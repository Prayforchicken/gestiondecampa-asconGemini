import type { CapacitorConfig } from '@capacitor/cli';

// App Android de comemos. La web compilada (dist/) va dentro de la APK: la app abre sin
// conexión y habla con el ordenador de casa (o con varios) por la red.
const config: CapacitorConfig = {
  appId: 'io.github.prayforchicken.comemos',
  appName: 'Comemos',
  webDir: 'dist',
  android: {
    // Los servidores de casa suelen ser http://192.168.x.x:8787 (sin HTTPS).
    allowMixedContent: true,
    // Android 15 dibuja bajo las barras del sistema: dejamos márgenes para que no se tapen.
    adjustMarginsForEdgeToEdge: 'force',
  },
  plugins: {
    // Las peticiones al servidor salen por la red nativa de Android: sin problemas de
    // CORS ni de «contenido mixto» al hablar con ordenadores de la red local.
    CapacitorHttp: { enabled: true },
  },
};

export default config;
