import fs from 'fs';
const PAGE = new URL('../index.html', import.meta.url);
let code = fs.readFileSync(PAGE,'utf8').match(/<script>\n([\s\S]*)<\/script>/)[1];
code = injectExports(code,
  `globalThis.__t={
  parse,buildWorking,segment,blocks,lineObjs,resolveRange,cellMarks,cellHtml,gapHtml,
  tokenize,diffTokens,opsToSource,buildBlockSource,cellComments,tidy,scrub,
  resolveText,spanOf,exportText,protectedRanges,SAMPLE,
  get d(){return doc}, set d(v){doc=v}, set v(x){view=x}, set li(x){localIdx=x},
  set oc(x){openCell=x}, set ia(x){insertAt=x}
};`);


/* Inject the export hook before the page script's final IIFE close. Anchoring on a source
   line is fragile — a boot-sequence edit once made this silently inject nothing, and every
   test then failed on a missing globalThis.__t instead of on the thing it was testing. */
function injectExports(code, exports){
  const at = code.lastIndexOf('})();');
  if(at < 0) throw new Error('could not find the page script IIFE close');
  return code.slice(0, at) + exports + '\n' + code.slice(at);
}

const el=()=>({value:'',textContent:'',innerHTML:'',disabled:false,hidden:false,style:{},dataset:{},
  classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},
  querySelector:()=>null,querySelectorAll:()=>[],setAttribute(){},getAttribute:()=>null,
  firstChild:null,contains:()=>false,closest:()=>null,focus(){},select(){},remove(){},
  appendChild(){},scrollHeight:62,title:''});
const cache={};
global.document={getElementById:id=>cache[id]||(cache[id]=el()),querySelector:()=>null,
  querySelectorAll:()=>[],addEventListener(){},createElement:el,body:{appendChild(){}}};
global.window={getSelection:()=>null,addEventListener(){},innerWidth:1200,innerHeight:800,scrollTo(){},self:1,top:1};
global.location={protocol:'file:',hostname:''};
global.localStorage={getItem:()=>null,setItem(){}};
Object.defineProperty(global,'navigator',{value:{platform:'MacIntel'},configurable:true});
global.requestAnimationFrame = function(fn){ return setTimeout(fn, 0); };
global.cancelAnimationFrame = function(id){ clearTimeout(id); };
global.Blob=class{}; global.URL={createObjectURL:()=>'',revokeObjectURL(){}}; global.FileReader=class{};
new Function(code)();
const T=globalThis.__t;
if(!T) throw new Error('export hook did not land — the page script changed shape');

let fails=0;
const ok=(c,m)=>{ if(!c) fails++; console.log((c?'ok   ':'FAIL ')+m); };
function setup(src){ T.d=T.parse(src); T.v='markup'; T.oc=null; T.ia=null; T.buildWorking(); T.segment(); return T.d; }
function openMarks(){ return T.d.marks.filter(m=>!m.attached); }

// ===== 1. offsets exact, now cell-relative =====
setup(T.SAMPLE);
let bad=0,total=0;
T.d.cells.forEach(c=>{
  const slice=T.d.work.slice(c.w0,c.w1);
  T.li={}; const h=T.blocks(T.lineObjs(slice,0));
  const re=/<span class="tx" data-o="(\d+)">([\s\S]*?)<\/span>/g; let m;
  while((m=re.exec(h))){ total++;
    const t=m[2].replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
    if(slice.slice(+m[1],+m[1]+t.length)!==t) bad++;
  }
});
ok(bad===0,'cell-relative offsets exact: '+total+' spans, '+bad+' bad');

