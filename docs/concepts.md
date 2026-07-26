# ChaibookLM — how it works and why

Notes I keep for myself while building this. Not the setup guide — that's the README.
This is the *why* behind the shape of the app.

**Contents**

- [Part 1 — The mental model](#part-1--the-mental-model)
- [Part 2 — The build, phase by phase](#part-2--the-build-phase-by-phase)
- [Glossary](#glossary)

---

# Part 1 — The mental model

## The whole app in one sentence

You give it documents, it cuts them into small pieces, and when you ask a question it
finds the few pieces that are about your question and asks an AI to answer using only those.

That's all a RAG app is. Everything else is plumbing.

Notice what it is **not** doing: it isn't training anything, and it isn't teaching the AI
your documents. The AI stays exactly as ignorant as it always was. You're doing very good
research on its behalf and handing it a short reading packet right before it answers.
It's an open-book exam where you pick which pages are open.

## The one genuinely new idea

Everything hinges on this: **you can turn a piece of text into a location.**

Feed a sentence to an embedding model and it hands back a long list of numbers. Think of
those numbers as coordinates on a map — a map where position means *meaning*. Text about
the same thing lands in the same neighbourhood, even when the words are totally different.
"The engine overheated" and "the motor got too hot" end up as near-neighbours, because the
model places them by meaning, not by spelling.

Your question gets coordinates too. So "find text relevant to this question" stops being a
hard language problem and becomes a simple geometry problem:

> which stored points are nearest to my question's point?

## Walking one file through it

Say you upload a lecture transcript.

**Reading it.** Different file types need different opening moves. A PDF needs its text
pulled out page by page. A YouTube link needs its captions fetched. A website needs its
article text scraped away from the navigation and ads. Five source types, five different
ways in. But once you're through the door they all become the same thing: a pile of plain
text with notes about where each bit came from.

That's the `Segment[]` idea. It means: **no matter what was uploaded, convert it into one
standard format immediately, and write the rest of the app once.**

**Cutting it up.** A two-hour transcript is far too big to hand an AI, so you slice it into
pieces of a few hundred words. Two reasons, and the second is the interesting one:

1. You need small pieces so you can send only the relevant bit.
2. You need small pieces so you can *point at* something specific later.

"The answer is somewhere in this two-hour video" is useless. "The answer is at 41:12" is a
citation.

**Placing it on the map.** Each piece goes through the embedding model and comes back as
coordinates. You store the coordinates alongside the piece's text and — crucially — a note
saying where it came from. Page 7. Timestamp 41:12. Which notebook it belongs to.

**Ready.** That's the green dot in the UI. Nothing more mysterious than "we finished doing
the above."

## Then someone asks a question

Their question gets coordinates. You look up the nearest stored pieces. You take maybe six
of them, paste them into a message that says roughly *"here's some reference material,
answer the question using only this, and if it isn't in here, say so"*, and stream the
answer back.

And here's the payoff. Because each piece remembered where it came from, and because you
**numbered** the pieces when you pasted them in, the AI writing `[3]` is a pointer you can
follow. Piece 3 came from page 7. So you show a chip saying page 7, and clicking it opens
the PDF at page 7.

Citations aren't a feature you build separately. They're a side effect of having tagged each
piece with its origin *before* you ever stored it. That bookkeeping is the difference
between citations being easy and being impossible.

## Why two databases

Two very different questions, two tools.

| Question | Shape | Tool |
| --- | --- | --- |
| What sources are in this notebook, and is that PDF done indexing? | rows and columns | Postgres |
| Which pieces of text sit nearest to this question? | geometry | Qdrant |

A regular database is terrible at the second one. A vector database exists for exactly that
one job. In practice Qdrant is about four operations for the whole project: create a
collection, put points in, search points, delete points.

## The part to stop worrying about

**Notebook isolation** sounds like a security feature. It's one condition on the search:
only look at points tagged with this notebook's id.

**Status indicators** are one column in Postgres that the pipeline writes and the UI reads.

**Grounded answers** are one instruction in the prompt.

Almost every rubric item is a small consequence of the two flows above, not a separate
system to design.

---

# Part 2 — The build, phase by phase

## P0 — Foundation

**What it's for:** building the two rooms before you have anything to put in them.

Nothing conceptually interesting happens here. You create the filing cabinet (Postgres, for
ordinary facts) and the map room (Qdrant, for coordinates), and give your code a way to
talk to both.

**The non-obvious thing: deploy the app while it's still empty.**

That sounds pointless — you're deploying a blank page. But "it deploys" is a claim, and you
want that claim tested while nothing is at stake. Deployment breaks for stupid, unrelated
reasons: a missing environment variable, a build step that works on your laptop and not on
their server. Discovering that on an empty app costs ten minutes. Discovering it at 11:40 pm
with a finished app costs you the submission.

Same logic for deciding all your table shapes up front rather than adding them as you go.
Changing storage later means a migration, and migrations under time pressure are how people
lose data they already collected.

## P1 — Notebooks

**What it's for:** the container. You can't add a source to nothing.

**The non-obvious thing: containment *is* your entire privacy model.**

There's no login here, no permissions, no access rules. "Each notebook keeps its own
isolated knowledge base" sounds like something you'd have to build. It isn't. It's a habit:
every single question you ask either database carries "…and only within this notebook"
attached to it. If you never break that habit, isolation is automatic. Break it once and a
notebook starts answering from another notebook's documents.

The second idea, reused in every phase after this: **data moves in two directions and each
has its own mechanism.** Reading is a page asking the database directly and arriving already
full of data. Writing is the browser calling a function that runs on the server, then telling
the page to go re-read. Every feature after this is that same loop with different contents.

## P2 — The first real pipeline

**What it's for:** getting one document all the way from upload to searchable. This is the
heart of the project.

Do it with only the two easiest source types: pasted text and a VTT caption file. Pasted
text needs no extraction at all. A VTT file is just timestamped caption lines, barely harder.

**Why start with the boring inputs:** the pipeline is the risky part, and you want to debug
it with material that can't itself be the problem. Start with PDFs and when something breaks
you don't know whether the PDF reader is wrong, the chunking is wrong, or the embedding call
is wrong. Three suspects. Start with pasted text and there's only ever one.

**The non-obvious thing: indexing is slow, so it can't happen while the user waits.**

Reading, cutting, and embedding takes anywhere from a few seconds to a minute. If the browser
sits waiting for all of it, the request times out and the page looks broken. So flip it: the
moment a file arrives, write down "this one is queued" and answer the browser immediately.
Then do the slow work separately, updating that note as you go — extracting, embedding, ready.

Meanwhile the browser just asks "any change?" every couple of seconds and repaints the dot.
Yellow while the note says extracting or embedding, green when it says ready, red on failure.

**It's a message board, not a phone call.** Nobody holds the line. That single idea is what
makes the status indicators work, and most of what makes the app feel responsive.

## P3 — The other three source types

**What it's for:** PDF, YouTube, and websites.

**The non-obvious thing: this phase should feel anticlimactic. If it doesn't, P2 was built
wrong.**

Each new type is one small function with one job: given this thing, hand back plain text
plus a note about where each bit came from.

- A PDF gives you text page by page → the note is a page number.
- YouTube gives you captions with timestamps → the note is a timestamp, same shape as VTT,
  which is already solved.
- A website gives you article text once the navigation and ads are stripped → the note is
  which heading the text sat under.

Then nothing downstream changes. Not the chunking, not the embedding, not the storing, not
the searching, not the citations. All of that was written once in P2 and doesn't care where
the text came from. Three new source types and you touch none of the machinery.

That's the payoff for converting everything into one shape early. This is the phase where
the architecture proves itself.

**The caveat:** extraction is where the real world bites. Some PDFs are scans — pictures of
text with no text inside. Some YouTube videos have captions disabled. Some websites block
anything that isn't a human. So each extractor has to fail *politely*: write down why it
failed and show that to the user instead of crashing. A red dot saying "this video has no
captions" is a feature. A blank screen is a bug.

## P4 — Asking questions

**What it's for:** the second half of the app, and the half people actually see.

The flow: question becomes coordinates → coordinates find the nearest pieces → pieces become
a reading packet → packet becomes an answer.

**Non-obvious thing one — you don't want the six closest pieces.**

The six nearest points will often all come from the same paragraph of the same document.
Technically that's the most relevant material. Practically it's a worse answer, because
you've given the AI six copies of one idea instead of six angles on the question. And the
citation list looks thin — same source, six times.

So after finding the nearest pieces, spread the selection across different sources before
handing anything over. Slightly worse on paper, noticeably better in reality.

**Non-obvious thing two — never let the AI invent a citation.**

The tempting approach is to give it the documents and ask it to tell you which page each
fact came from. That's exactly how you get confident, wrong page numbers.

Instead, hand it a **numbered** list of pieces and say "cite by number." Number 3 is a slot
*you* filled. When the answer says `[3]`, you look up what you put in slot 3 and read the
page number off your own records. The AI never sees a page number and never produces one.
It only points at a position in a list you built.

That's the whole citation system, and it's why hallucinated citations are structurally
impossible here rather than just discouraged.

**Grounding** is one instruction: use only this material, and if the answer isn't in it, say
so. It works not because you asked nicely but because you controlled what's in front of it.
There's nothing else there to drift toward.

**Streaming** — words appearing as they're written rather than after a five-second pause —
doesn't make anything faster. It just stops it feeling like waiting.

## P5 — Opening the source

**What it's for:** clicking a citation and seeing the actual original.

**The non-obvious thing: this is the feature that decides whether people trust the app.**

An answer with a citation chip is a *claim*. An answer where you click the chip and land on
the exact page, at the exact timestamp, with the exact sentence highlighted, is *proof*.
Same underlying data, completely different feeling.

Mechanically the viewer has one job: translate the note attached to a citation into a way of
showing the original.

- A page number → opens the PDF at that page.
- A timestamp → starts the video at that second.
- A character range → shows the full text with that stretch highlighted and scrolled to.

That last one is where an earlier decision quietly pays off. The note says "characters 4820
through 5600" — which means nothing unless you kept the original full text those numbers are
counting into. That's the only reason it's stored. Small decision in P0, load-bearing in P5.

**The honest limitation:** most websites refuse to be displayed inside another page. So for
web sources, show your own extracted copy with the highlight, plus a link out to the real
thing. That's better anyway — the highlight works, and it works every time.

## P6 — README and video

**What it's for:** twenty marks, and the only two things an evaluator is guaranteed to look at.

Someone might not manage to get the app running. They will definitely read the README and
watch the video. Treat them as deliverables, not paperwork.

**The README's job:** a stranger clones it and has it running in five minutes. What to
install, which environment variables to set, and one clear walkthrough of how a question
turns into a cited answer.

**The video's job is different**, and it's the thing people get wrong. Don't narrate the
interface — "now I'll click here, now this opens" — because the evaluator can see the screen.
Narrate the **decisions**:

> "Every source type gets converted into the same shape immediately, so the pipeline only
> exists once."

> "I number the context blocks and have the model cite by number, so it can't invent a page
> reference."

Two sentences like that are worth more than a flawless click-through, because one
demonstrates understanding and the other demonstrates a working button. Understanding is
what the last section of the rubric is actually measuring.

Then do the whole round trip on camera, once, unbroken: make a notebook, add a few sources,
watch them go green, ask a question, click a citation, land on the right page. That single
loop touches most of the marks available.

## How the phases lean on each other

P0 and P1 are containers — no intelligence, all foundation. **P2 is the phase that matters**;
it's where the actual idea gets built and the only phase solving something genuinely new.
P3 is P2 repeated cheaply. P4 and P5 are the reverse direction — pulling back out what P2
put in. P6 is showing the work.

Which is why, if time gets tight, **P3's extra source types are the first thing to drop and
P6 is the last.** A working app with three source types, a clear README, and a video that
explains itself scores better than five source types with neither.

---

# Glossary

**Postgres** — a place to store rows of data, like a spreadsheet with strict column types.
Lives on a server somewhere. You never write SQL for it directly.

**Prisma** — a translator. Describe your tables once in `schema.prisma` and it hands you
JavaScript functions: `db.notebook.create()`, `db.notebook.findMany()`. That's the whole idea.

**Migration** — a file of SQL that changes the database's shape. Prisma writes it for you by
comparing your schema against what the database currently looks like.

**Embedding** — a list of numbers representing the meaning of a piece of text. Coordinates
on a map where nearby means similar.

**Qdrant** — a database that only stores those lists of numbers. Hand it one, it finds the
stored ones closest to it.

**Chunk** — one small piece of a document, a few hundred words, stored with a note about
where in the original it came from.

**Locator** — that note. A page number, a timestamp, a character range. What makes a citation
clickable.

**Grounding** — making the model answer only from material you supplied, rather than from
what it already knows.
