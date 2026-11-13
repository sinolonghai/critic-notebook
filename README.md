# critic-notebook

**0.1.0** · [changelog](CHANGELOG.md)

Review Markdown the way you'd review a document — but keep the revisions in the file.

One HTML file. No install, no build, no server, no dependencies. Open it in a browser, open a
`.md`, and every block of the document becomes a cell you can click and rewrite in plain prose.
What you changed is recorded as [CriticMarkup](http://criticmarkup.com/) inside the Markdown
itself, so the revisions travel with the file and stay readable in any editor.

> **Use Chrome or Edge.** Opening a folder and saving back to the file you opened rely on the
> File System Access API, which exists only in Chromium. Firefox and Safari still open, edit,
> comment and export — one file at a time, saving as a download. See
> [Browsers and platforms](#browsers-and-platforms).

## Why

In the past most office work was done in MS Word, where track changes is an essential
function: a document goes back and forth; each person's edits stay visible and reversible;
the last pass is someone reading *what changed* rather than reading the whole thing again.

The work has moved and that habit has not. Nowadays, if you ask an AI to draft a document,
restructure one or tighten a section, what comes back is Markdown — plain text is what models
handle most reliably and what survives being passed between tools. The output is usually good
but never final. It needs a human pass, often a careful one. You can of course ask the AI to
make those edits too, but writing a prompt precise enough is sometimes more work than making
the change by hand.

So you are holding two versions of a document with no good way to see what moved between them.
Markdown has no notion of tracked changes, and the usual answers are unsatisfying:

- **Word / Google Docs** have real track changes, but the revisions live in their format. Export
  to Markdown and you get the final text with the history stripped off — so every AI pass means
  converting out and back, which is where the tracking dies.
- **`git diff`** is line-based. Soft-wrapped prose comes out as "this whole paragraph changed",
  which is useless in exactly the case you cared about: three words moved inside it.
- **CriticMarkup** solves the file format — `{++added++}`, `{--removed--}`, `{~~old~>new~~}` —
  but writing those delimiters by hand is tedious, and the existing tooling is editor plugins
  (Obsidian, VS Code, MultiMarkdown Composer) that each reviewer has to install first.

This fills that gap. There are two ways in:

- **Ask the AI to edit in CriticMarkup.** It writes the marks, you open the file here, and you
  take or drop each suggestion one at a time — the same loop as reviewing a colleague. This
  works today.
- **Keep the before and the after.** Open one, point **Compare** at the other, and the
  difference is shown block by block and word by word, with blocks aligned first so one
  inserted paragraph does not report the whole file as changed. Read-only for now; turning a
  comparison back into accept-or-reject suggestions is the first item under [To do](#to-do).

Either way the reviewer never has to learn CriticMarkup to review in it. That is deliberate:
this is built for the people who actually review documents, not only for engineers who are
at home in a diff. Nothing to install, no command line, no git — download one file,
double-click it, and click a paragraph to change it.

## Getting it

The whole program is one file: **`critic-notebook.html`**. You do not need git, Node, or an
account to use it — only to run the tests.

### From the GitHub page

1. Open **`critic-notebook.html`** in the file list.
2. GitHub will not render it; it shows the source. Click the **download icon** (↓) in the bar
   above the file — it sits next to *Raw* and *Copy*.
3. If you do not see that button, right-click the **Raw** button and choose
   **Save Link As…** (Chrome, Edge) or **Download Linked File As…** (Safari).

Save it anywhere you like. A Downloads folder is fine; beside the documents you review is
better, because then the title bar can show full paths.

### From the command line

```sh
curl -O https://raw.githubusercontent.com/sinolonghai/critic-notebook/main/critic-notebook.html
```

That URL is for downloading, not for opening: GitHub serves it as `text/plain` with
`nosniff`, so a browser pointed at it shows the source rather than running the page.

Or clone the whole thing, if you also want the samples and tests:

```sh
git clone https://github.com/sinolonghai/critic-notebook.git
cd critic-notebook
```

### Running it

It is a web page, not a program — there is nothing to install or launch. Open the file in
Chrome:

```sh
open -a "Google Chrome" critic-notebook.html     # macOS
xdg-open critic-notebook.html                    # Linux
start chrome critic-notebook.html                # Windows
```

Double-clicking works too, as long as your default browser is Chrome or Edge. The address bar
should read `file:///…/critic-notebook.html`.

That is all. The page opens on a built-in tutorial; click **Open folder** when you are ready to
work on your own files. Nothing is uploaded, and no network connection is needed — only the web
fonts come from the internet, and the page is perfectly legible without them.

### Running the tests

Only needed if you are changing the tool. Node 18 or newer, no packages to install:

```sh
node test/review.test.mjs      # unit: the cases that have broken before
node test/documents.test.mjs   # whole documents end to end
```

## Using it

**Opening.** There are two ways in:

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

**Sharing it.** Send someone the HTML file and they can review a document without installing
anything. Or serve `critic-notebook.html` from any static host — GitHub Pages included — and
send a link. Nothing is uploaded either way: the document they open is read in their own
browser and never leaves it.

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
| Compare two versions | the **Compare** tab |

Set a name in the `Sign as` field and your suggestions are attributed with `@name`; each author
gets a colour.

### Spelling and grammar

The cell editor is an ordinary text box with the browser's spell checker turned on, so
misspellings are underlined and right-click offers corrections, the same as anywhere else.
Chrome's basic check runs locally; its *enhanced* mode sends what you type to Google, which is
a browser setting worth knowing about if the document is confidential.

For grammar there is nothing to install here either: Grammarly, LanguageTool and the like work
in any text box, including this one. Opening the tool as a local file is the one catch — an
extension has to be allowed to run on `file://` pages, which is a switch on the extension's own
settings page, off by default.

### How edits are recorded

Edits are diffed against the **original**, not against your previous edit, so changing the same
sentence five times still produces one clean `{~~old~>new~~}` rather than five nested layers.
The diff is word-level for Latin scripts and character-level for CJK, so changing two characters
in a Chinese paragraph marks two characters.

## Comparing two versions

The **Compare** tab diffs the open document against another one — a different file, or an
earlier version of the same file — and shows the result in the same marks the editor uses.

The dropdown is a shortcut, holding the open documents and the files in the connected folder.
**Browse…** opens a file dialog instead and reaches anything on disk: the copy a colleague
mailed you, a draft in another project. A browsed file is only the other side of the
comparison — it is not opened for editing.

Two versions cannot be paired by position: insert one paragraph at the top and every later
block shifts, so a positional diff reports the whole file as changed. Blocks are aligned first,
by an LCS over their text, and only the pairs that survived alignment are diffed word by word.
Blocks that were rewritten rather than replaced are recognised by word overlap, so they read as
one change instead of a deletion next to an unrelated insertion. Runs of untouched blocks
collapse to a single line.

To compare against git history, export the versions as files first:

```sh
node tools/history.mjs README.md        # last 10 versions
node tools/history.mjs docs/spec.md 25
node tools/history.mjs --all            # every tracked .md
```

They land in `history/<name>/<date>-<sha>.md`, which is gitignored and shows up in the tree on
the left like any other folder. Git stays in git's hands: a web page has no business parsing
packfiles, and a reader that handled only loose objects would work on a fresh repo and quietly
stop after the first `git gc`.

The view is read-only. Taking individual changes from one version into another is worth doing
later, and belongs in a new commit rather than a revert — prose is exactly the case where you
accept one paragraph and reject the next.

## Browsers and platforms

**Chrome or Edge** for folder mode: the File System Access API that supplies folder handles and
in-place saving exists only in Chromium. Firefox and Safari implement OPFS, a private sandbox
that cannot reach your own directories — so this is an API fact, not an untested guess.

Everything else is ordinary DOM and works anywhere. Elsewhere the page drops to opening single
files through a file input or drag & drop, and saving downloads a copy; where even
`localStorage` is refused (Safari on `file://`) it still edits and exports, just without
remembering anything. That degraded path is tested by stripping the same APIs from Chromium.

**Windows.** Same engine, so folder mode works. A file opened with CRLF line endings is saved
back with CRLF, so a round trip does not show up as every line changed; paths are shown as
`C:\Users\…` and shortcut hints say Ctrl rather than ⌘.

## The invariant

Everything rests on one property:

> For any block, rejecting every suggestion reproduces the original text **exactly**, and
> accepting every suggestion reproduces the edited text **exactly**.

That is what makes the tool safe to use on a file you care about: a recorded change is never
lossy, and the original is recoverable from the file alone, on any machine, with no history.

The non-obvious consequence, and the thing that took three bugs to learn: **text outside a mark
belongs to the original.** A newline placed outside a mark survives a reject, so adding a list
item or a paragraph has to put its newline *inside* the mark, not beside it.

Two test files assert it ([how to run them](#running-the-tests)). Both run the real page —
they extract the script from `critic-notebook.html` and call its live functions, so they cannot
drift from the implementation.

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

In Chrome every `file://` page shares one storage bucket, so moving `critic-notebook.html` to another
directory keeps all of it. Clearing site data, or a private window, starts over.

## To do

Roughly in the order they would be worth doing. Each note says what makes it hard, because
that is the part that gets forgotten.

**Save a comparison as a file.** The Compare tab works out the alignment and the word diff but
only draws them. Writing the result back out gives a third document whose differences *are*
tracked suggestions — Word's "legal blackline" — which can then be accepted or rejected one at
a time in the editor. The invariant comes along for free: reject-all is the older version,
accept-all is the newer. Mostly reassembly, plus the newline rules whole-document output needs.

**Take individual changes across versions.** The natural use of a blackline. It should produce
a *new commit*, never a revert: prose is exactly the case where you accept one paragraph and
reject the next, so "go back to version N" is the wrong shape for the problem.

**Combine two reviewers' copies.** Reviewing *in turn* already works: each person signs with a
name, their suggestions and comments carry it in the file, and whoever opens it next can take,
drop or reply to what the last one left. Missing is Word's *Combine* — two people who edited the
same original **in parallel**, both sets of changes merged into one document with each
attributed. Needs a common ancestor — `git merge-base` where there is a repo, and asking
otherwise — and a way to show a genuine conflict, which CriticMarkup has no syntax for. Worth
designing only once two people are actually editing the same file.

**Browser tests in the repo.** The node suites cannot reach the interface, and three bugs so
far were visible only in a browser: an empty bullet in Original, a comment row with no way to
edit it, a column that collapsed to five words wide. Playwright would be the first real
dev dependency, so the test files would need to skip cleanly when it is absent.

**Read git directly.** It would remove `tools/history.mjs`, since the page already holds a
handle on the repository and browsers now decompress zlib natively. Loose objects are easy;
packfiles are not, and a reader that handled only loose objects would work on a fresh repo and
quietly stop after the first `git gc` — which is worse than not having it.

**AI assistance in the editor**, listed last because the first question is whether it belongs
here at all. A browser can call a model API perfectly well; what it cannot do is hold the key
safely. A single local file has only `localStorage`, and in Chrome every `file://` page shares
one store — so any other local HTML file you ever open could read it. That argues for an
optional localhost helper holding the key, with the page degrading to no AI button when it is
not running, at the cost of this no longer being a thing you download and double-click. The
deeper objection is that this tool is a reviewing surface, not a writing one: the model already
works upstream, through CriticMarkup it writes or a second version to compare against, and the
reason the tool exists is that a human should be the one reading what the model changed.
Putting the model back inside that step undoes it.

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

## Problems and questions

[Open an issue](https://github.com/sinolonghai/critic-notebook/issues). Neither side has to
hand over an email address for that, and the thread stays where the next person with the same
problem will find it.

What helps, in rough order:

- **The browser and the operating system.** Nearly every difference in behaviour so far has
  come from the File System Access API, which only Chromium has.
- **The smallest Markdown that still goes wrong.** This is a tool for reviewing documents, so
  the file that broke it is often one you cannot share. Cut it down until only the few lines
  that still reproduce the problem are left, and paste those — a heading and two paragraphs is
  usually enough, and it is a faster way to find the cause than the whole document would be.
- **What you expected instead.** Several past bugs were cases where the output was defensible
  and still not what anyone wanted.

If you hit something where accepting or rejecting a suggestion gives back the wrong original
text, say so plainly in the title. That is the one property everything else is built on, and
it takes priority over anything cosmetic.

## License

MIT.
