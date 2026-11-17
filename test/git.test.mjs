/* The page reads git repositories on its own, without git, so the only honest test is to ask
 * git. Every object in a repository is read twice — once by the page's reader, once by
 * `git cat-file` — and the two are compared byte for byte; then the history of every file is
 * compared with what `git log --first-parent` says it is.
 *
 *   node test/git.test.mjs                 # this repository
 *   node test/git.test.mjs path/to/repo    # any other, as many as given
 *
 * A reader that only understood loose objects would pass on a fresh clone and go blind the
 * first time git packed it, which it does by itself. So point this at repositories in every
 * state a real one is found in: loose, packed, both at once, deltas named by offset and by
 * hash, and chains of them dozens deep. `--fixtures` builds four such repositories in a temp
 * directory and runs against all of them.
 *
 * Needs git on the path; skips with a note and exits 0 if there is none, or if the target is
 * not a repository.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const PAGE = path.join(ROOT, 'critic-notebook.html');

function git(dir, args, opts = {}){
  return execFileSync('git', ['-C', dir, ...args], { maxBuffer: 1 << 28, ...opts });
}
try { execFileSync('git', ['--version'], { stdio: 'ignore' }); }
catch { console.log('git is not installed, so the git reader was not checked.'); process.exit(0); }

/* ---------------------------------------------------------------- the page */

let code = fs.readFileSync(PAGE, 'utf8').match(/<script>\n([\s\S]*)<\/script>/)[1];
const at = code.lastIndexOf('})();');
if(at < 0) throw new Error('could not find the page script IIFE close');
code = code.slice(0, at) + 'globalThis.__g={gitRepo,applyDelta,gitInflate};\n' + code.slice(at);
const el = () => ({value:'',textContent:'',innerHTML:'',disabled:false,hidden:false,style:{},dataset:{},
  classList:{add(){},remove(){},toggle(){},contains:()=>false},addEventListener(){},
  querySelector:()=>null,querySelectorAll:()=>[],setAttribute(){},getAttribute:()=>null,
  firstChild:null,contains:()=>false,closest:()=>null,focus(){},select(){},remove(){},
  appendChild(){},scrollHeight:62,title:''});
const cache = {};
const realURL = URL, realBlob = Blob;
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
global.URL = realURL; global.Blob = realBlob;
const G = globalThis.__g;
if(!G) throw new Error('export hook did not land — the page script changed shape');

/* The four questions the reader asks of a .git directory, answered from disk. */
function diskIO(gitDir){
  const full = p => path.join(gitDir, ...p.split('/'));
  return {
    read: p => fs.promises.readFile(full(p)).then(b => new Uint8Array(b)).catch(() => null),
    slice: async (p, a, b) => {
      const fh = await fs.promises.open(full(p), 'r');
      try { const buf = Buffer.alloc(b - a); await fh.read(buf, 0, b - a, a); return new Uint8Array(buf); }
      finally { await fh.close(); }
    },
    size: p => fs.promises.stat(full(p)).then(s => s.size).catch(() => null),
    list: p => fs.promises.readdir(full(p)).catch(() => null)
  };
}

/* ------------------------------------------------------------------ checks */

let fails = 0;
const ok = (c, m) => { if(!c) fails++; console.log((c ? '  ok   ' : '  FAIL ') + m); };

