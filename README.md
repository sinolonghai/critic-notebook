# critic-notebook

Review Markdown the way you'd review a document — but keep the revisions in the file.

A single HTML file. No install, no build, no server, no dependencies. Open it in a browser,
open a `.md`, and every block of the document becomes a cell you can click and rewrite in
plain prose. What you changed is recorded as [CriticMarkup](http://criticmarkup.com/) inside
the Markdown itself, so the revisions travel with the file and stay readable in any editor.

## Why

Markdown has no notion of tracked changes. The usual answers are unsatisfying:

- **Word / Google Docs** have real track-changes, but the revisions live in their format. Export
  to Markdown and you get the final text with the history stripped off.
- **`git diff`** is line-based. Soft-wrapped prose shows up as "this whole paragraph changed."
- **CriticMarkup** solves the file format — `{++added++}`, `{--removed--}`, `{~~old~>new~~}` —
  but writing those delimiters by hand is tedious, and the existing tooling is editor plugins
  (Obsidian, VS Code, MultiMarkdown Composer) that each reviewer has to install first.

This fills that last gap: a reviewer who has never heard of CriticMarkup opens one file,
edits text normally, and produces correct markup.

## Using it

**Locally.** Download `index.html` and open it. In Chromium-based browsers, `Open` gives you a
real file handle, so `⌘S` / `Ctrl+S` writes back to the file you opened. Elsewhere it falls
back to downloading a copy.

**From a URL.** Serve `index.html` anywhere static (GitHub Pages works) and send people the
link. Nothing is uploaded — the file they open is read in their own browser and never leaves it.

### What you do

| Action | How |
| --- | --- |
| Rewrite a block | Click it, edit the text, click away |
| Discard an edit in progress | `Esc` |
| Add a block | `+ new block` in the gap between cells |
| Delete a block | Click it, clear the text, click away |
| Comment on a phrase | Select it, type the comment |
| Accept / reject a suggestion | `✓` / `✕` on the row under its block |
| Undo anything | `⌘Z` (80 steps) |
| Save | `⌘S` |

Set a name in the `as` field and your suggestions are attributed with `@name`; each author gets
a colour. The three view tabs show the document marked up, as the original, or as it would read
with everything accepted.

Edits are diffed against the **original**, not against your previous edit, so changing the same
sentence five times still produces one clean `{~~old~>new~~}` rather than five nested layers.
The diff is word-level for Latin scripts and character-level for CJK, so changing two characters
in a Chinese paragraph marks two characters.

## The invariant

Everything rests on one property:

> For any block, rejecting every suggestion reproduces the original text **exactly**, and
> accepting every suggestion reproduces the edited text **exactly**.

That is what makes the tool safe to use on a file you care about: a recorded change is never
lossy, and the original is recoverable from the file alone, on any machine, with no history.

The non-obvious consequence, and the thing that took three bugs to learn: **text outside a mark
belongs to the original.** A newline placed outside a mark survives a reject, so adding a list
item or a paragraph has to put its newline *inside* the mark, not beside it.

Two test files assert it. Both run the real page — they extract the script from `index.html`
and call its live functions, so they cannot drift from the implementation. No dependencies;
Node 18+ and nothing else.

```
node test/review.test.mjs      # unit: the cases that have broken before
node test/documents.test.mjs   # whole documents end to end
```

`review.test.mjs` covers CJK and Latin edits, list insertion and deletion, multi-line
paragraphs, tables, headings, whole-block deletion, `+`-inserted blocks, author stamps,
and delimiter injection.

`documents.test.mjs` walks every `.md` under `samples/` and `samples-local/` and checks, per
document: the cells tile the file with nothing unreachable, every text offset maps exactly,
reject-all and accept-all reproduce the original and the final byte-for-byte, editing each
cell in turn round-trips both ways, and no markdown leaks into the output as literal text.

`samples/` holds documents committed to the repo. **`samples-local/` is gitignored** — put
your own files there and they are checked without being published.

## Syntax

Plain CriticMarkup, nothing proprietary:

| | |
| --- | --- |
| `{++inserted++}` | insertion |
| `{--deleted--}` | deletion |
| `{~~old~>new~~}` | replacement |
| `{>>comment<<}` | comment |
| `{==highlight==}` | highlight |

A comment immediately following a change is treated as that change's rationale and shown with
it. A comment beginning `@name:` or `@name：` is attributed to that author — the convention
MultiMarkdown Composer uses, since CriticMarkup itself has no author field.

## Known limits

- **Code blocks are not tracked.** CriticMarkup inside a fence is never parsed, so marking one
  up would write delimiters that no tool honours. Fenced blocks are shown read-only.
- **A selection for a comment can't span an existing mark or a line break.** It would produce
  nested or cross-block markup that has no unambiguous reading.
- **Accepting is the destructive step.** Committing an edit is safe — the original sits inside
  the mark. Accepting discards it, recoverable only through undo, within the session.
- **Re-editing a block re-derives its marks**, which drops the anchors of comments on it. The
  comment text is preserved and moved to the end of the block.
- **Tables are edited as Markdown source**, pipes and all, not as a grid.
- No real-time collaboration. Two people reviewing the same file exchange the file.

## License

MIT.
