# Data Model

**Status:** Proposed

The policy essays specify what a node and an edge mean. This essay writes down what they *are*, as
concrete, storable fields, so that [Database Choice](database-choice.md) and [Editing
Model](editing-model.md) have an actual schema to sit on top of. Nothing here introduces new meaning;
each field traces to a specific policy decision, cited as it appears. Testing and a reading of the
documentation have changed three things: how a review binds to a version of a claim, how an edge is
keyed so that the store enforces the multiplicity rules, and which collection type holds groundings,
all noted below.

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
| `description` | short text, often a borrowed encyclopedia lede with attribution; kept short, since long-form text goes through `prose_page` | [About the Project](../policy/about-the-project.md) |
| `dates` | node content, e.g. an inception date | not edge-reviewed; see Sourcing policy's node-facts-out-of-scope note below |
| `prose_page` | optional stable identifier of the node's long-form article in the prose store | Prose Merging |
| `redirect_target` | nullable reference to another node's `id` | Governance and Moderation |

Display title and slug are **derived** from `subject` and `stage`, never stored as the field of record,
per What Constitutes a Discovery?'s point that a node's identifier and its display title are separate
concerns.

Blast radius is deliberately absent from this table. It is a transitive-descendant count, always
computed from the live graph, never stored as a node field a write could leave stale. Where and how
often it is computed is a question for the tech index's Computed Values essay, not this one. The
prototype found that computing every node's blast radius in the client over a 300-node, 600-edge graph
takes about 15 to 17 milliseconds, so computing on read is viable at that scale.

A node's article, when it has one beyond the short description, is not stored in the node document. It lives
in the prose store (see [Prose Merging](prose-merging.md)), and the node holds only `prose_page`, an
identifier assigned when the page is created and never changed. Which revision is current is recorded in the
prose store, not on the node, so a prose edit never changes the node document.

## Edge, as a claim

> **An edge is stored as its own document, not as an entry nested inside either endpoint node's
> document.** This is the concrete decision [Editing Model](editing-model.md) depends on: it is what
> lets unrelated claims about the same node avoid colliding in a merge.

| Field | Type | Source |
| --- | --- | --- |
| `id` | stable identifier, derived from the key fields `source_node`, `target_node`, `basis`, and `origin` (see Keys and uniqueness) | Governance and Moderation |
| `source_node`, `target_node` | node `id` references, ordered | [Edge Schema](../policy/edge-schema.md) |
| `statement` | text; the claim itself | Edge Schema, Sourcing and Citation Policy |
| `relationship_kind` | enum: material necessity, conceptual enablement, combination, mere influence, or an unset generic default | Edge Schema |
| `basis` | enum: historical attestation, logical necessity, or unspecified | [Historical Attestation vs. Logical Necessity](../policy/historical-vs-logical-necessity.md) |
| `origin` | text (region or instance); present only on historical-attestation edges | Historical Attestation vs. Logical Necessity |
| `groundings` | set of Grounding sub-documents, see below | Sourcing and Citation Policy |
| `objections` | set of Objection sub-documents, see below | Sourcing and Citation Policy, Governance and Moderation |
| `status` | computed enum: ungrounded, red, yellow, green; never editor-set | Sourcing and Citation Policy |

Multiplicity follows directly from Edge Schema and Historical Attestation vs. Logical Necessity: at
most one logical-necessity edge per node pair, and at most one historical-attestation edge per node
pair per distinct `origin` value. The store enforces both through the edge's key, described in the
next section, so the validation gate does not have to.

One discrepancy to resolve: the prototype schema (`src/schema/graph-schema.ts`) currently stores
`status` as an ordinary required field on the edge. That contradicts the rule above that status is
computed and never editor-set. It was harmless for a first pass, but it means a stored value could go
stale or be set by hand. The field should either be removed from the stored schema or kept strictly as a
cache written only by the computation, and this is left for the Computed Values essay.

## Keys and uniqueness

The first prototype gave every node and edge a random key, so each insert minted a new identifier and two
identical claims were accepted as two documents. That is a property of the key strategy, not a limitation
of the store. A deterministic key builds the identifier from named fields, and the store then refuses a
second document with the same fields. Probes against the store settled what such a key can be made of and
how it behaves.

- **Optional fields can be key fields.** An absent value is written into the identifier as a fixed
  placeholder (`+none+`), so "no origin" is simply one more value.
- **Reference fields and enums can be key fields.** A key over two node references, and a key over two
  references, an enum, and an optional string together, all worked.
- **A duplicate is refused.** A second document with the same key fields is rejected with
  `DocumentIdAlreadyExists`, even when its other fields differ.
- **A key field cannot be edited in place.** An update that changes one is rejected with
  `SubmittedIdDoesNotMatchGeneratedId`. Changing a key field means a new document: a delete and an insert.
