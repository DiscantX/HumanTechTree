# Tech Tree Wiki — Prototype

First working step of the prototype: prove Node/TypeScript can talk to
TerminusDB, push a schema, and round-trip a Node/Edge pair through it.
Nothing here is the real application — it's deliberately small so it's
easy to throw away or rebuild pieces of as the tech essays settle.

## Layout

```text
src/
  config.ts              # env-based settings, read once, everywhere
  db/
    client.ts            # WOQLClient factory
    log.ts               # commit log helper with pagination, branch-exists check
    rebase.ts            # branch rebase helper using the official JS client
    merge-queue.ts       # serialized merge queue (spacing, error translation, retries)
    staged-landing.ts    # lands an edit through a staging branch and the gate
    validation-gate.ts   # graph validation (dangling edges, self-loops, cycles)
    woql-queries.ts      # server-side WOQL path queries (cycle detection, blast radius)
  mcp/
    index.ts             # read-only TerminusDB MCP server (stdio)
    tools.ts             # tool handlers: branches, commit log, documents, WOQL presets
    IMPLEMENTATION_PLAN.md
  schema/
    graph-schema.ts      # Node/Edge schema transcribed from wiki/tech/data-model.md
  scripts/
    tests/
      init-db.ts               # create the dev db (if needed) + push schema
      reset-db.ts              # delete the dev db entirely
      concurrent-suite.ts      # 50 comprehensive concurrency & conflict scenarios (live)
      stress-suite.ts          # scale and edit-growth stress test on scratch databases (live; see header for env settings)
      merge-queue-test.ts      # merge queue logic with fake clock (no server needed)
      merge-queue-live.ts      # live merge queue tests (needs the server)
      validation-gate-test.ts  # validation gate checks (no server needed)
      backlog-features-test.ts # query-building and preflight contracts (no server needed)
      backlog-features-live.ts # branchExists, log pagination, WOQL path queries (live)
      mcp-test.ts              # smoke test of the MCP tool handlers (live)
      repro-rebase.ts          # repros for the upstream rebase/HTTP 500 behavior (live)
```

This shape is meant to survive into the real codebase: `config`, the
client factory, and the schema module are the same pieces the real app
will need, just without a web server or an editing UI wrapped around
them yet.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and adjust if your TerminusDB credentials
   differ from the docker defaults (`admin` / `root`). Since TerminusDB
   is running inside Docker inside your Alpine VM, `TERMINUSDB_ENDPOINT`
   assumes port 6363 is reachable at `localhost` from wherever you run
   Node.
3. `npm run init-db` — creates the `tech_tree_dev` database (skips
   creation if it already exists) and pushes the schema.
4. `npm run concurrent-suite` — runs the full test suite (50 scenarios)
   covering concurrent landings, conflicts, validation gates, and version
   control behaviors.

To start over: `npm run reset-db`, then `npm run init-db` again.

### Tests that need no server

`npm run merge-queue-test`, `npm run validation-gate-test` and
`npm run backlog-features-test` run without a TerminusDB instance. The
`*-live` scripts, `concurrent-suite`, `repro-rebase` and the MCP smoke test
need the server from the steps above.

## TerminusDB MCP server

`src/mcp/index.ts` is a read-only MCP server over stdio that exposes branch
listing, commit-log reading, document fetching and two preset WOQL queries
(cycle detection and blast radius). To use it from an MCP host, launch it
with an absolute path to the script (for example `npx tsx
/path/to/HumanTechTree/src/mcp/index.ts`) and set the TerminusDB settings from
`.env.example` in the host's environment, since the host's working directory
is not the project's.

## What this deliberately doesn't do yet

- No accounts, permissions, or web-facing UI. Architecture
  Overview keeps those as separate concerns; this prototype is data-layer
  only.

## Troubleshooting

- **Connection refused / ECONNREFUSED**: usually means port 6363 isn't
  actually reachable at the address in `.env`.
- **401 / authentication failed**: the `.env` key doesn't match what the
  container was actually started with.
- **"database already exists" on init-db**: harmless — the script
  already treats this as a no-op and moves on to pushing the schema.
