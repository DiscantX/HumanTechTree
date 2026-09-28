# About the Project

**Status:** Proposed

The Human Tech Tree Wiki maps human technology and history as one large graph. Every discovery,
invention, and achievement is a point on the graph, and lines between them record what each one
depended on. Follow the lines backward from almost anything, a loaf of bread or a smartphone, and you
arrive at the earliest things people ever learned to do, such as controlling fire and farming.

The idea comes from Carl Sagan's remark that making an apple pie from scratch requires inventing the
universe first. This project takes the remark seriously and asks what the chain of prerequisites
actually looks like, and where it can sensibly stop.

This page explains what the project is, how the graph works, and how its rules are organized. It ends
with a glossary of the terms used across the project's policy essays.

## What the project is

The core of the project is the *connections*. Descriptions of individual technologies are easy to
find elsewhere. What is rare is a place that shows how they depend on each other, at a scale that
runs from the earliest human techniques to the present. For that reason each entry carries a short
description, borrowed with attribution from an existing encyclopedia where possible, and the
project's own effort goes into the links between entries and the evidence for them.

The intended reader is anyone curious about how things came to be, from a casual browser to a
researcher. The site is meant to feel somewhat like a game, with a tech tree you can explore, while
remaining a serious and practical reference. Its scope is deliberately large. The rules described
below exist partly to keep that scope manageable.

## A picture of how it works

Take the apple pie. Very roughly, and only as an illustration, a pie needs baking, which needs
controlled heat, which needs the ability to make and keep a fire. It also needs flour, which needs
milled grain, which needs farming. Each of those is a point on the graph, and each "needs" is a line
between two points. Follow any line back far enough and you reach the same small set of foundational
human achievements.

Three questions come up at once, and most of the project's policy essays answer one of them.

1. **What counts as a point?** Not everything that exists belongs on the graph. Gravity, for
   instance, is a prerequisite of nearly everything, yet nobody made it. The rules for what belongs
   are in [Founding Axioms](founding-axioms.md).
2. **What counts as a line, and how do we know it is right?** Saying that one thing required another
   is a claim, and claims need support. Each line is stored with its kind, its basis, and the
   evidence or reasoning behind it, and readers can see how well supported it is.
3. **Who keeps it correct?** A graph that anyone can edit can break in ways a text encyclopedia
   cannot, so the project has rules for reviewing, protecting, and repairing it.

## How the policy essays are organized

The project's rules are written as a set of short essays, each settling one question and explaining
its reasoning. They reference each other by name. They are grouped below by the question they answer.

**What belongs on the graph**

- [Founding Axioms](founding-axioms.md): what never becomes a node.
- [Achievement vs. Discovery vs. Invention](achievement-discovery-invention.md): the
  categories a node can be.
- [What Constitutes a Discovery?](what-constitutes-a-discovery.md): the stages a single
  subject can pass through, and the shapes those stages take.
- Can an Achievement Become a Genuine Prerequisite?: the rare cases where doing something and
  knowing how to do it cannot be separated.
- [Node Granularity](node-granularity.md): what counts as one node, and when a topic should
  be split.
- [The Culture / Social-Systems Layer](culture-social-systems-layer.md): how writing, money,
  and political institutions fit into a graph built around technology.

**How things connect**

- [Edge Schema](edge-schema.md): the fields every edge carries.
- [Historical Attestation vs. Logical Necessity](historical-vs-logical-necessity.md):
  whether an edge records what actually happened or what any civilization would have needed.

**How claims are supported and kept correct**

- [Sourcing and Citation Policy for Edges](sourcing-and-citation-policy.md): grounding,
  review, and the status shown to readers.
- [Governance and Moderation for a Living Graph](graph-governance-and-moderation.md):
  concurrent editing, protection for central nodes, deletion, and disputes.

Several further policies are planned but not yet written: a notability threshold for deciding which
eligible candidates deserve a node, a spotlight mechanism for highlighting major events, a policy for
automated accounts, and a format for the structured arguments attached to claims.

## Where the project stands

The project is in its policy-drafting phase. Every essay is a proposal, not a settled rule, and any
of them may be revised as real entries are added and tested against it. The graph itself has not yet
been populated. Where an essay leaves a question open, it says so.

## Glossary

Terms are listed alphabetically. Where a term is defined by a specific essay, the entry links to it.

