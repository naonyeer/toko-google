const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function send(res, status, body, contentType) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function safePathname(urlPath) {
  const decoded = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath);
  const resolved = path.normalize(path.join(ROOT, decoded));
  if (!resolved.startsWith(ROOT)) return null;
  return resolved;
}

function proxyRequest(req, res, parsedUrl) {
  const target = parsedUrl.searchParams.get('target');
  const action = parsedUrl.searchParams.get('action') || '';

  if (!target) {
    send(res, 400, JSON.stringify({ status: 'error', message: 'Proxy target is missing.' }), 'application/json; charset=utf-8');
    return;
  }

  let upstream;
  try {
    upstream = new URL(target);
  } catch (error) {
    send(res, 400, JSON.stringify({ status: 'error', message: 'Proxy target URL is invalid.' }), 'application/json; charset=utf-8');
    return;
  }

  const requestUrl = new URL(upstream.toString());
  if (action) requestUrl.searchParams.set('action', action);

  let body = '';
  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', async () => {
    try {
      const upstreamResponse = await fetch(requestUrl, {
        method: req.method,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: req.method === 'POST' ? body : undefined,
        redirect: 'follow'
      });

      const text = await upstreamResponse.text();
      send(res, upstreamResponse.status, text, upstreamResponse.headers.get('content-type') || 'text/plain; charset=utf-8');
    } catch (error) {
      send(res, 502, JSON.stringify({ status: 'error', message: 'Proxy request failed: ' + error.message }), 'application/json; charset=utf-8');
    }
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  if (parsedUrl.pathname === '/api') {
    proxyRequest(req, res, parsedUrl);
    return;
  }

  const filePath = safePathname(parsedUrl.pathname);
  if (!filePath) {
    send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      send(res, 404, 'Not found', 'text/plain; charset=utf-8');
      return;
    }

    send(res, 200, content, MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
  });
});

server.listen(PORT, HOST, () => {
  console.log(`My Kedai server running at http://${HOST}:${PORT}`);
});
