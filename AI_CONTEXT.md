# AI_CONTEXT

## Purpose
- Backend context for AE2 Authors API and integration points with the frontend.

## Backend (d:\dev\ae2-web\ae2-authors-api)
### Stack
- Node.js + Express
- MongoDB + Mongoose
- Auth: JWT (middlewares/auth + login controller)
- Validation: celebrate/joi
- Security: helmet, cors, rate limiter

### Key folders
- `routes`: route registration
- `controllers`: request handlers
- `models`: Mongoose schemas
- `services`: domain logic (subscriptions, etc.)
- `middlewares`: auth, logging, rate limiting
- `utils`: constants, validators, errors

### Entry points
- Server: `app.js`
- Router: `routes/index.js`
- Config: `config.js` (PORT/BASE_PATH/DB_CONN)

## Integration points (Backend <-> Frontend)
### Base URL and ports
- Defaults: `PORT=5000`, `BASE_PATH=localhost` (`config.js`)
- Frontend expects base URL via `REACT_APP_API_BASE_URL`

### API paths used by frontend
- Auth
  - `POST /signin`
  - `GET /users/me`
- Artifacts
  - `POST /artifact/ai`
  - `POST /artifact/ai/history` (auth)
  - `POST /artifact/images/search`
  - `GET /artifact/history` (auth)
  - `POST /artifact/history` (auth)
  - `GET /artifact/history/:id` (auth)
  - `PATCH /artifact/history/:id` (auth)
  - `DELETE /artifact/history/:id` (auth)

## Data models
### Mongoose
- `models/user.js`
- `models/artifact.js`
- `models/button.js`, `models/ppButton.js`, `models/psButton.js`, `models/aiButton.js`
- `models/registerStatus.js`

### Frontend type mapping
- Auth user <-> `models/user.js`:
  - `_id`, `email`, `login`, `name`
- Artifact history <-> `models/artifact.js`:
  - `id/_id`, `name`, `provider`, `prompt`, `response`, `status`, `errorMessage`, `createdAt`, `updatedAt`

## Route registration
- All routes are mounted in `routes/index.js`
- Artifact routes are mounted at `/artifact` via `routes/artifact.js`

## Sync checklist
- When API changes, update:
  - backend: `routes/*`, `controllers/*`
  - frontend: `src/services/*` (URL, payload, mapping)
- Keep model fields aligned with TS types
- If auth changes (JWT, header), update `src/services/authService.ts`
- If base URL/port changes, update `REACT_APP_API_BASE_URL`
- Do not commit secrets from `.env.local`; document only variable names

## Quick navigation
- Backend router index: `routes/index.js`
- Backend models: `models/*.js`
- Backend entry: `app.js`
- Frontend API clients: `d:\dev\ae2-web\artifact-after-effects-extension\src\services\*.ts`
