---
name: better-stack
description: Operate Better Stack (logs, uptime, status pages, alerts, dashboards) for the next-saas-boilerplate monorepo through the Better Stack MCP. Use when creating, modifying, pausing or deleting any BS resource, when wiring a new app to the logs sink, or when troubleshooting auth.
---

> **Ported from a production application.** It describes the target architecture, and some
> packages it names may not exist here yet — treat it as a spec to build against rather
> than a map of the current tree. `architecture-guard` is the authority.

# Better Stack — operations cookbook

Better Stack is the observability backbone for `next-saas-boilerplate`. One tool covers four products:

| Product | What it does | When you touch it |
| --- | --- | --- |
| **Logs (Telemetry)** | Receives JSON log records from `@saas/log`'s `BetterStackTransport` and stores them with searchable schema. | Adding a new app/job, debugging incidents, building dashboards. |
| **Uptime** | Polls HTTP/keyword/ping/TCP endpoints from multiple regions and opens incidents when they fail. | Adding a new service surface (web, admin, api, status pages), changing alert thresholds, adding heartbeats for crons. |
| **Status pages** | Public/private aggregated availability dashboards. | When the prod domain exists and we want to expose status to customers. |
| **Alerts (chart-alerts)** | Trigger on log query results crossing a threshold. | "Notify when error logs > N in 5 min", SLO-style alerts. |

Day-to-day, you operate every one of those through the **Better Stack MCP** instead of the dashboard. The MCP exposes ~80 tools under `mcp__better-stack__*`. This skill explains which to reach for, the conventions we follow, and how to keep the pipeline (Slack → on-call → resolution) healthy.

> **Defer note.** When you start a fresh Claude Code session the BS tools appear in the deferred list. Load them with `ToolSearch` — examples below show the exact selectors.

---

## Setup contract (read this first)

The integration has three moving parts. Each lives in a specific file.

### 1. MCP server registration — `.mcp.json`
Better Stack splits its API into **two surfaces with separate tokens**: Uptime (monitors / heartbeats / status pages / incidents) and Telemetry (logs / sources / dashboards / alerts). One token never works for both, so we register two MCP entries pointing at the same endpoint and let the bearer pick which API a tool can call:

```json
{
  "mcpServers": {
    "better-stack": {
      "type": "http",
      "url": "https://mcp.betterstack.com",
      "headers": { "Authorization": "Bearer ${BETTER_STACK_API_TOKEN}" }
    },
    "better-stack-telemetry": {
      "type": "http",
      "url": "https://mcp.betterstack.com",
      "headers": { "Authorization": "Bearer ${BETTER_STACK_TELEMETRY_API_TOKEN}" }
    }
  }
}
```

Tool routing rule:
- `mcp__better-stack__uptime_*` → **Uptime token** (`BETTER_STACK_API_TOKEN`).
- `mcp__better-stack-telemetry__telemetry_*` → **Telemetry token** (`BETTER_STACK_TELEMETRY_API_TOKEN`).
- Calling a `telemetry_*` tool on the `better-stack` server (or vice-versa) returns 401 — pick the namespace that matches the token.

The `${...}` placeholders are resolved by Claude Code from the **process environment** at MCP-handshake time, not from the project's `.env` file. We solve this with **direnv** (`.envrc` is committed at the repo root):
```bash
brew install direnv
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc   # or your shell of choice
exec zsh                                       # reload
direnv allow .                                 # one-time consent for this repo
```
From that point on, any shell session that `cd`s into the repo loads every variable from `.env` automatically. Launch `claude` from that shell and the MCP handshake picks up the tokens.

Stdio MCPs (e.g. Slack at `npx @modelcontextprotocol/server-slack`) skip this loop — they're wrapped with `node_modules/.bin/dotenv -e .env -- ...` in `.mcp.json`, so they always get the project `.env`.

### 2. Generate the two tokens

**`BETTER_STACK_API_TOKEN` — Uptime API token (team-based)**
> https://uptime.betterstack.com/team/api-tokens
> → tab **"Team-based tokens"**
> → section **"Uptime API tokens"**
> → pick the team (e.g. `Intrigo app`) → name it (e.g. `Claude Code next-saas-boilerplate app`) → **Create**

