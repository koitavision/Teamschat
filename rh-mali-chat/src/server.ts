import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Mistral } from '@mistralai/mistralai';
import { SYSTEM_PROMPT } from './rh-mali-prompt.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  process.loadEnvFile(path.join(__dirname, '..', '.env'));
} catch {
  // .env facultatif : la clé peut aussi venir directement de l'environnement
}

const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.MISTRAL_MODEL || 'mistral-small-latest';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function sanitizeHistory(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (m): m is { role: unknown; content: unknown } =>
        typeof m === 'object' && m !== null && 'role' in m && 'content' in m,
    )
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: String(m.content).slice(0, 4000) }))
    .filter((m) => m.content.trim().length > 0)
    .slice(-20);
}

async function askMistral(history: ChatMessage[]): Promise<string> {
  if (process.env.MISTRAL_MOCK === '1') {
    const last = history.filter((m) => m.role === 'user').at(-1);
    return `[mock] Réponse à : « ${last ? last.content.slice(0, 120) : ''} »`;
  }
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY non définie (copie .env.example en .env et remplis-la)');
  }
  const client = new Mistral({ apiKey });
  const completion = await client.chat.complete({
    model: MODEL,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
    temperature: 0.3,
  });
  const content = completion.choices?.[0]?.message?.content ?? '';
  const text = Array.isArray(content)
    ? content.map((c) => (c.type === 'text' && 'text' in c ? String(c.text) : '')).join('')
    : content;
  return String(text).trim() || '(réponse vide)';
}

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (_req, res) => {
  const mock = process.env.MISTRAL_MOCK === '1';
  res.json({
    ok: true,
    model: MODEL,
    mock,
    configured: mock || Boolean(process.env.MISTRAL_API_KEY),
  });
});

app.post('/api/chat', async (req, res) => {
  const history = sanitizeHistory(req.body?.messages);
  if (history.length === 0) {
    return res.status(400).json({ error: 'Champ "messages" requis (tableau non vide de { role, content })' });
  }
  try {
    const reply = await askMistral(history);
    res.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    const status = /MISTRAL_API_KEY/.test(message) ? 500 : 502;
    res.status(status).json({ error: message });
  }
});

const isMain = process.argv[1] ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) : false;
if (isMain) {
  app.listen(PORT, () => {
    console.log(`Assistant RH Mali démarré sur http://localhost:${PORT}`);
    console.log(`Modèle : ${MODEL} | ${process.env.MISTRAL_MOCK === '1' ? 'mode mock' : process.env.MISTRAL_API_KEY ? 'API Mistral configurée (clé serveur uniquement)' : 'MISTRAL_API_KEY manquante (voir .env.example)'}`);
  });
}

export default app;
