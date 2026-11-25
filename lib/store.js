const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || (process.env.VERCEL ? '/tmp/team-chat-data' : path.join(__dirname, '..', 'data'));
const DB_FILE = path.join(DATA_DIR, 'db.json');
const MAX_MESSAGES_PER_CHANNEL = 2000;
const CHANNELS_KEY = 'tc:channels';
const messagesKey = (channelId) => `tc:messages:${channelId}`;

const useKV = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

let kvClient = null;
function kv() {
  if (!kvClient) {
    const mod = require('@vercel/kv');
    kvClient = mod.kv;
  }
  return kvClient;
}

function defaultChannels() {
  return [
    { id: 'general', name: 'général', type: 'chat', createdAt: Date.now() },
    { id: 'agent', name: 'agent-ia', type: 'agent', createdAt: Date.now() },
  ];
}

let db = { channels: [], messages: [] };
let saveTimer = null;

function persistNow() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { persistNow(); } catch (err) { console.error('persist error:', err.message); }
  }, 100);
}

function slugify(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

async function init() {
  if (useKV) {
    const existing = await kv().get(CHANNELS_KEY);
    if (!existing) await kv().set(CHANNELS_KEY, defaultChannels());
    return;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } else {
    db.channels = defaultChannels();
    persistNow();
  }
}

async function listChannels() {
  if (useKV) return (await kv().get(CHANNELS_KEY)) || [];
  return db.channels;
}

async function getChannel(id) {
  const channels = await listChannels();
  return channels.find((c) => c.id === id) || null;
}

async function createChannel(name, type = 'chat') {
  const slug = slugify(name);
  if (!slug) throw new Error('Nom de salon invalide');
  const channels = await listChannels();
  if (channels.some((c) => c.id === slug || c.name.toLowerCase() === slug)) {
    throw new Error('Ce salon existe déjà');
  }
  const channel = { id: slug, name: slug, type, createdAt: Date.now() };
  if (useKV) {
    channels.push(channel);
    await kv().set(CHANNELS_KEY, channels);
  } else {
    db.channels.push(channel);
    save();
  }
  return channel;
}

async function addMessage(channelId, { author, kind, text }) {
  const msg = {
    id: crypto.randomUUID(),
    channelId,
    author: String(author || 'Anonyme').slice(0, 60),
    kind: kind === 'agent' || kind === 'system' ? kind : 'user',
    text: String(text || '').slice(0, 4000),
    ts: Date.now(),
  };
  if (useKV) {
    const key = messagesKey(channelId);
    await kv().rpush(key, msg);
    const len = await kv().llen(key);
    if (len > MAX_MESSAGES_PER_CHANNEL) await kv().ltrim(key, len - MAX_MESSAGES_PER_CHANNEL, -1);
  } else {
    db.messages.push(msg);
    const channelMessages = db.messages.filter((m) => m.channelId === channelId);
    if (channelMessages.length > MAX_MESSAGES_PER_CHANNEL) {
      const excess = channelMessages.length - MAX_MESSAGES_PER_CHANNEL;
      const toRemove = new Set(channelMessages.slice(0, excess).map((m) => m.id));
      db.messages = db.messages.filter((m) => !toRemove.has(m.id));
    }
    save();
  }
  return msg;
}

async function listMessages(channelId, limit = 100) {
  if (useKV) {
    const arr = await kv().lrange(messagesKey(channelId), -limit, -1);
    return arr || [];
  }
  return db.messages.filter((m) => m.channelId === channelId).slice(-limit);
}

module.exports = {
  init,
  listChannels,
  getChannel,
  createChannel,
  addMessage,
  listMessages,
  _setKvClient: (client) => { kvClient = client; },
  _useKV: () => useKV,
};
