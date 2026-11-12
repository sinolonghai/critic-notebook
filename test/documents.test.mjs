/* Runs every .md in samples-local/ through the real page and asserts the document-level
   properties.

   samples/        pristine documents, tracked in git — the originals
   samples-local/  the working copies this suite reads, gitignored

   Everything you do by hand happens in samples-local/, so a document you mangle while
   testing is never the original. Missing working copies are seeded from samples/ on first
   run; --reset overwrites them all again.

   Usage: node test/documents.test.mjs [--reset] */
import fs from 'fs';
import path from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
let code = fs.readFileSync(path.join(ROOT, 'critic-notebook.html'), 'utf8').match(/<script>\n([\s\S]*)<\/script>/)[1];
code = injectExports(code,
  `globalThis.__t={
  parse, buildWorking, segment, blocks, lineObjs, resolveRange, buildBlockSource, tidy,
  resolveText, spanOf,
  get d(){return doc}, set d(v){doc=v}, set v(x){view=x}, set li(x){localIdx=x},
  set oc(x){openCell=x}, set ia(x){insertAt=x}
};`);

/* enough DOM for the page's script to load; it is never rendered here */

/* Inject the export hook before the page script's final IIFE close. Anchoring on a source
   line is fragile — a boot-sequence edit once made this silently inject nothing, and every
   test then failed on a missing globalThis.__t instead of on the thing it was testing. */
function injectExports(code, exports){
  const at = code.lastIndexOf('})();');
  if(at < 0) throw new Error('could not find the page script IIFE close');
  return code.slice(0, at) + exports + '\n' + code.slice(at);
}

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
global.window = { getSelection: () => null, addEventListener(){}, innerWidth: 1200, innerHeight: 800, scrollTo(){}, self: 1, top: 1 };
global.location = { protocol: 'file:', hostname: '' };
global.localStorage = { getItem: () => null, setItem(){} };
Object.defineProperty(global, 'navigator', { value: { platform: 'MacIntel' }, configurable: true });
global.requestAnimationFrame = function(fn){ return setTimeout(fn, 0); };
global.cancelAnimationFrame = function(id){ clearTimeout(id); };
global.Blob = class {};
global.URL = { createObjectURL: () => '', revokeObjectURL(){} };
global.FileReader = class {};

new Function(code)();
const T = globalThis.__t;
if(!T) throw new Error('export hook did not land — the page script changed shape');

let fails = 0;
const ok = (cond, msg) => { if(!cond) fails++; console.log((cond ? '  ok   ' : '  FAIL ') + msg); };

