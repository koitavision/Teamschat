const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
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

store.init();

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, agentConfigured: agent.configured(), mock: process.env.AGENT_MOCK === '1' });
});

app.get('/api/channels', (req, res) => {
  res.json(store.listChannels());
});

app.post('/api/channels', (req, res) => {
  try {
    const channel = store.createChannel(req.body && req.body.name, 'chat');
    io.emit('channel:new', channel);
    res.status(201).json(channel);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/channels/:id/messages', (req, res) => {
  const channel = store.getChannel(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Salon introuvable' });
  const limit = Math.min(parseInt(req.query.limit || '100', 10) || 100, 500);
  res.json(store.listMessages(channel.id, limit));
});

function toAgentHistory(channelId, limit) {
  return store
    .listMessages(channelId, limit)
    .map((m) => ({
      role: m.kind === 'agent' ? 'assistant' : 'user',
      content: `${m.author}: ${m.text}`,
    }));
}

async function handleUserMessage({ channelId, author, text }) {
  const channel = store.getChannel(channelId);
  if (!channel) return;
  const userMsg = store.addMessage(channelId, { author, kind: 'user', text });
  io.to(channelId).emit('message:new', userMsg);

  const shouldAskAgent = channel.type === 'agent' || /@agent\b/i.test(text);
  if (!shouldAskAgent) return;

  io.to(channelId).emit('agent:typing', { channelId, on: true });
  try {
    const reply = await agent.askAgent(toAgentHistory(channelId, 30));
    const replyMsg = store.addMessage(channelId, { author: 'Agent', kind: 'agent', text: reply });
    io.to(channelId).emit('message:new', replyMsg);
  } catch (err) {
    const sysMsg = store.addMessage(channelId, {
      author: 'Système',
      kind: 'system',
      text: `Agent indisponible : ${err.message}`,
    });
    io.to(channelId).emit('message:new', sysMsg);
  } finally {
    io.to(channelId).emit('agent:typing', { channelId, on: false });
  }
}

io.on('connection', (socket) => {
  socket.on('join', (channelId) => {
    if (store.getChannel(channelId)) socket.join(channelId);
  });
  socket.on('message:send', (payload) => {
    const channelId = String((payload && payload.channelId) || '');
    const author = String((payload && payload.author) || 'Anonyme').slice(0, 60);
    const text = String((payload && payload.text) || '').trim().slice(0, 4000);
    if (!channelId || !text) return;
    handleUserMessage({ channelId, author, text }).catch((err) => {
      console.error('handleUserMessage error:', err.message);
    });
  });
});

server.listen(PORT, () => {
  console.log(`Team chat démarré sur http://localhost:${PORT}`);
  console.log(`Agent IA : ${agent.configured() ? 'API Mistral configurée' : process.env.AGENT_MOCK === '1' ? 'mode mock' : 'NON configurée (définir MISTRAL_API_KEY)'}`);
});
