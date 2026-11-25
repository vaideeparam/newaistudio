# Features

One folder per feature (for example `ask/`). Each exports a `RouteObject[]`
that `src/app/routes.tsx` spreads into the signed-in routes, and optionally adds
an entry to `src/app/nav.ts`.

Talk to the Gateway only through `callTool` / `listTools` from `src/lib/mcp.ts`.
