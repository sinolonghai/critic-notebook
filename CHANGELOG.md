# Changelog

## Unreleased

- **A comparison can be opened as suggestions** — Word's legal blackline, except that the
  result is an ordinary CriticMarkup file, so the next step is not reading a list of
  differences but deciding on them one at a time in the editor that is already open. Reject
  everything and you have the older version; accept everything and you have the newer. It
  opens unsaved and attached to no file, because a blackline is a third document rather than
  a new version of either side. Blocks are laid out the way this tool writes any document —
  one blank line between them — so rejecting gives the older version as the tool would have
  saved it, not a byte image of a file with four blank lines in a row; whitespace between
  blocks is deliberately not a suggestion, since marking it would put one between every pair
  of paragraphs and bury the rest.
- The file is put to the page's own parser before it opens, and does not open if it does not
  read back as both versions. That check is not a formality: it found three separate ways a
  mark can be swallowed, each of which would have written a file that read back as neither
  version while looking perfectly correct.
  - A mark inside an inline code span is not read as a mark at all — the parser blanks marks
    out before it looks for code spans, so the backticks close around the blank and protect
    what is left. A code span is now one token, so changing anything inside it replaces the
    whole span. This was a live bug in the editor too, not only in comparisons: it was
    reached by `test/review.test.mjs` losing a directory from its path.
  - A mark that opens on the line closing a fenced block is inside the fence, because a
    closing line may carry trailing text. A block added straight after a fence now takes its
    blank line on the right instead, which starts the mark on a line of its own.
  - A block that quotes CriticMarkup inside a code span cannot go inside a mark at all: the
    parser pairs an opening delimiter with the first closing one it meets, and that is the
    quoted one. There is no arrangement of marks that fixes it. Such a block is left at the
    older version with a note saying so, the count is reported, and where even the note will
    not parse — it lands on a fence's closing line — the notes are dropped and the count is
    the whole of the warning.
- Blocks in a run are merged rather than listed as every deletion and then every addition.
  The old order drew correctly but was not an order the newer version has, so accepting
  everything put the right blocks in the wrong places. A pair that crosses another is
  reported as a removal and an addition instead, because two blocks that swapped have no
  position both versions agree on.
- `test/blackline.test.mjs` asserts the round trip on every case that has broken: additions
  and removals at the top, the middle and the end, runs of both at once, lists, tables and
  fences, documents that are entirely new or entirely gone, and the blind spot above. The
  corpus it was developed against was every consecutive version of this project's own README
  and CHANGELOG out of git history — 69 comparisons, about a thousand suggestions written,
  four of which report a block they could not track.

- A layout for a side panel. Below 880 pixels the top bar folds to two rows — name, jumps and
  the write buttons above, views and the signing name below — and the status line to one row
  that truncates from the right, so what survives is the part worth reading. The label on the
  signing name goes, the "5 to review" count beside the file name goes because the status line
  below repeats it, and hosted, where there is one reviewer, the name goes with it. Below 700
  the tutorial strip goes too, which is where the two buttons it offers are also the two left
  in the bar. 880 is the width at which both panes have already given up their columns to
  become drawers: the layout has admitted there is no room beside the document, and the bar was
  the last thing still pretending otherwise. An assistant's side panel is around 780 wide,
  which a first attempt at this put on the wide side of the line and left wrapping into four
  rows. Into the bar goes `←  3 / 7  →`, which steps between blocks
  carrying suggestions and says where you are. Those jumps were in the outline pane, which a
  narrow layout is the first thing to throw away, and they are what the panel is for: the
  document becomes a queue of decisions rather than a page to scroll. Hosted at 420 pixels
  there are 124 pixels above the first line, where there were 199. A document scrolled to the
  end counts as being at its last suggestion — the last block of a short document cannot reach
  the top of the viewport, so the counter would otherwise stick partway and **next** would
  look broken.
- A pane that closed because the window was narrow opens again when it is not. The two panes
  were sized once at load and never reconsidered, so widening a side panel back out to a full
  window left both of them shut, with nothing to suggest that the two small buttons in the
  corner were what brought them back. Only the toggle writes a preference, so an absent one
  means the width decided and may decide again; a pane you closed yourself is never reopened
  over your head, and in a hosted panel the document list stays gone at any width, because
  there the host owns the file and the toggle is hidden.
