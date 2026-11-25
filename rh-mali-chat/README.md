# Assistant RH Mali (`rh-mali-chat`)

App web **minimale en TypeScript** qui appelle l'API Mistral avec le **SDK TypeScript officiel** [`@mistralai/mistralai`](https://www.npmjs.com/package/@mistralai/mistralai), avec une interface de chat simple.

L'assistant est spécialisé dans la **gestion des ressources humaines et le droit du travail au Mali** : contrats (CDI/CDD, période d'essai), durée du travail (40 h), congés payés, salaire et SMIG, rupture du contrat, représentation du personnel, sécurité sociale (CMSS/INPS), harcèlement, contentieux du travail, etc. (voir `src/rh-mali-prompt.ts`).

- Modèle : `mistral-small-latest` (modifiable via `MISTRAL_MODEL`)
- `MISTRAL_API_KEY` reste **côté serveur uniquement** (variable d'environnement / `.env`, jamais exposée au navigateur)

## Installation

```bash
cd rh-mali-chat
npm install
```

## Configuration

```bash
cp .env.example .env
# puis édite .env et renseigne ta clé :
# MISTRAL_API_KEY=ta-cle-mistral
```

Crée une clé API sur [console.mistral.ai](https://console.mistral.ai) (menu « API keys »).

## Lancer en local

```bash
# mode développement (rechargement automatique)
npm run dev

# ou mode production
npm run build
npm start
```

Puis ouvre <http://localhost:3000>.

Sans clé API, pour tester l'app localement : `MISTRAL_MOCK=1 npm run dev` (réponses fictives, aucun appel réseau).

## Test

```bash
npm test   # compile (tsc) + smoke test HTTP en mode mock, sans clé API
```

## Structure

- `src/server.ts` — serveur Express : sert `public/` et expose `POST /api/chat` (appelle le SDK Mistral avec le system prompt RH Mali) + `GET /api/health`
- `src/rh-mali-prompt.ts` — system prompt spécialisé RH / droit du travail malien (Loi n° 92-020 modifiée, etc.)
- `public/` — interface de chat vanilla (HTML/CSS/JS), l'historique est renvoyé à chaque requête et le system prompt n'est ajouté que côté serveur
- `tests/smoke.mjs` — test de bout en bout en mode mock

## Précision importante

Aucun modèle n'est « entraîné » ou fine-tuné ici : la spécialisation vient du **system prompt** envoyé à chaque requête. Pour aller plus loin (grande base documentaire interne, comportements figés), il faudrait créer un agent avec instructions sur la Plateforme Mistral ou fine-tuner un modèle — hors périmètre de cette app minimale.
