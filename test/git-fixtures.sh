#!/bin/bash
# A repository built to hit every path in the reader: loose objects, a pack, deep delta
# chains, both delta encodings, a merge, packed refs, a deletion, a rename, a nested path.
set -e
R=$1; MODE=$2
rm -rf "$R"; mkdir -p "$R"; cd "$R"
git init -q -b main
git config user.name t; git config user.email t@t
export GIT_AUTHOR_DATE='2026-01-01T00:00:00Z' GIT_COMMITTER_DATE='2026-01-01T00:00:00Z'
mkdir -p docs/deep
python3 -c "print('# Notes\n'); [print(f'Line {i}: the quick brown fox jumps over the lazy dog, number {i}.') for i in range(240)]" > notes.md
printf 'A nested file.\n' > docs/deep/inner.md
git add -A; git commit -qm 'first'
# forty small edits to one file: long delta chains once packed
for i in $(seq 1 40); do
  # one line changed per commit, in a different place each time: each version is nearest
  # to its neighbours and far from the newest, which is what builds long delta chains
  sed -i "$((i * 5 + 2))s/.*/Line edited in commit $i, and only in commit $i./" notes.md
  [ $((i % 7)) = 0 ] && printf 'Inner edit %s.\n' $i >> docs/deep/inner.md
  git add -A; git commit -qm "edit $i"
done
# a branch and a merge, so first-parent matters
git checkout -qb side
printf 'Only on the side branch.\n' > side.md
printf '\nA line from the side branch.\n' >> notes.md
git add -A; git commit -qm 'side work'
git checkout -q main
printf '\nA line on main while the side branch was out.\n' >> docs/deep/inner.md
git add -A; git commit -qm 'main work'
git merge -q --no-ff side -m 'merge side'
# a file that goes away, and one that is renamed
printf 'Short-lived.\n' > gone.md; git add -A; git commit -qm 'add gone'
git rm -q gone.md; git commit -qm 'remove gone'
git mv side.md renamed.md; git commit -qm 'rename side'
case "$MODE" in
  ofs)   git repack -q -a -d -f --window=2 --depth=50 ;;
  ref)   git -c repack.useDeltaBaseOffset=false repack -q -a -d -f --window=2 --depth=50 ;;
  mixed) git gc -q
         for i in 1 2 3; do printf 'After the pack, %s.\n' $i >> notes.md; git commit -qam "loose $i"; done ;;
  loose) : ;;
esac
git pack-refs --all 2>/dev/null || true
echo "$R: $(git count-objects -v | tr '\n' ' ')"
