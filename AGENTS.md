# AGENTS.md

## Stack

SvelteKit 2 + Svelte 5 (runes everywhere, see `svelte.config.js`), Tailwind 4 + shadcn-svelte
(stone base, same tokens as Chatty), better-sqlite3, better-auth (generic OIDC), MCP TypeScript
SDK, adapter-node. Package manager is **npm**.

## Commands

- Typecheck: `npm run check` — run it and `npm run lint` after changes (`npm run format` fixes formatting).
- Build: `npm run build` (needs `OIDC_*` env vars or `DEV_AUTH_BYPASS=true`).

## Architecture

- Server-only code lives in `src/lib/server/`; never import it from client code.
  - `db.ts` — schema + queries. `tracker.ts` — read models shared by the REST API and MCP tools.
  - `better-auth.ts` — sign-in via OIDC, and lookup of the app user for an OIDC subject.
  - `auth.ts` — resolves the caller (session, API key, or OAuth access token) into a `Principal` with scopes.
  - `oauth.ts` — verifies RFC 9068 JWT access tokens from the OIDC provider (Pocket ID) for the MCP resource.
  - `mcp.ts` — the MCP server; built per request and only lists tools the principal's scopes allow.
- Shared helpers: `src/lib/time.ts` (dates, durations, overtime rules), `src/lib/scopes.ts` (permission keys).
- Routes: `(app)/` is the signed-in UI, `api/` the JSON API (`{ data, error }` envelopes),
  `mcp/` the MCP endpoint, `.well-known/oauth-protected-resource/` its RFC 9728 metadata.
- `src/lib/components/ui/` is generated shadcn-svelte code (copied from Chatty); app components live in
  `src/lib/components/app/` and `src/lib/components/tracker/`.