function checkDocument(file, label){
  const src = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  T.d = T.parse(src); T.v = 'markup'; T.oc = null; T.ia = null;
  T.buildWorking(); T.segment();
  const d = T.d;
  const open = d.marks.filter(m => !m.attached).length;

  console.log('\n' + label);
  console.log('  ' + src.length + ' bytes · ' + d.cells.length + ' cells · ' + open + ' suggestions');

  /* 1. the cells tile the document — nothing is unreachable */
  const covered = new Array(src.length).fill(false);
  d.cells.forEach(c => { for(let i = c.a; i < c.b; i++) covered[i] = true; });
  const lines = src.split('\n');
  let at = 0, orphan = [];
  lines.forEach(line => {
    if(line.trim() && !covered[at]) orphan.push(JSON.stringify(line.slice(0, 48)));
    at += line.length + 1;
  });
  ok(orphan.length === 0, 'every non-blank line belongs to a cell' +
    (orphan.length ? ' — orphans: ' + orphan.slice(0, 4).join(', ') : ''));

  /* 2. every .tx span's offset points at exactly its own text */
  let spans = 0, wrong = 0;
  d.cells.forEach(cell => {
    const slice = d.work.slice(cell.w0, cell.w1);
    T.li = {};
    const html = T.blocks(T.lineObjs(slice, 0));
    const re = /<span class="tx" data-o="(\d+)">([\s\S]*?)<\/span>/g;
    let m;
    while((m = re.exec(html))){
      spans++;
      const text = m[2].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      if(slice.slice(+m[1], +m[1] + text.length) !== text) wrong++;
    }
  });
  ok(wrong === 0, 'offsets exact across ' + spans + ' spans');

  /* 3. THE invariant, document-wide */
  const original = T.resolveRange(0, src.length, 'orig');
  const final    = T.resolveRange(0, src.length, 'prop');
  let rejected = src, accepted = src;
  d.marks.filter(m => !m.attached).slice().reverse().forEach(mk => {
    rejected = rejected.slice(0, mk.start) + T.resolveText(mk, 'reject') + rejected.slice(T.spanOf(mk));
    accepted = accepted.slice(0, mk.start) + T.resolveText(mk, 'accept') + accepted.slice(T.spanOf(mk));
  });
  ok(rejected === original, 'reject-all reproduces the original byte-exactly');
  ok(accepted === final,    'accept-all reproduces the final byte-exactly');

  /* 4. editing each cell keeps both sides recoverable */
  const broken = [];
  d.cells.forEach((cell, i) => {
    if(cell.locked) return;
    const expectOrig = T.resolveRange(cell.a, cell.b, 'orig');
    const typed = T.resolveRange(cell.a, cell.b, 'prop')
      .replace(/\b(the|and|is|a|of)\b/g, 'THE').replace(/的/g, '之').replace(/价格/g, '行情');
    const built = T.buildBlockSource(cell, typed, '');
    const saved = T.d;
    T.d = T.parse(src.slice(0, cell.a) + built.src + src.slice(cell.b));
    T.buildWorking();
    const gotOrig = T.resolveRange(cell.a, cell.a + built.src.length, 'orig');
    const gotProp = T.resolveRange(cell.a, cell.a + built.src.length, 'prop');
    T.d = saved; T.buildWorking();
    if(gotOrig !== expectOrig) broken.push(i + ':' + cell.kind + ' (original lost)');
    else if(gotProp !== T.tidy(typed)) broken.push(i + ':' + cell.kind + ' (edit lost)');
  });
  ok(broken.length === 0, 'editing each of ' + d.cells.length + ' cells round-trips' +
    (broken.length ? ' — ' + broken.slice(0, 6).join(', ') : ''));

  /* 5. nothing markdown-ish leaks into the rendered output as literal text */
  let all = '';
  d.cells.forEach(cell => { T.li = {}; all += T.blocks(T.lineObjs(d.work.slice(cell.w0, cell.w1), 0)); });
  const leaks = [];
  if(/&lt;br/i.test(all)) leaks.push('<br> rendered as text');
  if(/\|\s*---/.test(all)) leaks.push('table separator row leaked');
  if(/^\s*#{1,6}\s/m.test(all.replace(/<[^>]+>/g, ''))) leaks.push('literal # markers');
  if(/\u0001/.test(all)) leaks.push('unreplaced placeholder');
  ok(leaks.length === 0, 'no raw markdown in the output' + (leaks.length ? ' — ' + leaks.join('; ') : ''));
}

const PRISTINE = path.join(ROOT, 'samples');
const WORKING  = path.join(ROOT, 'samples-local');
const isMd = f => /\.(md|markdown)$/i.test(f);
const listMd = dir => fs.existsSync(dir) ? fs.readdirSync(dir).filter(isMd) : [];

/* Copy originals into the working folder. Without force, only fills in what is missing —
   so deleting one working copy genuinely skips that document instead of resurrecting it. */
function seed(force){
  if(!fs.existsSync(PRISTINE)) return [];
  fs.mkdirSync(WORKING, { recursive: true });
  const copied = [];
  for(const name of listMd(PRISTINE)){
    const dest = path.join(WORKING, name);
    if(force || !fs.existsSync(dest)){
      fs.copyFileSync(path.join(PRISTINE, name), dest);
      copied.push(name);
    }
  }
  return copied;
}

const reset = process.argv.includes('--reset');
let working = listMd(WORKING);
if(reset || !working.length){
  const copied = seed(reset);
  if(copied.length) console.log((reset ? 'Reset' : 'Seeded') + ' samples-local/ from samples/ — ' + copied.join(', '));
  working = listMd(WORKING);
}

if(!working.length){
  console.log('Nothing to check. Put a .md in samples/ and re-run, or drop one straight into samples-local/.');
  process.exit(0);
}

for(const name of working.sort()) checkDocument(path.join(WORKING, name), 'samples-local/' + name);

const extra = working.filter(n => !fs.existsSync(path.join(PRISTINE, n)));
console.log('\n' + working.length + ' document(s) — ' + (fails ? fails + ' FAILURE(S)' : 'ALL PASS'));
if(extra.length) console.log('(local only, no original in samples/: ' + extra.join(', ') + ')');
process.exit(fails ? 1 : 0);
