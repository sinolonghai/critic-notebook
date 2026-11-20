# critic-notebook

**0.13.0** · [changelog](CHANGELOG.md)

**A Markdown editor with tracked changes.** Review Markdown the way you'd review a document —
but keep the revisions in the file.

One HTML file. No install, no build, no server, no dependencies. Open it in a browser, open a
`.md`, and every block of the document becomes a cell you can click and rewrite in plain prose.
What you changed is recorded as [CriticMarkup](http://criticmarkup.com/) inside the Markdown
itself, so the revisions travel with the file and stay readable in any editor.

![Editing a paragraph in place: two words are retyped, the word-level diff appears under the
editor as it is typed, and committing leaves a tracked suggestion in the prose with accept and
reject buttons beside it.](media/demo.gif)

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

### Without downloading anything

**<https://sinolonghai.github.io/critic-notebook/>** is the same file, served from this
repository. Open it and it works exactly as the downloaded copy does, including opening a
folder and saving back to it — the page makes no network requests of its own, so documents
you open stay on your machine either way.

The one difference is bookkeeping: a hosted page and a local file are separate origins to the
browser, so the folder history and the **Sign as** name do not carry between them. Send this
link to someone who should not have to think about any of the above.

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
node test/blackline.test.mjs   # a comparison written out, and read back as both versions
node test/merge.test.mjs       # two reviews laid over one original
node test/git.test.mjs         # the git reader, object by object against git itself
node test/browser.test.mjs     # the interface, in a real browser — needs Playwright
```

The first three need nothing installed. The last one skips itself, and says how to get
Playwright, if it is not there.

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
| Rewrite a block | Click it, edit the text, click anywhere else |
| Discard an edit in progress | `Esc` |
| Add a paragraph | `+` in the gap between paragraphs |
| Delete a paragraph | Click it, clear the text, click away |
| Split a block | Click it, type a blank line where it should break, click away — a table or a list warns as you type |
| Join two blocks | `−` in the gap between them — it asks first, and says so where the two will not read as one |
| Delete a phrase | Select it, choose **Delete** |
| Comment on a phrase | Select it, choose **Comment**, type it |
| Copy a phrase | Select it, choose **Copy** — or just press the copy shortcut |
| Change a few words | Select them, choose **Edit**, retype in the box, press Enter |
| Rewrite the whole block | Click it (or select inside a mark and choose **Edit**) |
| Edit or delete a comment | Click the comment text; empty it to remove it |
| Accept / reject a suggestion | `✓` / `✕` on the row under its block |
| Edit without recording it | **Tracking on** in the status strip — click to turn it off |
| Get unsaved work back after a crash or a host closing the page | It is offered on the next open |
| Undo anything | `⌘Z` (80 steps) |
| Save | `⌘S` — greyed out when there is nothing to write |
| Save to a new file | `Save as…` |
| Jump between touched blocks | `↑ prev` / `next ↓` in the outline |
| Fold a side pane | the two buttons at the top left |
| Compare two versions | the **Compare** tab |
| Merge two reviews | the **Compare** tab, then **Merge reviews…** |

Set a name in the `Sign as` field and your suggestions are attributed with `@name`; each author
gets a colour. Every mark is signed, not one per edit — tracked changes trade verbosity for a
history, and a mark nobody can be asked about is not much of one. Reviewing in turn keeps that
straight: open a document someone else has marked up and the editor hands you their proposed
text as prose, and a suggestion of theirs that you leave alone comes back with their name and
their note still on it.

### Spelling and grammar

The cell editor is an ordinary text box with the browser's spell checker turned on, so
misspellings are underlined and right-click offers corrections, the same as anywhere else.
Chrome's basic check runs locally; its *enhanced* mode sends what you type to Google, which is
a browser setting worth knowing about if the document is confidential.

For grammar there is nothing to install here either: Grammarly, LanguageTool and the like work
in any text box, including this one. Opening the tool as a local file is the one catch — an
extension has to be allowed to run on `file://` pages, which is a switch on the extension's own
settings page, off by default.

### Copying out of a document

Selecting a phrase offers **Copy** as well as **Comment**, and the copy shortcut works on its
own. Both resolve the suggestions in what you selected rather than handing you the rendered
text, where a replacement reads as the old and new words run together — `threenineteen`. You
get the passage as the view reads it: as proposed, or as the original in the **Original** view.
A selection that takes in a suggestion cannot be commented on, because a comment has to anchor
to plain text, but it can still be copied.

This is the way out of the loop when you want a passage rewritten rather than tweaked: copy it,
hand it to whoever or whatever is going to rewrite it, and paste the result back into the block.
The editor diffs what you paste against the original, so it arrives as one tracked suggestion
like any other.

### How edits are recorded

Edits are diffed against the **original**, not against your previous edit, so changing the same
sentence five times still produces one clean `{~~old~>new~~}` rather than five nested layers.
The diff is word-level for Latin scripts and character-level for CJK, so changing two characters
in a Chinese paragraph marks two characters.

### Unsaved work, and where it can be lost

A page at the top of a browser tab gets to ask before it closes, and the tab asks. A page
drawn **inside another app** — a chat assistant's side panel, a canvas, any iframe — does not:
the host removes the frame and `pagehide` is the first and last the page hears of it. There is
no way for the page to object, and no way to make that host notice there was something
unsaved in it.

So the page does the two things it can. While there is unsaved work in a frame, a strip above
the document says that the app around it can close it without asking. And every unsaved
document is kept in this browser's storage as you edit, and offered back the next time the
page opens: *Unsaved work from last time — bring it back or discard it.* What comes back is
what you had, still unsaved and still to be written somewhere.

One case defeats both. A frame sandboxed without same-origin has no storage at all, so
nothing can be kept for it; the strip says so instead of implying a safety net that is not
there. For a long review, the page belongs in a browser tab of its own, or in
`tools/panel.mjs`, where Save writes a real file.

### Turning tracking off

The status strip says **Tracking on**, and clicking it turns the page into an ordinary editor:
what you type goes straight into the text — no mark, no name, nothing for anyone to accept or
reject. It is for the pass before the review, when the document is still yours: your own draft,
your own typos. The strip changes colour while it is off, so it is not a state you can be in
without noticing, and it is on again every time the page is opened — a suggestion that went
unrecorded is a change nobody can see, which is the more expensive mistake.

Suggestions already in a block survive an untracked edit. Rewrite a paragraph someone else has
marked up and their marks come back as they were, with their names and notes on them: turning
tracking off never quietly accepts somebody else's work. `⌘Z` still undoes anything, and
comments and highlights are made the same way either way — a comment is not a change.

## Having an AI mark up the changes

The editor does not care who wrote the marks. An AI assistant — Claude, ChatGPT, DeepSeek,
Gemini, whichever you use — can produce them, and the document then arrives as a list of
suggestions to take or drop one at a time, which beats reading the new version straight
through and hoping you notice what moved.

Give the AI assistant the document and this prompt:

```text
Mark up this Markdown document with tracked changes in CriticMarkup, so that a human can
accept or reject each change separately. Return the complete document and nothing else —
no preamble, no summary, no diff.

1. Every character you are not changing must come through byte-identical. Do not rewrap
   lines, do not normalise quotes or dashes, do not reformat tables, and do not add or
   remove spaces between scripts — CJK text sitting directly against Latin text or a
   number stays that way. Anything outside a mark is read as the original text, so an
   unmarked change is an invisible one.
2. Use only these marks:
       {--deleted--}  {++inserted++}  {~~old~>new~~}  {>>comment<<}  {==highlight==}
3. Mark the smallest span that carries the change. A replaced word is {~~word~>better~~},
   not a rewritten sentence — the reviewer has to see what moved.
4. Never nest one mark inside another.
5. Never put a mark inside a fenced code block or inline code. Leave code alone.
6. When you add or remove a whole paragraph, list item or heading, the line breaks that
   separate it from its neighbours go INSIDE the mark. A newline left outside is read as
   original text and adds a blank line the author never wrote.
7. Put a comment immediately after the mark it explains, and sign it:
   {~~a~>b~~}{>>@ai: b is the term section 3 uses<<}
8. Where you are unsure, leave a comment rather than silently making the change.
9. A figure is not a wording choice. Do not replace a number unless the correction
   follows from the document itself; if a number looks wrong, comment on it and leave
   it as it is.
```

Rule 9 earned its place. An assistant returned a document with thirty-five numeric
replacements, a dozen of them figures in the right shape that follow from nothing — and every
one was formally correct CriticMarkup, so nothing but reading caught them. "Do not make things
up" is not a rule a model can check itself against; "comment, do not replace" is. It costs
none of the good findings: an arithmetic error spotted is still spotted, as a comment, and a
correction that genuinely follows from the document is still allowed.

Save what comes back as a `.md` and open it, or paste it in with **Paste** in the left pane.

**If the assistant can edit the file itself** — Claude Code, WorkBuddy, Copilot in an editor —
do not ask it for the document back. Reprinting a file is where a model drifts, and rule 1 is
the rule reprinting breaks. Point it at the file and swap the first two sentences for these:

```text
Add tracked changes to this file in place, in CriticMarkup, so a human can accept or reject
each change separately. Insert marks around the text that is already there; do not rewrite
the file, and do not touch a single character you are not marking. Make no other edit of any
kind — not a rewrap, not a reformat, not a spacing fix.
```

The rest of the rules below apply unchanged.

**Check rule 1 was obeyed before trusting the rest.** Switch to **Original**: that view
resolves every mark back to the text it replaced, so it should read as the document you
started with. If a sentence there is wrong, the AI changed something outside a mark — the
original is gone from the file and rejecting no longer recovers it. Rule 1 is first because it
is the only one whose breach is silent.

If you kept a copy of the file as it was, that check can be exact instead of attentive:

```sh
node tools/check-markup.mjs before.md after.md
```

It asserts that rejecting every suggestion reproduces `before.md` byte for byte, and when it
does not it names the rule that was broken — a paragraph rewrapped, a newline left outside a
mark, spacing padded between CJK and Latin, an excerpt returned instead of the document. It
then reports the shape of what came back: how many marks of each kind, how wide they are
(a whole paragraph swapped as one replacement parses fine and reviews badly), and whether the
comments are signed. Exit status is 0 on pass, so it drops into a script.

It is also how to compare one assistant against another on the same document, which is worth
doing: following rule 1 means reproducing text verbatim, and models differ at it more than
they differ at the editing itself. Results as they come in are in
[docs/model-notes.md](docs/model-notes.md).

## In a panel beside an assistant

The shape this is headed for: you ask an assistant to edit a file, it marks the changes, the
marked file opens in a panel, you take and drop them one at a time, save, and tell the
assistant to commit the result or send it on.

A page in a panel cannot be handed a path — `showOpenFilePicker` needs a human gesture and
will not take a string — so the host hands over the text instead and takes it back the same
way. Four messages, no credentials, nothing touching a filesystem:

```text
page → host   { type: 'ready', protocol: 1, version: '0.13.0' }
host → page   { type: 'open',  name: 'A.md', text: '…' }
page → host   { type: 'save',  name: 'A.md', text: '…' }
page → host   { type: 'dirty', dirty: true, open: 3 }
```

A host in twenty lines:

```html
<iframe id="f" src="critic-notebook.html"></iframe>
<script>
  const page = document.getElementById('f').contentWindow;
  addEventListener('message', ev => {
    if (ev.source !== page) return;
    switch (ev.data.type) {
      case 'ready':                               // the page has loaded and is listening
        page.postMessage({ type: 'open', name: 'A.md', text: myMarkdown }, '*');
        break;
      case 'save':                                // the reviewer pressed Save
        writeItSomewhere(ev.data.name, ev.data.text);
        break;
      case 'dirty':                               // decisions are pending; do not close yet
        panelHasUnsavedWork = ev.data.dirty;
        break;
    }
  });
</script>
```

`ready` is broadcast, because the host's origin is not known yet and the message says nothing
about any document. Everything after it is sent to the origin the first `open` arrived from
and nowhere else: a document must not be posted to a parent that never asked for one. The
page ignores any message that did not come from its own parent.

`dirty` is not decoration. The `beforeunload` guard that protects unsaved review work does not
fire reliably for an iframe a host tears down, so the page has to be able to say it is holding
decisions that would be lost. `dirty` is about unsaved edits; `open` counts suggestions nobody
has decided on yet, which can be above zero on a document that is perfectly saved.

While hosted, the page hides **Open folder**, **Open file**, **Save as** and the documents
pane. Those are not merely useless when the host owns the file — opening another one would
leave Save handing the host back something it never asked for. **Save** posts the document
instead of writing it, and the document counts as saved from that moment: a host that asks
for a document is taken to be committing to do something with it.

Not there yet: a `saved` acknowledgement, so the page could report a host that dropped the
document rather than assuming it landed; and `ask` / `suggest`, which would let you select a
paragraph, send it to the assistant for a rewrite, and have the result arrive in that block —
removing the copy and the paste that are otherwise the one manual step in the loop.

### From the command line

`tools/panel.mjs` is the protocol's second host, and the first meant for daily use. It is how
you tell an assistant that can run commands to put a file in front of you:

```sh
node tools/panel.mjs notes.md          # review it; saving writes the file
node tools/panel.mjs notes.md --once   # stop after the first save
```

It serves the page on localhost, hands it the file, and writes back what you decide — the loop
closes without anything being copied by hand. Say this to an assistant and it has what it
needs:

> 改完 `notes.md` 之后跑 `node tools/panel.mjs notes.md`，我在浏览器里审。

It serves rather than writing a page into a temp folder for two reasons: a page on localhost is
a trusted origin, so the editor behaves as it does from a folder, and saving has somewhere to
go. The server binds to 127.0.0.1, every request must carry a token made at startup — any other
page in your browser can reach a localhost port, and the token is what stops one writing to
your file — and it lives only as long as you are reviewing. The path is fixed when the process
starts, and nothing the page says can change it.

What it needs is a shell on **your** machine and a checkout of this repository. An assistant
whose code runs in its own cloud sandbox — ChatGPT's included — cannot open your browser or
reach your files, so there you are the one who runs the command, and the assistant's part is
only to write the marked-up file. An assistant that works in your filesystem — Claude Code,
WorkBuddy, Copilot in an editor — can run it for you.

Below 880 pixels the top bar folds to two rows and loses what a panel has no use for: the
label on the signing name, the "5 to review" count that the status line below repeats, and —
hosted — the signing name itself, since there is one reviewer. 880 is where both panes have
already given up their columns and become drawers; the bar was the last thing still pretending
there was room beside the document. What goes *in* is `←  3 / 7  →` beside the file name,
which jumps between blocks
carrying suggestions. Those buttons lived in the outline pane, the first thing a narrow layout
throws away, and they are the most useful control in the interface for this job: they turn the
document into a review queue, which for "it changed four things, decide on each" is better than
the wide layout rather than a degradation of it. Hosted at 780 pixels — a panel beside a chat —
there are 142 pixels above the first line of the document, where there were 189; at 420, 124
where there were 199.

## Comparing two versions

The **Compare** tab diffs the open document against another one — a different file, or an
earlier version of the same file — and shows the result in the same marks the editor uses.

The dropdown is a shortcut, holding the open documents and the files in the connected folder.
**Browse…** opens a file dialog instead and reaches anything on disk: the copy a colleague
mailed you, a draft in another project. A browsed file is only the other side of the
comparison — it is not opened for editing.

**Open as suggestions** turns the comparison into a document. Every difference becomes a
suggestion in it, so the next step is not reading a list of what changed but deciding on each
one in the editor that is already open — Word calls the result a legal blackline. Reject
everything and you have the older version; accept everything and you have the newer. It opens
unsaved and attached to no file — nothing should be written to a file on the strength of a
button that drew a comparison — and a strip above it offers the thing that makes it worth more
than a report: **Make it the new &lt;file&gt;**, which hands it the identity of the document it
was made against, so from then on it *is* that file and ⌘S writes it. That one asks first,
because it writes over the file on disk: it says so, says the older side is not touched
whatever happens, and says how many suggestions are still undecided and would go into the file
as marks. Until it is saved or adopts a file, a blackline is listed under **not saved to a
file**, so it is not mistaken for one.

That is how you take individual changes across versions. Reject the suggestions you want to put
back, accept the rest, save: what comes out is a new version of the file, never a revert to an
older one. Prose is exactly the case where you keep one paragraph and return the next, so "go
back to version N" is the wrong shape for the problem. The row the file was already open under
is dropped when the blackline adopts it, because two rows claiming one file is how a save
quietly throws the other away. **Keep it separate** declines all of that and leaves a plain
third document for **Save as…**; either way the older side is never written to.

The claim is checked rather than asserted. The file is put to the page's own parser before it
opens, and if it does not read back as both versions it is not opened at all — there is one
shape it cannot take, below. `test/blackline.test.mjs` asserts the round trip on the cases that
have broken; the two it was developed against were every consecutive version of this project's
own README and CHANGELOG out of git history, 69 comparisons and about a thousand suggestions.

A blackline is written in this tool's own layout: one blank line between blocks, one newline at
the end. So rejecting everything gives the older version as this tool would have saved it, not
a byte image of a file that may have had four blank lines in a row. Whitespace between blocks
is deliberately not a suggestion — marking it would put one between every pair of paragraphs
and bury the changes that matter.

The shape it cannot take is a block that quotes CriticMarkup inside a code span, because the
parser pairs an opening delimiter with the first closing one it meets and that would be the
quoted one. Such a block is left at the older version with a note saying so, and the count is
reported; where even that will not hold, nothing is opened and the tab says why. This project's
own README is the document that found it.

Two versions cannot be paired by position: insert one paragraph at the top and every later
block shifts, so a positional diff reports the whole file as changed. Blocks are aligned first,
by an LCS over their text, and only the pairs that survived alignment are diffed word by word.
Blocks that were rewritten rather than replaced are recognised by word overlap, so they read as
one change instead of a deletion next to an unrelated insertion. Runs of untouched blocks
collapse to a single line.

**Git history** is in the same picker. When the folder you opened is the top of a git
repository, the picker lists every commit that changed the open file, newest first —
`2026-11-17 · Keep the name on a mark… · a3dada4` — and choosing one compares against that
version. The newest is called *last commit*, so comparing against it shows what you have changed
since you last committed. From there, **Open as suggestions** works as it does for any file.

The page reads the repository itself, with no git installed and no terminal step, and only ever
reads: no object is written, no ref is moved, nothing is locked. It follows the first-parent
line, which is what `git log --first-parent -- <file>` lists, and does not follow renames. A
reader that understood only loose objects would work on a fresh repository and go quietly blind
the first time git packed it, so packs are read from the start — the version-2 index, every
entry type, deltas named by offset and by hash, and chains of them as deep as git builds. What
it does not understand it says so about rather than read wrongly: a SHA-256 repository, an index
format git stopped writing in 2008, a folder that is a worktree or a submodule and keeps its
history elsewhere. A folder that is *inside* a repository but not its top cannot reach the
`.git` above it — a page is given the folder it is given — and the picker says that too.

`tools/history.mjs` still writes past versions out as files, for a browser without folder
access or a folder below the top of the repository:

```sh
node tools/history.mjs README.md        # last 10 versions
node tools/history.mjs docs/spec.md 25
node tools/history.mjs --all            # every tracked .md
```

They land in `history/<name>/<date>-<sha>.md`, which is gitignored and shows up in the tree on
the left like any other folder.

**Merge reviews…** is the other thing two files can be to each other. Where a blackline is one
version against a later one, a merge is two people who reviewed the *same* document apart from
each other: both files reject to one original, and that original is what the two sets of
suggestions are laid over. Word calls it *Combine*.

The names are asked for at that moment because that is when they can be known. An assistant
signs where it leaves a comment and nowhere else, so half of what it changed comes back
anonymous — but you know which file came from whom, which is better evidence than a model
remembering to sign. Anything already signed keeps its name; everything else is stamped with
the name for its side. Each reviewer then has a colour, and the right edge of the suggestion
rows is a column you can run an eye down.

Where both touched the same words there is nothing to be done: CriticMarkup cannot nest, so
two suggestions cannot cover one span. The first is kept and the second is written beside it as
a comment saying what it would have done — nothing lost, nothing invented, the same answer the
blackline gives for a block it cannot mark. The count is reported when the merge opens.

The one claim asserted is that rejecting every suggestion gives back the document both reviews
started from; it is put to the page's own parser before the result opens, and if it fails the
result does not open. Accepting everything is deliberately *not* a claim: it would mean taking
two people's suggestions at once, which is a document neither of them wrote. Two files that do
not reject to the same text are refused with the reason.

Taking individual changes from one version into another is what **Open as suggestions** above
is for, and it lands in a new commit rather than a revert — prose is exactly the case where you
keep one paragraph and put the next one back.

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

`blackline.test.mjs` asserts the same invariant across a whole comparison — reject everything
and you have the older version, accept everything and you have the newer — on the cases that
have broken: additions and removals at the top, the middle and the end, runs of both at once,
lists, tables and fences, documents entirely new or entirely gone, and the one shape the format
cannot take.

### The git reader

```sh
node test/git.test.mjs                  # this repository
node test/git.test.mjs --fixtures       # four built ones: loose, packed two ways, and mixed
node test/git.test.mjs path/to/repo     # any other
```

The page reads git without git, so the only honest test is to ask git. Every object in the
repository is read twice — by the page's reader and by `git cat-file` — and compared byte for
byte; then the history of every file the first-parent line has touched is compared with what
`git log --first-parent` says. `--fixtures` builds repositories in every state a real one is
found in, including delta chains thirty-odd deep, which a fresh clone of a small project never
has. Needs git on the path, and skips with a note when there is none.

### The browser suite

```sh
node test/browser.test.mjs                 # all of it, about a minute
node test/browser.test.mjs join widths     # only the named scenarios
```

The three suites above run the page's functions in node and assert on text. This one asserts
what text cannot see: whether a control is on screen, what a selection reaches, whether a click
writes a file, whether the layout survives a panel's width. Most of what has broken in a week of
use broke here rather than in the parser, and each scenario was written the day its bug was
found — `stale` for a file re-read on the way back in, `pop` for a selection inside a deletion,
`join` and `split-warning` for the paragraph controls, `blackline` for a comparison adopting the
file it was made against, `widths` for eight viewport widths in both modes, `panel-tool` for
`tools/panel.mjs` end to end, including the token that guards its port.

Playwright is the project's only dev dependency and is not required: without it the suite says
so and exits 0, so `node test/*.test.mjs` stays green on a fresh clone.

```sh
npm install playwright && npx playwright install chromium
```

`CN_PLAYWRIGHT` points at an install elsewhere and `CN_CHROME` at a browser binary, for a
shared install or a CI cache. The page is served or opened exactly as it ships; the two
scenarios that have to reach inside it write a copy to a temp directory with a hook appended,
the same trick the node suites use. Nothing is added to the file that ships.

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
| | `cm-drafts` | unsaved documents, kept as you edit and offered back on the next open |
| IndexedDB `critic-notebook` → `kv` | `folders` | folder history: handles, names, last-used |
| | `dir` | the single folder an earlier version stored, kept for migration |

Two stores because `localStorage` holds only strings, and a `FileSystemDirectoryHandle`
cannot be turned into one — it survives only through structured clone, which is IndexedDB's
to offer. That handle is what lets a remembered folder be reopened with one permission click
instead of being picked again.

Folder history keeps the **8 most recent**; older entries fall off the end. Expansion state
for folders no longer in that history is pruned with it, so the keys do not accumulate.

In Chrome every `file://` page shares one storage bucket, so moving `critic-notebook.html` to
another directory keeps all of it — and so would any other local HTML file you ever open, which
is why nothing worth protecting is kept here. A copy served over `https://` gets its own origin
instead, separate from the local one and from other people's sites, which means a hosted copy
and a downloaded copy do not share a folder history. Clearing site data, or a private window,
starts over.

## To do

Nothing is planned at the moment. Everything this list once held has been built — the panel
mode, the blackline, taking changes across versions, merging two reviews, the browser suite,
reading git — and the CHANGELOG says what each one turned out to need. What is left is the one
idea that was turned down, kept because a list that records what was refused, and why, is more
use than one that quietly drops it.

**AI assistance in the editor — decided against,** and kept here because a list that records
what was turned down is more use than one that quietly drops it.

The objection that killed it was practical. A browser can call an AI API perfectly well; what
it cannot do is hold the key safely. A single local file has only `localStorage`, and in Chrome
every `file://` page shares one store, so any other local HTML file you ever open could read
it. A localhost helper would fix that and cost the one property that makes this tool easy to
hand to somebody: download a file, double-click it.

But the better answer turned out to be the other way round. **The tool does not want an
assistant inside it; it wants to be inside an assistant** — the two entries at the top of this
list. That inversion dissolves the key problem rather than working around it: the assistant
already holds the credentials, and the page needs none. It has been seen working, with
WorkBuddy holding the file and the key, DeepSeek writing the marks, and the review happening
here (see [docs/model-notes.md](docs/model-notes.md)).

And the deeper objection stands either way: this is a reviewing surface, not a writing one. The
reason it exists is that a human should be the one reading what the model changed. Putting the
model back inside that step undoes it.

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
- **Nothing locks the file.** Word takes the file for itself while you have it open; a browser
  has no way to. What the tool does instead is notice: a save re-reads the file first, and if
  it is no longer what was opened — a second tab, another editor, a sync client — it stops and
  offers **See what changed**, **Save as…** or **Overwrite** rather than writing over work it
  cannot see. Detection covers one case locking never would, which is the same file open in
  something that is not this tool. Choosing Overwrite still discards the other copy; that is
  what it means.
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
