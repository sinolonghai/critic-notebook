# critic-notebook

**0.1.0** · [changelog](CHANGELOG.md)

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

**Locally.** Download `index.html` and open it. There are two ways in:

- **Open folder** — the left pane shows it as a tree. Subfolders start collapsed, with the
  number of files and of open suggestions beneath them, so a large project does not bury the
  two files you came for; expansion is remembered per folder. Folders you have used stay
  listed in both modes, and one click re-grants permission after a reload.
- **Open file** — one file on its own. The left pane then shows what is open plus the folders
  you have used, so there is always a way back.

A file opened or saved *inside* the connected folder stays in folder mode; one outside switches
to file mode, and offers to open its folder first — the picker can be anchored at that file, so
it is two clicks, and the full path comes back with it.

`⌘S` / `Ctrl+S` writes the open file in place, and is disabled when there is nothing to write.

Browsers never reveal a file's absolute path. But when the tool is opened as a local file and
the folder you picked is the one the tool sits in, the page's own location supplies the prefix,
so the title bar shows a real path. Any other folder shows the path relative to it rather than
guessing wrong.

**Browsers.** Chrome or Edge, for folder mode: the File System Access API that supplies folder
handles and in-place saving exists only in Chromium. Firefox and Safari implement OPFS, a
private sandbox, which cannot reach your own directories — so this is an API fact, not an
untested guess.

Everything else is ordinary DOM and works anywhere. Elsewhere the page drops to opening single
files through a file input or drag & drop, and saving downloads a copy; where even
`localStorage` is refused (Safari on `file://`) it still edits and exports, just without
remembering anything. That degraded path is tested by stripping the same APIs from Chromium.

**Windows.** Same engine, so folder mode works. A file opened with CRLF line endings is saved
back with CRLF, so a round trip does not show up as every line changed; paths are shown as
`C:\Users\…` and shortcut hints say Ctrl rather than ⌘.

**From a URL.** Serve `index.html` anywhere static (GitHub Pages works) and send people the
link. Nothing is uploaded — the file they open is read in their own browser and never leaves it.

### What you do

The window is three panes: the document list on the left, the notebook in the middle, the
outline on the right. Either side pane folds away with the buttons at the top left; below
1180px and 880px they become drawers.

The three view tabs show the document marked up, as the original, or as it would read with
everything accepted. **Original and Final hide the suggestion rows**, because without the
inline marks a row saying "comma → period" has nothing to point at. A numbered flag on the
left rail marks the blocks that were touched; clicking it returns to Marked up and lands on
that block.

| Action | How |
| --- | --- |
| Rewrite a block | Click it, edit the text, click away |
| Discard an edit in progress | `Esc` |
| Add a block | `+ new block` in the gap between cells |
| Delete a block | Click it, clear the text, click away |
| Comment on a phrase | Select it, type the comment |
| Edit or delete a comment | Click the comment text; empty it to remove it |
| Accept / reject a suggestion | `✓` / `✕` on the row under its block |
| Undo anything | `⌘Z` (80 steps) |
| Save | `⌘S` — greyed out when there is nothing to write |
| Save to a new file | `Save as…` |
| Jump between touched blocks | `↑ prev` / `next ↓` in the outline |
| Fold a side pane | the two buttons at the top left |

Set a name in the `Sign as` field and your suggestions are attributed with `@name`; each author gets
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

`documents.test.mjs` checks, per document: the cells tile the file with nothing unreachable,
every text offset maps exactly, reject-all and accept-all reproduce the original and the final
byte-for-byte, editing each cell in turn round-trips both ways, and no markdown leaks into the
output as literal text.

### The two sample folders

| | |
| --- | --- |
| `samples/` | The originals, tracked in git. Never edited by hand. |
| `samples-local/` | The working copies — what the suite reads, and what you open in the tool. Gitignored. |

Everything you do by hand happens in `samples-local/`, so a document you mangle while testing
is never the original. Missing working copies are seeded from `samples/` on first run:

```
node test/documents.test.mjs            # seeds anything missing, then checks
node test/documents.test.mjs --reset    # restore every working copy from samples/
```

Deleting one file from `samples-local/` skips that document rather than re-seeding it, and a
file that exists only in `samples-local/` is checked too and flagged as local-only. To add a
document permanently, put it in `samples/` and commit.

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

The page opens on a built-in tutorial. It is a scratch pad: it has no file behind it, so
`Save` stays disabled on it and `Save as…` is the way to keep anything you tried there.

## What it remembers, and where

Everything persists in the browser's own storage for the page's origin. Nothing is written
beside your documents, and none of it leaves the machine.

| Where | Key | What |
| --- | --- | --- |
| `localStorage` | `cm-author` | the **Sign as** name |
| | `cm-pane-side`, `cm-pane-out` | whether each side pane is open |
| | `cm-open-<folder>` | which subfolders are expanded, per folder |
| | `cm-signhint` | whether the one-time "sign your suggestions" note has shown |
| IndexedDB `critic-notebook` → `kv` | `folders` | folder history: handles, names, last-used |
| | `dir` | the single folder an earlier version stored, kept for migration |

Two stores because `localStorage` holds only strings, and a `FileSystemDirectoryHandle`
cannot be turned into one — it survives only through structured clone, which is IndexedDB's
to offer. That handle is what lets a remembered folder be reopened with one permission click
instead of being picked again.

Folder history keeps the **8 most recent**; older entries fall off the end. Expansion state
for folders no longer in that history is pruned with it, so the keys do not accumulate.

In Chrome every `file://` page shares one storage bucket, so moving `index.html` to another
directory keeps all of it. Clearing site data, or a private window, starts over.

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
