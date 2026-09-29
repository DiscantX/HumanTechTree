# Tech Tree Wiki — Prototype

First working step of the prototype: prove Node/TypeScript can talk to
TerminusDB, push a schema, and round-trip a Node/Edge pair through it.
Nothing here is the real application — it's deliberately small so it's
easy to throw away or rebuild pieces of as the tech essays settle.

## Layout

```
src/
  config.ts              # env-based settings, read once, everywhere
  db/
    client.ts             # WOQLClient factory
    rebase.ts               # direct REST call for branch merge/rebase
                             # (see the comment at the top of the file for
                             # why this isn't going through the JS client
                             # wrapper)
  schema/
    graph-schema.ts        # Node/Edge schema, transcribed from
                            # wiki/tech/data-model.md (Grounding/Review/
                            # Objection deliberately left out for now —
                            # see the comment in that file)
  scripts/
    init-db.ts              # create the dev db (if needed) + push schema
    smoke-test.ts            # insert 2 Nodes + 1 Edge, read it back
    concurrent-edit-test.ts   # branch/merge exercise — see below
    reset-db.ts              # delete the dev db entirely
```

This shape is meant to survive into the real codebase: `config`, the
client factory, and the schema module are the same pieces the real app
will need, just without a web server or an editing UI wrapped around
them yet.

## Setup

1. `npm install`
2. `cp .env.example .env` and edit it if your TerminusDB credentials
   differ from the docker defaults (`admin` / `root`). Since TerminusDB
   is running inside Docker inside your Alpine VM, `TERMINUSDB_ENDPOINT`
   assumes port 6363 is reachable at `localhost` from wherever you run
   Node. If it isn't — for example if Node runs on the host and the VM's
   networking is NAT rather than bridged/host-only with a forwarded port
   — change it to the VM's address instead.
3. `npm run init-db` — creates the `tech_tree_dev` database (skips
   creation if it already exists) and pushes the schema with
   `full_replace: true`, so it's safe to re-run after schema edits.
4. `npm run smoke-test` — inserts two placeholder Nodes and one Edge,
   then reads the Edge back and prints it. This is the actual test:
   if this prints a document with `source_node`/`target_node` resolved,
   the connection, schema, and basic CRUD all work.
5. `npm run concurrent-edit-test` — exercises branch-and-merge. See
   below for what it's actually testing. Safe to re-run; each run uses
   freshly-named branches.

To start over: `npm run reset-db`, then `npm run init-db` again.

## What the concurrent-edit test is actually checking

Editing Model (the tech essay) makes two specific claims about how
TerminusDB's branch-and-merge behaves here, and flags the first one as
untested. This script tests both directly, against the real database:

- **Scenario 1 — unrelated edits.** Two branches each add a brand-new
  Node (different documents). Both merge onto main cleanly, even after
  main has already moved between the two merges. This is the
  "one-claim-per-document" collision-reduction argument the essay's own
  open questions call out as assumed but unverified.
- **Scenario 2 — a real conflict.** Two branches both edit the `status`
  field of the *same* Edge, starting from the same baseline value. The
  first merge succeeds; the second is expected to surface as a genuine
  merge conflict, per the essay's claim that this "resolves exactly the
  way TerminusDB already handles it: an ordinary merge conflict... with
  no new machinery needed."

If scenario 2 doesn't actually conflict — if TerminusDB just picks one
side silently — that's worth taking seriously rather than shrugging
off, since Editing Model's whole argument for sticking with
branch-and-merge leans on conflicts being visible and surfaced, not
silently resolved.

One implementation note: the merge/rebase step in `db/rebase.ts` calls
TerminusDB's REST endpoint directly rather than going through the JS
client's own method for it. See the comment at the top of that file —
short version, I could confirm the REST endpoint's exact shape with
confidence but not the JS client wrapper's method name for it, and
didn't want to guess at the latter.

## What this deliberately doesn't do yet

- No Grounding/Review/Objection modeling. Left out of the schema on
  purpose — see the comment at the top of `graph-schema.ts`.
- No validation gate (cycle check, dangling-edge check, etc.). Those are
  application code that runs after a merge, per Governance and
  Moderation and the tech index's Validation Gate entry. Now that
  branch/merge actually works (concurrent-edit-test.ts), this is the
  natural next thing to try — e.g. two branches that each add a valid
  logical-necessity edge, which together form a cycle only once merged.
- No prose-merge test. Database Choice names this as its own separate,
  blocking open question: whether TerminusDB's diff/merge gives an
  acceptable experience on ordinary concurrently-edited *prose* fields,
  not just structured documents like Node/Edge. concurrent-edit-test.ts
  doesn't touch that — worth its own script once there's a prose-bearing
  document type (talk pages, policy pages) to test it against.
- No accounts, permissions, or web-facing anything. Architecture
  Overview keeps those as separate concerns; this prototype is data-layer
  only.

## Troubleshooting

- **Connection refused / ECONNREFUSED**: usually means port 6363 isn't
  actually reachable at the address in `.env`. Worth checking from inside
  the Alpine VM itself first (`curl http://localhost:6363/api/info`)
  before assuming the Node side is wrong.
- **401 / authentication failed**: the `.env` key doesn't match what the
  container was actually started with. Check whatever env var or
  docker-compose setting configured the admin password when you set the
  container up.
- **"database already exists" on init-db**: harmless — the script
  already treats this as a no-op and moves on to pushing the schema.
- **concurrent-edit-test fails on the rebase step specifically** (not on
  branch/checkout/addDocument): most likely the REST endpoint shape in
  `db/rebase.ts` doesn't match your TerminusDB version. The error message
  includes the HTTP status and response body — paste that back and it's
  a quick fix, since everything else in the script is confirmed working
  if it gets that far.
