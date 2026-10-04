# Prose Merging

**Status:** Proposed

[Database Choice](database-choice.md) asked whether TerminusDB's merge model gives an acceptable conflict
experience on ordinary prose edited by several people at once. The prototype ran the test, and the answer
for native merging is no. A separate stress test showed that holding long-form text in the graph store
costs memory in proportion to the volume of prose. This essay records both findings, and decides how
long-form prose is stored and merged instead.

## What the tests found

A single text field is one value to the graph store. When one branch edited paragraph 1 of a five-paragraph
description and another edited paragraph 5, the merge failed, with the same cardinality error as any
other same-field collision. Editing the same paragraph failed the same way. There is no line-level or
paragraph-level merge inside a field, and no third view of the text to merge against. Everything else
about prose worked: a 200 KB string round-tripped exactly in under 0.2 seconds, and Unicode, newlines,
and quotes survived intact.

The stress test compared a graph with no prose, prose of about 8 KB on every node held inline, prose on 10%
of nodes, and the same prose as separate documents (figures in [Database Choice](database-choice.md)). Cost
followed the volume of prose, not where it was placed: at 10,000 nodes, memory after a restart roughly
doubled with prose on every node, whether inline or in separate documents, and each edit to a text field
added roughly 15 to 18 KB of storage. Placing the prose in separate documents did not make it cheaper. Only
holding less of it in the store would.

## The position

> **Long-form prose is stored outside the graph, in PostgreSQL, as immutable full-text revisions linked to
> the graph by a stable page identifier. It is merged in the application, with a three-way text merge that
> produces explicit conflict regions for a human to resolve, and the merged result is saved as a new
> revision. Storing a page as separate block records is deferred until real editing patterns show that it
> earns its complexity.**

Long-form prose means a node's article beyond its short description, and policy or essay pages if the wiki
ever holds them (see the open questions). A node's short description, talk-page comments, and argument pages
are small or structured, and stay in the graph store.

## How prose is stored

Three tables in the prose database carry the design.

- **Content.** Each distinct text is stored once, keyed by a hash of the text. Saving text that already
  exists, such as a revert, adds no new copy.
- **Revision.** One row per saved revision: the page it belongs to, its parent revision, the author's
  account identifier (an opaque value, since accounts live in a separate database), the content hash, a
  timestamp, and an edit summary. Revisions are never changed after they are written.
- **Page.** One row per page, with a stable identifier assigned when the page is created and never changed,
  and a pointer to the current revision. A node holds only this identifier.

Full text is kept for every revision, and diffs are computed when someone asks to see one. The merge needs
the base text, a review or rollback needs a revision that can be read without rebuilding it from a chain of
deltas, and a revision's hash is simply the hash of what is stored. The size is modest. Prose of about 8 KB
on each of 10,000 nodes is on the order of 80 MB for the current text, and under 1 GB even at ten revisions
per page before compression, which PostgreSQL applies automatically to large values. These are estimates,
not measurements. If storage ever becomes a concern, periodic full copies with deltas between them can be
added behind the content table's read and write interface without changing anything that refers to a
revision.

Because the content, the revision, and the current-revision pointer all live in one database, a save is one
transaction. It succeeds only if the parent revision the editor started from is still the current one, and
otherwise it is a conflict that goes to the merge below. No branch, staging step, or retry spacing is
involved, which are the costs of landing an edit in the graph store described in
[Editing Model](editing-model.md). The only write that spans both stores is creating a page and then a node
that refers to it. The page is created first, so a failure in between leaves an unreferenced page, which is
harmless and can be cleaned up later.

## How prose is merged

**Option A: merge text in the application.** This is the classic wiki experience. When a save finds that the
current revision is not the one the editor started from, the application takes the editor's starting
revision (the base), the editor's version, and the current version, runs a three-way merge, and either
produces merged text silently (when the edits do not overlap) or presents the overlapping regions for the
editor to choose between. The resolved text is saved as a new revision whose parent is the current one. This
handles the paragraph 1 versus paragraph 5 case without involving a person at all, because non-overlapping
edits merge automatically. Overlapping ones are a genuine conflict on any wiki.