async function check(repo){
  const gitDir = path.join(repo, '.git');
  if(!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()){
    console.log(repo + ': not a repository with a .git directory, skipped');
    return;
  }
  const counts = git(repo, ['count-objects', '-v']).toString();
  const loose = +/^count: (\d+)/m.exec(counts)[1], packed = +/^in-pack: (\d+)/m.exec(counts)[1];
  console.log('\n' + path.basename(repo) + ' — ' + loose + ' loose, ' + packed + ' packed');

  const R = G.gitRepo(diskIO(gitDir));

  /* every object, both ways */
  const all = git(repo, ['cat-file', '--batch-all-objects', '--batch-check=%(objectname) %(objecttype)'])
    .toString().trim().split('\n').filter(Boolean).map(l => l.split(' '));
  let same = 0, wrong = [];
  for(const [sha, type] of all){
    try {
      const o = await R.object(sha);
      const want = git(repo, ['cat-file', type, sha]);
      if(o.type === type && Buffer.compare(Buffer.from(o.data), want) === 0) same++;
      else wrong.push(sha.slice(0, 8) + ' (' + o.type + ' vs ' + type + ', ' + o.data.length + ' vs ' + want.length + ' bytes)');
    } catch(e){ wrong.push(sha.slice(0, 8) + ' threw: ' + e.message); }
  }
  ok(!wrong.length, 'all ' + all.length + ' objects read identically to git cat-file' +
     (wrong.length ? ' — ' + wrong.length + ' differ: ' + wrong.slice(0, 4).join('; ') : ''));

  /* where HEAD points */
  const head = git(repo, ['rev-parse', 'HEAD']).toString().trim();
  ok((await R.head()) === head, 'HEAD resolves to ' + head.slice(0, 8));

  /* the history of every file git has ever seen on the first-parent line */
  const files = git(repo, ['log', '--first-parent', '--name-only', '--format=']).toString()
    .split('\n').filter(Boolean);
  const unique = [...new Set(files)];
  let histOk = 0, histBad = [];
  for(const f of unique){
    const want = git(repo, ['log', '--first-parent', '--format=%H', '--', f]).toString()
      .trim().split('\n').filter(Boolean)
      .filter(c => { try { git(repo, ['cat-file', '-e', c + ':' + f], { stdio: 'ignore' }); return true; } catch { return false; } });
    const got = (await R.history(f, 10000)).map(v => v.commit.sha);
    const blobsOk = await Promise.all((await R.history(f, 10000)).map(async v =>
      v.blob === git(repo, ['rev-parse', v.commit.sha + ':' + f]).toString().trim()));
    if(JSON.stringify(got) === JSON.stringify(want) && blobsOk.every(Boolean)) histOk++;
    else histBad.push(f + ' (' + got.length + ' vs ' + want.length + ')');
  }
  ok(!histBad.length, 'the history of all ' + unique.length + ' files matches git log --first-parent' +
     (histBad.length ? ' — differs for ' + histBad.slice(0, 4).join(', ') : ''));

  /* and the text a version holds */
  const hist = await R.history(unique[0], 3);
  if(hist.length){
    const t = await R.blobText(hist[hist.length - 1].blob);
    const want = git(repo, ['show', hist[hist.length - 1].commit.sha + ':' + unique[0]]).toString();
    ok(t === want, 'an older version of ' + unique[0] + ' reads as git show gives it');
  }
}

async function negative(){
  console.log('\nwhat it refuses');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cn-git-'));
  try {
    execFileSync('git', ['init', '-q', '--object-format=sha256', path.join(tmp, 'sha256')], { stdio: 'ignore' });
    const R = G.gitRepo(diskIO(path.join(tmp, 'sha256', '.git')));
    let msg = '';
    try { await R.head(); } catch(e){ msg = e.message; }
    ok(/SHA-256/.test(msg), 'a SHA-256 repository is refused by name — ' + JSON.stringify(msg));
  } catch { console.log('  (this git cannot make a SHA-256 repository; that check was skipped)'); }

  execFileSync('git', ['init', '-q', path.join(tmp, 'empty')], { stdio: 'ignore' });
  let msg = '';
  try { await G.gitRepo(diskIO(path.join(tmp, 'empty', '.git'))).history('x.md'); } catch(e){ msg = e.message; }
  ok(/no commits yet/.test(msg), 'an empty repository says so — ' + JSON.stringify(msg));

  /* a detached HEAD holds a commit name rather than a branch */
  const det = path.join(tmp, 'detached');
  execFileSync('bash', ['-c', `git init -q ${det} && cd ${det} && git config user.name t && ` +
    `git config user.email t@t && echo one > a.md && git add -A && git commit -qm one && ` +
    `echo two > a.md && git commit -qam two && git checkout -q --detach HEAD~1`]);
  const detHead = git(det, ['rev-parse', 'HEAD']).toString().trim();
  const DR = G.gitRepo(diskIO(path.join(det, '.git')));
  ok((await DR.head()) === detHead, 'a detached HEAD resolves to the commit it holds');
  ok((await DR.history('a.md')).length === 1, 'and history starts from there, not from the branch tip');

  /* a delta that does not fit its base is an error, never plausible wrong text */
  let threw = false;
  try { G.applyDelta(new Uint8Array(3), new Uint8Array([5, 2, 0x90, 2])); } catch { threw = true; }
  ok(threw, 'a delta applied to a base of the wrong size is refused');
  fs.rmSync(tmp, { recursive: true, force: true });
}

/* ------------------------------------------------------------------- run */

const args = process.argv.slice(2);
let targets = args.filter(a => !a.startsWith('--'));
let built = null;
if(args.includes('--fixtures')){
  built = fs.mkdtempSync(path.join(os.tmpdir(), 'cn-gitfix-'));
  const script = path.join(HERE, 'git-fixtures.sh');
  for(const m of ['loose', 'ofs', 'ref', 'mixed']){
    execFileSync('bash', [script, path.join(built, 'repo-' + m), m], { stdio: 'ignore' });
    targets.push(path.join(built, 'repo-' + m));
  }
}
if(!targets.length) targets = [ROOT];

for(const t of targets) await check(path.resolve(t));
await negative();
if(built) fs.rmSync(built, { recursive: true, force: true });

console.log(fails ? '\n' + fails + ' FAILED' : '\nALL PASS');
process.exit(fails ? 1 : 0);