The token is short (~24 alphanumeric chars). That's normal.

**`BETTER_STACK_TELEMETRY_API_TOKEN` — Telemetry API token**
> https://logs.betterstack.com/team/api-tokens
> → "Telemetry API tokens" → **Create**, scoped to the same team.

Other tokens to **avoid** for the MCPs:
- ❌ **Personal API tokens** (Global tokens tab) — work for some endpoints but not all.
- ❌ **Source ingest tokens** — those are the per-source secrets `BetterStackTransport` uses (`BETTER_STACK_SOURCE_TOKEN`).

Symptom map:
- `mcp__better-stack__uptime_list_monitors_tool` → `401 Invalid Team API token` ⇒ Uptime token wrong/missing.
- `mcp__better-stack-telemetry__telemetry_list_teams_tool` → `No teams available` ⇒ Telemetry token wrong/missing.
- `/mcp` says `Authentication successful` but tools 401 ⇒ the Bearer reached the MCP server, but the underlying API call rejected it. Regenerate the token for that surface.

### 3. What you can and cannot create via the MCP

The MCP today is **read-mostly for Uptime** and **full CRUD for Telemetry**. Concretely:

| Resource | Create via MCP? | How |
| --- | --- | --- |
| Uptime monitors | ❌ | Dashboard. Once created, list/get/update via MCP. |
| Heartbeats | ❌ | Dashboard. List/get/availability via MCP. |
| Status pages | ❌ | Dashboard. Reports + report updates **can** be created via MCP. |
| Escalation policies | ❌ | Dashboard. List/get via MCP. |
| Severities | ❌ | Dashboard. List via MCP. |
| Incidents | ✅ | `uptime_create_incident_tool` — useful for synthetic alerts and runbooks. |
| Incident comments / ack / resolve / escalate | ✅ | The full incident-response flow is MCP-driven. |
| Telemetry sources / applications | ✅ | `telemetry_create_source_tool`, `telemetry_create_application_tool`. |
| Dashboards / charts | ✅ | `telemetry_create_dashboard_tool`, `telemetry_add_chart_to_dashboard_tool`. |
| Chart alerts (log-based) | ✅ | `telemetry_create_chart_alert_tool`. |
| Cloud connections (ClickHouse) | ✅ | `telemetry_create_cloud_connection_tool`. |

Practical implication: the **provisioning** of monitors/heartbeats/status-pages/policies happens in the BS dashboard once. After that, **operations** — ack/resolve/comment/escalate, list/get availability, build dashboards and chart alerts — are MCP-native.

### 3. Logger transport — `@saas/log`
`BetterStackTransport` (in `packages/log/src/transports/better-stack.ts`) ships records to the source's ingest URL with `Authorization: Bearer ${BETTER_STACK_SOURCE_TOKEN}`. The bootstrap modules (`apps/web/lib/log.ts`, `apps/admin/lib/log.ts`, `packages/jobs/log.ts`) auto-switch from `pino` → `better-stack` when the source token is present. `LOG_LEVEL` and `LOG_CHANNEL` env vars can override behavior without redeploying.

---

## Logs (Telemetry / Sources)

### Mental model
- A **Source** = one stream of logs (one app or one logical service).
- Each source has a stable **ingest token** — pasted into env as `BETTER_STACK_SOURCE_TOKEN`.
- Records arrive as JSON, are indexed by schema, and you query with the SQL-ish "Telemetry Explore".
- Default retention: 30 days. Up it via `logs_retention` (in days).

### Conventions for this repo
- **Naming**: `next-saas-boilerplate-<service>` (`next-saas-boilerplate-web`, `next-saas-boilerplate-admin`, `next-saas-boilerplate-jobs`). One source per service. Don't share — schema clashes.
- **Platform**: `javascript` for the apps and jobs.
- **Region**: `us_east` to match Vercel and Neon (low cross-region latency for the ingest path). Switch only after consulting `mcp__better-stack__telemetry_list_data_regions_tool`.
- **Retention**: 30 days for non-prod, 90 days once we have prod traffic.

### Common operations

**Discover** (always run before any change):
```
ToolSearch select:mcp__better-stack__telemetry_list_teams_tool,mcp__better-stack__telemetry_list_sources_tool
```
Then call:
```
telemetry_list_teams_tool                       → grab `team_id`
telemetry_list_sources_tool team_id=<id>        → see what already exists
```

