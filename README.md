# Team Chat

Application de chat pour une équipe : salons de discussion + un salon dédié à un agent IA (API Mistral).

Compatible **Vercel** (fonctions serverless + polling HTTP) et tout hébergeur Node classique.

## Fonctionnalités

- Plusieurs salons (`#général`, `#agent-ia`, et ceux que vous créez)
- Messages quasi temps réel (polling toutes les 2 s — compatible serverless)
- Dans le salon **#agent-ia**, chaque message est transmis à l'agent (Mistral) qui répond dans le salon
- Dans n'importe quel salon, mentionnez `@agent` pour invoquer l'agent
- Pseudo au choix (stocké localement dans le navigateur)

## Lancement en local

```bash
npm install
cp .env.example .env   # puis remplis MISTRAL_API_KEY
npm start              # http://localhost:3000
```

Test sans clé API : `AGENT_MOCK=1 npm start` (l'agent répond par un message fictif).

## Assistant RH Mali (`rh-mali-chat/`)

Seconde app, autonome et minimale, en **TypeScript** avec le **SDK officiel** `@mistralai/mistralai` : interface de chat avec un assistant spécialisé en **RH et droit du travail malien** (modèle `mistral-small-latest`, `MISTRAL_API_KEY` côté serveur uniquement).

```bash
cd rh-mali-chat
npm install
cp .env.example .env   # puis remplis MISTRAL_API_KEY
npm run dev             # http://localhost:3000
```

Détail et commandes : voir `rh-mali-chat/README.md`.

## Déploiement sur Vercel

1. Importer le dépôt sur [vercel.com](https://vercel.com) (le fichier `vercel.json` + le dossier `api/` sont détectés automatiquement ; aucun build command nécessaire).
2. Dans les **Settings → Environment Variables** du projet Vercel, ajouter `MISTRAL_API_KEY` (et éventuellement `MISTRAL_MODEL`).
3. Redéployer.

Notes :
- La clé API reste côté serveur (variable d'environnement, jamais dans le code ni dans le front).
- **Persistance durable** : dans le dashboard Vercel, onglet **Storage → Create Database → KV**, puis connecte-la au projet : les variables `KV_REST_API_URL` et `KV_REST_API_TOKEN` sont injectées automatiquement et l'app stocke alors salons + messages dans Redis (les 2000 derniers messages par salon sont conservés). Sans KV, sur Vercel l'app écrit dans `/tmp` (perdu au redémarrage à froid) ; en local elle écrit dans `data/`.
- Le front interroge le serveur toutes les 2 s (`GET /api/channels/:id/messages?since=...`) : pas de WebSocket, ce que Vercel ne supporte pas en serverless.

## Structure

- `server.js` — app Express (exportée pour Vercel via `api/[...path].js`), routes API, logique agent ; `listen` uniquement en local
- `api/[...path].js` — point d'entrée serverless Vercel
- `vercel.json` — redirige `/api/*` vers la fonction
- `lib/store.js` — persistance JSON (dossier `data/` en local, `/tmp` sur Vercel)
- `lib/agent.js` — appel à l'API Mistral (`/v1/chat/completions`)
- `public/` — front vanilla (HTML/CSS/JS, polling)
- `tests/smoke.js` — test de bout en bout en HTTP pur
