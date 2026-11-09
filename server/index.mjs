#!/usr/bin/env node
// Servidor del hogar. Sin dependencias: solo Node.js 22+.
//
// - Guarda, para cada hogar, una «foto inicial» (genesis) y la lista ordenada de operaciones.
// - Cada móvil envía sus operaciones nuevas y recibe las de los demás (POST /sync).
// - También sirve la app compilada (carpeta dist/) para abrirla desde el navegador.
//
// Uso:  npm run build && npm start      (puerto 8787 por defecto)
// Variables de entorno opcionales:
//   PORT=8787                  Puerto.
//   DATA_DIR=./data            Dónde se guardan los hogares. ¡Haz copias de esta carpeta!
//   CREATE_TOKEN=algo-secreto  Si se define, hace falta para crear hogares nuevos.
import { createServer } from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = resolve(process.env.DATA_DIR || join(ROOT, 'data'));
const DIST = resolve(process.env.DIST_DIR || join(ROOT, 'dist'));
const CREATE_TOKEN = process.env.CREATE_TOKEN || '';
const MAX_BODY = 1_500_000; // operaciones y foto inicial
const MAX_OPS_PER_SYNC = 500;

mkdirSync(DATA_DIR, { recursive: true });

// ---------- Almacenamiento ----------
// data/<id>/meta.json     nombre, hash de la clave, fecha
// data/<id>/genesis.json  estado inicial
// data/<id>/ops.jsonl     una operación por línea (solo se añade, nunca se reescribe)

/** @type {Map<string, {meta: any, ops: {seq:number, op:any}[], ids: Set<string>}>} */
const cache = new Map();
const validId = (id) => typeof id === 'string' && /^[a-z0-9]{10,40}$/.test(id);
const dirOf = (id) => join(DATA_DIR, id);
const sha256 = (s) => createHash('sha256').update(s).digest();

function writeAtomic(file, data) {
  const tmp = file + '.tmp';
  writeFileSync(tmp, data);
  renameSync(tmp, file);
}

function loadHousehold(id) {
  if (!validId(id)) return null;
  if (cache.has(id)) return cache.get(id);
  const dir = dirOf(id);
  if (!existsSync(join(dir, 'meta.json'))) return null;
  const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
  const ops = [];
  const ids = new Set();
  const file = join(dir, 'ops.jsonl');
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        ops.push(entry);
        ids.add(entry.op.id);
      } catch {
        // Una línea a medias (corte de luz) se ignora.
      }
    }
  }
  const h = { meta, ops, ids };
  cache.set(id, h);
  return h;
}

function checkAuth(req, h) {
  const header = req.headers.authorization || '';
  const secret = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!secret) return false;
  const expected = Buffer.from(h.meta.secretHash, 'hex');
  const given = sha256(secret);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// ---------- HTTP ----------

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Create-Token',
  'Access-Control-Max-Age': '86400',
};

function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'string' || Buffer.isBuffer(body) ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...CORS,
    ...headers,
  });
  res.end(data);
}

const fail = (res, status, message) => send(res, status, { error: message });

function readBody(req, limit) {
  return new Promise((ok, ko) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        ko(Object.assign(new Error('Demasiados datos.'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        ok(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        ko(Object.assign(new Error('JSON no válido.'), { status: 400 }));
      }
    });
    req.on('error', ko);
  });
}

const isOp = (op) =>
  op && typeof op === 'object' && typeof op.id === 'string' && op.id.length <= 120 && typeof op.type === 'string' && op.type.length <= 40;

