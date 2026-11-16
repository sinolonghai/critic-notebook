/* A blackline is a comparison written out as a document: the two versions' shared text,
   with every difference standing in it as a suggestion. The claim is the same invariant the
   editor lives by, applied to a whole file at once —

     reject every suggestion  ->  the older version
     accept every suggestion  ->  the newer version

   — and it is asserted here against the page's own parser, so what the tool accepts is what
   counts as correct. Both sides are compared in the layout the tool writes: one blank line
   between blocks, one newline at the end. */
import fs from 'fs';
const PAGE = new URL('../critic-notebook.html', import.meta.url);
/* resolved here, before the DOM shims below replace global.URL with a download stub */
const SAMPLE_MD = fs.readFileSync(new URL('../samples/review-me.md', import.meta.url), 'utf8');
let code = fs.readFileSync(PAGE, 'utf8').match(/<script>\n([\s\S]*)<\/script>/)[1];
code = injectExports(code,
  `globalThis.__t={
  parse,buildWorking,segment,resolveRange,docBlocks,alignBlocks,
  blacklineSource,blacklineSide,SAMPLE,
  get d(){return doc}, set d(v){doc=v}
};`);

function injectExports(code, exports){
  const at = code.lastIndexOf('})();');
  if(at < 0) throw new Error('could not find the page script IIFE close');
  return code.slice(0, at) + exports + '\n' + code.slice(at);
}

const el = () => ({value:'',textContent:'',innerHTML:'',disabled:false,hidden:false,style:{},dataset:{},
  classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},
  querySelector:()=>null,querySelectorAll:()=>[],setAttribute(){},getAttribute:()=>null,
  firstChild:null,contains:()=>false,closest:()=>null,focus(){},select(){},remove(){},
  appendChild(){},scrollHeight:62,title:''});
const cache = {};
global.document = {getElementById:id=>cache[id]||(cache[id]=el()),querySelector:()=>null,
  querySelectorAll:()=>[],addEventListener(){},createElement:el,body:{appendChild(){}}};
global.window = {getSelection:()=>null,addEventListener(){},innerWidth:1200,innerHeight:800,scrollTo(){},self:1,top:1};
global.location = {protocol:'file:',hostname:''};
global.localStorage = {getItem:()=>null,setItem(){}};
Object.defineProperty(global,'navigator',{value:{platform:'MacIntel'},configurable:true});
global.requestAnimationFrame = fn => setTimeout(fn, 0);
global.cancelAnimationFrame = id => clearTimeout(id);
global.Blob = class {}; global.URL = {createObjectURL:()=>'',revokeObjectURL(){}}; global.FileReader = class {};
new Function(code)();
const T = globalThis.__t;
if(!T) throw new Error('export hook did not land — the page script changed shape');

let fails = 0;
const ok = (c, m) => { if(!c) fails++; console.log((c ? 'ok   ' : 'FAIL ') + m); };
const show = s => JSON.stringify(s);

function blackline(olderSrc, newerSrc){
  T.d = T.parse(newerSrc); T.buildWorking(); T.segment();
  const older = T.docBlocks(olderSrc), newer = T.docBlocks(newerSrc);
  const rows = T.alignBlocks(older, newer);
  const out = T.blacklineSource(rows, '');
  return { src: out.src, untracked: out.untracked, held: out.held,
           older: T.blacklineSide(older), newer: T.blacklineSide(newer), rows };
}
function resolve(src, mode){
  T.d = T.parse(src); T.buildWorking(); T.segment();
  return T.resolveRange(0, src.length, mode);
}

/* The whole test: one call, both directions, named so a failure says which side broke. */
function roundTrip(label, olderSrc, newerSrc){
  const bl = blackline(olderSrc, newerSrc);
  const back = resolve(bl.src, 'orig'), fwd = resolve(bl.src, 'prop');
  const a = back === bl.older, b = fwd === bl.newer;
  if(bl.untracked.length) ok(false, label + ' — left ' + bl.untracked.length + ' block(s) untracked');
  ok(bl.held, label + ' — the file says so itself, asked as a whole');
  ok(a, label + ' — reject-all is the older version' +
       (a ? '' : '\n       got      ' + show(back) + '\n       expected ' + show(bl.older) +
                  '\n       blackline ' + show(bl.src)));
  ok(b, label + ' — accept-all is the newer version' +
       (b ? '' : '\n       got      ' + show(fwd) + '\n       expected ' + show(bl.newer) +
                  '\n       blackline ' + show(bl.src)));
  return bl;
}

