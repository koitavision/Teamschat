const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const store = require('./lib/store');
const agent = require('./lib/agent');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
loadEnv(path.join(__dirname, '.env'));

const PORT = process.env.PORT || 3000;

store.init().catch((err) => {
  console.error('init store failed:', err.message);
  process.exit(1);
});

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    agentConfigured: agent.configured(),
    mock: process.env.AGENT_MOCK === '1',
    storage: store._useKV() ? 'kv' : 'file',
  });
});

app.get('/api/channels', async (req, res) => {
  res.json(await store.listChannels());
});

app.post('/api/channels', async (req, res) => {
  try {
    const channel = await store.createChannel(req.body && req.body.name, 'chat');
    res.status(201).json(channel);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/channels/:id/messages', async (req, res) => {
  const channel = await store.getChannel(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Salon introuvable' });
  const limit = Math.min(parseInt(req.query.limit || '200', 10) || 200, 500);
  const since = parseInt(req.query.since || '0', 10) || 0;
  let messages = await store.listMessages(channel.id, limit);
  if (since) messages = messages.filter((m) => m.ts > since);
  res.json(messages);
});

async function toAgentHistory(channelId, limit) {
  const messages = await store.listMessages(channelId, limit);
  return messages.map((m) => ({
    role: m.kind === 'agent' ? 'assistant' : 'user',
    content: `${m.author}: ${m.text}`,
  }));
}

app.post('/api/channels/:id/messages', async (req, res) => {
  const channel = await store.getChannel(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Salon introuvable' });
  const author = String((req.body && req.body.author) || 'Anonyme').slice(0, 60);
  const text = String((req.body && req.body.text) || '').trim().slice(0, 4000);
  if (!text) return res.status(400).json({ error: 'Message vide' });

  const message = await store.addMessage(channel.id, { author, kind: 'user', text });

  let agentReply = null;
  const shouldAskAgent = channel.type === 'agent' || /@agent\b/i.test(text);
  if (shouldAskAgent) {
    try {
      const reply = await agent.askAgent(await toAgentHistory(channel.id, 30));
      agentReply = await store.addMessage(channel.id, { author: 'Agent', kind: 'agent', text: reply });
    } catch (err) {
      agentReply = await store.addMessage(channel.id, {
        author: 'Système',
        kind: 'system',
        text: `Agent indisponible : ${err.message}`,
      });
    }
  }

  res.status(201).json({ message, agentReply });
});

if (require.main === module) {
  const server = http.createServer(app);
  server.listen(PORT, () => {
    console.log(`Team chat démarré sur http://localhost:${PORT}`);
    console.log(`Stockage : ${store._useKV() ? 'Vercel KV' : 'fichier (' + (process.env.VERCEL ? '/tmp' : 'data/') + ')'}`);
    console.log(`Agent IA : ${agent.configured() ? 'API Mistral configurée' : process.env.AGENT_MOCK === '1' ? 'mode mock' : 'NON configurée (définir MISTRAL_API_KEY)'}`);
  });
}

module.exports = app;