- **Two branches adding the same key behave like any same-field collision.** With different statements,
  the second merge fails with the same cardinality conflict on the statement that any same-field edit
  produces. With identical statements, the two converge to one document.

> **An edge's key is `(source_node, target_node, basis, origin)`. Nodes keep random keys.**

- **Why these four fields.** They are exactly the parts of a claim that the policies treat as making it a
  different claim: which pair, on which basis, and for a historical attestation, which origin. With them in
  the key, the store itself enforces "at most one logical-necessity edge per pair" (provided `origin` is left empty
  on logical-necessity edges, which the store cannot require and the gate must check) and "at most one
  historical-attestation edge per pair per origin". A key over `relationship_kind` as well would have allowed two logical-necessity edges that
  differed only in kind, which Edge Schema forbids, so it is deliberately left out and stays editable.
- **Why nodes stay random.** Governance and Moderation requires a node's identifier to be stable across
  renames, moves, and merges, so it cannot be derived from anything an editor can change.
- **An edge changes identity when its proposition does.** Editing `basis`, `origin`, or an endpoint produces
  a new document. The old claim keeps its reviews and objections and the new one starts with none, which
  matches the Sourcing policy's rule that a substantive change invalidates reviews. A physical re-pointing
  of an edge, such as when a node is merged into another, is therefore a delete and an insert. Whether the
  old reviews may be carried across by explicit re-attestation is a governance question. A redirect, by
  contrast, leaves the stored edge untouched and is resolved when the graph is read.
- **An unspecified basis is a value like any other.** A bare edge and a basis-specific edge on the same pair
  have different keys, so the store permits both. Whether it should is Edge Schema's open question, and the
  validation gate is the place to flag it.
- **Duplicates arrive in two forms.** Inserting a duplicate on one branch fails with
  `DocumentIdAlreadyExists`. The same claim added on two branches fails at merge as a cardinality conflict
  on its statement, which the merge queue already translates. In that case the conflict means two editors
  proposed the same claim with different wording, and resolving it is choosing the wording.

## Grounding

A grounding is not a top-level stored object with its own `id` in the same sense as a node or edge. It
is always a sub-object of the claim it backs, matching Sourcing and Citation Policy's point that a
grounding exists to support one specific claim and is meaningless detached from it.

| Field | Type | Notes |
| --- | --- | --- |
| `type` | Citation or Argument | Sourcing and Citation Policy |
| `source` | text/reference | Citation only: what states the claim |
| `premises` | ordered sequence (a List, see below), each itself grounded by a citation or a sub-argument | Argument only; recursive, and the leaves of the recursion must be citations |
| `ungrounded_premises` | derived: the premises with no grounding, always shown, never averaged into a score | Argument only |
| `reviews` | set of Review sub-documents | both types, reviewed to the same standard |

Nesting groundings inside the claim was tested, because two editors appending to the same nested
collection at once might collide even though they touch different entries. The collection type decides
the outcome.

| Type | Two branches each append a different entry | Outcome |
| --- | --- | --- |
| `Set` | Both land | Both entries survive |
| `List` | Second merge fails | A cardinality conflict, reported like any same-field collision |
| `Array` | Both land | **Silently wrong:** the result was the base entry twice plus both additions, which neither branch wrote |

A `Set` of sub-documents, each keyed by a hash of its value, behaved the same way as a `Set` of strings:
both appends survived and nothing was duplicated.

- **Groundings, objections, and reviews are Sets of sub-documents nested in the claim.** They are
  independent entries with no order, so concurrent additions merging is what is wanted. Nothing tested
  needed them to be separate documents, so the embedded form is enough.
- **`Array` is never used,** because it fails without any error.
- **Premises are ordered, and a Set has no order.** The two options are a `List`, where concurrent edits to
  one argument's chain conflict, or a Set with an explicit position field on each premise. The leaning is
  `List`. A deductive chain is one author's structure, and two editors changing it at once should be
  stopped and shown the collision, because inserting or reordering a step changes what a reviewer attested
  to.
- **Two branches editing the same sub-document.** With a stable key on the sub-document, two branches
  changing different fields of one entry merged and both changes survived. Changing the same field on both
  was reported as a conflict, and the first branch's value stayed.
- **Reviews nested inside a grounding.** Two branches each appended a review to the same grounding's `Set`,
  and all three reviews survived, so reviews can sit one level inside a grounding.
- **Premises as a `List` of sub-documents.** Two branches each appending a step conflicted, and so did two
  branches editing different steps of one chain, with the first branch's version kept. That matches the
  leaning below: concurrent edits to one argument's chain are stopped and shown the collision.