- **Achievement.** An event in which an existing capability is exercised to a superlative degree,
  such as the fastest, highest, or first, without producing a technique anyone else can build on. The
  four-minute mile and the Moon landing are examples. See
  [Achievement vs. Discovery vs. Invention](achievement-discovery-invention.md).
- **Argument.** A kind of grounding: a step-by-step deduction whose premises are each supported by a
  source or by a further argument. See
  [Sourcing and Citation Policy for Edges](sourcing-and-citation-policy.md).
- **Axiom.** One of the founding rules that every candidate must satisfy before it can become a node.
  See [Founding Axioms](founding-axioms.md).
- **Basis.** The kind of claim an edge makes: either *historical attestation* or *logical
  necessity*. See
  [Historical Attestation vs. Logical Necessity](historical-vs-logical-necessity.md).
- **Blast radius.** A measure of how much depends on a node or edge, computed as the number of nodes
  downstream of it. It sets how heavily an item is protected and how many reviews it needs. See
  [Governance and Moderation for a Living Graph](graph-governance-and-moderation.md).
- **Citation.** A kind of grounding: a source that states the claim itself. See
  [Sourcing and Citation Policy for Edges](sourcing-and-citation-policy.md).
- **Claim.** A single statement about how two nodes relate, which can be supported, reviewed, or
  disputed on its own. An edge is the stored form of a claim.
- **Cluster.** A group of densely connected nodes, worked out by an algorithm when the graph is drawn.
  A cluster is never a node and never an edge endpoint. See
  [Node Granularity](node-granularity.md).
- **Discovery.** Something that already existed and was revealed by human effort, such as a natural
  law or a mathematical truth. Contrast *invention*. See
  [Achievement vs. Discovery vs. Invention](achievement-discovery-invention.md).
- **Edge.** A line between two nodes. Each edge is one claim, and carries a relationship-kind, a
  basis, and its grounding. See [Edge Schema](edge-schema.md).
- **Floor.** The boundary below which nothing gets a node: natural phenomena and other things no
  human action is responsible for. See [Founding Axioms](founding-axioms.md).
- **Grounding.** What backs a claim. Either a *citation* or an *argument*, and a claim can have
  several of either. See
  [Sourcing and Citation Policy for Edges](sourcing-and-citation-policy.md).
- **Historical attestation.** A basis: a dated, sourced claim that one thing preceded and enabled
  another in the actual historical record. It can be true in one region and false in another. See
  [Historical Attestation vs. Logical Necessity](historical-vs-logical-necessity.md).
- **Invention.** Something that did not exist before and was created by human effort, such as a
  device or a technique. Contrast *discovery*. See
  [Achievement vs. Discovery vs. Invention](achievement-discovery-invention.md).
- **Logical necessity.** A basis: a timeless claim that something cannot exist, for any civilization,
  without something else having been achieved first. See
  [Historical Attestation vs. Logical Necessity](historical-vs-logical-necessity.md).
- **Node.** A single discovery, invention, or achievement on the graph. See
  [Founding Axioms](founding-axioms.md).
- **Prerequisite.** Something a later thing depended on. This is the graph's central relationship,
  though an edge can also record a weaker connection, such as influence.
- **Redirect.** A pointer left at a node's old identifier when it is moved, renamed, or merged, so
  that existing edges keep working. See
  [Governance and Moderation for a Living Graph](graph-governance-and-moderation.md).
- **Relationship-kind.** The type of connection an edge records: *material necessity* (something
  physically required), *conceptual enablement* (knowledge or an idea required), *combination*
  (several independently developed lines converging on one thing), or *mere influence* (a real
  connection short of necessity). See [Edge Schema](edge-schema.md).
- **Review.** A check by an independent party that a grounding does what it says. See
  [Sourcing and Citation Policy for Edges](sourcing-and-citation-policy.md).
- **Shadow node.** A node for the human understanding of something that sits on the floor, such as the
  theory of gravity. The phenomenon has no node, but the discovery of how it works does. See
  [Founding Axioms](founding-axioms.md).
- **Stage.** An optional label on a node marking a phase in the history of one subject: *observation*,
  *exploitation*, *production*, or *explanation*. See
  [What Constitutes a Discovery?](what-constitutes-a-discovery.md).
- **Status.** A computed label showing how well a claim is grounded and reviewed: *ungrounded*, *red*,
  *yellow*, or *green*. It describes what a claim rests on, not whether it is true. See
  [Sourcing and Citation Policy for Edges](sourcing-and-citation-policy.md).
- **Subject.** What a node is about. Every node has a subject, and only some also have a stage.
