#!/bin/bash
# コード譜ノートを GitHub Pages に置く。版は V+年月日+時（例 V261124-18）。
# 同じ時間に2回置くときは b, c … を足して見分けられるようにする。
#
# 使い方: リポジトリの中で ./deploy.sh "何を直したか"
# このスクリプトはリポジトリ自身の index.html を書き換えて push する。
# どのチャットでも、clone してきてそのまま使える。
set -e
cd "$(dirname "$0")"
REPO="$(pwd)"
MSG="${1:-譜面アプリの更新}"

[ -f index.html ] || { echo "index.html が見つかりません。リポジトリの中で実行してください"; exit 1; }

BASE="V$(TZ=Asia/Tokyo date +%y%m%d-%H)"
CUR=$(grep -o "const APP_BUILD = '[^']*'" index.html | sed "s/.*'\(.*\)'/\1/")
VER="$BASE"
if [ "$CUR" = "$BASE" ]; then VER="${BASE}b"
elif [[ "$CUR" == ${BASE}* ]]; then
  L=${CUR#$BASE}
  VER="${BASE}$(echo "$L" | tr 'a-y' 'b-z')"
fi

python3 - index.html "$VER" <<'ENDPY'
import re,sys
p,ver=sys.argv[1],sys.argv[2]
s=open(p,encoding='utf-8').read()
s2=re.sub(r"const APP_BUILD = '[^']*'", "const APP_BUILD = '"+ver+"'", s, count=1)
assert s2!=s or ver in s, '版の書き換えに失敗'
open(p,'w',encoding='utf-8').write(s2)
ENDPY

if git diff --quiet && git diff --cached --quiet; then echo "変更なし（$VER）"; exit 0; fi
git add -A
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -q -m "$MSG ($VER)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016BA84yJfKTy8pc7XiSe8yK"
git push -q origin main
echo "置きました: $VER"
git log --oneline -1
