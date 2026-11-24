#!/bin/bash
# コード譜ノートのテストを全部流し、前回の正解と比べて合否を出す。
#
#   ./tests/run-all.sh                 … 全部
#   ./tests/run-all.sh tcapo tkey      … 名前に含む文字列で絞る
#   ./tests/run-all.sh --accept        … いまの出力を「正解」として保存し直す
#   ./tests/run-all.sh --accept tcapo  … 絞って保存し直す
#
# 正解は tests/golden/<名前>.txt に入っていて、git で管理している。
# **出力が1文字でも変われば NG になる。** 歌詞が1行消える、キーが1つずれる、
# といった「落ちないけれど中身が違う」間違いを、ここで止める。
#
# 意図した変更で差分が出たときは、画面に出る差分を読んで、それが望んだ変化で
# あることを確かめてから --accept で正解を更新する。**中身を見ずに --accept を
# 打つと、間違った出力が新しい正解になり、この仕組みが死ぬ。**
# 更新した差分は git のコミットに残るので、後から何が変わったか追える。
#
# 終了コード: 1つでも NG なら 1。

cd "$(dirname "$0")"
ROOT="$(cd .. && pwd)"
LOG=.log
GOLD=golden
mkdir -p "$LOG" "$GOLD"

ACCEPT=
PICK=()
for a in "$@"; do
  case "$a" in
    --accept) ACCEPT=1;;
    -h|--help) sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    *) PICK+=("$a");;
  esac
done

if ! node -e "require('playwright')" 2>/dev/null; then
  echo "playwright が見つかりません。次を実行してから再試行してください："
  echo "  npm install -g playwright && npx playwright install chromium"
  exit 2
fi

# tplays.js と tstor.js は http:// でアプリを開くので、リポジトリのルートを配る
PORT=8899
SERVED=
if ! curl -s -o /dev/null "http://localhost:$PORT/index.html" 2>/dev/null; then
  (cd "$ROOT" && python3 -m http.server $PORT >/dev/null 2>&1 &)
  SERVED=1
  for i in $(seq 1 20); do
    curl -s -o /dev/null "http://localhost:$PORT/index.html" 2>/dev/null && break
    sleep 0.3
  done
fi
cleanup(){ [ -n "$SERVED" ] && pkill -f "http.server $PORT" 2>/dev/null; }
trap cleanup EXIT

match(){ [ ${#PICK[@]} -eq 0 ] && return 0; for p in "${PICK[@]}"; do case "$1" in *"$p"*) return 0;; esac; done; return 1; }

# 自分でも合否を出すテストは先に流す
SELF="rules.js tplays.js"
ALL=""
for f in $SELF; do [ -f "$f" ] && match "$f" && ALL="$ALL $f"; done
for f in $(ls *.js 2>/dev/null | grep -v '^_' | sort); do
  case " $SELF " in *" $f "*) continue;; esac
  match "$f" && ALL="$ALL $f"
done
[ -z "$ALL" ] && { echo "流すテストがありません"; exit 2; }

ng=0; ok=0; new=0; upd=0; n=0
NGLIST=""
printf "%-16s %5s  %-10s %s\n" "テスト" "秒" "判定" "備考"
printf "%s\n" "------------------------------------------------------------------"
for f in $ALL; do
  n=$((n+1)); name="${f%.js}"
  s=$(date +%s)
  out=$(timeout 300 node "$f" 2>&1); code=$?
  e=$(( $(date +%s) - s ))
  printf '%s\n' "$out" > "$LOG/$name.txt"
  printf '%s\n' "$out" | python3 _normalize.py > "$LOG/$name.norm"

  v=""; note=""
  if [ $code -eq 124 ]; then v="NG"; note="時間切れ（300秒）"
  elif [ $code -ne 0 ]; then v="NG"; note="落ちた（終了コード $code）"
  elif grep -qE "PAGEERROR|ReferenceError|TypeError:|is not a function" "$LOG/$name.txt"; then
    v="NG"; note="ページ内エラー"
  fi

  if [ -z "$v" ]; then
    if [ ! -f "$GOLD/$name.txt" ]; then
      if [ -n "$ACCEPT" ]; then cp "$LOG/$name.norm" "$GOLD/$name.txt"; v="正解を作成"; new=$((new+1))
      else v="正解なし"; note="--accept で保存してください"; ng=$((ng+1)); NGLIST="$NGLIST $name"; fi
    elif diff -q "$GOLD/$name.txt" "$LOG/$name.norm" >/dev/null; then
      v="OK"; ok=$((ok+1))
    else
      d=$(diff "$GOLD/$name.txt" "$LOG/$name.norm" | grep -c '^[<>]')
      if [ -n "$ACCEPT" ]; then cp "$LOG/$name.norm" "$GOLD/$name.txt"; v="正解を更新"; note="$d 行"; upd=$((upd+1))
      else v="NG"; note="出力が変わった（$d 行）"; fi
    fi
  fi
  case "$v" in NG) ng=$((ng+1)); NGLIST="$NGLIST $name";; esac
  printf "%-16s %5s  %-10s %s\n" "$f" "$e" "$v" "$note"
done

printf "%s\n" "------------------------------------------------------------------"
if [ -n "$ACCEPT" ]; then
  echo "$n 本 … 正解を作成 $new / 更新 $upd / 変化なし $ok / NG $ng"
  [ $((new+upd)) -gt 0 ] && echo "git diff tests/golden で、何が変わったか確かめてからコミットしてください。"
else
  echo "$n 本 … OK $ok / NG $ng"
fi

if [ $ng -gt 0 ]; then
  for name in $NGLIST; do
    echo; echo "=== $name ==="
    if [ -f "$GOLD/$name.txt" ] && [ -f "$LOG/$name.norm" ]; then
      diff "$GOLD/$name.txt" "$LOG/$name.norm" | head -40
      echo "（< が正解、> がいまの出力。全部は $LOG/$name.txt）"
    else
      tail -20 "$LOG/$name.txt"
    fi
  done
  exit 1
fi
[ -z "$ACCEPT" ] && echo "すべて前回の正解と同じでした。"
exit 0
