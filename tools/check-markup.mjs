#!/usr/bin/env node
/* Judge a document an assistant marked up in CriticMarkup.
 *
 *   node tools/check-markup.mjs <original.md> <marked.md>
 *
 * The one thing that has to hold: rejecting every suggestion gives back the original file,
 * byte for byte. Everything a model does wrong that matters shows up there, and almost none
 * of it is visible by reading the result — a paragraph it quietly rewrapped still renders
 * correctly, still carries its marks, and has silently taken the original with it. You find
 * out when you press reject and cannot get back.
 *
 * So the verdict comes from the page's own parser, not a second implementation of it: this
 * script lifts the script out of critic-notebook.html and runs it, which is how the two
 * suites under test/ work too. What the page accepts is the definition of correct.
 *
 * Exit status is 0 on PASS, 1 on FAIL. Warnings do not fail the run; they are the things that
 * are legal but make a review harder than it needs to be.
 */
import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2).filter(a => a !== '--');
if (argv.length !== 2 || argv.some(a => a === '-h' || a === '--help')) {
  console.error([
    'usage: node tools/check-markup.mjs <original.md> <marked.md>',
    '',
    '  original.md   the file as it was before the assistant touched it',
    '  marked.md     what the assistant returned, with CriticMarkup in it',
    '',
    'Asserts that rejecting every suggestion reproduces original.md exactly, then reports',
    'how the markup is shaped: counts, granularity, attribution, and the mistakes that',
    'parse cleanly but review badly.',
  ].join('\n'));
  /* asking for help is not an error; being called wrong is */
  process.exit(argv.some(a => a === '-h' || a === '--help') ? 0 : 2);
}

const ROOT = new URL('..', import.meta.url).pathname;
const PAGE = path.join(ROOT, 'critic-notebook.html');

/* ---------- load the page's parser ---------- */

function loadPage() {
  let code = fs.readFileSync(PAGE, 'utf8').match(/<script>\n([\s\S]*)<\/script>/)[1];
  const at = code.lastIndexOf('})();');
  if (at < 0) throw new Error('could not find the page script IIFE close — the page changed shape');
  code = code.slice(0, at) + `globalThis.__t = {
    parse, buildWorking, segment, resolveRange, resolveText, spanOf, tidy,
    get d(){ return doc }, set d(v){ doc = v },
    set v(x){ view = x }, set oc(x){ openCell = x }, set ia(x){ insertAt = x }
  };\n` + code.slice(at);

  const stub = () => ({
    value: '', textContent: '', innerHTML: '', disabled: false, hidden: false, title: '',
    style: {}, dataset: {}, firstChild: null, scrollHeight: 62,
    classList: { add(){}, remove(){}, toggle(){}, contains: () => false },
    addEventListener(){}, setAttribute(){}, getAttribute: () => null,
    querySelector: () => null, querySelectorAll: () => [],
    contains: () => false, closest: () => null, focus(){}, select(){}, remove(){}, appendChild(){}
  });
  const byId = {};
  global.document = {
    getElementById: id => byId[id] || (byId[id] = stub()),
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener(){}, createElement: stub, body: { appendChild(){} }
  };
  global.window = { getSelection: () => null, addEventListener(){}, innerWidth: 1200,
                    innerHeight: 800, scrollTo(){}, self: 1, top: 1 };
  global.location = { protocol: 'file:', hostname: '' };
  global.localStorage = { getItem: () => null, setItem(){} };
  Object.defineProperty(global, 'navigator', { value: { platform: 'MacIntel' }, configurable: true });
  global.requestAnimationFrame = fn => setTimeout(fn, 0);
  global.cancelAnimationFrame = id => clearTimeout(id);
  global.Blob = class {};
  global.URL = { createObjectURL: () => '', revokeObjectURL(){} };
  global.FileReader = class {};

  new Function(code)();
  if (!globalThis.__t) throw new Error('export hook did not land — the page script changed shape');
  return globalThis.__t;
}

/* ---------- helpers ---------- */

