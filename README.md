# ai/Studio (new UI)

A Claude-web-style single window for Param ai/Studio, built on the **ai/Studio dev MCP**
(`https://dev.paramai.studio/gwapi/mcp`). Run time and design time share one frame:

| Surface | What it is | MCP tools |
| --- | --- | --- |
| **New chat** (`/`) | Greeting + composer. The chip in the composer picks a project *or* an agent per conversation, so there is no global workspace/project switch | `ask_project`, `run_agent`, `get_run` |
| **Conversation** (`/c/:id`) | Answer with numbered cited sources, collapsible run steps (code vs model), and a **Receipt** side panel | same |
| **Agents** (`/agents`, `/agents/:id`) | Run zone (left) beside Design zone (right): steps marked governed code vs model call, runs, versions, routines | `find_agents`, `agent_details`, `agent_versions`, `recent_runs` |
| **Routines** (`/routines`) | Scheduled agents, like Routines in Claude web: preview, then create; pause/resume; run now | `list_schedules`, `schedule_agent`, `control_schedule` |
| **Knowledge** (`/knowledge`) | Per-project knowledge graph, sources and connectors (SharePoint, OneDrive, Google Drive) | `source_status`, `connect_source`, `knowledge_graph`* |
| **Governance** (`/governance`) | Workspace isolation map, sharing, policies, allowed models, members, audit log | `list_workspaces`, `governance_summary`*, `audit_log`* |

\* Not seen on the MCP yet: mock-only names, to be mapped to the real dev MCP tools.

Design tokens live in `design-tokens/` (paramai.studio palette, Bricolage Grotesque / Geist / Geist Mono)
and are copied into `src/styles/`.

- `src/` — Vite + React 19 + TypeScript app (react-router 7, plain CSS with design tokens)
- `server/` — small Node server (Hono) that holds the MCP session to the Gateway.
  The browser only ever calls `/api/*`; Gateway tokens stay on the server.
- `public/landing.html` — the original marketing landing page, kept as brand reference (served at `/landing.html`)

## Run it

```bash
npm install
npm run dev          # web on :5173, API on :8787, mock data by default
```

Open http://localhost:5173. With no `.env`, the server runs in **mock mode** (canned data
shaped like the real dev MCP responses), so UI work doesn't need a Gateway.

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

Put it in `src/features/<name>/`, add its route in `src/app/routes.tsx`, and a sidebar entry
in `src/app/AppFrame.tsx`. Shared data (workspace, projects, agents) comes from `useStudio()`;
conversations from `useChats()`; the right-hand panel from `usePanel()`.
`/dev/tools` lists every Gateway tool and lets you call one with JSON args.