**Create a source**
```
telemetry_create_source_tool
  team_id=<id>
  name="next-saas-boilerplate-<service>"
  platform="javascript"
  data_region="us_east"
  logs_retention=30
```
Returns an `ingestion_token` and `ingesting_host`. Save them in `.env` as
`BETTER_STACK_SOURCE_TOKEN` and `BETTER_STACK_INGESTING_HOST` and trigger a redeploy
of the affected app. Once `BETTER_STACK_SOURCE_TOKEN` is set, `@saas/log` switches
its default channel to `better-stack` and starts streaming.

**Verify ingest** (after first deploy):
```
telemetry_get_source_details_tool id=<source_id>
```
Should report a recent `last_log_at`. If empty after 5 min: check the deploy's
runtime logs for `[better-stack]` errors, and re-confirm the source token.

**Inspect schema (what fields can I query?)**
```
telemetry_get_source_fields_tool id=<source_id>
```
Useful before writing a chart query — it lists every key the ingest has seen so far.

**Pause / unpause** (e.g. quota emergencies)
```
telemetry_get_source_details_tool id=<id>
# follow with the dashboard for now — pause flag is a setting, not a tool yet.
```

**Delete a source** — only via dashboard (no MCP tool today). Always `pause` first
to avoid mid-flight loss; remove the token from env to stop the transport from
retrying.

### Wiring a new service to logs (full procedure)

1. Read this skill's "Setup contract".
2. `telemetry_create_source_tool` for `next-saas-boilerplate-<service>` → grab tokens.
3. Add `BETTER_STACK_SOURCE_TOKEN` (and `BETTER_STACK_INGESTING_HOST` if non-default) to the deploy env (Vercel / Trigger).
4. Add a `lib/log.ts` (or equivalent bootstrap) that mirrors the web/admin shape. Copy from `apps/web/lib/log.ts`; only `service` in `baseBindings` should change.
5. Trigger a deploy. Watch `telemetry_get_source_details_tool id=<id>` for `last_log_at`.
6. Save a starter view in the BS UI named `next-saas-boilerplate-<service> · errors` filtered by `level in ('error', 'fatal')`.

---

## Uptime monitors

### What we monitor
- **Web (PWA)**: `https://<vercel-slug-web>.vercel.app/api/health` (and prod URL once LOY-43 lands).
- **Admin**: `https://<vercel-slug-admin>.vercel.app/api/health` — this one **also** pings the DB internally and returns 503 on failure, so DB outages page us via this monitor.
- **API**: alias of admin's health for now (one route serves Hono RPC + auth + status). Split when API gets its own deploy.
- **Status page** (later): once published, monitor it too.

