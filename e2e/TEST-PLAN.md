# ai/Studio new UI: user-journey test plan

Each journey runs at **phone** (iPhone 13, touch) and **desktop** (1280×860) size.
`npm run e2e` builds the preview and runs them all in Chromium; screenshots land
in `e2e/screens/` (or `$E2E_SHOTS`). Any uncaught page error fails the journey.

The suite runs against the preview build, whose sample gateway mirrors the
live gateway's observed behaviour (find_agents only published, list_agents with
drafts, recent_runs refusing drafts, get_run "Session not found" for older chat
runs, agent_details inputs with type/required). Shapes were last checked live on
2026-11-27.

| # | Journey | What must hold |
|---|---------|----------------|
| J1 | Navigate every section | Phone drawer opens and closes on pick; each page loads; no sideways scroll |
| J2 | Agents list | Drafts listed with published minds; Drafts filter shows only drafts |
| J3 | Agent header | Title at most two lines; actions on the title row and on screen; description full width |
| J4 | Run a DAG mind with inputs | Human labels, Required/Optional, required first, optional folded; one column on phone; blocked until required filled; bad JSON flagged; run lands in chat with rich answer and page card |
| J5 | Draft chat mind | Composer says "Message …", no runtime text; draft note shown; a run from here appears under Recent marked "this device" and reopens |
| J6 | Reopen an earlier run | Recent row opens the run with its full answer and pages |
| J7 | Run Studio no longer keeps | Calm note with "Run it again", no red error or raw gateway text |
| J8 | Composer | Shift+Enter new line; Enter sends on desktop; Return is a new line on phone; Stop while running |
| J9 | Rich answer | No raw `#` or pipe tables; table turns into a chart; no sideways scroll; page opens in the side pane / sheet |
| J10 | Ask a project | Answer with numbered sources |
| J11 | Design a new mind | Designer replies with a plan to approve |
| J12 | Routines | Schedules listed; no sideways scroll |
| J13 | Persistence | A chat survives a reload |

## Not yet automated

- Against the live gateway: the preview runs inside claude.ai through your
  connector, which a headless browser here can't sign in to. Live shapes are
  checked by calling the gateway directly when they change.
- Saving, publishing and tagging an agent (they change real agents; covered by
  confirm steps in the UI).
- Knowledge graph and governance pages (still sample data).
