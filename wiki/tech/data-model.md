# Data Model

**Status:** Proposed

The policy essays specify what a node and an edge mean. This essay writes down what they *are*, as
concrete, storable fields, so that [Database Choice](database-choice.md) and [Editing
Model](editing-model.md) have an actual schema to sit on top of. Nothing here introduces new meaning;
each field traces to a specific policy decision, cited as it appears. Testing and a reading of the
documentation have changed two things: how a review binds to a version of a claim, and what is known
about key strategies and uniqueness, both noted below.

## Why this is mostly transcription

Every field below is already implied by an existing policy essay. This essay's job is to collect them
into one schema, fix which fields live on which object, and settle the storage-granularity question
Editing Model depends on: that a claim is its own document, not a nested entry inside a node's.

## Node

| Field | Type | Source |
| --- | --- | --- |
| `id` | stable identifier, distinct from title/slug | [Governance and Moderation](../policy/graph-governance-and-moderation.md), stable-identity section |
| `subject` | required string/text | [What Constitutes a Discovery?](../policy/what-constitutes-a-discovery.md) |
| `stage` | optional enum: Observation, Exploitation, Production, Explanation | What Constitutes a Discovery? |
| `category` | Discovery, Invention, Achievement, or computed Disambiguation for an undivided multi-category subject | [Achievement vs. Discovery vs. Invention](../policy/achievement-discovery-invention.md) |
| `description` | short text, often a borrowed encyclopedia lede with attribution | [About the Project](../policy/about-the-project.md) |
| `dates` | node content, e.g. an inception date | not edge-reviewed; see Sourcing policy's node-facts-out-of-scope note below |
| `redirect_target` | nullable reference to another node's `id` | Governance and Moderation |

Display title and slug are **derived** from `subject` and `stage`, never stored as the field of record,
per What Constitutes a Discovery?'s point that a node's identifier and its display title are separate
concerns.

Blast radius is deliberately absent from this table. It is a transitive-descendant count, always
computed from the live graph, never stored as a node field a write could leave stale. Where and how
often it is computed is a question for the tech index's Computed Values essay, not this one. The
prototype found that computing every node's blast radius in the client over a 300-node, 600-edge graph
takes about 15 to 17 milliseconds, so computing on read is viable at that scale.

## Edge, as a claim

> **An edge is stored as its own document, not as an entry nested inside either endpoint node's
> document.** This is the concrete decision [Editing Model](editing-model.md) depends on: it is what
> lets unrelated claims about the same node avoid colliding in a merge.

| Field | Type | Source |
| --- | --- | --- |
| `id` | stable identifier | Governance and Moderation |
| `source_node`, `target_node` | node `id` references, ordered | [Edge Schema](../policy/edge-schema.md) |
| `statement` | text; the claim itself | Edge Schema, Sourcing and Citation Policy |
| `relationship_kind` | enum: material necessity, conceptual enablement, combination, mere influence, or an unset generic default | Edge Schema |
| `basis` | enum: historical attestation, logical necessity, or unspecified | [Historical Attestation vs. Logical Necessity](../policy/historical-vs-logical-necessity.md) |
| `origin` | text (region or instance); present only on historical-attestation edges | Historical Attestation vs. Logical Necessity |
| `groundings` | list of Grounding objects, see below | Sourcing and Citation Policy |
| `objections` | list of Objection objects, see below | Sourcing and Citation Policy, Governance and Moderation |
| `status` | computed enum: ungrounded, red, yellow, green; never editor-set | Sourcing and Citation Policy |

Multiplicity follows directly from Edge Schema and Historical Attestation vs. Logical Necessity: at
most one logical-necessity edge per node pair, and at most one historical-attestation edge per node
pair per distinct `origin` value. Nothing in the prototype schema enforces this; it is a rule the
validation gate checks, the same way it checks for cycles. Whether the store could enforce some of it
through the document key is the subject of the next section.

One discrepancy to resolve: the prototype schema (`src/schema/graph-schema.ts`) currently stores
`status` as an ordinary required field on the edge. That contradicts the rule above that status is
computed and never editor-set. It was harmless for a first pass, but it means a stored value could go
stale or be set by hand. The field should either be removed from the stored schema or kept strictly as a
cache written only by the computation, and this is left for the Computed Values essay.

## Keys and uniqueness

The prototype gives every node and edge a random key, so each insert mints a new identifier and two
identical claims are accepted as two documents. That is a property of the key strategy, not a limitation
of the store. The schema reference documents deterministic alternatives: a lexical key builds the
identifier from named fields, a hash key builds it from a hash of named fields, and a value-hash key
hashes the whole document. A deterministic key would make the store itself reject an exact duplicate.

