const messagesEl = document.getElementById('messages');
const form = document.getElementById('composer');
const input = document.getElementById('input');
const send = document.getElementById('send');

const history = [];

function addBubble(role, text) {
  const div = document.createElement('div');
  div.className = `bubble ${role}`;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

addBubble(
  'assistant',
  "Bonjour ! Je suis votre assistant RH spécialisé dans le droit du travail malien : contrats (CDI/CDD, période d'essai), durée du travail, congés payés, salaire et SMIG, rupture du contrat, sécurité sociale (CMSS/INPS), harcèlement… Posez-moi votre question.",
);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  send.disabled = true;
  addBubble('user', text);
  const pending = addBubble('assistant', '…');
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [...history, { role: 'user', content: text }] }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    history.push({ role: 'user', content: text }, { role: 'assistant', content: data.reply });
    pending.textContent = data.reply;
  } catch (err) {
    pending.textContent = `Erreur : ${err.message}`;
    pending.classList.add('error');
  } finally {
    send.disabled = false;
    input.focus();
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
});
