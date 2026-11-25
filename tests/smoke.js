const { io } = require('socket.io-client');

const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function main() {
  const health = await (await fetch(`${BASE}/api/health`)).json();
  console.log('health:', JSON.stringify(health));
  if (!health.ok) throw new Error('health check failed');

  const channels = await (await fetch(`${BASE}/api/channels`)).json();
  console.log('channels:', channels.map((c) => `${c.id}(${c.type})`).join(', '));
  const agent = channels.find((c) => c.type === 'agent');
  const chat = channels.find((c) => c.type === 'chat');
  if (!agent || !chat) throw new Error('salons par défaut manquants');

  const created = await fetch(`${BASE}/api/channels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'test-auto' }),
  });
  console.log('create channel status:', created.status);
  if (created.status !== 201) throw new Error('création de salon échouée');

  const socket = io(BASE);
  const received = [];
  let typingSeen = false;
  socket.on('message:new', (m) => received.push(m));
  socket.on('agent:typing', ({ on }) => { if (on) typingSeen = true; });

  await new Promise((resolve) => socket.on('connect', resolve));
  socket.emit('join', agent.id);
  socket.emit('message:send', { channelId: agent.id, author: 'Test', text: 'Bonjour agent !' });

  await new Promise((resolve) => setTimeout(resolve, 2500));
  socket.close();

  console.log('messages reçus:', received.map((m) => `${m.kind}:${m.author}:${m.text.slice(0, 40)}`).join(' | '));
  const userMsg = received.find((m) => m.kind === 'user');
  const agentMsg = received.find((m) => m.kind === 'agent' || m.kind === 'system');
  if (!userMsg) throw new Error('message utilisateur non reçu');
  if (!agentMsg) throw new Error('aucune réponse de l’agent reçue');
  if (!typingSeen) throw new Error('indicateur "agent écrit" non reçu');

  const history = await (await fetch(`${BASE}/api/channels/${agent.id}/messages?limit=50`)).json();
  if (history.length < 2) throw new Error('historique non persisté');
  console.log('historique ok:', history.length, 'messages');

  console.log('SMOKE TEST OK');
  process.exit(0);
}

main().catch((err) => {
  console.error('SMOKE TEST FAILED:', err.message);
  process.exit(1);
});