### Conventions
- **Frequency**: 60 s in prod, 180 s in staging/preview to save quota.
- **Regions**: ≥ 3 (one in NA, one EU, one Asia). MCP arg: `regions: ["us-east", "eu", "as"]`.
- **Alert after**: 2 consecutive failures (`request_timeout: 30`, `recovery_period: 0`).
- **Verification**: keyword check on `"status":"ok"` in the body. This catches "200 OK with empty body" regressions that pure HTTP-status checks miss.
- **HTTP method**: `GET` (we don't have monitors that need POST yet).
- **Naming**: `<env>: <service>` — `prod: web`, `preview: admin`, …

### Discover
```
ToolSearch select:mcp__better-stack__uptime_list_monitors_tool,mcp__better-stack__uptime_create_monitor_tool,mcp__better-stack__uptime_update_monitor_tool,mcp__better-stack__uptime_delete_monitor_tool,mcp__better-stack__uptime_get_monitor_tool,mcp__better-stack__uptime_get_monitor_availability_tool
```
(`uptime_create_monitor_tool` etc. live in the deferred list — load them when you need them.)

### Create a monitor
```
uptime_create_monitor_tool
  url="https://<vercel-slug>.vercel.app/api/health"
  pronounceable_name="preview: web"
  monitor_type="keyword"
  required_keyword="\"status\":\"ok\""
  check_frequency=60
  request_timeout=30
  regions=["us-east","eu","as"]
  call=false email=true sms=false push=false
  policy_id=<escalation_policy_id>     # see "Notification channels"
```

### Update / pause / delete
- **Pause** (e.g. during planned downtime): `uptime_update_monitor_tool id=<id> paused=true`. Always pause instead of deleting if you intend to bring the URL back.
- **Migrate URL** (preview → prod): `uptime_update_monitor_tool id=<id> url="https://app.<dominio>/api/health" pronounceable_name="prod: web"`. Better Stack keeps history.
- **Delete**: `uptime_delete_monitor_tool id=<id>`. Only when retiring the surface.

### Inspect availability / SLO
```
uptime_get_monitor_availability_tool id=<id> from="-30d"
uptime_get_monitor_response_times_tool id=<id> from="-7d"
```
Use these in standups/post-mortems instead of opening the UI.

### Heartbeats (for crons)
A heartbeat is a URL the cron is expected to hit on every successful run. Miss it → incident.

```
uptime_create_heartbeat_tool
  name="cron: daily-kpi-rollup"
  period=86400        # seconds; daily
  grace=600           # 10 min late before alert
  policy_id=<id>
```
Returns a `url`. Curl that URL at the end of each successful cron run:
```ts
await fetch(process.env.HEARTBEAT_DAILY_KPI_URL!, { method: "GET" });
```
For Trigger.dev tasks, do this in the `run` function after the work succeeds. Never inside a try/catch that swallows errors — if the work failed we want the heartbeat to miss.

---

## Notification channels (Slack, email, webhook)

### Slack — what you need to connect
Slack integration is OAuth-based and is **not** done via MCP. One-time, manual:

> **Important:** Slack lives in the **Uptime** sub-app (`uptime.betterstack.com`), **not** Telemetry. If you opened `telemetry.betterstack.com/team/integrations` you'll only see the MCP integration tab — switch surfaces.

1. Open https://uptime.betterstack.com/team/integrations (note the `uptime.` subdomain).
2. Click **Slack** → **Connect with Slack**.
3. Authorize the Better Stack app on the Slack workspace you want alerts in (admin permission required in the workspace).
4. Pick the destination channel — we use `#alerts-next-saas-boilerplate` by convention. Create it first if needed.
5. The integration appears as a **notification channel**. It shows up in `mcp__better-stack__*` lookups under whatever escalation policy uses it.

> Ask the user for: **Slack workspace name** + **target channel** (default `#alerts-next-saas-boilerplate`). Without those, the OAuth flow can't complete.

After connecting:
- All monitor incidents on policies that include Slack post a message (open + acknowledge + resolve).
- Heartbeat misses post the same way.
- Chart alerts (log-based) post too.
- The bot can take ack/resolve actions via Slack message buttons — saves a click.

### Email
Always available, no setup. Listed by default in the team's escalation policy. Add team members under Settings → People.

### Webhook (catch-all)
For PagerDuty, Opsgenie, Datadog, custom: Settings → Integrations → Generic webhook. Drops a JSON payload to your endpoint. We don't use any today.

### Escalation policies
Better Stack groups channels into policies (think "PagerDuty schedules"). One policy = one rule like "Slack first, after 15 min ping email; after 30 min phone-call the on-call".

```
ToolSearch select:mcp__better-stack__uptime_list_escalation_policies_tool,mcp__better-stack__uptime_get_escalation_policy_tool
```
Default policy IDs are returned by `uptime_list_escalation_policies_tool`. Reference them when creating monitors / heartbeats so they inherit the channel mix.

### Conventions for this repo
- Single policy `next-saas-boilerplate-default` covering Slack `#alerts-next-saas-boilerplate` immediately + email after 15 min.
- One day, when on-call rotates, add a phone tier after 30 min.

---

## Status pages

Parked behind LOY-43 (we don't have a prod domain). Once the domain is live:

```
ToolSearch select:mcp__better-stack__uptime_create_status_page_tool,mcp__better-stack__uptime_list_status_pages_tool
```

Sketch:
```
uptime_create_status_page_tool
  company_name="the app"
  subdomain="next-saas-boilerplate"          # → next-saas-boilerplate.betteruptime.com
  custom_domain="status.<dominio>"
  history_days=90
  password_enabled=false
```
Then attach monitor IDs as resources via `uptime_get_status_page_resources_tool` / dashboard. Add planned-maintenance windows via `uptime_create_status_page_report_tool`.

---

## Alerts on logs (chart-alerts)

Better Stack runs a SQL-ish query on the source every X minutes and triggers when a numeric column crosses a threshold. Two pieces:

1. **Chart** — the visualization the alert lives on (line, bar, value).
2. **Chart alert** — the threshold + escalation.

### Recipe — "alert when error rate > 10/5min"

Discover:
```
ToolSearch select:mcp__better-stack__telemetry_list_dashboards_tool,mcp__better-stack__telemetry_create_dashboard_tool,mcp__better-stack__telemetry_create_chart_alert_tool,mcp__better-stack__telemetry_build_explore_query_tool,mcp__better-stack__telemetry_get_chart_alert_instructions_tool
```

Steps (always read the per-tool instructions first — schema is large):
1. `telemetry_get_query_instructions_tool` → ingest the query DSL.
2. Build a query: `count(*) where level in ('error', 'fatal')`, group by 1m bucket.
3. Add the chart to a dashboard via `telemetry_add_chart_to_dashboard_tool`.
4. `telemetry_create_chart_alert_tool` with `threshold=10`, `comparison_operator=">"`, `evaluation_period_minutes=5`, `policy_id=<next-saas-boilerplate-default>`.

### Modifying / pausing
- Pause: `telemetry_toggle_chart_alert_pause_tool id=<id>`.
- Edit threshold: `telemetry_edit_chart_alert_tool id=<id> threshold=20`.
- Delete: `telemetry_delete_chart_alert_tool id=<id>`.

### Conventions
- Live in dashboard `next-saas-boilerplate: alerts` (one place to scan).
- Naming: `<service>: <signal>` — `web: 5xx surge`, `admin: Hono RPC slow`, `jobs: failed retries`.
- Always include a runbook link in the alert description.

---

## Dashboards

```
ToolSearch select:mcp__better-stack__telemetry_create_dashboard_tool,mcp__better-stack__telemetry_list_dashboards_tool,mcp__better-stack__telemetry_add_chart_to_dashboard_tool,mcp__better-stack__telemetry_add_dashboard_section_tool,mcp__better-stack__telemetry_list_dashboard_templates_tool
```

Repo conventions:
- **`next-saas-boilerplate: overview`** — top-level KPIs (req/min per service, error rate, p95 latency).
- **`next-saas-boilerplate: alerts`** — every chart that backs an alert.
- **`next-saas-boilerplate: <service>`** — per-service drilldowns.

Use `telemetry_list_dashboard_templates_tool` to bootstrap from BS templates, then customize. Move charts between dashboards with `telemetry_move_charts_tool` instead of recreating.

---

## Incidents (when something goes off)

```
ToolSearch select:mcp__better-stack__uptime_list_incidents_tool,mcp__better-stack__uptime_get_incident_tool,mcp__better-stack__uptime_acknowledge_incident_tool,mcp__better-stack__uptime_resolve_incident_tool,mcp__better-stack__uptime_create_incident_comment_tool,mcp__better-stack__uptime_get_incident_timeline_tool
```

Day-of:
- **Acknowledge** as soon as you see it: `uptime_acknowledge_incident_tool id=<id>`.
- **Comment** running notes via `uptime_create_incident_comment_tool` (visible in Slack thread).
- **Resolve** when the underlying signal recovers: `uptime_resolve_incident_tool id=<id>`. Don't resolve from a healthy fluke if it's still flapping.

After:
- Pull `uptime_get_incident_timeline_tool` for the post-mortem doc.
- File a Linear ticket if the cause needs follow-up.

---

## Quick MCP tool cheat sheet (loaders)

Copy/paste the right `ToolSearch` line for the operation you need:

| Goal | Selector |
| --- | --- |
| Discover what exists | `select:mcp__better-stack__telemetry_list_teams_tool,mcp__better-stack__telemetry_list_sources_tool,mcp__better-stack__uptime_list_monitors_tool,mcp__better-stack__uptime_list_heartbeats_tool,mcp__better-stack__uptime_list_status_pages_tool,mcp__better-stack__uptime_list_incidents_tool,mcp__better-stack__telemetry_list_dashboards_tool,mcp__better-stack__telemetry_list_chart_alerts_tool` |
| Create a source | `select:mcp__better-stack__telemetry_create_source_tool,mcp__better-stack__telemetry_list_data_regions_tool,mcp__better-stack__telemetry_get_source_details_tool` |
| Manage monitors | `select:mcp__better-stack__uptime_create_monitor_tool,mcp__better-stack__uptime_update_monitor_tool,mcp__better-stack__uptime_delete_monitor_tool,mcp__better-stack__uptime_get_monitor_availability_tool` |
| Manage heartbeats | `select:mcp__better-stack__uptime_create_heartbeat_tool,mcp__better-stack__uptime_update_heartbeat_tool,mcp__better-stack__uptime_delete_heartbeat_tool,mcp__better-stack__uptime_get_heartbeat_availability_tool` |
| Notification policies | `select:mcp__better-stack__uptime_list_escalation_policies_tool,mcp__better-stack__uptime_get_escalation_policy_tool` |
| Manage status page | `select:mcp__better-stack__uptime_create_status_page_tool,mcp__better-stack__uptime_get_status_page_tool,mcp__better-stack__uptime_get_status_page_resources_tool` |
| Build a dashboard | `select:mcp__better-stack__telemetry_create_dashboard_tool,mcp__better-stack__telemetry_add_chart_to_dashboard_tool,mcp__better-stack__telemetry_chart` |
| Build an alert | `select:mcp__better-stack__telemetry_get_chart_alert_instructions_tool,mcp__better-stack__telemetry_create_chart_alert_tool,mcp__better-stack__telemetry_edit_chart_alert_tool,mcp__better-stack__telemetry_toggle_chart_alert_pause_tool,mcp__better-stack__telemetry_delete_chart_alert_tool` |
| Search BS docs | `select:mcp__better-stack__better_stack_search_documentation_tool` |
| Incident response | `select:mcp__better-stack__uptime_list_incidents_tool,mcp__better-stack__uptime_acknowledge_incident_tool,mcp__better-stack__uptime_resolve_incident_tool,mcp__better-stack__uptime_create_incident_comment_tool,mcp__better-stack__uptime_get_incident_timeline_tool` |

When in doubt, the MCP also exposes `better_stack_search_documentation_tool` — give it a free-form question and it returns relevant doc snippets.

---

## Troubleshooting

### `401 Unauthorized` from any `uptime_*` tool
The MCP got a token but the API rejects it as not-a-Team-token. Fix:
1. https://uptime.betterstack.com/team/api-tokens → "Team API tokens" tab → Create token.
2. Set it in your shell env as `BETTER_STACK_API_TOKEN` and restart Claude Code.
3. `mcp__better-stack__telemetry_list_teams_tool` should return a non-empty list.

### `No teams available` from `telemetry_list_teams_tool`
The token's missing or wrong-scope. Same fix as above. The MCP doesn't read project-level `.env` files — the var must be in the **process** env when Claude Code launches.

### `BetterStackTransport` drops batches in prod
Look for `[better-stack] dropped batch after retries` in the runtime logs. Causes: source paused (unpause via dashboard), source token revoked (re-issue and re-deploy), or 5xx ingest spike (BS will recover; the transport already retried 3× with backoff).

### Slack notifications stop arriving
Workspace admin revoked the Better Stack app, or the channel was archived. Re-run the Slack OAuth at https://uptime.betterstack.com/team/integrations.

### Status page reports 502/timeout
For monitors against Vercel preview URLs, the URL slug changes when you redeploy from a different branch. Use `uptime_update_monitor_tool` to refresh the URL.

---

## Where to look first

- **Production playbook**: this skill.
- **The transport** that ships logs: `packages/log/src/transports/better-stack.ts`.
- **The bootstrap modules** (env-driven channel selection): `apps/web/lib/log.ts`, `apps/admin/lib/log.ts`, `packages/jobs/log.ts`.
- **MCP server config**: `.mcp.json`.
- **Env vars (for both MCP and transport)**: `.env.example` — Better Stack section.

When this skill is out of date with a newer MCP tool name, prefer `better_stack_search_documentation_tool` for the canonical answer, then update the cheat sheet here.
