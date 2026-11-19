/* The checks that need a real browser.
 *
 *   node test/browser.test.mjs              # everything
 *   node test/browser.test.mjs stale pop    # only the named scenarios
 *   CN_CHROME=/path/to/chrome node test/browser.test.mjs
 *
 * The other two suites parse the page's own functions in node and assert the invariant on
 * text. These assert the things text cannot see: whether a control is on the screen, what a
 * selection reaches, whether a click writes a file, whether the layout survives a panel's
 * width. Most of what broke over a week of use broke here rather than in the parser, and
 * each of these was written the day its bug was found.
 *
 * Playwright is not a dependency of this project and the page has none. Without it this
 * suite says so and exits 0, so `node test/*.test.mjs` stays green on a fresh clone:
 *
 *   npm install playwright && npx playwright install chromium
 *
 * The page is served or opened as it ships. Two scenarios need to reach inside it — to hand
 * it a pretend folder, or to read its document list — and for those a copy is written to a
 * temp directory with a hook appended, the same trick the node suites use. Nothing is added
 * to the file that ships.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn, execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const PAGE = path.join(ROOT, 'critic-notebook.html');
const PANEL = path.join(ROOT, 'tools', 'panel.mjs');

/* CN_PLAYWRIGHT points at an install somewhere else — a shared one, or a CI cache. An import
   does not look at NODE_PATH, so there is no subtler way to say it. */
let chromium;
try {
  const where = process.env.CN_PLAYWRIGHT
    ? new URL('index.mjs', 'file://' + path.join(process.env.CN_PLAYWRIGHT, '/')).href
    : 'playwright';
  ({ chromium } = await import(where));
} catch {
  console.log('playwright is not installed, so the browser checks were skipped.\n' +
              '  npm install playwright && npx playwright install chromium\n' +
              '  (or set CN_PLAYWRIGHT to an install elsewhere)');
  process.exit(0);
}

/* ---------------------------------------------------------------- harness */

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cn-browser-'));
const only = process.argv.slice(2).filter(a => !a.startsWith('-'));
let fails = 0, ran = 0;
const ok = (cond, msg) => { if(!cond) fails++; console.log((cond ? '  ok   ' : '  FAIL ') + msg); };

/* A copy of the page with a hook appended, for the two scenarios that have to reach inside
   it. Everything the hook exposes is read-only but `useFiles`, which stands in for a folder
   the browser would otherwise have to be given by hand. */
function instrumented(){
  const src = fs.readFileSync(PAGE, 'utf8');
  const at = src.lastIndexOf('})();');
  if(at < 0) throw new Error('could not find the page script IIFE close');
  const hook = `window.__T={
    openDoc:openDoc, setView:setView, render:render, parse:parse, resolveRange:resolveRange,
    get d(){ return doc; }, set d(v){ doc = v; },
    setCompare:function(c){ compareWith = c; render(); },
    useFiles:function(l){ files = l; folder = { handle:{name:'f'}, name:'f', abs:'/f' }; paintDocList(); },
    useFolder:function(h){ folder = { handle:h, name:h.name, abs:'/' + h.name }; },
    docs:function(){ return docs.map(function(d){ return {
      key:d.key, name:d.name, src:d.src, from:!!d.from, scratch:!!d.scratch, handle:!!d.handle }; }); },
    active:function(){ return activeDoc; },
    compareWith:function(){ return compareWith; },
    src:function(){ return doc.src; },
    groups:function(){ return [].slice.call(document.querySelectorAll('#doclist .grp'))
      .map(function(g){ return g.textContent; }); }
  };`;
  const out = path.join(TMP, 'instrumented.html');
  fs.writeFileSync(out, src.slice(0, at) + hook + '\n' + src.slice(at));
  return 'file://' + out;
}

/* tools/panel.mjs is the host these scenarios run against, so the protocol and the writing
   back are under test too rather than simulated. */
function servePanel(file, args = []){
  const proc = spawn(process.execPath, [PANEL, file, '--no-open', ...args],
                     { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  proc.stdout.on('data', d => { out += d; });
  proc.stderr.on('data', d => { out += d; });
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const t = setInterval(() => {
      const m = out.match(/http:\/\/127\.0\.0\.1:\d+\/\?t=[a-f0-9]+/);
      if(m){ clearInterval(t); resolve({ url: m[0], proc, log: () => out }); }
      else if(Date.now() - started > 15000){ clearInterval(t); proc.kill(); reject(new Error('panel.mjs did not start: ' + out)); }
    }, 60);
  });
}

function fixture(name, text){
  const p = path.join(TMP, name);
  fs.writeFileSync(p, text);
  return p;
}

