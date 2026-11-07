// Servidor estático mínimo com fallback de SPA (index.html) para o build do Angular.
// Uso: node scripts/demo/static-server.mjs <dir> [porta]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = process.argv[2];
const port = Number(process.argv[3] ?? 4200);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.ico': 'image/x-icon', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = join(root, path.includes('..') ? '/' : path);
  try {
    const data = await readFile(extname(file) ? file : join(root, 'index.html'));
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'text/html; charset=utf-8' });
    res.end(data);
  } catch {
    const data = await readFile(join(root, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  }
}).listen(port, '127.0.0.1', () => console.log(`static ${root} em :${port}`));
