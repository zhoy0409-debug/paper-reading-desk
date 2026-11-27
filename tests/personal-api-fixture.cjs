const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');

// A second loopback origin exercises real CORS and fetch with the reader's
// service worker active. Only the two paid destinations are redirected.
async function fixtureOrigin(origin, respond) {
  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization,content-type',
    'Access-Control-Allow-Methods': 'POST',
    'Content-Type': 'application/json'
  };
  async function handle(req, res) {
    const name = req.url.slice(1);
    if (req.headers.origin !== origin || !['deepseek','qwen'].includes(name)) {
      res.writeHead(403).end();
      return;
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, headers).end();
      return;
    }
    if (req.method !== 'POST') {
      res.writeHead(405).end();
      return;
    }
    try {
      const parts = [];
      for await (const part of req) parts.push(part);
      const reply = respond(name, req.headers.authorization, JSON.parse(Buffer.concat(parts)));
      res.writeHead(reply.status, headers).end(JSON.stringify(reply.json));
    } catch {
      res.writeHead(400, headers).end('{}');
    }
  }
  const tls = origin.startsWith('https:');
  const server = tls ? https.createServer({
    cert: fs.readFileSync(process.env.READER_TEST_CERT),
    key: fs.readFileSync(process.env.READER_TEST_KEY)
  }, handle) : http.createServer(handle);
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  return {
    origin: (tls ? 'https' : 'http') + '://127.0.0.1:' + server.address().port,
    close: () => new Promise(resolve => {server.close(resolve); server.closeAllConnections()})
  };
}

module.exports = {fixtureOrigin};