const SCEN = [];
const scenario = (name, fn) => SCEN.push({ name, fn });
const frameOf = p => p.frames().find(f => f.url().includes('critic-notebook.html'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ------------------------------------------------------------- scenarios */

const A = 'The first paragraph, which neither version touches.';
const C = 'The third paragraph, also untouched by anyone.';

/* Clicking back to a file that something else has rewritten used to show the copy held in
   memory, and a review done against that would have been saved back over the new version. */
scenario('stale', async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(instrumented()); await sleep(900);

  await p.evaluate(() => {
    window.__disk = { 'A.md': '# A\n\nThe first file, as it was.\n', 'B.md': '# B\n\nThe second file.\n' };
    const mk = n => ({ key: 'f/' + n, name: n, path: n, count: 0, scanned: true,
      handle: { name: n,
        getFile: () => Promise.resolve(new File([window.__disk[n]], n)),
        createWritable: () => Promise.resolve({
          write: t => { window.__disk[n] = t; return Promise.resolve(); },
          close: () => Promise.resolve() }) } });
    window.__T.useFiles([mk('A.md'), mk('B.md')]);
  });
  await sleep(300);
  const click = async n => { await p.click('.doc-row[data-key="f/' + n + '"]'); await sleep(500); };

  await click('A.md');
  ok((await p.evaluate(() => window.__T.src())).includes('as it was'), 'A opens');
  await click('B.md');
  ok((await p.evaluate(() => window.__T.src())).includes('second file'), 'B opens');

  await p.evaluate(() => { window.__disk['A.md'] = '# A\n\nRewritten by something else entirely.\n'; });
  await click('A.md');
  const back = await p.evaluate(() => window.__T.src());
  ok(back.includes('Rewritten by something else'), 'clicking back to A shows what the file says now');
  ok(!back.includes('as it was'), 'and not the copy it had in memory');

  /* unsaved work must never be read over */
  await p.evaluate(() => { window.__disk['A.md'] = '# A\n\nChanged on disk a second time.\n'; });
  await p.evaluate(() => { const c = document.querySelector('.out[data-cell]'); if(c) c.click(); });
  await sleep(400);
  ok(await p.evaluate(() => !!document.getElementById('edbox')), 'a block opened for editing');
  await p.evaluate(() => { const t = document.getElementById('edbox');
    t.value = 'Edited here, never saved.'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(250);
  await p.evaluate(() => document.getElementById('nb').click());
  await sleep(400);
  ok(!(await p.evaluate(() => document.getElementById('btn-save').disabled)),
     'and there is something unsaved to write');

  await p.click('.doc-row[data-key="f/B.md"]'); await sleep(400);
  const gate = await p.$('[data-x="cancel"]');
  ok(!!gate, 'leaving a dirty document asks before anything is read over it');
  if(gate) await p.click('[data-x="cancel"]');
  await sleep(300);
  const after = await p.evaluate(() => window.__T.src());
  ok(/Edited/.test(after) && /never saved/.test(after), 'the unsaved work is still there, recorded as marks');
  ok(!after.includes('Changed on disk a second time'), 'the disk copy did not overwrite it');

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await ctx.close();
});

/* A selection inside a deletion mapped nowhere in the source, so nothing came up at all and
   struck words could be copied with the keyboard and no other way. */
scenario('pop', async (browser) => {
  const f = fixture('pop.md',
    'But the horse was not lifting 720 pounds. On a soft dirt road the coefficient is about 0.2, so ' +
    '{~~the force actually required at the collar was closer to 150 pounds~>the force at the collar was closer to 150 pounds~~}.\n');
  const { url, proc } = await servePanel(f);
  const ctx = await browser.newContext({ viewport: { width: 900, height: 760 },
                                         permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(url); await sleep(1300);
  const fr = frameOf(p);

  ok(await fr.evaluate(() => !!document.querySelector('.cm.fine .wd.del')),
     'a replacement that keeps most of its text is diffed again when drawn');

  const selectStruck = () => fr.evaluate(() => {
    const w = document.querySelector('.cm.fine .wd.del');
    const r = document.createRange(); r.selectNodeContents(w);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await selectStruck(); await sleep(450);
  let pop = await fr.evaluate(() => { const e = document.querySelector('.pop');
    return e ? { text: e.textContent, btns: [].slice.call(e.querySelectorAll('button')).map(b => b.dataset.x) } : null; });
  ok(!!pop, 'selecting struck words brings up the popover at all');
  ok(pop && /actually required/.test(pop.text), 'it shows what was selected');
  ok(pop && pop.btns.includes('copy') && pop.btns.includes('edit'), 'Copy and Edit are offered');
  ok(pop && !pop.btns.includes('comment'), 'Comment is not, having nothing to anchor to');

  await fr.click('.pop [data-x="copy"]'); await sleep(450);
  const clip = await p.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok(/actually required/.test(clip), 'Copy puts the struck words on the clipboard');

  await selectStruck(); await sleep(400);
  await fr.click('.pop [data-x="edit"]'); await sleep(600);
  ok(await fr.evaluate(() => { const t = document.getElementById('edbox');
    return !!t && /the force at the collar/.test(t.value) && !/\{/.test(t.value); }),
     'Edit opens the block as prose, with the suggestion resolved and no markup to type');

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await ctx.close(); proc.kill();
});

/* Deleting the words you selected, and the spacing going with them the way a word diff
   does it: one space left behind, not two. */
scenario('delete', async (browser) => {
  const ORIG = 'The force actually required at the collar was closer to 150 pounds.\n';
  const f = fixture('del.md', ORIG);
  const { url, proc } = await servePanel(f);
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(url); await sleep(1300);
  const fr = frameOf(p);

  const found = await fr.evaluate(w => {
    for(const s of document.querySelectorAll('.out .tx')){
      const n = s.firstChild; if(!n || n.nodeType !== 3) continue;
      const i = n.nodeValue.indexOf(w); if(i < 0) continue;
      const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + w.length);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      return true;
    }
    return false;
  }, 'actually required');
  ok(found, 'found the words to delete');
  await sleep(450);
  ok(await fr.evaluate(() => { const e = document.querySelector('.pop');
    return !!e && [].slice.call(e.querySelectorAll('button')).some(b => b.dataset.x === 'del'); }),
     'Delete is offered on a plain selection');
  await fr.click('.pop [data-x="del"]'); await sleep(600);
  ok(await fr.evaluate(() => /actually required/.test(
       (document.querySelector('.cm.del') || {}).textContent || '')), 'the words are struck in place');

  await fr.evaluate(() => document.getElementById('btn-save').click());
  await sleep(900);
  const disk = fs.readFileSync(f, 'utf8');
  const accepted = disk.replace(/\{--[\s\S]*?--\}/g, '').replace(/\{>>[\s\S]*?<<\}/g, '');
  const rejected = disk.replace(/\{--([\s\S]*?)--\}/g, '$1').replace(/\{>>[\s\S]*?<<\}/g, '');
  ok(/\{--/.test(disk), 'the file carries a tracked deletion');
  ok(/The force at the collar/.test(accepted), 'accepting leaves exactly one space, not two');
  ok(rejected === ORIG, 'rejecting gives the file back byte for byte');

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await ctx.close(); proc.kill();
});

/* Edit on a short selection in a long paragraph edits the selection, in place, instead of
   opening the whole block and leaving you to find the five words again. */
scenario('edit-selection', async (browser) => {
  const LONG = 'In the spring of that year the migration finished three weeks late, ' +
    'after a winter of arguments about the schema, two changes of lead, and a rollback ' +
    'that nobody wanted to talk about, and it cost 206 thousand in the end.';
  const ORIG = LONG + '\n';
  const f = fixture('editsel.md', ORIG);
  const { url, proc } = await servePanel(f);
  const ctx = await browser.newContext({ viewport: { width: 980, height: 800 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(url); await sleep(1300);
  const fr = frameOf(p);
  await fr.evaluate(() => { document.getElementById('author').value = 'hai'; });

  const select = w => fr.evaluate(w => {
    for(const s of document.querySelectorAll('.out .tx')){
      const n = s.firstChild; if(!n || n.nodeType !== 3) continue;
      const i = n.nodeValue.indexOf(w); if(i < 0) continue;
      const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + w.length);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      return true;
    }
    return false;
  }, w);

  ok(await select('three weeks late'), 'selected three words in the middle of a long paragraph');
  await sleep(450);
  await fr.click('.pop [data-x="edit"]'); await sleep(400);
  const box = await fr.evaluate(() => { const t = document.querySelector('.pop textarea');
    return t ? { v: t.value, focused: document.activeElement === t } : null; });
  ok(box && box.v === 'three weeks late', 'Edit opens a box holding just the selection — ' + JSON.stringify(box && box.v));
  ok(box && box.focused, 'with the cursor already in it');
  ok(await fr.evaluate(() => !document.getElementById('edbox')), 'and the whole block is not opened');
  const pr = await fr.evaluate(() => { const r = document.querySelector('.pop').getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, vh: innerHeight, vw: innerWidth }; });
  ok(pr.top >= 0 && pr.bottom <= pr.vh && pr.left >= 0 && pr.right <= pr.vw,
     'and the box sits wholly on screen — ' + JSON.stringify(pr));
  if(process.env.CN_SHOT) await p.screenshot({ path: process.env.CN_SHOT });

  /* Esc leaves everything as it was */
  await fr.press('.pop textarea', 'Escape'); await sleep(300);
  ok(await fr.evaluate(() => !document.querySelector('.pop')), 'Esc closes it');
  ok(await fr.evaluate(() => !document.querySelector('.cm')), 'having changed nothing');

  /* type and press Enter */
  await select('three weeks late'); await sleep(450);
  await fr.click('.pop [data-x="edit"]'); await sleep(350);
  await fr.fill('.pop textarea', 'two weeks late');
  await fr.press('.pop textarea', 'Enter'); await sleep(600);
  ok(await fr.evaluate(() => /three/.test((document.querySelector('.cm.del, .cm.fine .wd.del') || {}).textContent || '')),
     'Enter records it as a suggestion, struck where it stands');

  /* the frame round the block being edited is orange, not the blue every button uses */
  await fr.evaluate(() => document.querySelector('.out[data-cell]').click()); await sleep(400);
  const border = await fr.evaluate(() => { const e = document.querySelector('.ed');
    return e ? getComputedStyle(e).borderTopColor : null; });
  ok(border && /rgb\(232, 115, 12\)|rgb\(255, 157, 66\)/.test(border), 'the block being edited has an orange frame — ' + border);
  await fr.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await sleep(300);

  await fr.evaluate(() => document.getElementById('btn-save').click()); await sleep(900);
  const disk = fs.readFileSync(f, 'utf8');
  ok(/\{~~three~>two~~\}\{>>@hai<<\}/.test(disk), 'the file holds one small signed replacement, not a rewritten paragraph — ' +
     JSON.stringify((disk.match(/\{[-+~][\s\S]{0,40}/) || [''])[0]));
  const rejected = disk.replace(/\{~~([\s\S]*?)~>[\s\S]*?~~\}/g, '$1').replace(/\{>>[\s\S]*?<<\}/g, '');
  ok(rejected === ORIG, 'and rejecting it gives the paragraph back exactly');

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await ctx.close(); proc.kill();
});

/* The controls between blocks, the confirmation, and what joining writes. */
scenario('join', async (browser) => {
  const ORIG = '# A heading\n\nFirst paragraph, which ends here.{>>@hai: check this<<}\n\n' +
               'Second paragraph, which starts here.\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n';
  const f = fixture('join.md', ORIG);
  const { url, proc } = await servePanel(f);
  const ctx = await browser.newContext({ viewport: { width: 980, height: 900 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(url); await sleep(1300);
  const fr = frameOf(p);

  const joins = () => fr.evaluate(() =>
    [].slice.call(document.querySelectorAll('button[data-join]')).map(b => +b.dataset.join));
  ok(await fr.evaluate(() => {
      const b = document.querySelector('.gap button[data-ins]');
      const st = getComputedStyle(b);
      return st.display !== 'none' && +st.opacity > 0.9;
    }), 'the + between blocks is on screen without hovering');
  ok((await joins()).length === 3, 'a − is offered in every gap between two blocks');

  /* a heading cannot actually merge, and says so before doing anything */
  await fr.evaluate(() => document.querySelector('button[data-join="1"]').click());
  await sleep(400);
  let panel = await fr.evaluate(() => { const d = document.querySelector('.panel'); return d ? d.textContent : null; });
  ok(panel && /heading ends at its own line/.test(panel), 'joining a heading warns first');
  await fr.click('[data-x="cancel"]'); await sleep(300);
  ok(await fr.evaluate(() => !document.querySelector('.cm.pilcrow,.blk.pilcrow')), 'cancel joined nothing');

  /* two plain paragraphs: asked about, but nothing made to sound dangerous */
  await fr.evaluate(() => document.querySelector('button[data-join="2"]').click());
  await sleep(400);
  panel = await fr.evaluate(() => { const d = document.querySelector('.panel'); return d ? d.textContent : null; });
  ok(panel && /Join these two paragraphs\?/.test(panel), 'two plain paragraphs are asked about too');
  ok(panel && !/table|heading|quotation|anyway/.test(panel), 'and nothing is made to sound dangerous');
  await fr.click('[data-x="go"]'); await sleep(600);

  ok(await fr.evaluate(() => !!document.querySelector('.cm.pilcrow')), 'a struck pilcrow marks the break');
  /* the first row in this document is the comment, so look for the one that is the join */
  const row = await fr.evaluate(() => [].slice.call(document.querySelectorAll('.mk'))
    .map(r => r.textContent).find(t => /Join/.test(t)) || '');
  ok(/break between these paragraphs/.test(row), 'the row is called Join and says what it does');

  await fr.evaluate(() => document.getElementById('btn-save').click());
  await sleep(900);
  const disk = fs.readFileSync(f, 'utf8');
  ok(/check this<<\}\n\{--\n--\}Second paragraph/.test(disk),
     'the mark goes around the break only, under a comment and with one newline outside it');
  ok(disk.replace(/\{--([\s\S]*?)--\}/g, '$1') === ORIG, 'rejecting gives the file back byte for byte');
  const accepted = disk.replace(/\{--[\s\S]*?--\}/g, '').replace(/\{>>[\s\S]*?<<\}/g, '');
  ok(/ends here\.\nSecond paragraph/.test(accepted), 'accepting leaves one paragraph');

  /* the rule that still refuses: a gap whose blank line lies inside a mark */
  const gaps = await fr.evaluate(() => document.querySelectorAll('.gap').length);
  ok((await joins()).length < gaps - 1, 'no join is offered where the break is inside a mark');

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await ctx.close(); proc.kill();
});

/* A blank line typed into a table warns while there is still a cursor in the box. */
scenario('split-warning', async (browser) => {
  const f = fixture('warn.md', 'A paragraph.\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n');
  const { url, proc } = await servePanel(f);
  const ctx = await browser.newContext({ viewport: { width: 980, height: 800 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(url); await sleep(1300);
  const fr = frameOf(p);

  await fr.evaluate(() => {
    const outs = [].slice.call(document.querySelectorAll('.out[data-cell]'));
    (outs.find(o => o.querySelector('table')) || outs[outs.length - 1]).click();
  });
  await sleep(400);
  ok(await fr.evaluate(() => !!document.getElementById('edbox')), 'the table opened for editing');
  ok(await fr.evaluate(() => !document.querySelector('.ed .prev .warn')), 'and says nothing yet');

  await fr.evaluate(() => { const t = document.getElementById('edbox');
    t.value = t.value.replace('\n| 1 | 2 |', '\n\n| 1 | 2 |');
    t.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(700);
  const warn = await fr.evaluate(() => { const w = document.querySelector('.ed .prev .warn'); return w ? w.textContent : null; });
  ok(warn && /blank line ends a table/.test(warn), 'a blank line in a table warns as it is typed');
  ok(warn && /rejecting it puts the block back/.test(warn), 'and says it is still only a suggestion');

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await ctx.close(); proc.kill();
});

/* A comparison opened as suggestions arrives detached; adopting makes it the file. */
scenario('blackline', async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(instrumented()); await sleep(900);
  await p.evaluate(() => { window.showSaveFilePicker = () =>
    Promise.reject(Object.assign(new Error('abort'), { name: 'AbortError' })); });

  const OLD = '# Weekly note\n\nThe migration finished three weeks late and cost 206 thousand.\n\n' + A + '\n';
  const NEW = '# Weekly note\n\nThe migration finished two weeks late and cost 188.5 thousand.\n\n' + A + '\n';
  await p.evaluate(([o, n]) => {
    window.__WROTE = null;
    const fake = { name: 'weekly-note.md', kind: 'file',
      getFile: () => Promise.resolve(new File([n], 'weekly-note.md')),
      createWritable: () => Promise.resolve({
        write: t => { window.__WROTE = t; return Promise.resolve(); }, close: () => Promise.resolve() }) };
    window.__T.openDoc(n, 'weekly-note.md', fake, '', 'file:weekly-note.md');
    window.__T.setCompare({ key: 't:old', name: 'weekly-note.prev.md', src: o });
    window.__T.setView('compare');
  }, [OLD, NEW]);
  await sleep(500);
  await p.click('button[data-act3="blackline"]'); await sleep(700);

  ok((await p.evaluate(() => window.__T.groups())).includes('not saved to a file'),
     'the blackline is listed as what it is — a document that is no file');
  const strip = await p.evaluate(() => ({ hidden: document.getElementById('bl').hidden,
    text: document.getElementById('bl-txt').textContent,
    adopt: document.getElementById('bl-adopt').textContent }));
  ok(!strip.hidden && /weekly-note\.prev\.md/.test(strip.text) && /weekly-note\.md/.test(strip.text),
     'the strip names both sides');
  ok(strip.adopt === 'Make it the new weekly-note.md', 'and the button names the file');
  ok(!(await p.evaluate(() => document.getElementById('btn-save').disabled)),
     'Save is offered on it, there being no file for it to match');

  await p.click('#bl-adopt'); await sleep(400);
  const warn = await p.evaluate(() => { const d = document.querySelector('.panel'); return d ? d.textContent : null; });
  ok(warn && /writes over/.test(warn), 'adopting warns that it writes over the file');
  ok(warn && /is not touched/.test(warn), 'and says the older side is safe');
  ok(await p.evaluate(() => window.__WROTE) === null, 'nothing written yet');
  await p.click('[data-x="cancel"]'); await sleep(300);
  ok(await p.evaluate(() => window.__WROTE) === null, 'Cancel writes nothing');

  await p.click('#bl-adopt'); await sleep(300);
  await p.click('[data-x="go"]'); await sleep(900);
  const wrote = await p.evaluate(() => window.__WROTE);
  ok(!!wrote && /\{~~206~>188\.5~~\}/.test(wrote), 'confirming writes the file, suggestions and all');
  const docs = await p.evaluate(() => window.__T.docs());
  const me = docs[await p.evaluate(() => window.__T.active())];
  ok(me && !me.scratch && me.key === 'file:weekly-note.md', 'and the document is that file now');
  ok(docs.filter(d => d.key === 'file:weekly-note.md').length === 1, 'listed once, not twice');

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await ctx.close();
});

/* Two reviewers in turn, through the editor rather than the merge: the second one opens a
   paragraph the first has already marked and changes something else in it. The block is
   rebuilt from the original either way, so the first reviewer's name has to survive the
   rebuild — it did not, and their comment ended up adrift at the end of the block. */
scenario('in-turn', async (browser) => {
  const O = 'The migration finished three weeks late and cost 206 thousand.\n\n' + A + '\n';
  const AFTER_AI = O.replace('three weeks',
    '{~~three~>two~~}{>>@ai：from the deploy log<<} weeks');
  const f = fixture('turn.md', AFTER_AI);
  const { url, proc } = await servePanel(f);
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 860 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(url); await sleep(1300);
  const fr = frameOf(p);

  await fr.evaluate(() => { document.getElementById('author').value = 'hai'; });
  await fr.evaluate(() => document.querySelector('.out[data-cell]').click());
  await sleep(400);
  const handed = await fr.evaluate(() => document.getElementById('edbox').value);
  ok(/two weeks/.test(handed) && !/\{/.test(handed),
     'the second reviewer is handed what the first proposed, as prose');

  await fr.evaluate(() => { const t = document.getElementById('edbox');
    t.value = t.value.replace('migration', 'rollout').replace('206', '188.5');
    t.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(300);
  await fr.evaluate(() => { const o = document.querySelectorAll('.out[data-cell]'); o[o.length - 1].click(); });
  await sleep(500);
  await fr.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await sleep(500);

  const rows = await fr.evaluate(() => [].slice.call(document.querySelectorAll('.mk')).map(r => ({
    txt: (r.querySelector('.txt') || {}).textContent.replace(/\s+/g, ' ').trim(),
    who: (r.querySelector('.who') || {}).textContent || null })));
  const find = t => rows.find(r => r.txt.indexOf(t) === 0) || {};
  ok(find('three').who === '@ai', "the first reviewer's suggestion keeps their name — " + find('three').who);
  ok(/from the deploy log/.test(find('three').txt), 'and their note stays on it rather than drifting off');
  ok(find('migration').who === '@hai', "the second reviewer's own change is theirs");
  ok(find('206').who === '@hai', 'including the second mark of the same edit');
  ok(rows.length === 3, 'three suggestions, no comment left loose — ' + rows.length);

  await fr.evaluate(() => document.getElementById('btn-save').click());
  await sleep(900);
  const disk = fs.readFileSync(f, 'utf8');
  ok(disk.replace(/\{~~([\s\S]*?)~>[\s\S]*?~~\}/g, '$1').replace(/\{>>[\s\S]*?<<\}/g, '') === O,
     'and rejecting everything still gives the document the first reviewer started from');

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await ctx.close(); proc.kill();
});

/* Two reviews of one document, laid over each other, named at the moment the names are
   still known. */
scenario('merge', async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(instrumented()); await sleep(900);

  const O = 'The migration finished three weeks late and cost 206 thousand.\n\n' + A + '\n';
  const MINE = O.replace('three weeks', '{~~three~>two~~} weeks');
  const THEIRS = O.replace('206 thousand', '{~~206~>188.5~~}{>>@workbuddy<<} thousand')
                  .replace('three weeks', '{~~three~>four~~} weeks');
  await p.evaluate(([mine, theirs]) => {
    window.__T.openDoc(mine, 'report.md', null, '', 'file:report.md');
    window.__T.setCompare({ key: 't:theirs', name: 'report.workbuddy.md', src: theirs });
    window.__T.setView('compare');
  }, [MINE, THEIRS]);
  await sleep(500);

  ok(await p.evaluate(() => !!document.querySelector('button[data-act3="merge"]')),
     'the Compare tab offers Merge reviews');
  await p.click('button[data-act3="merge"]'); await sleep(400);
  const names = await p.evaluate(() => ({
    a: document.getElementById('mg-a').value, b: document.getElementById('mg-b').value }));
  ok(names.b === 'workbuddy', "the other side's name is taken from its own marks — " + names.b);
  ok(!!names.a && names.a !== names.b, 'and this side gets a different one — ' + names.a);
  await p.evaluate(() => { document.getElementById('mg-a').value = 'hai'; });
  await p.click('[data-x="go"]'); await sleep(800);

  const src = await p.evaluate(() => window.__T.src());
  ok(/\{~~three~>two~~\}\{>>@hai<<\}/.test(src), "an unsigned mark is stamped with its side's name");
  ok(/\{~~206~>188\.5~~\}\{>>@workbuddy<<\}/.test(src), 'a signed one keeps the name it had');
  ok(/@workbuddy：would write/.test(src), 'the suggestion on the same words is written beside it');
  ok(await p.evaluate(() => window.__T.docs().some(d => /\(merged\)/.test(d.name))),
     'the result opens as a document of its own');
  ok((await p.evaluate(() => window.__T.groups())).includes('not saved to a file'),
     'listed as what it is, having been written nowhere');
  const strip = await p.evaluate(() => document.getElementById('bl').hidden ? null
    : document.getElementById('bl-txt').textContent);
  ok(strip && /This is a merge of report\.md and report\.workbuddy\.md/.test(strip),
     'the strip says what it is, not that it is a blackline — ' + (strip || 'NONE').slice(0, 56));
  ok(strip && /both started from/.test(strip), 'and what rejecting everything gives back');

  /* two authors, two colours, at opposite ends of the circle */
  const dots = await p.evaluate(() => [].slice.call(document.querySelectorAll('.mk .who'))
    .map(w => ({ who: w.textContent, dot: w.querySelector('.dot').style.background })));
  const uniq = [...new Set(dots.map(d => d.dot))];
  ok(dots.length >= 2 && uniq.length >= 2, 'each reviewer gets a colour of their own');

  /* and the one claim that matters */
  const back = await p.evaluate(o => {
    const s = window.__T.src();
    window.__T.d = window.__T.parse(s);
    return window.__T.resolveRange(0, s.length, 'orig') === o;
  }, O).catch(() => null);
  if(back !== null) ok(back, 'rejecting every suggestion gives the document both started from');

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await ctx.close();
});

/* The history of the open file, read out of the repository by the page itself. The folder
   handle is a stand-in whose files are a real repository on disk — built by the same script
   the git suite uses, packs and loose objects both — so what is under test is the page's own
   reading through the handle API, and what it chose is checked against git. */
scenario('git-history', async (browser) => {
  let gitOk = true;
  try { execFileSync('git', ['--version'], { stdio: 'ignore' }); } catch { gitOk = false; }
  if(!gitOk){ console.log('  (git is not installed; skipped)'); return; }
  const repo = path.join(TMP, 'repo');
  execFileSync('bash', [path.join(HERE, 'git-fixtures.sh'), repo, 'mixed'], { stdio: 'ignore' });
  const gitDir = path.join(repo, '.git');
  const g = args => execFileSync('git', ['-C', repo, ...args]).toString();

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.exposeFunction('__gitKind', rel => {
    try { return fs.statSync(path.join(gitDir, rel)).isDirectory() ? 'dir' : 'file'; } catch { return null; }
  });
  await p.exposeFunction('__gitRead', rel => {
    try { return fs.readFileSync(path.join(gitDir, rel)).toString('base64'); } catch { return null; }
  });
  await p.exposeFunction('__gitList', rel => {
    try { return fs.readdirSync(path.join(gitDir, rel)); } catch { return null; }
  });
  await p.goto(instrumented()); await sleep(900);

  const notes = fs.readFileSync(path.join(repo, 'notes.md'), 'utf8');
  await p.evaluate(text => {
    const nf = () => Promise.reject(Object.assign(new Error('not found'), { name: 'NotFoundError' }));
    const join = (a, b) => a ? a + '/' + b : b;
    const fileH = rel => ({ kind: 'file', name: rel.split('/').pop(),
      getFile: () => window.__gitRead(rel).then(b64 => {
        const bin = atob(b64), u = new Uint8Array(bin.length);
        for(let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        return new File([u], rel.split('/').pop());
      }) });
    const dirH = rel => ({ kind: 'directory', name: rel.split('/').pop() || '.git',
      getDirectoryHandle: n => window.__gitKind(join(rel, n)).then(k => k === 'dir' ? dirH(join(rel, n)) : nf()),
      getFileHandle: n => window.__gitKind(join(rel, n)).then(k => k === 'file' ? fileH(join(rel, n)) : nf()),
      keys: () => { let names = null, i = 0;
        return { next: async () => { if(!names) names = (await window.__gitList(rel)) || [];
          return i < names.length ? { done: false, value: names[i++] } : { done: true }; } }; } });
    /* the folder that was opened: it holds .git, and nothing about it is real but the repository */
    const root = { kind: 'directory', name: 'repo',
      getDirectoryHandle: n => n === '.git' ? Promise.resolve(dirH('')) : nf(),
      getFileHandle: () => nf() };
    window.__T.useFolder(root);
    window.__T.openDoc(text, 'notes.md', null, 'notes.md', 'repo/notes.md');
    window.__T.setView('compare');
  }, notes);

  /* reading happens in the background; wait for the picker to fill */
  let opts = [];
  for(let t = 0; t < 40; t++){
    opts = await p.evaluate(() => [].slice.call(document.querySelectorAll('#cmppick option'))
      .map(o => ({ v: o.value, t: o.textContent, d: o.disabled })));
    if(opts.some(o => /^git:/.test(o.v)) || opts.some(o => o.d && !/reading/.test(o.t))) break;
    await sleep(150);
  }
  const versions = opts.filter(o => /^git:/.test(o.v));
  const want = g(['log', '--first-parent', '--format=%H', '--', 'notes.md']).trim().split('\n').slice(0, 40);
  ok(versions.length === want.length, 'the picker lists every commit that changed the file — ' +
     versions.length + ' of ' + want.length + (versions.length ? '' : ' ' + JSON.stringify(opts.map(o => o.t))));
  ok(versions.length && versions[0].v === 'git:' + want[0], 'newest first, the same commits git names');
  ok(versions.length && /^last commit/.test(versions[0].t), 'the newest is called the last commit');

  /* choose the oldest and compare against what git says that version was */
  const oldest = versions[versions.length - 1];
  await p.selectOption('#cmppick', oldest.v); await sleep(800);
  const got = await p.evaluate(() => (window.__T.compareWith() || {}).src || null);
  const sha = oldest.v.slice(4);
  ok(got === g(['show', sha + ':notes.md']), 'choosing a version compares against exactly what git holds for it');
  ok(await p.evaluate(() => document.querySelectorAll('.cmp:not(.same)').length > 0),
     'and the Compare view shows what changed since');
  if(process.env.CN_SHOT) await p.screenshot({ path: process.env.CN_SHOT, clip: { x: 0, y: 60, width: 1280, height: 420 } });

  /* a folder that is not the top of a repository says so rather than showing nothing */
  await p.evaluate(() => {
    window.__T.useFolder({ kind: 'directory', name: 'plain',
      getDirectoryHandle: () => Promise.reject(Object.assign(new Error(''), { name: 'NotFoundError' })),
      getFileHandle: () => Promise.reject(Object.assign(new Error(''), { name: 'NotFoundError' })) });
    window.__T.setView('markup'); window.__T.setView('compare');
  });
  await sleep(600);
  const said = await p.evaluate(() => [].slice.call(document.querySelectorAll('#cmppick option[disabled]'))
    .map(o => o.textContent).join(' | '));
  ok(/not the top of a git repository/.test(said), 'a folder that is not a repository says so — ' + said);

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await ctx.close();
});

/* The layout a panel beside an assistant gets, at the widths one actually has. */
scenario('widths', async (browser) => {
  const f = fixture('wide.md', '# Weekly note\n\n' + A + '\n\nA line with {++an insertion++} in it.\n\n' + C + '\n');
  const { url, proc } = await servePanel(f);
  const standalone = 'file://' + PAGE;
  for(const w of [1400, 1000, 880, 780, 700, 560, 420, 360]){
    for(const mode of ['hosted', 'alone']){
      const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
      const p = await ctx.newPage();
      await p.goto(mode === 'hosted' ? url : standalone);
      await sleep(mode === 'hosted' ? 900 : 700);
      const fr = mode === 'hosted' ? frameOf(p) : p.mainFrame();
      if(!fr){ ok(false, w + 'px ' + mode + ': the page did not load'); await ctx.close(); continue; }
      const r = await fr.evaluate(() => {
        const de = document.documentElement, over = [];
        document.querySelectorAll('.bar,.status,.nb,.center,.shell,.app').forEach(el => {
          if(el.scrollWidth > el.clientWidth + 1) over.push(el.className.split(' ')[0]);
        });
        const v = document.getElementById('sver').getBoundingClientRect();
        return { doc: de.scrollWidth > de.clientWidth + 1, over,
                 verShown: v.width > 0 && v.right <= innerWidth + 1,
                 hosted: document.querySelector('.app').classList.contains('hosted'),
                 jump: getComputedStyle(document.getElementById('navjump')).display !== 'none' };
      });
      ok(!r.doc && !r.over.length, w + 'px ' + mode + ': nothing overflows sideways' +
         (r.over.length ? ' (' + r.over.join(', ') + ')' : ''));
      ok(r.verShown, w + 'px ' + mode + ': the version is on screen');
      if(mode === 'hosted') ok(r.hosted, w + 'px hosted: the page knows it is in a host');
      if(w <= 880) ok(r.jump, w + 'px ' + mode + ': the jumps come up out of the outline pane');
      await ctx.close();
    }
  }
  proc.kill();
});

/* tools/panel.mjs itself: it serves the page, guards the port, and writes the file back. */
scenario('panel-tool', async (browser) => {
  const ORIG = '# Smoke\n\nA line with {++an insertion++} and {~~206~>188.5~~} in it.\n';
  const f = fixture('tool.md', ORIG);
  const { url, proc } = await servePanel(f, ['--once']);
  const origin = url.slice(0, url.indexOf('/?'));

  const ctx = await browser.newContext({ viewport: { width: 820, height: 820 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));

  /* asked outside a page, because a fetch from one is refused by CORS before it ever leaves
     and would report nothing about the server */
  const bare = await ctx.request.get(origin + '/', { failOnStatusCode: false });
  ok(bare.status() === 403, 'a request without the token is refused (' + bare.status() + ')');
  const wrong = await ctx.request.get(origin + '/?t=deadbeef', { failOnStatusCode: false });
  ok(wrong.status() === 403, 'and so is one with the wrong token (' + wrong.status() + ')');
  const save = await ctx.request.post(origin + '/save', { data: 'pwned', failOnStatusCode: false });
  ok(save.status() === 403 && fs.readFileSync(f, 'utf8') === ORIG,
     'a save without it writes nothing');

  await p.goto(url); await sleep(1300);
  const fr = frameOf(p);
  ok(!!fr, 'the page loads in the host');
  const st = await fr.evaluate(() => ({
    hosted: document.querySelector('.app').classList.contains('hosted'),
    name: document.getElementById('docname').textContent,
    status: document.getElementById('stxt').textContent,
    tog: getComputedStyle(document.getElementById('tog-side')).display }));
  ok(st.hosted, 'in host mode');
  ok(st.name === 'tool.md', 'showing the file by name');
  ok(/2 open suggestions/.test(st.status), 'with the suggestions out of the file');
  ok(st.tog === 'none', 'and the file controls gone, the host owning the file');

  /* reject the first, accept the second, save */
  await fr.evaluate(() => document.querySelectorAll('.mk .ops button')[1].click());
  await sleep(400);
  await fr.evaluate(() => document.querySelectorAll('.mk .ops button')[0].click());
  await sleep(400);
  await fr.evaluate(() => document.getElementById('btn-save').click());
  await sleep(1200);

  const after = fs.readFileSync(f, 'utf8');
  ok(after !== ORIG, 'saving in the page wrote the file on disk');
  ok(!/\{[-+~]/.test(after), 'with the decisions applied and no marks left');
  ok(/188\.5/.test(after) && !/an insertion/.test(after),
     'the accepted one went in and the rejected one did not — ' + JSON.stringify(after.split('\n')[2]));

  await sleep(400);
  ok(proc.exitCode === 0 || proc.killed, '--once stopped the server after the save');
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await ctx.close(); proc.kill();
});

/* ------------------------------------------------------------------ run */

const chosen = only.length ? SCEN.filter(s => only.includes(s.name)) : SCEN;
if(only.length && !chosen.length){
  console.error('no such scenario. known: ' + SCEN.map(s => s.name).join(', '));
  process.exit(1);
}

let browser;
try {
  browser = await chromium.launch(process.env.CN_CHROME ? { executablePath: process.env.CN_CHROME } : {});
} catch (e) {
  console.log('could not start Chromium, so the browser checks were skipped.\n  ' +
              String(e.message).split('\n')[0] +
              '\n  npx playwright install chromium — or set CN_CHROME to a browser binary');
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(0);
}

for(const s of chosen){
  console.log('\n' + s.name);
  ran++;
  try { await s.fn(browser); }
  catch (e) { fails++; console.log('  FAIL ' + s.name + ' threw: ' + (e && e.message)); }
}
await browser.close();
fs.rmSync(TMP, { recursive: true, force: true });

console.log('\n' + ran + ' scenario(s) — ' + (fails ? fails + ' FAILED' : 'ALL PASS'));
process.exit(fails ? 1 : 0);