- The `+ new block` buttons between paragraphs stay visible on touch screens rather than on
  narrow ones. Narrow is not the same as touch: a side panel on a desktop has a mouse, and had
  a dashed button hanging between every pair of paragraphs.
- The page can be handed a document by whatever opened it, and hand it back. Four messages —
  `ready`, `open`, `save`, `dirty` — carrying no credentials and touching no filesystem,
  because a page in a panel cannot be given a path: `showOpenFilePicker` needs a gesture and
  will not take a string, so there the file picker is not inconvenient, it is the wrong
  mechanism. `ready` is broadcast and says nothing about any document; everything after goes
  only to the origin the first `open` came from. `dirty` exists because the `beforeunload`
  guard does not fire reliably for an iframe a host tears down, so the page must be able to
  say it is holding decisions. While hosted the page hides the controls that would open or
  redirect a file — those are not useless but wrong, since opening another would leave Save
  returning something the host never asked for.
- Closing the documents pane no longer collapses the document. The panes were placed in the
  shell's grid by source order, so hiding one shifted the rest a column left: above 1,180
  pixels the outline took the document's column, and below that everything went to nothing.
  Shipped broken since the three-pane layout, and found only because a hosted page closes
  that pane deliberately — every browser test so far had left the panes as they load.
- The judge stops reporting density for documents under 800 characters, where marks per
  thousand says more about the arithmetic than about the document.
- A mark that changes a figure is told apart from one that changes a word. The inline mark
  gets a dashed amber outline, its row a **figure** tag, the status bar a count, and
  **Accept all** stops being one click: it says how many suggestions it is about to write,
  how many of those change a figure, and lists them. A changed digit is a claim about the
  world and a changed word is a choice about words; they were rendered identically and so
  got the same glance. An assistant returned a document with thirty-five numeric
  replacements, a dozen of them invented figures in the right shape, and every one was
  formally correct CriticMarkup — nothing but reading caught them, and nobody reads a
  hundred marks carefully. Deleting a number and inserting one both count, since both
  change what the document asserts; rewriting `$206` as `206 dollars` does not.

## 0.2.0 — 2026-11-13

Reviewing a document an AI changed, which is what the first version turned out to be for.
Three assistants were run against the prompt below and judged rather than read; the results
are in [docs/model-notes.md](docs/model-notes.md).

**Comparing two versions**

- **Compare** tab: diff the open document against another file, or an earlier version of it,
  rendered in the same marks the editor uses. Blocks are aligned by LCS before being diffed, so
  one inserted paragraph does not report the whole file as changed; rewritten blocks are
  recognised by word overlap rather than showing as an unrelated delete and insert; runs of
  untouched blocks collapse. Read-only for now. The other side is chosen from a dropdown of
  the open documents and the connected folder, or through **Browse…**, which opens a file
  dialog and so reaches a copy that lives nowhere near the folder you opened.
- `tools/history.mjs` exports a file's past versions into `history/` for the Compare tab, so
  git history is read by git rather than by a packfile parser in the browser.

**Reviewing**

- The cell editor turns the browser's spell checker back on. It holds prose — the marks are
  resolved away before the text reaches it — so underlines land on words rather than on
  CriticMarkup delimiters. The paste and export boxes, which hold raw markdown, keep it off.
- A selection can be copied. It could not be: the popover that opens on a selection focused
  its comment input, which collapsed the selection, so the copy shortcut had nothing to act on
  and the only way to lift text out of a document was to open the block for editing and copy
  from the textarea. The popover now asks first — Copy or Comment — and focuses nothing until
  Comment is chosen, which restores the shortcut by itself. Copying resolves the marks instead
  of yielding the rendered text, where a replacement reads as `threenineteen`, and it is
  offered for selections that cannot be commented on at all, which is most of the ones worth
  copying once a document has been marked up.

**Files**

- A save no longer overwrites a file that changed underneath it. Nothing locks a file the way
  Word does, and a browser cannot, so saving now reads the file back first and compares it
  with what was last read or written — content, not a timestamp, which for files this size
  neither misses a change nor invents one. If it moved, the write stops and offers **See what
  changed**, which opens the on-disk version in the Compare tab as the older side, so the diff
  reads as what overwriting would do; **Save as…**; or **Overwrite**. Previously two tabs on
  one file meant the second save silently destroyed the first.
