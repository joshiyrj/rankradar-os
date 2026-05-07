import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { routeRequest } from '../src/router.js';
import { createServer } from '../src/server.js';

function req(path, method = 'GET') {
  return { url: path, method, headers: {}, on() {} };
}

test('health route proxies worker status', async () => {
  const worker = http.createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ ok: true, service: 'worker' }));
  });
  worker.listen(0);
  await once(worker, 'listening');
  const port = worker.address().port;
  const result = await routeRequest(req('/api/health'), { pythonServiceUrl: `http://127.0.0.1:${port}` });
  assert.equal(result.ok, true);
  assert.equal(result.worker.service, 'worker');
  worker.close();
});

test('unknown route throws 404', async () => {
  await assert.rejects(() => routeRequest(req('/api/missing'), { pythonServiceUrl: 'http://127.0.0.1:1' }), /Route not found/);
});

test('server responds with cors preflight', async () => {
  const server = createServer({ pythonServiceUrl: 'http://127.0.0.1:1', allowedOrigins: ['http://localhost:5173'], rateLimitPerMinute: 10 });
  server.listen(0);
  await once(server, 'listening');
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/api/health`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } });
  assert.equal(response.status, 204);
  server.close();
});