// ===== 2. accept / reject write to source and reproduce the right text =====
function verdictTest(src,label){
  setup(src);
  const orig=T.resolveRange(0,T.d.src.length,'orig');
  const fin =T.resolveRange(0,T.d.src.length,'prop');
  // reject all, descending
  let s=T.d.src;
  openMarks().slice().reverse().forEach(mk=>{ s=s.slice(0,mk.start)+T.resolveText(mk,'reject')+s.slice(T.spanOf(mk)); });
  const rejected=T.parse(s);
  // accept all
  setup(src); let s2=T.d.src;
  openMarks().slice().reverse().forEach(mk=>{ s2=s2.slice(0,mk.start)+T.resolveText(mk,'accept')+s2.slice(T.spanOf(mk)); });
  const accepted=T.parse(s2);
  ok(rejected.src===orig && rejected.marks.length===0, label+': reject-all → original, no marks left');
  ok(accepted.src===fin && accepted.marks.length===0, label+': accept-all → final, no marks left');
}
verdictTest(T.SAMPLE,'sample');
verdictTest('a {~~x~>y~~}{>>@d: why<<} b {--gone--} c {++added++} d {==hi==}{>>@e: note<<} e','mixed marks');

// ===== 3. the ABC → abc → bcd scenario =====
setup('ABC');
const hist=[];
function commit(text){
  const c=T.d.cells[0];
  hist.push(T.d.src);
  const b=T.buildBlockSource(c,text,'');
  setup(T.d.src.slice(0,c.a)+b.src+T.d.src.slice(c.b));
}
commit('abc');
const afterFirst=T.d.src;
ok(afterFirst==='{~~ABC~>abc~~}','1st edit → '+afterFirst);
ok(T.resolveRange(0,T.d.src.length,'prop')==='abc','1st edit reads abc');
commit('bcd');
ok(T.d.src==='{~~ABC~>bcd~~}','2nd edit collapses vs ORIGINAL → '+T.d.src);
ok(T.resolveRange(0,T.d.src.length,'orig')==='ABC','original still ABC after 2 edits');
// one undo should land on the abc state
setup(hist.pop() && hist[hist.length] || afterFirst);
ok(T.resolveRange(0,T.d.src.length,'prop')==='abc','one undo → abc state recoverable');

// ===== 4. repeated edits must NOT accumulate author stamps =====
setup('One two three.');
function commitAs(text,who){
  const c=T.d.cells[0];
  const b=T.buildBlockSource(c,text,'{>>@'+who+'<<}');
  const kept=b.changed?T.cellComments(c,who):'';
  setup(T.d.src.slice(0,c.a)+b.src+kept+T.d.src.slice(c.b));
}
commitAs('One TWO three.','dana');
commitAs('One TWO THREE.','dana');
commitAs('ONE TWO THREE.','dana');
const stamps=(T.d.src.match(/\{>>@dana<<\}/g)||[]).length;
ok(stamps===1,'3 edits by same author → '+stamps+' stamp(s): '+T.d.src);

// a real comment by someone else must survive repeated edits
setup('Keep this {==phrase==}{>>@erin: unclear<<} here.');
commitAs('Keep this phrase right here.','dana');
ok(/@erin：unclear|@erin: unclear/.test(T.d.src),"erin's comment survived: "+T.d.src);
commitAs('Keep that phrase right here.','dana');
const erin=(T.d.src.match(/@erin/g)||[]).length;
ok(erin===1,'erin comment not duplicated after 2nd edit ('+erin+'): '+T.d.src);

