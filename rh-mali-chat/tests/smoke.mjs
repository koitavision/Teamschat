import { spawn } from 'node:child_process';

const PORT = 3111;
const server = spawn(process.execPath, ['dist/server.js'], {
  env: { ...process.env, MISTRAL_MOCK: '1', PORT: String(PORT) },
  stdio: 'pipe',
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(path, options) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`, options);
  return { status: res.status, body: await res.json() };
}

async function waitForServer(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
      if (res.ok) return;
    } catch {
      // serveur pas encore prêt
    }
    await wait(300);
  }
  throw new Error('Serveur non démarré dans le délai imparti');
}

try {
  await waitForServer();

  const health = await api('/api/health');
  if (health.status !== 200 || !health.body.ok || !health.body.mock || health.body.model !== 'mistral-small-latest') {
    throw new Error(`health KO: ${JSON.stringify(health.body)}`);
  }

  const chat = await api('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Durée légale du travail au Mali ?' }] }),
  });
  if (chat.status !== 200 || typeof chat.body.reply !== 'string' || !chat.body.reply.includes('mock')) {
    throw new Error(`chat KO: ${JSON.stringify(chat.body)}`);
  }

  const bad = await api('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [] }),
  });
  if (bad.status !== 400) throw new Error(`validation KO: status ${bad.status}`);

  const index = await fetch(`http://127.0.0.1:${PORT}/`);
  const html = await index.text();
  if (index.status !== 200 || !html.includes('Assistant RH Mali')) throw new Error('UI KO');

  console.log('smoke OK');
  process.exitCode = 0;
} catch (err) {
  console.error('smoke KO:', err.message);
  process.exitCode = 1;
} finally {
  server.kill();
}
