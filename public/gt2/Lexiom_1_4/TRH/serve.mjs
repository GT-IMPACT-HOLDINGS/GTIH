#!/usr/bin/env node
/**
 * Serve TheReasoningHub on a separate origin with COOP/COEP.
 * Also serves Lexiom 1.4 SDK/core/embeds from the parent folder at /sdk /core /embeds
 * so COEP pages do not need cross-origin script CORP from GT3.
 *
 * Usage: node serve.mjs [port]
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRH_ROOT = __dirname;
const LEXIOM14_ROOT = path.join(__dirname, '..');
const PORT = parseInt(process.argv[2] || process.env.TRH_PORT || '4173', 10);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function isolationHeaders(type) {
  return {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin'
  };
}

function send(res, status, body, type) {
  const headers = isolationHeaders(type);
  headers['Content-Length'] = Buffer.byteLength(body);
  res.writeHead(status, headers);
  res.end(body);
}

function resolveFile(urlPath) {
  let rel = urlPath === '/' ? '/index.html' : urlPath;
  if (rel.includes('..')) return null;

  if (rel.startsWith('/sdk/') || rel.startsWith('/core/') || rel.startsWith('/embeds/')) {
    const filePath = path.join(LEXIOM14_ROOT, rel.slice(1));
    if (!filePath.startsWith(LEXIOM14_ROOT)) return null;
    return filePath;
  }

  const filePath = path.join(TRH_ROOT, rel);
  if (!filePath.startsWith(TRH_ROOT)) return null;
  return filePath;
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const filePath = resolveFile(urlPath);
  if (!filePath) {
    send(res, 400, 'Bad path');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, 'Not found: ' + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, TYPES[ext] || 'application/octet-stream');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('TRH listening on http://127.0.0.1:' + PORT + '/');
  console.log('COOP: same-origin | COEP: require-corp');
  console.log('SDK served same-origin at /sdk /core /embeds');
  console.log('Point Settings → Lexiom base URL at GT3 (default http://localhost:8080)');
});
