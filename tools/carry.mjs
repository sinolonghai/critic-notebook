#!/usr/bin/env node
/* Build a copy of the page with documents already in it.
 *
 *   node tools/carry.mjs abstract.md                  # → abstract.review.html
 *   node tools/carry.mjs ch1.md ch2.md -o review.html # several, first one in front
 *
 * The third way to put a document in front of someone, after a file picker and the host
 * protocol. It is for whoever can write a file or publish a page but cannot reach the
 * browser it will be read in: an assistant working in its own container, a chat app that
 * renders HTML in a canvas. The result is one self-contained file — open it, mail it, publish
 * it — that comes up showing the document rather than the tutorial.
 *
 * What it does is small enough to do by hand: append
 *
 *     <script type="text/markdown" data-name="abstract.md">…<\/script>
 *
 * to the page before </body>. The two things worth getting right are here so they are not
 * got wrong: the text is not indented (four spaces is a code block), and any closing script
 * tag inside the document is written with the slash escaped, or it would end the tag early.
 * The page turns that escape back on the way in.
 *
 * What it cannot do is save. A page opened from a file, or inside somebody's sandbox, has
 * nowhere to write: Save becomes Copy, and the marked-up text comes back by hand. To close
 * the loop, use tools/panel.mjs on the machine the browser is on.
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(HERE, '..', 'critic-notebook.html');

function usage(msg){
  if(msg) console.error('error: ' + msg + '\n');
  console.error([
    'usage: node tools/carry.mjs <file.md> [more.md …] [-o out.html]',
    '',
    'Writes a copy of critic-notebook.html with the documents inside it.',
    'The first file given is the one in front. Without -o, the output is',
    'named after the first file: abstract.md → abstract.review.html',
  ].join('\n'));
  process.exit(msg ? 1 : 0);
}

const argv = process.argv.slice(2);
if(!argv.length || argv[0] === '-h' || argv[0] === '--help') usage();

const files = [];
let out = null;
for(let i = 0; i < argv.length; i++){
  const a = argv[i];
  if(a === '-o' || a === '--out') out = argv[++i] || usage('-o needs a filename');
  else if(a.startsWith('-')) usage('unknown option ' + a);
  else files.push(a);
}
if(!files.length) usage('no file given');
if(!out) out = files[0].replace(/\.(md|markdown|mdown|txt)$/i, '') + '.review.html';

let page;
try { page = readFileSync(PAGE, 'utf8'); }
catch { usage('cannot read ' + PAGE + ' — run this from the repository it lives in'); }

const tags = files.map(f => {
  let text;
  try { text = readFileSync(f, 'utf8'); }
  catch(e){ usage('cannot read ' + f); }
  const name = path.basename(f);
  /* the one escape: a closing script tag in the document would end the tag it is written in */
  const safe = text.replace(/<\/script/gi, '<\\/script');
  return '<script type="text/markdown" data-name="' +
    name.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '">\n' +
    (safe.endsWith('\n') ? safe : safe + '\n') + '<\/script>\n';
}).join('');

const at = page.lastIndexOf('</body>');
if(at < 0) usage('the page has no </body> to insert before — is ' + PAGE + ' intact?');
writeFileSync(out, page.slice(0, at) + tags + page.slice(at));

console.log(out + ' — ' + files.length + ' document' + (files.length === 1 ? '' : 's') +
  ' carried: ' + files.map(f => path.basename(f)).join(', '));
console.log('Open it in a browser, or publish it. Saving there is a copy, not a file: ' +
  'use tools/panel.mjs when the loop has to close.');
