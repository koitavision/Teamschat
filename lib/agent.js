const API_URL = 'https://api.mistral.ai/v1/chat/completions';

const SYSTEM_PROMPT = [
  "Tu es l'agent IA de l'équipe. Tu participes aux conversations du salon #agent-ia.",
  'Réponds en français, de façon concise, utile et directe.',
  "Si on te pose une question hors sujet, ramène doucement la conversation vers l'équipe.",
].join(' ');

function configured() {
  return Boolean(process.env.MISTRAL_API_KEY);
}

async function askAgent(history) {
  if (process.env.AGENT_MOCK === '1') {
    const last = history.filter((m) => m.role === 'user').slice(-1)[0];
    return `[mock] Réponse de l'agent à : « ${last ? last.content.slice(0, 120) : ''} »`;
  }
  const key = process.env.MISTRAL_API_KEY;
  if (!key) {
    throw new Error('MISTRAL_API_KEY non définie (copie .env.example en .env et remplis-la)');
  }
  const model = process.env.MISTRAL_MODEL || 'mistral-small-latest';
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body && body.error && body.error.message ? ': ' + body.error.message : '';
    } catch { /* ignore */ }
    throw new Error(`API Mistral ${res.status}${detail}`);
  }
  const data = await res.json();
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return (content || '').trim() || '(réponse vide)';
}

module.exports = { askAgent, configured };
