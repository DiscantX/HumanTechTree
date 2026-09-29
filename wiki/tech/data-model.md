# Data Model

**Status:** Proposed

The policy essays specify what a node and an edge mean. This essay writes down what they *are*, as
concrete, storable fields, so that [Database Choice](database-choice.md) and [Editing
Model](editing-model.md) have an actual schema to sit on top of. Nothing here introduces new meaning;
each field traces to a specific policy decision, cited as it appears.

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
often it is computed is a question for the tech index's Computed Values essay, not this one.

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
pair per distinct `origin` value. Nothing in the schema itself enforces this; it is a rule the
validation gate checks, the same way it checks for cycles.

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

## Review

| Field | Type | Notes |
| --- | --- | --- |
| `reviewer` | account reference | Sourcing and Citation Policy |
| `bound_version` | the specific version of the grounding reviewed | reviews invalidate on any substantive change to that version |
| `is_bot` | boolean | Sourcing and Citation Policy, bots section |
| `model_family` | text, bots only | same-model-family bots count as one reviewer in the independence tally |

## Objection

| Field | Type | Notes |
| --- | --- | --- |
| `target` | a specific premise, inference step, or the source-to-premise fit | Sourcing and Citation Policy |
| `status` | open or resolved | an open objection caps status at yellow |
| `resolution` | withdrawn, grounding amended, or reviewers judged it answered | Sourcing and Citation Policy |

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
Talk Pages and Argument Pages essay, which has not yet been drafted. This essay only asserts that they
exist as documents alongside nodes and edges, not what shape those documents take.

## What this essay does not decide

- The literal TerminusDB JSON-LD schema declarations (types, `@key` strategies, and so on). That is an
  implementation detail below the level of a policy essay.
- The internal schema of talk, policy, and argument pages. That belongs to Talk Pages and Argument
  Pages, still Open.
- When and how computed fields like blast radius, status, and cluster membership are actually
  calculated and cached. That belongs to Computed Values, still Open.
- The validation gate's specific checks and when they run. That belongs to The Validation Gate, still
  Open.

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
- **Whether one-claim-per-document holds up under real editing load.** Shared with Editing Model's own
  open questions; this schema commits to the storage shape that assumption depends on.
