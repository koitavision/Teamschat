# Team Chat

Application de chat pour une équipe : salons de discussion en temps réel + un salon dédié à un agent IA (API Mistral).

## Fonctionnalités

- Plusieurs salons (`#général`, `#agent-ia`, et ceux que vous créez)
- Messages en temps réel (Socket.IO), historique persisté sur disque (`data/db.json`)
- Dans le salon **#agent-ia**, chaque message est transmis à l'agent (Mistral) qui répond dans le salon
- Dans n'importe quel salon, mentionnez `@agent` pour invoquer l'agent
- Pseudo au choix (stocké localement dans le navigateur)

## Installation

```bash
npm install
cp .env.example .env   # puis remplis MISTRAL_API_KEY
npm start              # http://localhost:3000
```

La clé API reste côté serveur (variable d'environnement `MISTRAL_API_KEY`, jamais dans le code ni dans le front).

## Test sans clé API

```bash
AGENT_MOCK=1 npm start
```

L'agent répond alors par un message fictif, sans appel réseau.

## Structure

- `server.js` — serveur Express + Socket.IO, routes API, logique de messagerie
- `lib/store.js` — persistance JSON (salons + messages)
- `lib/agent.js` — appel à l'API Mistral (`/v1/chat/completions`)
- `public/` — front vanilla (HTML/CSS/JS)
