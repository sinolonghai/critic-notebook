/* Two people review one document separately and come back with two files. The merge lays
   them over the original they both reject to, and the claim is the one that matters:
   rejecting every suggestion in the merged file gives that original back, byte for byte.
   Accepting everything is deliberately not asserted — it would mean taking two people's
   suggestions at once, which is a document neither of them wrote.
 */
import fs from 'fs';
const PAGE = new URL('../critic-notebook.html', import.meta.url);
/* read here, before the DOM shims below replace global.URL with a download stub */
const SAMPLE_MD = fs.readFileSync(new URL('../samples/review-me.md', import.meta.url), 'utf8');
let code = fs.readFileSync(PAGE, 'utf8').match(/<script>\n([\s\S]*)<\/script>/)[1];
const at = code.lastIndexOf('})();');
if(at < 0) throw new Error('could not find the page script IIFE close');
code = code.slice(0, at) +
  'globalThis.__t={parse,buildWorking,segment,resolveRange,markSpans,mergeReviews,' +
  'get d(){return doc}, set d(v){doc=v}};\n' + code.slice(at);

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
global.requestAnimationFrame = fn => setTimeout(fn,0);
global.cancelAnimationFrame = id => clearTimeout(id);
global.Blob = class {}; global.URL = {createObjectURL:()=>'',revokeObjectURL(){}}; global.FileReader = class {};
new Function(code)();
const T = globalThis.__t;
if(!T) throw new Error('export hook did not land — the page script changed shape');

let fails = 0;
const ok = (c, m) => { if(!c) fails++; console.log((c ? 'ok   ' : 'FAIL ') + m); };
const show = s => JSON.stringify(s);
const reject = src => { T.d = T.parse(src); return T.resolveRange(0, src.length, 'orig'); };
const accept = src => { T.d = T.parse(src); return T.resolveRange(0, src.length, 'prop'); };

const O = 'The migration finished three weeks late and cost 206 thousand.\n\n' +
          'A paragraph neither of them touched at all.\n\n' +
          'The coefficient runs about 0.3 on a dirt road.\n';

function merged(a, b, na = 'ai', nb = 'hai', want = O){
  const r = T.mergeReviews(a, b, na, nb);
  if(r.ok){
    const back = reject(r.src);
    ok(back === want, 'rejecting everything gives the original back' +
       (back === want ? '' : '\n       got      ' + show(back.slice(0, 120)) +
                             '\n       expected ' + show(want.slice(0, 120))));
  }
  return r;
}

/* ===== 1. two reviews that do not touch each other ===== */
const A1 = O.replace('three weeks', '{~~three~>two~~} weeks');
const B1 = O.replace('0.3 on', '{~~0.3~>0.2~~} on');
let r = merged(A1, B1);
ok(r.ok, 'two reviews of one document merge');
ok(!r.conflicts.length, 'with nothing in conflict');
ok(/\{~~three~>two~~\}\{>>@ai<<\}/.test(r.src), "the first side's mark is stamped with its name");
ok(/\{~~0\.3~>0\.2~~\}\{>>@hai<<\}/.test(r.src), "and the second side's with its own");
ok(accept(r.src).includes('two weeks') && accept(r.src).includes('0.2'),
   'accepting everything takes both');

/* ===== 2. a mark that already says who made it keeps its name ===== */
const A2 = O.replace('three weeks', '{~~three~>two~~}{>>@workbuddy：checked against the log<<} weeks');
r = merged(A2, B1);
ok(/@workbuddy：checked against the log/.test(r.src), 'a signed mark keeps its own name and note');
ok(!/@ai/.test(r.src), 'and is not stamped again');

/* ===== 3. the same words, both sides ===== */
const A3 = O.replace('three weeks', '{~~three~>two~~} weeks');
const B3 = O.replace('three weeks', '{~~three~>four~~} weeks');
r = merged(A3, B3);
ok(r.ok, 'two suggestions on one phrase still merge');
ok(r.conflicts.length === 1, 'and one of them is reported as a conflict — ' + r.conflicts.length);
ok(/\{~~three~>two~~\}\{>>@ai<<\}/.test(r.src), 'the first is kept as a suggestion');
ok(/@hai：would write “four”/.test(r.src), 'the second is written beside it as a comment');
ok(accept(r.src) === accept(A3).replace(/$/, ''), 'accepting gives the first reading, not both');

/* ===== 4. one inside the other ===== */
const A4 = O.replace('finished three weeks late', '{--finished three weeks late--}');
const B4 = O.replace('three', '{~~three~>four~~}');
r = merged(A4, B4);
ok(r.ok, 'a suggestion inside a deleted span still merges');
ok(r.conflicts.length === 1, 'as a conflict, a mark being unable to hold a mark');
ok(/inside another suggestion/.test(r.src), 'and the file says why');

/* ===== 5. comments never conflict, because they consume nothing ===== */
const A5 = O.replace('206 thousand', '206 thousand{>>@ai：is this the 1994 figure?<<}');
const B5 = O.replace('206 thousand', '{~~206~>188.5~~} thousand');
r = merged(A5, B5);
ok(r.ok && !r.conflicts.length, 'a comment and an edit on the same words do not conflict');
ok(/is this the 1994 figure\?/.test(r.src) && /\{~~206~>188\.5~~\}/.test(r.src), 'both survive');

/* ===== 6. two insertions at one point ===== */
const A6 = O.replace('dirt road', 'dirt road{++, rolling++}');
const B6 = O.replace('dirt road', 'dirt road{++, not lifting++}');
r = merged(A6, B6);
ok(r.ok && !r.conflicts.length, 'two insertions at one point are both kept');
ok(accept(r.src).includes(', rolling') && accept(r.src).includes(', not lifting'), 'and both apply');

/* ===== 7. nothing to merge ===== */
r = merged(O, B1);
ok(r.ok && !r.conflicts.length, 'merging an untouched copy is the other review on its own');
ok(reject(r.src) === O && /0\.2/.test(r.src), 'and still rejects to the original');
r = merged(O, O);
ok(r.ok && r.src === O, 'two untouched copies merge to the document itself');

/* ===== 8. two files that are not reviews of one document ===== */
r = T.mergeReviews(A1, 'A different document entirely.\n', 'ai', 'hai');
ok(!r.ok, 'two files with different originals are refused');
ok(/not two reviews of one document/.test(r.why), 'and told why — ' + show((r.why||'').slice(0, 48)));

/* ===== 9. a real document, reviewed twice ===== */
const sample = SAMPLE_MD;
const first = sample.replace(/\bthe\b/, '{~~the~>that~~}');
const second = sample.replace(/\.\n/, '.{>>@hai：fine as it is<<}\n');
r = merged(first, second, 'ai', 'hai', reject(sample));
ok(r.ok, 'two reviews of samples/review-me.md merge');
const back = reject(r.src);
ok(back === reject(sample), 'and reject to the document they came from');

/* ===== 10. quoted text that would close a comment ===== */
const A10 = O.replace('three weeks', '{~~three~>two<<}~~} weeks'.replace('<<}~~}', '~~}'));
const B10 = O.replace('three weeks', '{~~three~>a value with <<} in it~~} weeks');
r = T.mergeReviews(A10, B10, 'ai', 'hai');
ok(r.ok, 'a suggestion whose text could close a comment still merges');
ok(reject(r.src) === O, 'and rejects to the original');
ok(!/<<\}.*<<\}/.test(r.src.split('{>>')[1] || ''), 'the quoted text cannot end the comment early');

console.log(fails ? '\n' + fails + ' FAILED' : '\nALL PASS');
process.exit(fails ? 1 : 0);
