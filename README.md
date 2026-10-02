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
    log.ts               # commit log helper with pagination support
    rebase.ts            # branch rebase helper using the official JS client
    merge-queue.ts       # staged landing and serialized merge queue
    validation-gate.ts   # graph validation (dangling edges, self-loops, cycles)
  schema/
    graph-schema.ts      # Node/Edge schema transcribed from wiki/tech/data-model.md
  scripts/
    init-db.ts           # create the dev db (if needed) + push schema
    reset-db.ts          # delete the dev db entirely
    concurrent-suite.ts  # 50 comprehensive concurrency & conflict scenarios
    merge-queue-live.ts  # live merge queue tests against TerminusDB
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
