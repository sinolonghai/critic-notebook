# How assistants do at marking up a document

Results from running the prompt in the README's *Having an AI mark up the changes* section
against real assistants, judged by `tools/check-markup.mjs` rather than by reading the output.

Reading is not enough here. The failure that matters is invisible: a paragraph the assistant
quietly rewrapped still renders correctly and still carries its marks, and the original has
gone with it. You find out the first time you press reject.

## Method

Same prompt, same documents, one assistant at a time.

| Document | What it exercises |
| --- | --- |
| `samples/review-me.md` | English prose, a table, a fenced code block (rule 5) |
| `samples/fertilizer.md` | Chinese: per-character diffing, wide tables, full-width punctuation, `−` `×` `÷` `→` `₂` |

Verdict is `check-markup.mjs`: rejecting every suggestion has to reproduce the original byte
for byte. Warnings — a whole paragraph swapped as one replacement, unsigned comments, marks
the parser cannot see — do not fail a run but are recorded.

Two things vary independently, and the first runs made it clear they should be named apart:

**The harness decides how the file travels** — and which prompt to use.

- *Writes files on your disk* — Claude Code, WorkBuddy, Copilot in an editor. The file arrives
  intact, so only the markup is under test. Tell these to **edit in place**: a patch cannot
  drift the way a reprint can, which is most of rule 1.
- *Writes to a repo or cloud through MCP* — intact, one step removed.
- *Chat text only* — a web client, consumer Copilot. Here the braces have to survive the
  interface too: smart quotes, stripped trailing whitespace, a markdown renderer that eats
  `{++ ++}`. Only these need the "return the complete document" prompt.

**The model decides whether the markup is any good** — granularity, what it notices, whether
it comments instead of silently changing.

The same model lands in different rows depending on what is driving it. DeepSeek through its
own web client is chat-only; DeepSeek inside WorkBuddy writes the file. So a result is a
harness-and-model pair, never a model alone, and a flaw belongs to whichever of the two it
survives a change of the other.

## Results

### Claude (Opus 5), 2026-11-13

Both documents pass, no warnings. 11 marks on the English document, 8 on the Chinese one;
40 and 38 characters per edit on average.

**This is a calibration run, not a comparison.** The prompt was written in this session and
its failure modes had been under discussion for hours, so a pass says what a clean result
looks like — it says nothing about how an assistant that has only the prompt will do.

What the run is still good for is showing which rules cost effort, because those are the ones
other assistants will break:

- **Rule 1 is the whole difficulty.** Both documents had to be reproduced in full — 3,733 and
  6,113 characters — and every character outside a mark had to survive. The Chinese document
  is the harder of the two by a distance: it carries `｜`, `₂`, `₅`, `−` (a real minus sign, not
  a hyphen), `×`, `÷`, `→`, `~`, and curly quotes, and getting any one of them wrong is a rule 1
  failure that reads as correct.
- **Rule 6 needs deliberate attention.** Adding an eighth item to a numbered list means the
  mark has to swallow the newline after item seven, not sit between two newlines. The judge
  catches it, but nothing in the rendered page would.
- **Rule 3 is a judgement call, not a rule.** Marking `{~~没有一个是跌的~>无一下跌~~}` is one
  mark for a six-character phrase, which reads well. The temptation is to swap the sentence.

### Tencent WorkBuddy, 2026-11-13 — crashed partway, and the partial run is informative

WorkBuddy stopped partway through `samples/fertilizer.md`, having written two edits. Those
two pass: rejecting them reproduces the original byte for byte, 10 characters per edit.

This is the first evidence for the in-place prompt. WorkBuddy edits the file itself rather
than reprinting it, and rule 1 — the rule a reprint breaks — held, including across Chinese
text with full-width punctuation and a `<br>` in a nearby table. One assistant and two edits
is not a result, but it is the right sign.

The edits were good review, and one of them found something the calibration run missed: the
summary's second bullet lists seven of the eight varieties the first section tabulates, and
WorkBuddy inserted the missing `10-34-0` with a comment saying why. Reviewing the same
document earlier, Claude did not notice.

It signed itself `@//workbuddy/`. The page's author pattern accepts that, so the comments
parsed, counted as attributed, and would have shown `//workbuddy/` as the author on screen.
The judge reported "4 marks carry @name" and said nothing about the name — so it now prints
the names it found and warns when one contains characters nobody would type. Third
measurement the judge got wrong until real output went through it.

The crashed file is kept at `model-runs/_partial/` and the working copies were reset to the
originals before the re-run, since re-running over a half-marked file stacks one pass on
another.

### Tencent WorkBuddy + DeepSeek 4.1 Flash, 2026-11-13

Passes. 46 marks on `samples/fertilizer.md` — 11 replacements, 2 deletions, 1 insertion, 9
highlights, 23 comments — at 16 characters per edit, widest 34. That granularity is the
finest of any run so far and it is the right end of the scale: the reader sees which words
moved.

**It reviewed the document better than the calibration run did.** Seven of its numeric claims
were checked independently and all seven hold:

| Its claim | Checked |
| --- | --- |
| "13.5 months" is nearer 14 | 2025-09-05 → 2026-10-30 is 420 days, 13.80 months |
| `+$19.1` should be 19.0 | 225.1 − 206.1 = 19.0, and 16.5 + 1.8 + 0.7 = 19.0 |
| 19.1 implies 9.3%, not the stated 9.2% | 19.0/206.1 = 9.22%, 19.1/206.1 = 9.27% |
| so the 86% downstream becomes 87% | 16.5/19.0 = 86.8% |
| ±1% comes from rounding the published percentage, not the tonne price | tonne rounding is ±0.06%; a percentage rounded to whole points spans 0.84% |
| "the 18% is not the highest" contradicts the table | +18% is the highest of the eight |
| potash did not rise "all autumn" | 2026-07-10 is 499.58 against 504.58 in June |

Two more were careful table reading rather than arithmetic: a bolded 1099.50 that is neither
the maximum nor the minimum under a caption saying bold marks extremes, and a tied maximum
marked on only one of its two rows.

Three of those — the summary listing seven of eight varieties, `+18%` being the highest after
all, and the 19.1/9.2% inconsistency with its knock-on to 86% — are real defects in the
document that the calibration run did not find.

It still signs itself `@//workbuddy/`, on a different model than the run that crashed. **So
that belongs to the harness**, and no wording in rule 7 will fix it — it is WorkBuddy's own
identifier reaching the file, not the model's choice.

Worth noting what the pair is: this is the stack this tool was argued to belong in, running.
WorkBuddy holds the credentials and the file, DeepSeek produces the marks, and the review
happens here. Nothing in the page needed an API key, which was the objection that put
in-editor AI last on the to-do list. And the model is a *Flash*-tier one — if the cheap fast
tier reviews this well, the economics of the whole loop are better than expected.

**What this run does not tell you**, and it matters: `check-markup.mjs` judges whether the
markup is safe to review, not whether the review is any good. Everything above about the
quality of the edits came from checking the claims by hand. The judge would have passed an
assistant that marked up the document impeccably and said nothing worth reading.

### Tencent WorkBuddy + DeepSeek 4.1 Flash, 2026-11-13, English document

Passes, two warnings. 14 marks on `samples/review-me.md` — 5 replacements, 2 highlights, 7
comments.

**Rule 5 held.** The python fence came through byte for byte, which is the first time any run
has been tested on it; the Chinese document has no code in it. A model asked to review a
document is sorely tempted to improve the code in it, and this one left it alone.

Six of its seven edits are good, two of them sharp:

- It challenged "It is not a recommendation yet" by pointing at two places where the note
  does argue for B — the blockquote calling case 3 "the argument against patching", and the
  runtime section calling the check "most of the argument for B". The document claims a
  neutrality it does not keep, and noticing that is a reading of the whole thing, not a line.
- "Three distinct failures are being reported as one alert" is wrong on the document's own
  terms: item 3 says nothing alerts on it. Two reach the alert, not three.
- It also caught `not detected` sitting in a *Time to recover* column, which answers a
  different question than the column asks, and `six-week project` where the estimate above
  is six to eight.

**The seventh is the first edit in any run that a reviewer should reject.** It cut "story"
from "keeps the deployment story unchanged" as adding nothing. But "deployment story" is
idiomatic for the whole business of how a thing ships, and "keeps the deployment unchanged"
is a narrower and stronger claim than the author made. Which is the argument for the tool
rather than against the model: it does not need the assistant to be right, only legible
enough to be told no.

**Granularity went from 16 characters per edit on the Chinese document to 65 here**, same
harness and model. The new rule-3 check explains it: four of the five replacements carry text
that did not change, the widest keeping 37 of 47 characters identical on both sides to change
`the number` into `what`. Whether this is about English having word boundaries to be lazy
with, or about these particular edits being rephrasings, one run cannot say.

That check is the fourth measurement the judge gained from being used, and the first that
raw length could never have caught: 88 characters is nowhere near the 400 that warned about
coarseness, and the mark was still mostly ballast. What matters is how much of a replacement
is identical on both sides, because the page strikes the whole old text beside the whole new
text — it word-diffs only while you are editing — so a baggy mark leaves the reader hunting
for the difference.

### Still to run

ChatGPT (Code Interpreter and Canvas separately — Canvas is an editing surface and may
normalise text, which is rule 1's natural enemy), WorkBuddy (local files and its GitHub MCP
path; pair it with the Chinese document), Copilot (say which: VS Code, M365, or the consumer
chat — they land on three different rows of the delivery table), DeepSeek (chat only, so the
strictest delivery test).

## What the judge learned from being used

Two metrics were wrong until real output went through it, which is worth recording because it
is an argument for running the thing rather than reasoning about it:

- Granularity counted comment length, so an assistant that wrote a thorough note looked like
  one that swapped a paragraph. It now measures the text an edit moves.
- The coarseness warning fired on a legitimately inserted paragraph. A paragraph added or
  removed is one mark because there is nothing inside it to diff; only a paragraph *swapped*
  hides which words moved. The warning is now about replacements alone.