That is attractive, but it is not free, and the obvious version conflicts with the policies.

- **The multiplicity rules are not "unique over a fixed set of fields".** A logical-necessity claim is
  unique per node pair regardless of its relationship-kind, while a historical-attestation claim is
  unique per pair *and origin*. A key built from source, target, relationship-kind, and origin would
  therefore allow two logical-necessity edges for one pair that differed only in kind, which Edge Schema
  forbids, and would need `basis` in the key to distinguish the two cases at all.
- **A key field is part of the identifier, so editing it changes the identifier.** The expected
  behavior, which the documentation does not state, is that changing a key field means a new document, not
  an update. Since `relationship_kind` and `basis` are fields editors are expected to revise, keying on
  them would turn a routine edit into a delete and an insert, detaching reviews, objections, and any
  references from the claim they belong to. A whole-document hash is worse, since every edit would
  change the identifier.
- **Optional and reference key fields are undocumented.** `origin` and `basis` are optional, and
  `source_node` and `target_node` are references. Whether either can be part of a key is not stated in
  the documentation. Scenarios that probe an optional key field, a key over two node references, and an
  edit to a key field are written and awaiting their first run.

The position for now is to leave keys random and keep uniqueness with the validation gate, and to revisit
once those probes have run. If a deterministic key proves workable, the natural candidate is a narrow one
over the immutable parts of a claim's identity, not over its editable content.

## Grounding

A grounding is not a top-level stored object with its own `id` in the same sense as a node or edge. It
is always a sub-object of the claim it backs, matching Sourcing and Citation Policy's point that a
grounding exists to support one specific claim and is meaningless detached from it.

| Field | Type | Notes |
| --- | --- | --- |
| `type` | Citation or Argument | Sourcing and Citation Policy |
| `source` | text/reference | Citation only: what states the claim |
| `premises` | ordered list, each itself grounded by a citation or a sub-argument | Argument only; recursive, and the leaves of the recursion must be citations |
| `ungrounded_premises` | list, always shown, never averaged into a score | Argument only |
| `reviews` | list of Review objects | both types, reviewed to the same standard |

Nesting groundings inside the claim has a cost that the prototype has not yet measured. Two editors
appending to the same nested list at once might collide even though they touch different entries. The
schema offers `Set`, `List`, and `Array` collection types, and the documentation says nothing about how
concurrent appends to each merge, so the choice of type matters and is untested. Two storage options are
also documented and undecided: an embedded sub-document, owned by its parent and not independently
updatable, and a shared document type (added in server 12.0.6) with its own identifier that several
parents can reference. Which suits groundings and objections depends on the collection test and on
whether they ever need to be edited or referenced independently.

## Review

| Field | Type | Notes |
| --- | --- | --- |
| `reviewer` | account reference | Sourcing and Citation Policy |
| `bound_version` | a content hash of the grounding as reviewed | reviews invalidate on any substantive change to that content |
| `is_bot` | boolean | Sourcing and Citation Policy, bots section |
| `model_family` | text, bots only | same-model-family bots count as one reviewer in the independence tally |

**Why a content hash and not a commit ID.** An earlier version of this table bound a review to "the
specific version of the grounding reviewed" without saying how a version is named. The obvious answer is
the commit that created it. The prototype showed that is unsafe: landing a branch replays it onto main,
and the branch's own commits are rewritten (in the second run, 194 of 196 commit IDs survived, which
matches the branch's two own commits being the ones changed). Nor is there a merge operation that avoids
this: the server's version-control operations are rebase, which replays commits, and apply, which
squashes them. A rebase does return a report mapping each replayed commit to the commit IDs it became,
so a commit-based binding could in principle be kept current, but that couples reviews to the store's
internal bookkeeping. A hash of the grounding's formal structure is stable across rebases and also lines
up with the Sourcing policy's rule that a substantive change is computed from the difference, since two
versions with the same hash have no difference. Which fields go into the hash is settled by the planned
Argument Page Format policy.

## Objection

| Field | Type | Notes |
| --- | --- | --- |
| `target` | a specific premise, inference step, or the source-to-premise fit | Sourcing and Citation Policy |
| `status` | open or resolved | an open objection caps status at yellow |
| `resolution` | withdrawn, grounding amended, or reviewers judged it answered | Sourcing and Citation Policy |

## What the database enforces, and what the gate must

