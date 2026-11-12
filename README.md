# Time Tracker

A simple self-hosted time tracking app built with SvelteKit.

## What this app does

- Track work time with start and stop controls
- Edit daily totals manually
- View monthly totals
- Mark office days
- Create personal API keys with scoped access
- Use API keys to:
  - start or stop the timer
  - read worked time for today or any date
- Connect AI assistants (Chatty, Claude, …) through the built-in MCP server,
  authenticated with an API key or OAuth via your OIDC provider (e.g. Pocket ID)

## Tech stack

- SvelteKit (Node adapter), Svelte 5, Tailwind CSS 4, shadcn-svelte
- Better Auth with OIDC login
- MCP TypeScript SDK (Streamable HTTP)
- SQLite for application data and auth data
- Docker + Docker Compose for self-hosting

## Self-host with Docker Compose

### 1. Prerequisites

- Docker
- Docker Compose plugin
- An OIDC provider (issuer URL, client id, client secret)

### 2. Configure environment in compose.yml

Edit [compose.yml](compose.yml) and set at least:

- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- `OIDC_ISSUER`
- `OIDC_CLIENT_ID`
- `OIDC_CLIENT_SECRET`

Notes:

- `BETTER_AUTH_URL` must match the public URL you will use in the browser.
- `BETTER_AUTH_SECRET` should be a long random string.
- Keep OIDC values in sync with your identity provider app settings.

### 3. Build and start

```bash
docker compose up -d --build
```

The app is exposed on port `3000` by default.

### 4. Open the app

- URL: `http://localhost:3000`

### 5. Persistent storage

Compose creates a named volume:

- `time_tracker_data`

It stores:

- `/data/time-tracker.db` (app data)
- `/data/auth.db` (auth data)

## Update / restart

```bash
docker compose pull
docker compose up -d --build
```

## Stop

```bash
docker compose down
```

## API quick overview

Authentication:

- Session cookie from web login, or
- API key via `Authorization: Bearer <API_KEY>`, or
- an OAuth access token from your OIDC provider (see [MCP server](#mcp-server))

Endpoints:

- `POST /api/timer/start` (scope: `timer:start`)
- `POST /api/timer/stop` (scope: `timer:stop`, optional body `{ "day": "YYYY-MM-DD" }`)
- `GET /api/timer/status` (scope: `hours:read`)
- `GET /api/hours/today` (scope: `hours:read`)
- `GET /api/hours/:date` (scope: `hours:read`, date format `YYYY-MM-DD`)
- `GET /api/hours/week` (scope: `hours:read`, current week Monday-Sunday)
- `GET /api/hours/year?year=YYYY` (scope: `hours:read`)
- `GET /api/days?month=YYYY-MM` (scope: `hours:read`)
- `PUT /api/days/:date` (scope: `hours:write`, body `{ "minutes": 450 }`)
- `GET /api/office?month=YYYY-MM` (scope: `hours:read`)
- `PUT|DELETE /api/office/:date` (scope: `office:write`)

API keys can be managed in the app UI at `/keys`.

## MCP server

The app is an [MCP](https://modelcontextprotocol.io) server at `<BETTER_AUTH_URL>/mcp`
(stateless Streamable HTTP). The **Connect** page in the app shows the exact URLs for
your deployment.

Tools: `get_timer_status`, `get_day`, `get_week`, `get_month`, `get_year`,
`start_timer`, `stop_timer`, `set_day_hours`, `set_office_day`. A client only sees
the tools its credential has scopes for.

### Option A: API key (works with Chatty)

1. Create an API key at `/keys` with the scopes the assistant should have.
2. In Chatty, add an HTTP MCP server with the URL above and paste the key as its token.

### Option B: OAuth via Pocket ID

The OIDC provider used for sign-in also acts as the authorization server for MCP
clients. The app publishes RFC 9728 protected resource metadata at
`/.well-known/oauth-protected-resource/mcp` and verifies the RFC 9068 JWT access
tokens Pocket ID issues (signature via JWKS, `iss`, `aud` = the MCP resource,
`typ: at+jwt`, scopes).

In Pocket ID (v2.x):

1. Turn on the **APIs** feature, then create an API under **Administration → APIs**
   with the resource `<BETTER_AUTH_URL>/mcp`.
2. Add the permissions `hours:read`, `hours:write`, `timer:start`, `timer:stop`,
   `office:write`.
3. Allow clients, either:
   - **Self-registering MCP clients** (Client ID Metadata Documents): turn on the
     feature, add the client's metadata URL to **Allowed metadata document URLs**,
     and enable **Allow all metadata document clients** on the API, or
   - **Pre-registered clients**: create an OIDC client with the MCP client's callback
     URL and grant it the API.

Pocket ID has no dynamic client registration (RFC 7591) endpoint; MCP clients
that only support DCR need a pre-registered client.

Each person must sign in to the web app once so their Pocket ID account is linked
to their tracked time.

Settings:

- `MCP_OAUTH=false` turns OAuth off (API keys keep working).
- `MCP_RESOURCE` overrides the resource identifier (defaults to `<BETTER_AUTH_URL>/mcp`).

## Local development (optional)

```bash
npm ci
npm run dev
```

Before committing, run `npm run check` (types), `npm run lint` (Prettier + ESLint)
and `npm run format` to fix formatting.

By default, local development still expects OIDC variables.

If you want to run without an OIDC provider in development, create a `.env`
from `.env.example` and enable:

- `DEV_AUTH_BYPASS=true`

Optional identity fields for the local dev user:

- `DEV_AUTH_USER_ID`
- `DEV_AUTH_USER_EMAIL`
- `DEV_AUTH_USER_NAME`
- `DEV_AUTH_USER_IMAGE`

When `DEV_AUTH_BYPASS=true`, the app injects a local session in development and
skips the OIDC login flow.