- The page now carries its own document head — doctype, `<meta charset="utf-8">`, viewport.
  It had none: the artifact host wraps uploads in a skeleton and macOS Chrome guesses UTF-8
  for local files, so both environments hid it. Downloaded and opened from disk, which is
  what the README tells people without git to do, the file rendered in quirks mode and left
  the encoding to the browser's guess — on a Windows machine with a CJK locale that guess is
  GBK, and every `→`, `‡` and Chinese character in the document becomes mojibake. Leaving
  quirks mode shifts content about 3px; nothing else moves.
- Saving works from a hosted copy in browsers without the File System Access API. The download
  path tested for `file://` or localhost by name, so a Firefox or Safari visitor to a project
  page was offered Copy and nothing else; it now asks the browser whether the origin is
  trusted. An `index.html` redirects to the tool, since GitHub Pages serves the site root.

**Working with an AI**

- README gains a prompt for having an AI mark a document up in CriticMarkup, and the one
  check worth doing on what comes back: the **Original** view should read as the document you
  started with, because an edit made outside a mark destroys the original silently. The prompt
  is tested rather than asserted — its output is parsed by the real page and asserted to
  reject back to the source file byte for byte.
- `tools/check-markup.mjs` judges a document an assistant marked up: it asserts that rejecting
  every suggestion reproduces the original byte for byte, and names the rule behind a failure
  rather than printing a diff — rewrapped text, a newline outside a mark, CJK spacing padded,
  an excerpt in place of the document. It runs the page's own parser, so what the tool accepts
  is the definition of correct, and it exits non-zero, so comparing assistants on one document
  is a loop rather than a reading exercise. The silent failures are the point: a paragraph
  quietly rewrapped still renders correctly and still carries its marks, and has taken the
  original with it.
- The judge measures rule 3 by how much of a replacement is identical on both sides, not by
  how long the mark is. A replacement that keeps 37 of its 47 characters the same to change
  two words is mostly ballast, and the page strikes the whole old text beside the whole new
  one — it word-diffs only while you are editing — so the reader is left hunting. Length
  could not see this: the mark was 88 characters against a 400-character threshold.
- `docs/model-notes.md` records how each assistant does at the prompt, starting with a
  calibration run whose only claim is to show what a clean result looks like. Using the judge
  on real output corrected two of its own metrics: granularity was counting comment length, so
  a thorough note read as a coarse edit, and the coarseness warning fired on a legitimately
  inserted paragraph — a paragraph added or removed is one mark because there is nothing inside
  it to diff, and only a paragraph swapped hides which words moved.

**Finding your way in**

- The tutorial says that it is one, and the two ways out of it are a row of buttons above the
  document rather than only in a side pane a first-time reader has no reason to have looked
  at. Both disappear once a real file is open.
- README opens with a recording of the loop it describes — edit a paragraph as prose, watch
  the word diff form under the editor, commit, accept.
- A social preview card, so a link to the repository stops rendering as GitHub's grey default,
  with the page that generates it committed beside it — the card carries the project URL and
  would go stale with no way to remake it.
- README gains a **To do** section recording what is planned and what makes each piece hard,
  and a **Why** that starts from the case this tool exists for: an AI edits a Markdown document
  and a human has to see what it changed.
- **To do** records the direction the day arrived at: a panel beside an assistant, which needs
  the document handed in and out through whatever opened the page, because a browser page
  cannot be given a path. The entry that asked whether AI belonged inside the editor is marked
  decided against, with the reason — the tool wants to be inside an assistant rather than host
  one, and that inversion dissolves the credential problem instead of working around it.

**Fixed**

- Fixes a parser bug the compare work surfaced, latent in the editor all along: a mark whose
  text contains one backtick — which a diff produces as soon as formatting changes — left a
  stray backtick that paired with the next one in the document, and the inline-code span that
  resulted swallowed the following mark. Code spans and fences are now found on a copy with
  marks blanked out.

**Still not 1.0**, and for a new reason. The file format was already stable and still is;
what moved is the shape of the thing around it. This release learned that the tool belongs
in a panel beside an assistant rather than holding one, and nothing of that is built yet.
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
