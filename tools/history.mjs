#!/usr/bin/env node
/* Write a file's past versions out as files, so the review tool can compare them.
 *
 *   node tools/history.mjs README.md          # last 10 versions
 *   node tools/history.mjs docs/spec.md 25    # last 25
 *   node tools/history.mjs --all              # every tracked .md, last 10 each
 *
 * Versions land in history/<name>/<date>-<sha>.md. That folder is gitignored, and the
 * review tool lists it like any other folder — open the Compare tab and pick one.
 *
 * Git stays in git's hands: the page has no business parsing packfiles.
 */
import { execFileSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import path from 'path';

const OUT = 'history';

function git(args){
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function usage(msg){
  if(msg) console.error('error: ' + msg + '\n');
  console.error([
    'usage: node tools/history.mjs <file.md> [count]',
    '       node tools/history.mjs --all [count]',
    '',
    `Writes each past version into ${OUT}/<name>/<date>-<sha>.md for the Compare tab.`,
  ].join('\n'));
  process.exit(msg ? 1 : 0);
}

const argv = process.argv.slice(2);
if(!argv.length || argv[0] === '-h' || argv[0] === '--help') usage();

try { git(['rev-parse', '--git-dir']); }
catch { usage('not inside a git repository'); }

const all = argv[0] === '--all';
const target = all ? null : argv[0];
const count = Math.max(1, parseInt(argv[all ? 1 : 1], 10) || 10);

let targets;
if(all){
  targets = git(['ls-files', '*.md', '*.markdown']).split('\n').filter(Boolean)
            .filter(f => !f.startsWith(OUT + '/'));
  if(!targets.length) usage('no tracked markdown files');
} else {
  const tracked = git(['ls-files', '--', target]).split('\n').filter(Boolean);
  if(!tracked.length) usage(`"${target}" is not tracked by git`);
  targets = tracked;
}

let wrote = 0, skipped = 0;
for(const file of targets){
  /* --follow so a rename does not cut the history short */
  const log = git(['log', '--follow', '-n', String(count), '--date=short',
                   '--format=%H%x09%ad%x09%s', '--', file])
              .split('\n').filter(Boolean);
  if(!log.length){ console.log(`${file}: no history`); continue; }

  const base = path.basename(file).replace(/\.(md|markdown)$/i, '');
  const dir = path.join(OUT, base);
  /* rebuild this file's folder so deleted commits do not linger */
  if(existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const seen = new Set();
  for(const line of log){
    const [sha, date, subject] = line.split('\t');
    let body;
    try { body = git(['show', `${sha}:${file}`]); }
    catch { skipped++; continue; }          /* the path did not exist at that commit */

    const name = `${date}-${sha.slice(0, 7)}.md`;
    let out = path.join(dir, name), n = 2;
    while(seen.has(out)) out = path.join(dir, `${date}-${sha.slice(0, 7)}-${n++}.md`);
    seen.add(out);

    /* a header so you can tell which version you are looking at inside the tool, and so a
       comparison's first block names the commit rather than repeating the document title */
    const header = `<!-- ${file} @ ${sha.slice(0, 7)} · ${date} · ${(subject || '').trim()} -->\n\n`;
    writeFileSync(out, header + body);
    wrote++;
  }
  console.log(`${file}: ${log.length} commit${log.length === 1 ? '' : 's'} -> ${dir}/`);
}

console.log(`\n${wrote} version${wrote === 1 ? '' : 's'} written to ${OUT}/` +
            (skipped ? ` (${skipped} commit${skipped === 1 ? '' : 's'} skipped: file absent)` : ''));
console.log('Open the folder in critic-notebook, switch to Compare, and pick a version.');