const A = 'The first paragraph, which neither version touches.';
const B = 'The second paragraph, where a word is different.';
const B2 = 'The second paragraph, where a letter is different.';
const C = 'The third paragraph, also untouched by anyone.';
const X = 'A paragraph that only the newer version has at all.';

// ===== 1. nothing changed =====
roundTrip('identical documents', [A,B,C].join('\n\n')+'\n', [A,B,C].join('\n\n')+'\n');
const same = blackline([A,B,C].join('\n\n')+'\n', [A,B,C].join('\n\n')+'\n');
ok(!/\{[-+~]/.test(same.src), 'identical documents produce no marks at all');

// ===== 2. a word inside a block =====
const w = roundTrip('one word rewritten', [A,B,C].join('\n\n')+'\n', [A,B2,C].join('\n\n')+'\n');
ok(/\{~~/.test(w.src), 'a rewritten block is a replacement, not a delete and an insert');
ok(!/\{~~[\s\S]*first paragraph/.test(w.src), 'the untouched blocks stay outside the mark');

// ===== 3. a block added, at each of the three places it can go =====
roundTrip('block added at the top',    [A,B].join('\n\n')+'\n', [X,A,B].join('\n\n')+'\n');
roundTrip('block added in the middle', [A,B].join('\n\n')+'\n', [A,X,B].join('\n\n')+'\n');
roundTrip('block added at the end',    [A,B].join('\n\n')+'\n', [A,B,X].join('\n\n')+'\n');

// ===== 4. a block removed, at each of the three =====
roundTrip('block removed from the top',    [X,A,B].join('\n\n')+'\n', [A,B].join('\n\n')+'\n');
roundTrip('block removed from the middle', [A,X,B].join('\n\n')+'\n', [A,B].join('\n\n')+'\n');
roundTrip('block removed from the end',    [A,B,X].join('\n\n')+'\n', [A,B].join('\n\n')+'\n');

/* The end of the document is a boundary like any other, and the one most easily got wrong:
   a file whose last paragraph went has to still end in exactly one newline. */
const tail = blackline([A,B].join('\n\n')+'\n', A+'\n');
ok(resolve(tail.src,'prop') === A+'\n', 'a file whose last block went still ends in one newline'
   + (resolve(tail.src,'prop') === A+'\n' ? '' : ' — got ' + show(resolve(tail.src,'prop'))));

// ===== 5. runs: several at once, and both kinds mixed =====
roundTrip('two blocks added together',  [A,B].join('\n\n')+'\n', [A,X,X+' Twice.',B].join('\n\n')+'\n');
roundTrip('added and removed together', [A,X,B].join('\n\n')+'\n', [A,X+' No.',B].join('\n\n')+'\n');
roundTrip('a rewrite and an addition',  [A,B,C].join('\n\n')+'\n', [A,X,B2,C].join('\n\n')+'\n');

/* The ordering case. Pairing picked the rewritten block out of the run and the addition was
   pushed behind it, which drew correctly and accepted back with the blocks in the wrong
   order. The newer version has X first, so the blackline has to as well. */
const ord = roundTrip('an addition that comes before the rewrite it travels with',
                      [A,B,C].join('\n\n')+'\n', [A,X,B2,C].join('\n\n')+'\n');
ok(ord.src.indexOf(X) >= 0 && ord.src.indexOf('~>letter') > ord.src.indexOf(X),
   'the added block is written where the newer version has it');

// ===== 6. the degenerate ends =====
roundTrip('everything removed', [A,B].join('\n\n')+'\n', '');
roundTrip('everything new',     '', [A,B].join('\n\n')+'\n');
roundTrip('two empty documents', '', '');

// ===== 7. blocks that are not paragraphs =====
const docA = '# Title\n\n- one\n- two\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n```js\nvar x = 1;\n```\n\n' + A + '\n';
const docB = '# Title\n\n- one\n- two\n- three\n\n| a | b |\n| --- | --- |\n| 1 | 3 |\n\n```js\nvar x = 2;\n```\n\n' + A + '\n';
roundTrip('lists, tables and fences', docA, docB);
roundTrip('a heading rewritten', '# Before\n\n'+A+'\n', '# After\n\n'+A+'\n');

// ===== 8. a real document against an edited copy of itself =====
const sample = SAMPLE_MD;
const edited = sample
  .replace(/\n\n/, '\n\n' + X + '\n\n')          // a paragraph inserted near the top
  .replace(/the/g, 'the very')                   // a word-level change in many blocks
  .replace(/\n[^\n]+\n$/, '\n');                 // and the last block gone
roundTrip('samples/review-me.md against an edited copy', sample, edited);
roundTrip('and the same comparison the other way round', edited, sample);

/* A document that already carries suggestions compares by what it says, not by what it is
   still arguing about: both sides are read with their own marks accepted. */
const marked = A + '\n\n' + 'A paragraph {--with a deletion --}in it.\n\n' + C + '\n';
const settled = A + '\n\n' + 'A paragraph in it.\n\n' + C + '\n';
const mk = blackline(marked, settled);
ok(!/\{[-+~]/.test(mk.src),
   'a side with its own open suggestions is compared by what it proposes'
   + (/\{[-+~]/.test(mk.src) ? ' — got ' + show(mk.src) : ''));

// ===== 9. the tutorial, against itself with every suggestion taken =====
const tutorialFinal = resolve(T.SAMPLE, 'prop');
roundTrip('the tutorial against its own final text', resolve(T.SAMPLE,'orig'), tutorialFinal);

/* ===== 10. the format's blind spot =====
   A block that quotes CriticMarkup cannot go inside a mark: the parser pairs an opening
   delimiter with the first closing one it meets, which is the quoted one. The blackline has
   to notice rather than write a file that reads back as neither version.

   Quoting it in prose is not enough to trip this: unprotected delimiters are read as real
   marks and resolved away before the comparison ever sees them. It takes a code span, which
   is what keeps them literal, around a substitution, which is the one mark whose closer can
   end a mark of the same kind that is trying to contain it. */
const quotes = 'Write `{~~old~>new~~}` for a swap.';
const quotes2 = 'Write `{~~older~>newer~~}` for a swap.';
const bad = blackline([A, quotes, C].join('\n\n')+'\n', [A, quotes2, C].join('\n\n')+'\n');
ok(bad.untracked.length === 1, 'a block quoting CriticMarkup is reported, not written wrong'
   + (bad.untracked.length === 1 ? '' : ' — got ' + bad.untracked.length));
ok(resolve(bad.src, 'orig') === bad.older,
   'and rejecting is still exactly the older version, untracked block included');
ok(resolve(bad.src, 'prop') !== bad.newer,
   'while accepting knowingly falls short of the newer one, which is what it reported');
ok(/could not be tracked/.test(bad.src), 'the file says so where the block is');
ok(bad.held, 'and the file as a whole still holds, note and all');

/* Everything next to it is the ordinary case and must not trip the fallback: a quoted mark
   the prose leaves alone, and a quoted insertion or deletion, whose closers cannot end the
   mark around them. The fallback is a loss of fidelity, so it has to stay rare. */
const spanned = 'Write `{++this++}` to insert a word into the sentence.';
const spanned2 = 'Write `{++this++}` to insert a word into the line.';
const sp = roundTrip('a code span quoting CriticMarkup', [A,spanned,C].join('\n\n')+'\n',
                                                         [A,spanned2,C].join('\n\n')+'\n');
ok(sp.untracked.length === 0, 'and it is tracked normally, not reported');
const del1 = 'Write `{--gone--}` to remove a word from the sentence.';
const del2 = 'Write `{--vanished--}` to remove a word from the sentence.';
const dl = roundTrip('a quoted deletion, its own content changed',
                     [A,del1,C].join('\n\n')+'\n', [A,del2,C].join('\n\n')+'\n');
ok(dl.untracked.length === 0, 'a closer that cannot end the mark around it is no obstacle');
const rm = roundTrip('a block quoting a substitution, removed whole',
                     [A,quotes,C].join('\n\n')+'\n', [A,C].join('\n\n')+'\n');
ok(rm.untracked.length === 0, 'and removing such a block is fine — {-- needs --} to end it');

/* A change inside a code span replaces the whole span. A mark between the backticks is not
   read as a mark at all — the parser blanks marks before it looks for spans — so the edit
   would be lost on both sides. Found on this project's own README. */
const path1 = 'The file `test/review.test.mjs` asserts the invariant.';
const path2 = 'The file `review.test.mjs` asserts the invariant.';
const pa = roundTrip('a path inside a code span loses a directory', path1+'\n', path2+'\n');
ok(/\{~~`test\/review\.test\.mjs`~>`review\.test\.mjs`~~\}/.test(pa.src),
   'the whole span is replaced, so no mark lands between the backticks'
   + (/\{~~`/.test(pa.src) ? '' : ' — got ' + show(pa.src)));

console.log(fails ? '\n' + fails + ' FAILED' : '\nALL PASS');
process.exit(fails ? 1 : 0);
