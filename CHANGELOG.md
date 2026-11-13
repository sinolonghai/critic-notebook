# Changelog

## Unreleased

- **Compare** tab: diff the open document against another file, or an earlier version of it,
  rendered in the same marks the editor uses. Blocks are aligned by LCS before being diffed, so
  one inserted paragraph does not report the whole file as changed; rewritten blocks are
  recognised by word overlap rather than showing as an unrelated delete and insert; runs of
  untouched blocks collapse. Read-only for now. The other side is chosen from a dropdown of
  the open documents and the connected folder, or through **Browse…**, which opens a file
  dialog and so reaches a copy that lives nowhere near the folder you opened.
- `tools/history.mjs` exports a file's past versions into `history/` for the Compare tab, so
  git history is read by git rather than by a packfile parser in the browser.
- The page now carries its own document head — doctype, `<meta charset="utf-8">`, viewport.
  It had none: the artifact host wraps uploads in a skeleton and macOS Chrome guesses UTF-8
  for local files, so both environments hid it. Downloaded and opened from disk, which is
  what the README tells people without git to do, the file rendered in quirks mode and left
  the encoding to the browser's guess — on a Windows machine with a CJK locale that guess is
  GBK, and every `→`, `‡` and Chinese character in the document becomes mojibake. Leaving
  quirks mode shifts content about 3px; nothing else moves.
- A save no longer overwrites a file that changed underneath it. Nothing locks a file the way
  Word does, and a browser cannot, so saving now reads the file back first and compares it
  with what was last read or written — content, not a timestamp, which for files this size
  neither misses a change nor invents one. If it moved, the write stops and offers **See what
  changed**, which opens the on-disk version in the Compare tab as the older side, so the diff
  reads as what overwriting would do; **Save as…**; or **Overwrite**. Previously two tabs on
  one file meant the second save silently destroyed the first.
- README gains a prompt for having a model mark a document up in CriticMarkup, and the one
  check worth doing on what comes back: the **Original** view should read as the document you
  started with, because an edit made outside a mark destroys the original silently. The prompt
  is tested rather than asserted — its output is parsed by the real page and asserted to
  reject back to the source file byte for byte.
- Saving works from a hosted copy in browsers without the File System Access API. The download
  path tested for `file://` or localhost by name, so a Firefox or Safari visitor to a project
  page was offered Copy and nothing else; it now asks the browser whether the origin is
  trusted. An `index.html` redirects to the tool, since GitHub Pages serves the site root.
- The cell editor turns the browser's spell checker back on. It holds prose — the marks are
  resolved away before the text reaches it — so underlines land on words rather than on
  CriticMarkup delimiters. The paste and export boxes, which hold raw markdown, keep it off.
- README gains a **To do** section recording what is planned and what makes each piece hard,
  and a **Why** that starts from the case this tool exists for: an AI edits a Markdown document
  and a human has to see what it changed.
- Fixes a parser bug the compare work surfaced, latent in the editor all along: a mark whose
  text contains one backtick — which a diff produces as soon as formatting changes — left a
  stray backtick that paired with the next one in the document, and the inline-code span that
  resulted swallowed the following mark. Code spans and fences are now found on a copy with
  marks blanked out.

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

**Browsers**

Folder mode needs Chromium (Chrome, Edge): the File System Access API exists nowhere else.
Elsewhere the page falls back to a file input and a download, and survives `localStorage`
being refused outright. CRLF files are saved back as CRLF, paths render as `C:\…` on Windows,
and key hints say Ctrl off the Mac.

**Known limits**

Code blocks are not tracked, a comment selection cannot span a mark or a line break,
accepting is the destructive step, re-editing a block moves its comments to the end, tables
are edited as markdown source, and there is no real-time collaboration.

**Not 1.0 because** the file format is stable — it is plain CriticMarkup, readable by other
tools — but this tool's own shape is young: the editing model was rebuilt three times in its
first week, and it has not yet been used by anyone but its author.
