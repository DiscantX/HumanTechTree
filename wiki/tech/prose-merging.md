# Prose Merging

**Status:** Proposed

[Database Choice](database-choice.md) named one test as the gate before wiki-mechanic content could live
in TerminusDB with confidence: does the store's merge model give an acceptable conflict experience on
ordinary prose edited by several people at once? The prototype ran it, and the answer for native merging
is no. This essay records what was found, and decides how prose is merged instead.

## What the test found

A single text field is one value to the store. When one branch edited paragraph 1 of a five-paragraph
description and another edited paragraph 5, the merge failed, with the same cardinality error as any
other same-field collision. Editing the same paragraph failed the same way. There is no line-level or
paragraph-level merge inside a field, and no third view of the text to merge against. Everything else
about prose worked: a 200 KB string round-tripped exactly in under 0.2 seconds, and Unicode, newlines,
and quotes survived intact.

## The position

> **Long-form prose is merged in the application, with a three-way text merge that produces explicit
> conflict regions for a human to resolve, and the merged result is written back as an ordinary edit.
> Storing a page as separate block documents is deferred until real editing patterns show that it earns
> its complexity.**

Two approaches were weighed. They are not rivals, and the position is to build the first now and decide
on the second later.

**Option A: merge text in the application.** This is the classic wiki experience. When a save would
conflict, the application takes the text the editor started from, the editor's version, and the current
version, runs a three-way merge, and either produces merged text silently (when the edits do not overlap)
or presents the overlapping regions for the editor to choose between. The resolved text is then written
to a fresh branch off current main and landed through the merge queue described in
[Editing Model](editing-model.md). This handles the paragraph 1 versus paragraph 5 case without
involving a person at all, because non-overlapping edits merge automatically. Overlapping ones are a
genuine conflict on any wiki.

Four details decide whether it works.

- **The library must report conflicts.** A fuzzy-patch library such as diff-match-patch applies patches
  but does not produce conflict regions. A diff3-style merge (for instance `node-diff3`) returns merged
  text plus explicit conflict hunks, which is what the resolution interface needs.
- **The base text has to be captured deliberately.** The error the store returns names the instance and
  class involved but is not a reliable source for the common ancestor. The application records the base
  text, or a content hash that resolves to it, when an editing session begins, and performs the merge at
  save time. Commit IDs are not a safe identifier for the base, since rebase rewrites a branch's own
  commits.
- **Merged text goes on a fresh branch.** A conflicted branch cannot be repaired in place, so the
  resolved text is written on a new branch and landed through the queue, with a retry if main has moved
  again.
- **Reading a document at a past commit must work.** If the base is fetched from history instead of
  stored with the session, the API has to support reading a document as of an older commit. That has not
  been tested.

**Option B: store pages as blocks.** A page becomes an ordered set of paragraph or section documents, so
edits to different paragraphs touch different documents and merge with no help from the application. It
uses the store's real strength, and it would also give per-block history, attribution, anchors for
comments, and a natural unit for review. It has costs.

- **The ordering becomes the collision point.** If the page holds an ordered list of block references,
  two people inserting blocks both edit that list. The safer shape is a fractional position key on each
  block and a reference back to its page, so an insert only creates a new document. How the store merges
  list fields has not been tested, so this is a design intent, not a finding.
- **Blocks need stable identities.** Editors such as ProseMirror do not give blocks persistent IDs by
  default. An ID scheme has to be added and reconciled on save, covering splits, merges, moves, and
  pastes. How Lexical handles this has not been checked.
- **Blocks should be stored as markdown.** Option A can only diff plain text, so block content should be
  markdown, not the editor's internal JSON.
- **Conflicts do not disappear.** Two people editing the same block, or one editing a block another
  deleted, still conflict, and edit against delete was seen to produce a different error shape. Option A
  is still needed for the block level, so B never replaces A, it only reduces how often A fires.

The order matters. A is required in every scenario, B is optional, and adopting B first would still
leave the work of A to do. Building A alone also keeps the editor decision and the storage decision
separate.

## Which content actually needs this

Most content in the project does not.

| Content | Shape | Prose merge needed? |
| --- | --- | --- |
| Talk pages | One document per comment, append-only | No: new comments do not collide |
| Argument pages | Structured data: each premise and inference step is its own document | No: same as graph data |
| Node descriptions | A short single field, often borrowed text | Rarely: a plain conflict is enough |
| Policy and essay pages | Long-form, edited rarely | Yes: the only real long-form case |

Policy and essay pages are also the least concurrent content in the project, and
[the tech index](tech-index.md) still lists whether they stay a markdown repository as an open question.
If they do, this essay's problem shrinks to almost nothing for now.

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

## Open questions

- **The merge library.** Whether a diff3 library handles the project's markdown well, including tables
  and lists, has not been tried.
- **Where the base text comes from.** Stored per editing session, or fetched from history. The second
  depends on the past-commit read test.
- **Block storage feasibility.** How the store merges list fields, whether fractional position keys work
  as intended, and what happens when one branch edits a block that another deletes.
- **Whether the volume of long-form prose editing will ever justify option B.** This is an empirical
  question the project cannot answer before it has editors.
