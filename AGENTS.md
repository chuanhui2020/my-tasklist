# Repository Guidelines

## Project Structure & Module Organization
- `backend/` serves the Flask API; `app.py` boots the service, `routes/` holds blueprints, and `models.py` encapsulates business logic. Place migrations in `database.sql` and keep helpers slim and reusable.
- `frontend/` contains the Vue 3 SPA. Components live in `src/components/`, routes in `src/router.js`, and remote calls in `src/api/`. Co-locate stateful composables with their features.
- `deploy/` tracks automation (`deploy.sh`, `install-environment.sh`) plus systemd and nginx configs. Update these when runtime parameters change.
- Root helpers (`start.sh`, `stop.sh`) orchestrate both services; adjust them whenever entrypoint commands or ports shift.

## Build, Test, and Development Commands
- Backend environment: `cd backend && python -m venv .venv && .venv\Scripts\activate && pip install -r requirements.txt` to sync dependencies.
- Run API locally with `python app.py`; use `gunicorn -c gunicorn.conf.py app:app` for production parity.
- Frontend setup: `cd frontend && npm install` once, then `npm run dev` for hot reload, `npm run build` for optimized assets, and `npm run preview` to validate the bundle.

## Coding Style & Naming Conventions
- Python: 4-space indents, PEP 8 formatting, `snake_case` for modules/functions, `PascalCase` for classes. Keep route handlers thin and move logic into helpers or models.
- Vue: prefer `<script setup>` in single-file components, name components in `PascalCase` (e.g., `TaskList.vue`), and composables as `useX`. Store secrets in `.env`, never in code.

## Testing Guidelines
- Backend tests belong in `backend/tests/test_*.py` using pytest with Flask's test client. Run with `pytest backend/tests` and cover critical `/api/tasks` flows plus model constraints.
- Frontend tests live under `frontend/src/__tests__/` with Vitest. Execute via `npm run test` once the script is available; ensure UI edge states are represented.

## Commit & Pull Request Guidelines
- Use Conventional Commits (`feat:`, `fix:`, `chore:`) to keep history consistent, e.g., `feat(tasks): add due date validation`.
- PRs should summarize scope, list manual test commands, link tracking issues, and include screenshots or curl traces for user-visible changes. Confirm deployment scripts remain accurate before requesting review.

## Deployment & Configuration Notes
- Mirror production locally with `gunicorn` and Vite¡¯s preview before releasing. Keep systemd and nginx templates in `deploy/` aligned with any port or path adjustments.
- Regenerate `.env` files per environment; configure secrets through environment variables and never commit credentials.
