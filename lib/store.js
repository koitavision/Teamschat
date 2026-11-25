const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || (process.env.VERCEL ? '/tmp/team-chat-data' : path.join(__dirname, '..', 'data'));
const DB_FILE = path.join(DATA_DIR, 'db.json');
const MAX_MESSAGES_PER_CHANNEL = 2000;

let db = { channels: [], messages: [] };
let saveTimer = null;

function init() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } else {
    db.channels = [
      { id: 'general', name: 'général', type: 'chat', createdAt: Date.now() },
      { id: 'agent', name: 'agent-ia', type: 'agent', createdAt: Date.now() },
    ];
    persistNow();
  }
}

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

function listChannels() {
  return db.channels;
}

function getChannel(id) {
  return db.channels.find((c) => c.id === id) || null;
}

function createChannel(name, type = 'chat') {
  const slug = slugify(name);
  if (!slug) throw new Error('Nom de salon invalide');
  if (db.channels.some((c) => c.id === slug || c.name.toLowerCase() === slug)) {
    throw new Error('Ce salon existe déjà');
  }
  const channel = { id: slug, name: slug, type, createdAt: Date.now() };
  db.channels.push(channel);
  save();
  return channel;
}

function addMessage(channelId, { author, kind, text }) {
  const msg = {
    id: crypto.randomUUID(),
    channelId,
    author: String(author || 'Anonyme').slice(0, 60),
    kind: kind === 'agent' || kind === 'system' ? kind : 'user',
    text: String(text || '').slice(0, 4000),
    ts: Date.now(),
  };
  db.messages.push(msg);
  const channelMessages = db.messages.filter((m) => m.channelId === channelId);
  if (channelMessages.length > MAX_MESSAGES_PER_CHANNEL) {
    const excess = channelMessages.length - MAX_MESSAGES_PER_CHANNEL;
    const toRemove = new Set(channelMessages.slice(0, excess).map((m) => m.id));
    db.messages = db.messages.filter((m) => !toRemove.has(m.id));
  }
  save();
  return msg;
}

function listMessages(channelId, limit = 100) {
  return db.messages
    .filter((m) => m.channelId === channelId)
    .slice(-limit);
}

module.exports = { init, listChannels, getChannel, createChannel, addMessage, listMessages };
