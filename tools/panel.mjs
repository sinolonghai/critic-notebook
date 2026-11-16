#!/usr/bin/env node
/* Open a markdown file for review in a browser, and write back what comes out.
 *
 *   node tools/panel.mjs notes.md            # review it, save writes the file
 *   node tools/panel.mjs notes.md --once     # close after the first save
 *   node tools/panel.mjs notes.md --no-open  # print the URL instead of opening it
 *
 * This exists because a browser page cannot be handed a path. `showOpenFilePicker` wants a
 * human gesture and will not take a string, so a tool that wants to put a particular file in
 * front of you has to hand over the text instead — which is what the page's host protocol is
 * for. This is that protocol's second host, and the first one meant for daily use.
 *
 * It serves rather than writing a file to /tmp, for two reasons. A page served from localhost
 * is a trusted origin, so everything in the editor works the way it does from a folder; and
 * saving has somewhere to go, so the loop closes here instead of ending in a textarea you
 * copy out of by hand. The server is bound to 127.0.0.1, holds a random token that every
 * request must carry, and lives only as long as you are reviewing: Ctrl-C, or --once.
 *
 * The one thing it will not do is write a file it was not pointed at. The path is fixed when
 * the process starts and nothing the page says can change it.
 */
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { randomBytes } from 'crypto';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(HERE, '..', 'critic-notebook.html');

function usage(msg){
  if(msg) console.error('error: ' + msg + '\n');
  console.error([
    'usage: node tools/panel.mjs <file.md> [--once] [--no-open] [--port N]',
    '',
    'Opens the file for review in a browser. Saving in the page writes the file.',
    '',
    '  --once      stop after the first save',
    '  --no-open   print the URL rather than opening a browser',
    '  --port N    listen on this port instead of one the system picks',
  ].join('\n'));
  process.exit(msg ? 1 : 0);
}

const argv = process.argv.slice(2);
if(!argv.length || argv[0] === '-h' || argv[0] === '--help') usage();

let file = null, once = false, noOpen = false, port = 0;
for(let i = 0; i < argv.length; i++){
  const a = argv[i];
  if(a === '--once') once = true;
  else if(a === '--no-open') noOpen = true;
  else if(a === '--port') port = Number(argv[++i]) || usage('--port needs a number');
  else if(a.startsWith('-')) usage('unknown option ' + a);
  else if(file === null) file = a;
  else usage('one file at a time');
}
if(!file) usage('no file given');

const target = path.resolve(file);
if(!existsSync(target) || !statSync(target).isFile()) usage(target + ' is not a file');
if(!existsSync(PAGE)) usage('cannot find critic-notebook.html beside tools/ — run this from the repo');

const token = randomBytes(16).toString('hex');
const name = path.basename(target);

/* The page is read once at startup and the document each time the browser asks, so a reload
   picks up a file that changed underneath — the same thing the editor's own stale check is
   there to notice. */
const pageHtml = readFileSync(PAGE, 'utf8');

/* The host. Everything it knows about the document arrives from this server; everything the
   reviewer decides goes back the same way. It is deliberately small: anything clever here is
   a second place for the protocol to be wrong. */
const host = (text) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(name)} — review</title>
<style>
  html,body{margin:0;height:100%;background:#eef1f5}
  iframe{width:100%;height:100%;border:0;display:block}
  #bar{position:fixed;left:0;right:0;bottom:0;z-index:9;display:none;
    font:13px/1.5 system-ui,sans-serif;padding:7px 12px;background:#1f2937;color:#fff}
  #bar.on{display:block}
</style></head><body>
<iframe id="f" src="/critic-notebook.html?t=${token}"></iframe>
<div id="bar"></div>
<script>
var page = document.getElementById('f').contentWindow;
var bar = document.getElementById('bar');
var dirty = false, open = 0;
function say(m){ bar.textContent = m; bar.className = 'on'; setTimeout(function(){ bar.className = ''; }, 4000); }
addEventListener('message', function(ev){
  if(ev.source !== page) return;
  var m = ev.data;
  if(!m || typeof m !== 'object') return;
  if(m.type === 'ready'){
    page.postMessage({ type: 'open', name: ${JSON.stringify(name)}, text: ${JSON.stringify(text)} }, '*');
    return;
  }
  if(m.type === 'dirty'){ dirty = !!m.dirty; open = m.open || 0; return; }
  if(m.type === 'save'){
    fetch('/save?t=${token}', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: m.text })
      .then(function(r){ return r.text(); })
      .then(function(t){ dirty = false; say(t); })
      .catch(function(e){ say('could not write the file: ' + e); });
  }
});
/* The page's own guard cannot fire for a frame its host tears down, which is why it reports
   dirty at all — so the warning has to live out here. */
addEventListener('beforeunload', function(ev){
  if(!dirty) return;
  ev.preventDefault(); ev.returnValue = '';
});
</script>
</body></html>`;

function esc(s){
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let saves = 0;
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const send = (code, type, body) => {
    res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(body);
  };
  /* Any other page in this browser can reach a localhost port. The token is what stops one
     of them writing to a file it has no business knowing about. */
  if(url.searchParams.get('t') !== token) return send(403, 'text/plain', 'no');

  if(req.method === 'GET' && url.pathname === '/')
    return send(200, 'text/html; charset=utf-8', host(readFileSync(target, 'utf8')));

  if(req.method === 'GET' && url.pathname === '/critic-notebook.html')
    return send(200, 'text/html; charset=utf-8', pageHtml);

  if(req.method === 'POST' && url.pathname === '/save'){
    let body = '';
    req.setEncoding('utf8');
    req.on('data', c => { body += c; });
    req.on('end', () => {
      try{
        writeFileSync(target, body);
        saves++;
        const open = (body.match(/\{(\+\+|--|~~)/g) || []).length;
        console.log(`wrote ${target}` + (open ? ` — ${open} suggestion${open === 1 ? '' : 's'} still in it` : ' — all decided'));
        send(200, 'text/plain', 'saved to ' + name + (once ? ' — you can close this tab' : ''));
        if(once) setTimeout(() => { server.close(); process.exit(0); }, 250);
      }catch(e){
        console.error('could not write ' + target + ': ' + e.message);
        send(500, 'text/plain', String(e.message));
      }
    });
    return;
  }
  send(404, 'text/plain', 'no');
});

server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/?t=${token}`;
  console.log(`reviewing ${target}`);
  console.log(url);
  console.log(once ? 'saving once writes the file and stops.' : 'saving writes the file. Ctrl-C when done.');
  if(noOpen) return;
  const cmd = process.platform === 'darwin' ? 'open'
            : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try{ spawn(cmd, args, { stdio: 'ignore', detached: true }).unref(); }
  catch{ console.log('(open it yourself — could not launch a browser)'); }
});

process.on('SIGINT', () => {
  console.log(saves ? `\n${saves} save${saves === 1 ? '' : 's'}.` : '\nnothing was written.');
  process.exit(0);
});
