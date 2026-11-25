process.env.KV_REST_API_URL = 'http://fake-kv.local';
process.env.KV_REST_API_TOKEN = 'fake-token';

const store = require('../lib/store');

function makeFakeKV() {
  const strings = new Map();
  const lists = new Map();
  const slice = (l, s, e) => {
    const n = l.length;
    const start = s < 0 ? n + s : s;
    const stop = e < 0 ? n + e : e;
    return l.slice(start, stop + 1);
  };
  return {
    async get(k) { return strings.has(k) ? strings.get(k) : null; },
    async set(k, v) { strings.set(k, v); },
    async rpush(k, ...vals) { const l = lists.get(k) || []; l.push(...vals); lists.set(k, l); return l.length; },
    async lrange(k, s, e) { return slice(lists.get(k) || [], s, e); },
    async llen(k) { return (lists.get(k) || []).length; },
    async ltrim(k, s, e) { lists.set(k, slice(lists.get(k) || [], s, e)); },
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg);
}

async function main() {
  assert(store._useKV() === true, 'useKV devrait être actif avec les env KV définies');
  store._setKvClient(makeFakeKV());

  await store.init();
  let channels = await store.listChannels();
  assert(channels.length === 2, 'salons par défaut créés');
  assert(channels.some((c) => c.type === 'agent'), 'salon agent présent');

  await store.init();
  channels = await store.listChannels();
  assert(channels.length === 2, 'init idempotent (pas de doublon)');

  const c = await store.createChannel('Projet Apollo');
  assert(c.id === 'projet-apollo', 'slug ok: ' + c.id);
  let dup = false;
  try { await store.createChannel('projet-apollo'); } catch { dup = true; }
  assert(dup, 'doublon refusé');

  for (let i = 1; i <= 5; i++) {
    await store.addMessage('projet-apollo', { author: 'T' + i, kind: 'user', text: 'msg ' + i });
  }
  const all = await store.listMessages('projet-apollo', 100);
  assert(all.length === 5, '5 messages stockés');
  const last3 = await store.listMessages('projet-apollo', 3);
  assert(last3.length === 3 && last3[2].text === 'msg 5', 'limite = derniers messages');

  const ch = await store.getChannel('general');
  assert(ch && ch.type === 'chat', 'getChannel ok');
  assert((await store.getChannel('inexistant')) === null, 'getChannel inconnu = null');

  console.log('KV STORE TEST OK');
  process.exit(0);
}

main().catch((err) => {
  console.error('KV STORE TEST FAILED:', err.message);
  process.exit(1);
});