async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', 'households', id, action]

  if (parts[1] === 'health') return send(res, 200, { ok: true, app: 'comemos', createNeedsToken: Boolean(CREATE_TOKEN) });

  if (parts[1] !== 'households') return fail(res, 404, 'Ruta desconocida.');

  // Crear hogar
  if (parts.length === 2 && req.method === 'POST') {
    if (CREATE_TOKEN && req.headers['x-create-token'] !== CREATE_TOKEN) return fail(res, 403, 'Este servidor necesita un código para crear hogares.');
    const body = await readBody(req, MAX_BODY);
    if (!body.genesis || typeof body.genesis !== 'object' || body.genesis.version !== 2) return fail(res, 400, 'Falta el estado inicial del hogar.');
    const id = randomBytes(12).toString('hex');
    const secret = randomBytes(24).toString('base64url');
    const dir = dirOf(id);
    mkdirSync(dir, { recursive: true });
    const meta = { id, name: String(body.name || 'Hogar').slice(0, 60), secretHash: sha256(secret).toString('hex'), createdAt: new Date().toISOString() };
    writeAtomic(join(dir, 'genesis.json'), JSON.stringify(body.genesis));
    writeAtomic(join(dir, 'meta.json'), JSON.stringify(meta));
    cache.set(id, { meta, ops: [], ids: new Set() });
    return send(res, 201, { id, secret });
  }

  const id = parts[2];
  const h = loadHousehold(id);
  if (!h) return fail(res, 404, 'Hogar no encontrado.');
  if (!checkAuth(req, h)) return fail(res, 401, 'Clave del hogar incorrecta.');
  const action = parts[3] || '';

  // Descargar todo (al unirse desde un móvil nuevo)
  if (action === '' && req.method === 'GET') {
    const genesis = JSON.parse(readFileSync(join(dirOf(id), 'genesis.json'), 'utf8'));
    return send(res, 200, { name: h.meta.name, genesis, ops: h.ops, seq: h.ops.length});
  }

  // Sincronizar: recibe operaciones nuevas y devuelve todas las posteriores a `since`
  if (action === 'sync' && req.method === 'POST') {
    const body = await readBody(req, MAX_BODY);
    const since = Number.isInteger(body.since) && body.since >= 0 ? body.since : 0;
    const incoming = Array.isArray(body.ops) ? body.ops : [];
    if (incoming.length > MAX_OPS_PER_SYNC) return fail(res, 413, 'Demasiadas operaciones de una vez.');
    if (!incoming.every(isOp)) return fail(res, 400, 'Operación con formato no válido.');
    const lines = [];
    for (const op of incoming) {
      if (h.ids.has(op.id)) continue; // ya recibida (reintento)
      const entry = { seq: h.ops.length + 1, op, receivedAt: new Date().toISOString() };
      h.ops.push(entry);
      h.ids.add(op.id);
      lines.push(JSON.stringify(entry));
    }
    if (lines.length) appendFileSync(join(dirOf(id), 'ops.jsonl'), lines.join('\n') + '\n');
    return send(res, 200, { seq: h.ops.length, ops: h.ops.slice(since)});
  }

  return fail(res, 404, 'Ruta desconocida.');
}

// ---------- Archivos estáticos (la app) ----------

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(req, res, url) {
  if (!existsSync(join(DIST, 'index.html'))) return send(res, 200, 'Servidor del hogar en marcha. Compila la app con «npm run build» para servirla aquí.');
  let path;
  try {
    path = normalize(decodeURIComponent(url.pathname));
  } catch {
    return fail(res, 400, 'Ruta no válida.');
  }
  let file = resolve(join(DIST, path));
  if (!file.startsWith(DIST + sep) && file !== DIST) return fail(res, 403, 'No permitido.');
  if (existsSync(file) && statSync(file).isDirectory() && existsSync(join(file, 'index.html'))) file = join(file, 'index.html'); // p. ej. /guia/
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html'); // la app decide la pantalla
  const type = TYPES[extname(file)] || 'application/octet-stream';
  const immutable = file.includes(`${sep}assets${sep}`);
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(readFileSync(file));
}

export function createApp() {
  return createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    try {
      if (req.method === 'OPTIONS') return send(res, 204, '');
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'Método no permitido.');
      return serveStatic(req, res, url);
    } catch (e) {
      const status = e && e.status ? e.status : 500;
      if (status === 500) console.error(e);
      return fail(res, status, status === 500 ? 'Error interno del servidor.' : e.message);
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createApp().listen(PORT, () => {
    const households = readdirSync(DATA_DIR).filter(validId).length;
    console.log(`🏠 Servidor del hogar en http://localhost:${PORT}  ·  ${households} hogar(es)  ·  datos en ${DATA_DIR}`);
    if (!existsSync(join(DIST, 'index.html'))) console.log('   (Aún no hay app compilada: ejecuta «npm run build».)');
  });
}
