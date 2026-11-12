# Changelog

## 0.1.0 — 2026-11-12

First tagged version. Usable end to end: open a folder, review and edit its markdown,
save in place.

**Reviewing**

- Every markdown block is a cell. Click one to edit its text as plain prose; a word-level
  diff (character-level for CJK) works out what changed and records it as CriticMarkup.
  Opening another cell commits the one you were in, `Esc` discards.
- Edits are diffed against the **original**, not against the previous edit, so changing the
  same sentence repeatedly yields one clean mark rather than nested layers.
- Accept or reject each suggestion; both write straight to the source, and `⌘Z` undoes
  anything, 80 steps deep.
- Select a phrase to comment on it. Click any comment to edit it; empty it to remove it.
  Comments keep their author across edits.
- `+ new block` between cells; clearing a cell deletes that block as a tracked deletion.
- Three views: marked up, original, final. Original and Final hide the suggestion rows —
  without the inline marks a row reading "comma → period" has nothing to point at — and put
  a numbered flag on the rail instead, which returns to Marked up and lands on the block.
- Outline on the right, tracking scroll position, with jumps between touched blocks.

**Files**

- **Open folder** shows a collapsible tree: subfolders start collapsed, carrying the number
  of files and of open suggestions rolled up from their subtree. **Open file** takes one file
  on its own. A file opened or saved inside the connected folder stays in folder mode.
- Folder handles are kept in IndexedDB, so a reload offers the folder again and one click
  re-grants permission. The eight most recent folders stay listed in both modes.
- `⌘S` writes the open file in place, and is disabled when there is nothing to write — the
  open editor counts, so it does not grey out mid-edit. `Save as…` adopts the new file, and
  when it lands inside the connected folder the tree and the path follow it.
- Browsers never reveal absolute paths. When the tool runs as a local file and the folder you
  picked is the one it sits in, the page's own location supplies the prefix and the title bar
  shows a real path; otherwise it shows the path relative to the folder rather than guessing.

**The invariant**

For any block, rejecting every suggestion reproduces the original byte for byte, and
accepting every suggestion reproduces the edited text. Two test files assert it against the
real page — `review.test.mjs` for the cases that have broken before, `documents.test.mjs` for
whole documents under `samples-local/`.

**Known limits**

Code blocks are not tracked, a comment selection cannot span a mark or a line break,
accepting is the destructive step, re-editing a block moves its comments to the end, tables
are edited as markdown source, and there is no real-time collaboration.

**Not 1.0 because** the file format is stable — it is plain CriticMarkup, readable by other
tools — but this tool's own shape is young: the editing model was rebuilt three times in its
first week, and it has not yet been used by anyone but its author.
