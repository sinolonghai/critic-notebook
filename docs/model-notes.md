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

A note on delivery, which is a separate axis from whether the markup is correct:

- **Writes files on your disk** — Claude Code, WorkBuddy, Copilot in VS Code. The file arrives
  intact; only the markup is under test. Worth telling these to *edit the file in place* rather
  than reprint it, since a patch cannot drift the way a reprint can.
- **Writes to a repo or cloud through MCP** — the file still arrives intact, one step removed.
- **Chat text only** — DeepSeek's web client, consumer Copilot. Here the braces have to survive
  the interface as well: watch for smart quotes, stripped trailing whitespace, and a markdown
  renderer that eats `{++ ++}`.

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
