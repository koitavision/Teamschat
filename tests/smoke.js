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

  const post = (channelId, body) =>
    fetch(`${BASE}/api/channels/${channelId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json());

  const r1 = await post(agent.id, { author: 'Test', text: 'Bonjour agent !' });
  if (!r1.message || r1.message.kind !== 'user') throw new Error('message utilisateur non créé');
  if (!r1.agentReply || r1.agentReply.kind !== 'agent') throw new Error('aucune réponse de l’agent');
  console.log('agent reply:', r1.agentReply.text.slice(0, 60));

  const r2 = await post(chat.id, { author: 'Léa', text: 'Hello @agent stp' });
  if (!r2.agentReply) throw new Error('la mention @agent devrait déclencher l’agent');

  const r3 = await post(chat.id, { author: 'Léa', text: 'message simple' });
  if (r3.agentReply) throw new Error('pas de réponse agent attendue ici');

  const since = r3.message.ts;
  const fresh = await (await fetch(`${BASE}/api/channels/${chat.id}/messages?since=${since}&limit=50`)).json();
  if (fresh.length !== 0) throw new Error('le filtre since ne fonctionne pas');

  const history = await (await fetch(`${BASE}/api/channels/${agent.id}/messages?limit=50`)).json();
  if (history.length < 2) throw new Error('historique non persisté');
  console.log('historique ok:', history.length, 'messages');

  const index = await (await fetch(`${BASE}/`)).text();
  if (!index.includes('Team Chat')) throw new Error('front non servi');

  console.log('SMOKE TEST OK');
  process.exit(0);
}

main().catch((err) => {
  console.error('SMOKE TEST FAILED:', err.message);
  process.exit(1);
});