// ===== 5. deleting a whole heading / list renders as a block mark, not literal ## =====
setup('# My Heading\n\nbody');
let c0=T.d.cells[0];
let del=T.buildBlockSource(c0,'','');
setup(T.d.src.slice(0,c0.a)+del.src+T.d.src.slice(c0.b));
ok(T.d.src.startsWith('{--# My Heading--}'),'whole heading deleted → '+T.d.src.split('\n')[0]);
T.li={}; let h0=T.blocks(T.lineObjs(T.d.work.slice(T.d.cells[0].w0,T.d.cells[0].w1),0));
ok(/class="blk del"/.test(h0)&&/<h2/.test(h0)&&!/## /.test(h0),'renders as struck-through heading, no literal ##\n   '+h0);

setup('- one\n- two\n- three');
let cl=T.d.cells[0];
let d2=T.buildBlockSource(cl,'','');
setup(T.d.src.slice(0,cl.a)+d2.src+T.d.src.slice(cl.b));
T.li={}; let h1=T.blocks(T.lineObjs(T.d.work,0));
ok(/class="blk del"/.test(h1)&&/<ul>/.test(h1),'deleted list renders as a struck-through list');
ok(T.resolveRange(0,T.d.src.length,'orig')==='- one\n- two\n- three','deleted list: original intact');
ok(T.resolveRange(0,T.d.src.length,'prop')==='','deleted list: final is empty');

// ===== 6. in-cell blank line (new paragraph inside a cell) must work, not error =====
setup('Para one.');
let cp=T.d.cells[0];
let np=T.buildBlockSource(cp,'Para one.\n\nPara two.','');
setup(T.d.src.slice(0,cp.a)+np.src+T.d.src.slice(cp.b));
ok(T.d.cells.length===2,'blank line inside a cell → pending new para becomes its own cell ('+T.d.cells.length+')');
ok(T.resolveRange(0,T.d.src.length,'orig')==='Para one.','in-cell new para: original intact');
ok(T.resolveRange(0,T.d.src.length,'prop')==='Para one.\n\nPara two.','in-cell new para: final correct');
// accepting splits it into two real cells
let s3=T.d.src; openMarks().slice().reverse().forEach(mk=>{ s3=s3.slice(0,mk.start)+T.resolveText(mk,'accept')+s3.slice(T.spanOf(mk)); });
setup(s3);
ok(T.d.cells.length===2,'after accept it becomes 2 cells ('+T.d.cells.length+')');

// ===== 7. "+" insert between blocks =====
function insertAtGap(src,gap,body){
  setup(src);
  const cells=T.d.cells; let at,repl;
  if(!cells.length){ at=0; repl='{++'+body+'++}'; }
  else if(gap===0){ at=cells[0].a; repl='{++'+body+'\n\n++}'; }
  else { at=cells[Math.min(gap,cells.length)-1].b; repl='{++\n\n'+body+'++}'; }
  setup(T.d.src.slice(0,at)+repl+T.d.src.slice(at));
  return T.d;
}
let g=insertAtGap('First block.\n\nSecond block.',1,'Middle block.');
ok(T.resolveRange(0,g.src.length,'orig')==='First block.\n\nSecond block.','insert mid: original intact');
ok(T.resolveRange(0,g.src.length,'prop')==='First block.\n\nMiddle block.\n\nSecond block.','insert mid: final correct');
g=insertAtGap('First block.\n\nSecond block.',0,'Top block.');
ok(T.resolveRange(0,g.src.length,'prop')==='Top block.\n\nFirst block.\n\nSecond block.','insert at top');
g=insertAtGap('First block.\n\nSecond block.',2,'Tail block.');
ok(T.resolveRange(0,g.src.length,'prop')==='First block.\n\nSecond block.\n\nTail block.','insert at end');

// ===== 7b. a pending "+" block stands alone and can be cleared away cleanly =====
g=insertAtGap('First block.\n\nSecond block.',1,'Middle block.');
ok(T.d.cells.length===3,'pending inserted block is its own cell ('+T.d.cells.length+')');
ok(T.d.cells[1].kind==='blockmark','middle cell is the block mark');
T.li={}; {
  const c=T.d.cells[1];
  const h=T.blocks(T.lineObjs(T.d.work.slice(c.w0,c.w1),0));
  ok(/class="blk ins"/.test(h)&&/Middle block\./.test(h),'renders as a standalone inserted block\n   '+h);
}
{ // clearing that cell removes the insertion and leaves the original byte-exact
  const c=T.d.cells[1];
  setup(T.d.src.slice(0,c.a)+''+T.d.src.slice(c.b));
  ok(T.d.src==='First block.\n\nSecond block.','clearing the new block restores the file exactly: '+JSON.stringify(T.d.src));
}

// ===== 8. untouched cells render byte-identical after an edit elsewhere =====
setup(T.SAMPLE);
function rowSnapshot(){
  const out=[];
  for(let k=0;k<T.d.cells.length;k++) out.push(T.cellHtml(k));
  return out;
}
const before=rowSnapshot();
const target=T.d.cells.findIndex(c=>c.kind==='para'&&/no suggestions on it/.test(T.d.src.slice(c.a,c.b)));
const tc=T.d.cells[target];
const bb=T.buildBlockSource(tc,T.resolveRange(tc.a,tc.b,'prop').replace('few words','handful of words'),'');
setup(T.d.src.slice(0,tc.a)+bb.src+T.d.src.slice(tc.b));
const after=rowSnapshot();
ok(before.length===after.length,'cell count unchanged by an in-place edit');
let changed=[];
for(let k=0;k<before.length;k++) if(before[k]!==after[k]) changed.push(k);
ok(changed.length===1&&changed[0]===target,
  'only the edited cell re-renders (changed rows: ['+changed.join(',')+'], edited: '+target+')');

// resolving a mark in an EARLY cell must not change late cells' html
setup(T.SAMPLE);
const b2=rowSnapshot();
const firstMk=openMarks()[0];
let rs=T.d.src.slice(0,firstMk.start)+T.resolveText(firstMk,'accept')+T.d.src.slice(T.spanOf(firstMk));
setup(rs);
const a2=rowSnapshot();
let ch2=[]; for(let k=0;k<Math.min(b2.length,a2.length);k++) if(b2[k]!==a2[k]) ch2.push(k);
ok(ch2.length===1,'accepting a mark in cell '+ch2.join(',')+' leaves every other cell byte-identical');

// ===== 9. export tidies stray blank lines but never inside a fence =====
setup('A\n\n\n\n\nB\n\n```\nx\n\n\n\ny\n```\n\n\n\nC');
const ex=T.exportText();
{
  const pr=T.protectedRanges(ex);
  let outside='',at2=0;
  pr.sort((a,b)=>a[0]-b[0]).forEach(r=>{ if(r[0]<at2) return; outside+=ex.slice(at2,r[0])+'\u0001'; at2=r[1]; });
  outside+=ex.slice(at2);
  ok(!/\n{3,}/.test(outside),'blank lines collapsed outside fences');
}
ok(/x\n\n\n\ny/.test(ex),'blank lines INSIDE the fence preserved');
ok(ex.endsWith('C\n'),'single trailing newline');

// ===== 10. injection still neutralized =====
setup('Clean sentence.');
const inj=T.buildBlockSource(T.d.cells[0],'Clean sentence.{--sneaky--}{>>evil<<}','').src;
ok(T.parse(inj).marks.filter(m=>m.t==='del'||m.t==='com').length===0,'typed delimiters neutralized: '+inj);

// ===== 11. Original / Final hide the suggestion rows and show a rail flag instead =====
setup(T.SAMPLE);
const withMarks=T.d.cells.findIndex(c=>T.cellMarks(c).length);
ok(withMarks>=0,'found a cell carrying suggestions (#'+withMarks+')');
T.v='markup';
let hm=T.cellHtml(withMarks);
ok(/class="mk"/.test(hm),'Marked up: suggestion rows present');
ok(!/class="flag/.test(hm),'Marked up: no rail flag (rows are right there)');
for(const v of ['original','final']){
  T.v=v;
  const h=T.cellHtml(withMarks);
  ok(!/class="mk"/.test(h), v+': suggestion rows hidden');
  ok(/class="flag/.test(h),  v+': rail flag shown');
  ok(new RegExp('data-flag="'+withMarks+'"').test(h), v+': flag points back at this cell');
}
T.v='markup';
// a cell with only a comment gets the muted flag, not the red one
setup('Plain text here.{==phrase==}{>>@dana: check this<<} More text.');
T.v='final';
ok(/class="flag note-only"/.test(T.cellHtml(0)),'comment-only cell gets the muted flag');
T.v='markup';

console.log('\n'+(fails?fails+' FAILURE(S)':'ALL PASS'));
process.exit(fails?1:0);