The prototype tested which of the schema's rules the store enforces by itself. This division decides
what the validation gate has to be written to catch.

| Rule | Enforced by the store? | Evidence |
| --- | --- | --- |
| Required fields present | Yes | An edge missing its statement was rejected |
| Enum values valid | Yes | Invalid relationship kinds and stages were rejected |
| No unknown properties | Yes | An extra field was rejected |
| Edge endpoints exist on insert | Yes | An edge to a nonexistent node was rejected |
| No node deletion with dependents | Yes | A direct delete was refused |
| No dangling edge after concurrent delete and add | Yes | The merge failed and main stayed consistent |
| No cycles among logical-necessity edges | **No** | Two independently added edges formed a cycle and both merged |
| No self-loops | **No** | A self-loop edge was accepted |
| No duplicate claims | **No, under random keys** | Two identical claims were accepted; a deterministic key might change this (see above) |
| At most one logical-necessity edge per pair | **Unknown** | Both attempts to test it hit a server error before they could answer |
| At most one historical-attestation edge per pair per origin | **Not tested** | |

Everything in the "No" and "Unknown" rows belongs to the validation gate, which is consistent with what
Governance and Moderation already assumed.

## Clusters are not stored as graph entities

Per [Node Granularity](../policy/node-granularity.md), a cluster is never a node and never an edge
endpoint; it is computed from the live edge set at render or query time and is re-derivable at any
time. The only thing actually stored is a thin `PinnedCluster` record for editor-named clusters: a
slug, an editor-assigned name, and a snapshot of the membership at pin time, used solely to compute
drift against the algorithm's current answer. This record is metadata about a computed fact, not the
fact itself, and it carries no edges of its own.

## Wiki-mechanic content

Under the direction recorded in [Architecture Overview](architecture-overview.md), talk pages, policy
pages, and argument pages are documents in the same store, sharing the same commit history as nodes and
edges. Their own field-level schema is deliberately out of scope here and belongs to the tech index's
Talk Pages and Argument Pages essay, which has not yet been drafted. Two constraints from the prose
findings do reach this essay. Talk-page comments should be stored one document per comment, so that new
comments never collide. And any long-form text field is a single value to the store and cannot be merged
inside it, which [Prose Merging](prose-merging.md) addresses in the application.

## What this essay does not decide

- The literal TerminusDB JSON-LD schema declarations (types, key strategies, and so on). That is an
  implementation detail below the level of a policy essay, apart from the key question above.
- The internal schema of talk, policy, and argument pages. That belongs to Talk Pages and Argument
  Pages, still Open.
- When and how computed fields like blast radius, status, and cluster membership are actually
  calculated and cached. That belongs to Computed Values, still Open.
- The validation gate's specific checks and when they run. That belongs to The Validation Gate, still
  Open.
- Which fields go into a review's content hash. That belongs to the planned Argument Page Format policy.

## Open questions

- **Sourcing node-level facts.** Sourcing and Citation Policy explicitly leaves open how stage claims,
  dates, and category assignments are grounded and reviewed, since its own review mechanism covers
  edges, not node content. This schema stores those fields on the node but does not resolve how, or
  whether, they get any grounding at all.
- **Multi-origin subjects and stage chains.** What Constitutes a Discovery? leaves open whether a
  subject with several independent historical origins needs a separate stage chain per origin. This
  schema does not resolve it; `stage` is modeled here as a single field per node, which will need
  revisiting if the answer turns out to be "one stage chain per origin."
- **Redirect chains.** Whether a `redirect_target` may itself point to a redirected node, and how that
  resolves, is not specified.
- **Deterministic keys.** Whether a key over an edge's immutable identity is workable: whether key
  fields can be optional or references, and what editing one does. Untested, and the documentation is
  silent.
- **Collection fields under concurrent edits.** Whether two editors appending to `groundings` or
  `objections` inside the same claim collide, and whether `Set`, `List`, or `Array` behaves differently.
  If they collide, groundings and objections may need to become their own documents referencing the
  claim, which would change this schema. This is the most important untested assumption behind
  one-claim-per-document.
- **Whether one-claim-per-document holds up under real editing load.** Supported in the prototype's
  small simulated tests. Shared with Editing Model's own open questions.
- **Block storage for long-form content.** If [Prose Merging](prose-merging.md)'s deferred option is
  ever adopted, blocks become a new document type with a position key and a page reference. Not modeled
  here.
- **The stored `status` field.** Whether to remove it from the stored schema or keep it as a computed
  cache. See the note under Edge above.