The shared document type (added in server 12.0.6), with its own identifier that several parents can
reference, remains documented and unused. It becomes relevant only if a grounding ever needs to be edited
or referenced independently of its claim.

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
matches the branch's two own commits being the ones changed, and in the third run none of the branch's two
own commits could be found on main after landing). Nor is there a merge operation that avoids
this: the server's version-control operations are rebase, which replays commits, and apply, which
squashes them. A rebase is documented to return a report mapping each replayed commit to the commit IDs it
became, so a commit-based binding could in principle be kept current, but in the third run that report
came back empty for a replay that had plainly rewritten commits, and relying on it would couple reviews to
the store's internal bookkeeping in any case. A hash of the grounding's formal structure is stable across rebases and also lines
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
| No dangling edge after concurrent delete and add | **No** | An edge added on one branch landed on main after another branch had deleted its target, and the rebase report called the replay valid. Replaying main's delete onto the edge branch fails instead, with `instance_not_of_class`, so only one direction is enforced |
| No cycles among logical-necessity edges | **No** | Two independently added edges formed a cycle and both merged |
| No self-loops | **No** | A self-loop edge was accepted |
| No duplicate claims | **Yes, under the composite edge key** (no under random keys) | Under random keys two identical claims were accepted. Under the key, a second is rejected with `DocumentIdAlreadyExists` |
| At most one logical-necessity edge per pair | **Yes, under the composite edge key** (no under random keys) | Under random keys, two such edges merged. Under the key, the second insert is rejected, and the same claim added on two branches conflicts at merge |
| At most one historical-attestation edge per pair per origin | **Yes, under the composite edge key** | A second claim repeating an origin was rejected, and different origins were accepted |
| `origin` empty on logical-necessity edges | **No** | The key accepts any origin value, so a logical-necessity edge given an origin would escape the one-per-pair rule |
| A bare-basis edge alongside a basis-specific edge on one pair | **No** | The two have different keys, so both are accepted |

Everything in the "No" rows belongs to the validation gate, which is consistent with what Governance and
Moderation already assumed. The multiplicity rules no longer need the gate, since the edge key enforces
them.

## Clusters are not stored as graph entities

Per [Node Granularity](../policy/node-granularity.md), a cluster is never a node and never an edge
endpoint; it is computed from the live edge set at render or query time and is re-derivable at any
time. The only thing actually stored is a thin `PinnedCluster` record for editor-named clusters: a
slug, an editor-assigned name, and a snapshot of the membership at pin time, used solely to compute
drift against the algorithm's current answer. This record is metadata about a computed fact, not the
fact itself, and it carries no edges of its own.

## Wiki-mechanic content

Under the direction recorded in [Architecture Overview](architecture-overview.md), talk-page comments and
argument pages are documents in the same store, sharing the same commit history as nodes and edges. Their
own field-level schema is deliberately out of scope here and belongs to the tech index's Talk Pages and
Argument Pages essay, which has not yet been drafted. One constraint from the prose findings reaches this
essay: talk-page comments should be stored one document per comment, so that new comments never collide.

Long-form text is not stored here. A text field is a single value to this store and cannot be merged
inside it, and holding prose on every node costs memory in proportion to its volume (see
[Database Choice](database-choice.md)). It lives in the prose store as immutable revisions, whose fields
are specified in Prose Merging, and is reached from the graph only through a node's `prose_page`.

## What this essay does not decide

- The literal TerminusDB JSON-LD schema declarations. That is an implementation detail below the level
  of a policy essay, apart from the key and collection-type positions above.
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
- **Carrying reviews across a re-pointing.** A physical re-pointing of an edge is a new document, so its
  reviews do not carry over. Whether a reviewer may re-attest across such a change in one action, as the
  Sourcing policy allows for a small edit, and whether a display-time redirect should reset reviews at all,
  belong to Governance and Moderation.
- **The key of a grounding.** The nested-review test keyed the grounding on its name. A key that hashes every
  field of a grounding would change the grounding's identity when a review is added to it, since the reviews
  sit inside it. Which fields identify a grounding, and whether reviews are kept out of that key, is not
  settled and is tied to which fields go into a review's content hash.
- **Whether one-claim-per-document holds up under real editing load.** Supported in the prototype's
  small simulated tests. Shared with Editing Model's own open questions.
- **Block storage for long-form content.** If Prose Merging's deferred option is ever adopted, blocks
  become rows in the prose store with a position key and a page reference. Not modeled here.
- **Prose edits and the graph's commit log.** The node holds only `prose_page`, so the graph's commit log
  does not show prose edits. Recent changes come from the activity table in the prose database instead, as
  set out in Prose Merging.
- **The stored `status` field.** Whether to remove it from the stored schema or keep it as a computed
  cache. See the note under Edge above.