const norm = t => t.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
/* What a text box turns characters into when nobody asked it to. A chat window that
   smartens a quote or lengthens a hyphen breaks rule 1 without the assistant having typed
   anything wrong, and blaming the model for it sends you to fix the prompt instead of the
   transport. */
const TYPO = { '"': '\u201c\u201d\u301d\u301e', "'": '\u2018\u2019',
               '-': '\u2013\u2014\u2212', '~': '\uff5e\u301c',
               '.': '\u2026', ' ': '\u00a0\u3000' };
const KIND = { ins: 'insert', del: 'delete', sub: 'replace', com: 'comment', hil: 'highlight' };

function readFile(p) {
  if (!fs.existsSync(p)) { console.error(`error: no such file: ${p}`); process.exit(2); }
  const raw = fs.readFileSync(p, 'utf8');
  return { raw, text: norm(raw), bom: /^﻿/.test(raw), crlf: /\r\n/.test(raw) };
}

function firstDifference(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : n;
}

/* Which rule was broken. The diff alone is cryptic; the shape of it is not. */
function diagnose(expected, got) {
  const at = firstDifference(expected, got);
  const show = s => JSON.stringify(s.slice(Math.max(0, at - 45), at + 45));
  const out = [`  first difference at byte ${at} of ${expected.length}`,
               `  original : ${show(expected)}`,
               `  rejected : ${show(got)}`];

  const squash = s => s.replace(/\s+/g, ' ').trim();
  if (squash(expected) === squash(got)) {
    const el = expected.split('\n').length, gl = got.split('\n').length;
    if (gl < el)
      out.push('', '  Only whitespace differs, and there are fewer lines than before: the',
                   '  assistant rewrapped text it was not changing. That is rule 1 — anything',
                   '  outside a mark is read as the original, so a rewrap destroys it.');
    else if (gl > el)
      out.push('', '  Only whitespace differs, and there are more lines than before: a newline',
                   '  was left outside a mark. That is rule 6 — the line breaks around an added',
                   '  or removed block have to sit inside the mark.');
    else
      out.push('', '  Only whitespace differs. Spaces were added or removed outside a mark —',
                   '  often spacing inserted between CJK and Latin text, which is rule 1.');
  } else if (TYPO[expected[at]] && TYPO[expected[at]].includes(got[at])) {
    out.push('', `  ${JSON.stringify(expected[at])} came back as ${JSON.stringify(got[at])}. That is typographic`,
                 '  substitution, which an assistant does not do to text it is copying — an interface did',
                 '  it on the way through. Ask for the document inside a code block, or move the file',
                 '  rather than the text. The markup itself may be fine.');
  } else if (expected.replace(/[ \t]/g, '') === got.replace(/[ \t]/g, '')) {
    /* The usual way a model breaks a CJK document: it "helpfully" pads the seams between
       scripts. Nothing reads as wrong, and the original is gone all the same. */
    const cjk = /[　-鿿＀-￯]/;
    const near = got[at] === ' ' || got[at] === '\t' ? (cjk.test(got[at - 1] || '') || cjk.test(got[at + 1] || ''))
                                                     : (cjk.test(expected[at - 1] || '') || cjk.test(expected[at + 1] || ''));
    out.push('');
    if (near) out.push(
      '  Only spaces differ, and the change is next to CJK text. Padding the seam between',
      '  CJK and Latin is the usual cause, and it is rule 1 all the same: nothing looks',
      '  wrong on the page, and the original is gone.');
    else out.push(
      '  Only spaces differ. The assistant adjusted spacing it was not asked to touch,',
      '  which is rule 1. Nothing looks wrong on the page, and the original is gone.');
  } else if (got.length < expected.length * 0.9) {
    out.push('', '  What came back is much shorter than the original. The assistant probably',
                 '  returned an excerpt, a summary or a diff rather than the whole document.');
  } else {
    out.push('', '  Text outside a mark was changed, which is rule 1. Whatever stood there is',
                 '  not in the file any more, so rejecting cannot bring it back.');
  }
  return out.join('\n');
}

/* ---------- the run ---------- */

const T = loadPage();
const original = readFile(argv[0]);
const marked = readFile(argv[1]);