Two details decide whether it works.

- **The library must report conflicts.** A fuzzy-patch library such as diff-match-patch applies patches
  but does not produce conflict regions. A diff3-style merge (for instance `node-diff3`) returns merged
  text plus explicit conflict hunks, which is what the resolution interface needs. A diff library is still
  useful for displaying differences between revisions.
- **The base is a revision.** The editing session records the identifier of the revision it started from.
  Revisions are immutable, so that identifier always resolves to the exact base text, with no need to read
  anything from the graph store's history.

**Option B: store pages as blocks.** A page becomes an ordered set of paragraph or section rows, so edits to
different paragraphs touch different rows. It would give per-block history, attribution, anchors for
comments, and a natural unit for review. Its original appeal was that it would use the graph store's
field-level merge so that the application had less to do. That no longer applies, since the prose database
does not merge for us. It has costs.

- **The ordering becomes the collision point.** If a page holds an ordered list of block references, two
  people inserting blocks both edit that list. A fractional position key on each block avoids this, but it
  has not been tried.
- **Blocks need stable identities.** Editors such as ProseMirror do not give blocks persistent IDs by
  default. An ID scheme has to be added and reconciled on save, covering splits, merges, moves, and
  pastes. How Lexical handles this has not been checked.
- **Blocks should be stored as markdown.** Option A can only diff plain text, so block content should be
  markdown, not the editor's internal JSON.
- **Conflicts do not disappear.** Two people editing the same block, or one editing a block another
  deleted, still conflict. Option A is still needed at the block level, so B never replaces A.

The order matters. A is required in every scenario, B is optional, and adopting B first would still leave
the work of A to do. Building A alone also keeps the editor decision and the storage decision separate.

## Which content actually needs this

| Content | Shape | Where it lives | Prose merge needed? |
| --- | --- | --- | --- |
| Talk pages | One document per comment, append-only | Graph store | No: new comments do not collide |
| Argument pages | Structured data: each premise and inference step is its own document | Graph store | No: same as graph data |
| Node descriptions | A short single field, often borrowed text | Graph store | Rarely: a plain conflict is enough |
| Node articles | Long-form text beyond the description | Prose store | Yes |
| Policy and essay pages | Long-form, edited rarely | Prose store, if held by the wiki | Yes: the least concurrent long-form case |

Policy and essay pages are the least concurrent content in the project, and
[the tech index](tech-index.md) still lists whether they stay a markdown repository as an open question.
If they do, only node articles need this essay for now.

## The editor is a separate decision

A rich-text editor is worth having whichever storage option is chosen, and both ProseMirror and Lexical
are serious candidates. ProseMirror is the current lean. That decision is tracked in the tech index under
Text Editor. The one constraint this essay places on it is that the stored format is markdown, so that
the merge in option A and any future block storage in option B both operate on plain text.

## What this essay does not decide

- The editor library. That is the Text Editor essay.
- Whether block storage is ever adopted. That waits for real edit patterns.
- The conflict-resolution interface design beyond the requirement that overlapping regions are shown to
  the editor with both versions.
- Whether policy and essay pages stay in the repository at all.
- Search over prose. The prose database makes indexed full-text search available, and the Search essay
  decides whether and how it is used.

## Open questions

- **The merge library.** Whether a diff3 library handles the project's markdown well, including tables
  and lists, has not been tried.
- **Watching across two histories.** Graph edits and prose edits have separate histories, so a watchlist
  or recent-changes feed that covers both has to read both. Whether the graph should also record each prose
  edit, so that one commit log still tells the whole story, is not decided. It would tie every prose edit
  to the graph store's landing queue.
- **An article size cap.** The graph store's roughly 100 KB string limit no longer constrains articles.
  Whether to set a cap anyway, for editing and reading reasons, is open.
- **Block storage feasibility.** Whether fractional position keys work as intended, and what happens when
  one editor changes a block that another deleted.
- **Whether the volume of long-form prose editing will ever justify option B.** This is an empirical
  question the project cannot answer before it has editors.
