#!/usr/bin/env node
// Compila la APK de Android: web → Capacitor → Gradle → apk/comemos-<versión>.apk
// Uso: npm run android:apk            (APK firmada si existe android/keystore.properties)
//      npm run android:apk -- debug   (APK de pruebas, firmada con la clave de depuración)
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const android = join(root, 'android');
const debug = process.argv.includes('debug');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit' });

if (!process.env.ANDROID_HOME && !existsSync(join(android, 'local.properties'))) {
  console.error('Falta el SDK de Android. Instala Android Studio (o las «command line tools») y define ANDROID_HOME.');
  process.exit(1);
}
const signed = existsSync(join(android, 'keystore.properties')) || process.env.COMEMOS_KEYSTORE_FILE;
if (!debug && !signed) console.warn('⚠️  Sin android/keystore.properties: la APK de «release» saldrá SIN firmar y Android no la instalará. Usa «-- debug» o crea la clave (ver README).');

run('npm run build');
run('npx cap sync android');
const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
run(`${gradle} ${debug ? 'assembleDebug' : 'assembleRelease'} --no-daemon`, android);

const kind = debug ? 'debug' : 'release';
const built = join(android, 'app', 'build', 'outputs', 'apk', kind, `app-${kind}${!debug && !signed ? '-unsigned' : ''}.apk`);
mkdirSync(join(root, 'apk'), { recursive: true });
const out = join(root, 'apk', `comemos-${version}${debug ? '-debug' : ''}.apk`);
copyFileSync(built, out);
console.log(`\n✅ APK lista: ${out}`);