console.log(`original : ${argv[0]}  (${original.text.length} bytes)`);
console.log(`marked   : ${argv[1]}  (${marked.text.length} bytes)`);
if (marked.bom || marked.crlf) {
  console.log(`  note   : the marked file has ${[marked.bom && 'a BOM', marked.crlf && 'CRLF line endings']
    .filter(Boolean).join(' and ')}${original.bom || original.crlf ? '' : ', which the original does not'
    } — harmless, the tool normalises both`);
}

T.d = T.parse(marked.text); T.v = 'markup'; T.oc = null; T.ia = null;
T.buildWorking(); T.segment();
const d = T.d;
const marks = d.marks.filter(m => !m.attached);

let failed = false, warnings = 0;
const verdict = (ok, msg, detail) => {
  if (!ok) failed = true;
  console.log(`\n${ok ? 'ok  ' : 'FAIL'}  ${msg}`);
  if (!ok && detail) console.log(detail);
};
const warn = msg => { warnings++; console.log(`warn  ${msg}`); };

/* 1. THE invariant */
let rejected = marked.text, accepted = marked.text;
marks.slice().reverse().forEach(mk => {
  rejected = rejected.slice(0, mk.start) + T.resolveText(mk, 'reject') + rejected.slice(T.spanOf(mk));
  accepted = accepted.slice(0, mk.start) + T.resolveText(mk, 'accept') + accepted.slice(T.spanOf(mk));
});
verdict(rejected === original.text,
        'rejecting every suggestion reproduces the original, byte for byte',
        rejected === original.text ? null : diagnose(original.text, rejected));

/* 2. nothing left behind once accepted */
const residue = accepted.match(/\{\+\+|\+\+\}|\{--|--\}|\{~~|~~\}|~>|\{>>|<<\}|\{==|==\}/g);
verdict(!residue, 'accepting every suggestion leaves no CriticMarkup behind',
        residue ? `  found ${residue.length}: ${[...new Set(residue)].join(' ')}` +
                  '\n\n  Delimiters survive when they are nested, unbalanced, or inside a code span,' +
                  '\n  where the parser leaves them alone and the reader sees them as text.' : null);

