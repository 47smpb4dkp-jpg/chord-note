# テスト

コード譜ノートのテスト 40 本。**本物の `index.html` をブラウザで開いて、中の関数を直接呼ぶ**つくり。モックは使っていない（Firebase とドライブの通信だけ、テスト側で差し替える）。

## 流し方

```bash
./tests/run-all.sh              # 全部（5分ほどかかる）
./tests/run-all.sh tcapo tkey   # 名前に含む文字列で絞る
node tests/rules.js             # 1本だけ（3秒）
```

必要なもの：`node` と `playwright`。入っていなければ run-all.sh が入れ方を教えてくれる。

**`tplays.js` と `tstor.js` の2本は HTTP サーバーが必要**（`localhost:8899`）。`run-all.sh` が
自動で立てて片付けるので、全部流すときは何もしなくてよい。この2本だけ単体で流すときは、先に
リポジトリのルートで `python3 -m http.server 8899 &` を動かしておく。立てずに流すと
`ERR_CONNECTION_REFUSED` で落ちる（残り38本は `file://` で開くので不要）。
各テストの出力は `tests/.log/<名前>.txt` に残る（git には入れない）。

## 直したあとに必ず流すもの

```bash
node tests/rules.js
```

**機能どうしの干渉チェック 57 項目（A〜M）。3秒で終わる。** 何を直してもこれは流す。
デプロイの前に `./tests/run-all.sh` で全部流す。

## 2種類ある

| | 本数 | 判定 |
|---|---|---|
| **自分で合否を出す** | 2本（`rules.js` `tplays.js`） | 終了コードで分かる。run-all.sh が OK / NG と表示する |
| **出力を読んで判断する** | 38本 | run-all.sh は「要確認」と表示する。**落ちていないことしか分からない** |

38本は値を並べて表示するつくりで、人（または Claude）が読んで正しいか判断する。
run-all.sh が拾えるのは**クラッシュ・ページ内エラー・時間切れ**だけ。
中身が静かに間違っている場合は、`tests/.log/` の出力を読む必要がある。

→ 将来この38本も自分で合否を出す形に直せば、全部が自動判定になる。未着手。

## 何を見ているか

| テスト | 見ているもの |
|---|---|
| `rules.js` | **機能どうしの干渉 57項目（A〜M）**。鳴る音の不変・原曲キーの独立・譜面の音の切替・合わせ込み・自動で直す・♯♭・整理の冪等性・スクロールとBPMの独立・undefined・ドライブ差分・移調・開いた回数・スクロール中に触っても止まらない |
| `tplays.js` | 「よく使う」の回数が同期や再読み込みで消えないか |
| `tcapo` `tcapo2` `tkey2` `tretune` `tflat` `tsame` `tsound` | キー・カポ・移調・♯♭ |
| `ttidy` `ttidy2` `ttidy3` `ttidyline` `tmerge` | 読み込み済みの曲の整理（冪等性・取り込み・行の扱い） |
| `talign` `talign2` `thdr2` `tlook` `tflow` `tpop` `tmenu` `thelp` `tswipe` `tset` | 画面の見た目・配置・操作 |
| `tdrive` `tdrive2` `tdrive3` `tsync` `tundef` `tstor` | ドライブへの書き出し・端末間同期・容量 |
| `tmetro` `tvid` `tsound` `tvision` `tshot` `tshot2` | メトロノーム・動画・音源・文字起こし・画面写真 |
| `tnew` `tmemo` `audit` `pure` `pure2` | 新規登録・メモ行・通し点検・計算だけのテスト（ブラウザを使わない） |

## 書き足すとき

1. **機能を足したら `rules.js` に検証を足す。** 干渉はここで止める
2. 新しいテストは `tests/` に `t〇〇.js` で置く。`run-all.sh` が勝手に拾う
3. アプリは `__dirname + '/../index.html'` で開く（リポジトリのルートにある）
4. 通信が必要なら `http://localhost:8899/index.html`（run-all.sh がサーバーを立てる）
5. **できれば終了コードで合否を出す**（`process.exit(落ちた件数 ? 1 : 0)`）。そうすれば run-all.sh が自動で判定できる
