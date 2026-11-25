let myName = localStorage.getItem('tc_name') || '';
if (!myName) {
  myName = (prompt('Ton pseudo ?') || 'Anonyme').trim() || 'Anonyme';
  localStorage.setItem('tc_name', myName);
}

let channels = [];
let currentChannel = null;
let lastTs = 0;
let pendingAgent = false;

const channelsEl = document.getElementById('channels');
const messagesEl = document.getElementById('messages');
const channelNameEl = document.getElementById('channel-name');
const channelBadgeEl = document.getElementById('channel-badge');
const typingEl = document.getElementById('typing');
const composer = document.getElementById('composer');
const input = document.getElementById('input');
const newChannelForm = document.getElementById('new-channel');
const newChannelName = document.getElementById('new-channel-name');
const meEl = document.getElementById('me');

meEl.textContent = myName;

document.getElementById('edit-name').addEventListener('click', () => {
  const n = (prompt('Nouveau pseudo ?', myName) || '').trim();
  if (n) {
    myName = n;
    localStorage.setItem('tc_name', myName);
    meEl.textContent = myName;
  }
});

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function appendMessage(msg) {
  const div = document.createElement('div');
  div.className = `msg msg-${msg.kind}`;
  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  const author = document.createElement('span');
  author.className = 'msg-author';
  author.textContent = msg.author;
  const time = document.createElement('span');
  time.className = 'msg-time';
  time.textContent = fmtTime(msg.ts);
  meta.append(author, time);
  const body = document.createElement('div');
  body.className = 'msg-body';
  body.textContent = msg.text;
  div.append(meta, body);
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  if (msg.ts > lastTs) lastTs = msg.ts;
  if (msg.kind !== 'user') pendingAgent = false;
  typingEl.classList.toggle('hidden', !pendingAgent);
}

async function renderChannels() {
  const res = await fetch('/api/channels');
  channels = await res.json();
  channelsEl.innerHTML = '';
  for (const c of channels) {
    const li = document.createElement('li');
    li.className = 'channel' + (c.id === currentChannel ? ' active' : '');
    const hash = document.createElement('span');
    hash.textContent = '#';
    const name = document.createElement('span');
    name.textContent = c.name;
    li.append(hash, name);
    if (c.type === 'agent') {
      const badge = document.createElement('span');
      badge.className = 'badge-agent';
      badge.textContent = 'IA';
      li.appendChild(badge);
    }
    li.addEventListener('click', () => selectChannel(c.id));
    channelsEl.appendChild(li);
  }
}

async function poll() {
  if (!currentChannel) return;
  try {
    const res = await fetch(`/api/channels/${currentChannel}/messages?since=${lastTs}&limit=200`);
    if (!res.ok) return;
    const messages = await res.json();
    for (const m of messages) appendMessage(m);
  } catch { /* réseau indisponible, on réessaiera au prochain cycle */ }
}

async function selectChannel(id) {
  currentChannel = id;
  lastTs = 0;
  pendingAgent = false;
  typingEl.classList.add('hidden');
  const res = await fetch(`/api/channels/${id}/messages?limit=200`);
  const messages = await res.json();
  messagesEl.innerHTML = '';
  for (const m of messages) appendMessage(m);
  const c = channels.find((ch) => ch.id === id);
  channelNameEl.textContent = c ? `# ${c.name}` : '—';
  channelBadgeEl.textContent = c && c.type === 'agent' ? 'salon de l’agent IA — chaque message lui est envoyé' : '';
  renderChannels();
  input.focus();
}

composer.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !currentChannel) return;
  input.value = '';
  const channel = channels.find((c) => c.id === currentChannel);
  const shouldAsk = channel && (channel.type === 'agent' || /@agent\b/i.test(text));
  if (shouldAsk) {
    pendingAgent = true;
    typingEl.classList.remove('hidden');
  }
  try {
    const res = await fetch(`/api/channels/${currentChannel}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: myName, text }),
    });
    if (!res.ok) throw new Error('envoi échoué');
    const { message, agentReply } = await res.json();
    appendMessage(message);
    if (agentReply) appendMessage(agentReply);
  } catch {
    pendingAgent = false;
    typingEl.classList.add('hidden');
    alert('Impossible d’envoyer le message');
  }
  input.focus();
});

newChannelForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = newChannelName.value.trim();
  if (!name) return;
  const res = await fetch('/api/channels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (res.ok) {
    newChannelName.value = '';
    const c = await res.json();
    await renderChannels();
    selectChannel(c.id);
  } else {
    const err = await res.json().catch(() => ({}));
    alert(err.error || 'Impossible de créer le salon');
  }
});

(async () => {
  await renderChannels();
  const first = channels.find((c) => c.type === 'chat') || channels[0];
  if (first) await selectChannel(first.id);
  setInterval(poll, 2000);
})();
