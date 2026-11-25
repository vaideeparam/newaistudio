# ai/Studio (new UI)

A web UI for Param ai/Studio built on the **ai/Studio Gateway MCP**.

- `src/` — Vite + React 19 + TypeScript app (react-router 7, plain CSS with design tokens)
- `server/` — small Node server (Hono) that holds the MCP session to the Gateway.
  The browser only ever calls `/api/*`; Gateway tokens stay on the server.
- `public/landing.html` — the original marketing landing page, kept as brand reference (served at `/landing.html`)

## Run it

```bash
npm install
npm run dev          # web on :5173, API on :8787, mock data by default
```

Open http://localhost:5173. With no `.env`, the server runs in **mock mode** (canned
whoami / list_workspaces / list_projects / ask_project / get_run), so UI work doesn't need a Gateway.

To use the real Gateway, copy `.env.example` to `.env` and set `STUDIO_MCP_URL`, then either:

- **OAuth (default)** — each user signs in via the Gateway's MCP OAuth (discovery,
  dynamic client registration, PKCE). Tokens live in a server-side session keyed by an
  httpOnly cookie.
- **Static token** — set `STUDIO_MCP_TOKEN` for local development; every request uses that one identity.

Other scripts: `npm run build`, `npm start` (serves `dist/` + API), `npm run typecheck`, `npm test`.

## Calling the Gateway from UI code

```ts
import { callTool, listTools, McpToolError, AuthRequiredError } from './lib/mcp';

const { projects } = await callTool<{ projects: Project[] }>('list_projects', { search: 'fin' });
```

`callTool` returns the tool's `structuredContent`, else its single text block parsed as JSON,
else the raw text. It throws `McpToolError` when the tool reports an error and
`AuthRequiredError` (HTTP 401) when the user needs to sign in. There is no client timeout;
the server allows tools up to 5 minutes (`get_run` waits ~30s by design).

Wire format: `POST /api/mcp/tools/:name` with the args as JSON body and an
`X-Studio-Request: 1` header (CSRF guard) → `{ data }` or `{ error: { message, tool, details } }`.

Session: `useSession()` from `src/app/session.tsx` (`session`, `signIn()`, `signOut()`).

## Adding a feature

Put it in `src/features/<name>/`, export a `RouteObject[]`, spread it into the signed-in
children in `src/app/routes.tsx`, and add a sidebar entry in `src/app/nav.ts`.
`/dev/tools` lists every Gateway tool and lets you call one with JSON args.
