#!/bin/bash
# コード譜ノートのテストを全部流す。
#   ./tests/run-all.sh            … 全部
#   ./tests/run-all.sh tcapo tkey … 名前に含む文字列で絞る
# 各テストの出力は tests/.log/<名前>.txt に残る。
# 終了コード: 1つでも落ちたら 1。

cd "$(dirname "$0")"
ROOT="$(cd .. && pwd)"
LOG=.log
mkdir -p "$LOG"

if ! node -e "require('playwright')" 2>/dev/null; then
  echo "playwright が見つかりません。次を実行してから再試行してください："
  echo "  npm install -g playwright && npx playwright install chromium"
  exit 2
fi

# file:// では読めない場面があるテストのために、リポジトリのルートを 8899 で配る
PORT=8899
if ! curl -s -o /dev/null "http://localhost:$PORT/index.html" 2>/dev/null; then
  (cd "$ROOT" && python3 -m http.server $PORT >/dev/null 2>&1 &) 
  SERVED=1
  for i in $(seq 1 20); do
    curl -s -o /dev/null "http://localhost:$PORT/index.html" 2>/dev/null && break
    sleep 0.3
  done
fi

# 自分で合否を出すテスト（終了コードで判定できる）。先に流す
SELF="rules.js tplays.js"
PICK=("$@")
match(){ [ ${#PICK[@]} -eq 0 ] && return 0; for p in "${PICK[@]}"; do case "$1" in *"$p"*) return 0;; esac; done; return 1; }

ALL=""
for f in $SELF; do [ -f "$f" ] && match "$f" && ALL="$ALL $f"; done
for f in $(ls *.js | sort); do
  case " $SELF " in *" $f "*) continue;; esac
  [ "$f" = "run-all.sh" ] && continue
  match "$f" && ALL="$ALL $f"
done

ng=0; warn=0; ok=0; n=0
printf "%-18s %6s  %-8s %s\n" "テスト" "秒" "判定" "備考"
printf "%s\n" "----------------------------------------------------------------"
for f in $ALL; do
  n=$((n+1))
  s=$(date +%s)
  out=$(timeout 300 node "$f" 2>&1); code=$?
  e=$(( $(date +%s) - s ))
  echo "$out" > "$LOG/${f%.js}.txt"
  note=""
  if [ $code -eq 124 ]; then
    v="NG"; note="時間切れ（300秒）"
  elif [ $code -ne 0 ]; then
    v="NG"; note="終了コード $code"
  elif echo "$out" | grep -qE "PAGEERROR|ReferenceError|TypeError:|is not a function|Traceback"; then
    v="NG"; note="ページ内エラー"
  elif echo "$out" | grep -qE "★NG|失敗 [1-9]|^NG |NG  "; then
    v="NG"; note="判定が NG"
  elif case " $SELF " in *" $f "*) true;; *) false;; esac; then
    v="OK"
  else
    v="要確認"; note="合否を自分で出さないテスト（出力は $LOG/${f%.js}.txt）"
  fi
  case "$v" in NG) ng=$((ng+1));; OK) ok=$((ok+1));; *) warn=$((warn+1));; esac
  printf "%-18s %6s  %-8s %s\n" "$f" "$e" "$v" "$note"
done

printf "%s\n" "----------------------------------------------------------------"
echo "$n 本 … 自動判定OK $ok / 要確認 $warn / NG $ng"
[ -n "$SERVED" ] && pkill -f "http.server $PORT" 2>/dev/null
if [ $ng -gt 0 ]; then
  echo
  echo "落ちたテストの出力を見てください： $LOG/ の中"
  exit 1
fi
echo
echo "NG はありません。「要確認」は出力を読んで判断するつくりのテストです（$LOG/ に全部あります）。"