/* 3. marks the parser refuses to see — inside code, or malformed */
const naive = (marked.text.match(/\{\+\+|\{--|\{~~|\{>>|\{==/g) || []).length;
if (naive > d.marks.length) {
  warn(`${naive - d.marks.length} of ${naive} mark openings are not parsed as marks. Either they are ` +
       `nested inside\n      another mark (rule 4) or they sit in a code fence or code span, where the ` +
       `parser\n      leaves them as literal text (rule 5). Both read as braces on the page.`);
}

/* 4. shape of the markup */
const byKind = {};
d.marks.forEach(m => { byKind[KIND[m.t]] = (byKind[KIND[m.t]] || 0) + 1; });
/* Granularity is about how coarsely the text was edited, so it is measured over edits only.
   Counting comments would make a model that writes a thorough note look like one that swapped
   a whole paragraph. */
const edits = marks.filter(m => m.t === 'ins' || m.t === 'del' || m.t === 'sub');
/* the text the edit moves, not the mark's extent: spanOf() reaches over an attached comment
   and the delimiters are not content either */
const weight = m => (m.rem || '').length + (m.add || '').length;
const spans = edits.map(weight);
/* Coarseness is a property of replacements alone. A paragraph added or removed is one mark
   because there is nothing inside it to diff; a paragraph *swapped* as one mark hides which
   words moved, and that is the only case worth warning about. */
const subs = edits.filter(m => m.t === 'sub');
const widest = subs.length ? subs.reduce((a, b) => weight(b) > weight(a) ? b : a) : null;
const signed = d.marks.filter(m => m.who).length;
const comments = d.marks.filter(m => m.t === 'com').length;

console.log('\nshape');
console.log(`  marks        : ${d.marks.length}` +
            (d.marks.length ? '  (' + Object.entries(byKind).map(([k, n]) => `${n} ${k}`).join(', ') + ')' : ''));
if (spans.length) {
  const mean = Math.round(spans.reduce((a, b) => a + b, 0) / spans.length);
  console.log(`  granularity  : ${mean} characters per edit on average, widest ${Math.max(...spans)}` +
              ` (over ${edits.length} edit${edits.length === 1 ? '' : 's'}, comments excluded)`);
}
/* Print the names, not just the count. An assistant once signed itself "@//workbuddy/",
   which the page's author pattern accepts — so it parsed, it counted as attributed, and the
   name on screen was wrong. A count cannot show that; the names can. */
const names = [...new Set(d.marks.map(m => m.who).filter(Boolean))];
if (comments) {
  console.log(`  attribution  : ${names.length ? names.map(n => '@' + n).join(', ') +
    ` (${signed} mark${signed === 1 ? '' : 's'})` : 'none of the comments are signed'}`);
}

/* 5. legal but hard to review */
if (!d.marks.length) warn('no marks at all — the assistant changed nothing, or changed it without marking it.');
if (widest && weight(widest) > 400) {
  const peek = marked.text.slice(widest.start, widest.start + 70).replace(/\n/g, '\\n');
  warn(`one replacement swaps ${weight(widest)} characters of text: ${JSON.stringify(peek)}…` +
       `\n      A whole paragraph swapped as a single replacement parses fine and reviews badly —` +
       `\n      the reader cannot see which words moved (rule 3).`);
}
if (/\n{3,}/.test(accepted) || /\n{3,}/.test(rejected)) {
  warn('blank runs of three or more newlines appear after accepting or rejecting; the marks are\n' +
       '      probably sitting around the line breaks rather than inside them (rule 6).');
}
/* Rule 3 measured properly. Length alone misses the common case: a replacement whose two
   sides share most of their text, so the mark drags unchanged words along with the changed
   ones. The page shows an existing replacement as the whole old text struck through beside
   the whole new text — it word-diffs only while you are editing — so the reader is left to
   find the difference. Stripping the shared prefix and suffix says how much of the mark is
   actually doing work. */
function slack(m){
  const a = m.rem || '', b = m.add || '';
  let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let q = 0; while (q < a.length - p && q < b.length - p &&
                    a[a.length - 1 - q] === b[b.length - 1 - q]) q++;
  const shared = p + q, total = Math.max(a.length, b.length);
  return { shared, total, core: total - shared };
}
const baggy = subs.map(m => ({ m, s: slack(m) }))
                  .filter(x => x.s.total >= 24 && x.s.shared > x.s.core * 1.5)
                  .sort((x, y) => y.s.shared - x.s.shared);
if (baggy.length) {
  const w = baggy[0];
  warn(`${baggy.length} replacement${baggy.length === 1 ? '' : 's'} carry text that did not change. ` +
       `The widest keeps ${w.s.shared} of\n      ${w.s.total} characters identical on both sides, ` +
       `so only ${w.s.core} of it is the edit: ` +
       JSON.stringify((w.m.rem || '').slice(0, 56)) + `\n      → ` +
       JSON.stringify((w.m.add || '').slice(0, 56)) +
       `\n      The page strikes the whole old text beside the whole new text, leaving the reader` +
       `\n      to find the difference. A narrower mark shows it (rule 3).`);
}
const odd = names.filter(n => !/^[\w.\-\u3000-\u9fff]+$/.test(n));
if (odd.length) {
  warn(`the author name${odd.length === 1 ? '' : 's'} ${odd.map(n => JSON.stringify('@' + n)).join(', ')} ` +
       `contain${odd.length === 1 ? 's' : ''} characters no reader\n      would type. The page's ` +
       `pattern accepts them, so they parse and show up as the author verbatim —\n      check how ` +
       `the assistant was told to sign itself (rule 7).`);
}
if (comments && !signed) {
  warn('no comment is signed. Starting one with "@name:" attributes it, which is what lets a\n' +
       '      reader tell the assistant\'s notes from a colleague\'s (rule 7).');
}

console.log(`\n${failed ? 'FAIL' : 'PASS'}` +
            (warnings ? ` with ${warnings} warning${warnings === 1 ? '' : 's'}` : '') +
            (failed ? '' : ' — this document is safe to review: every original is recoverable.'));
process.exit(failed ? 1 : 0);
