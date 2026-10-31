# コード譜ノート

弾き語り用のコード譜アプリ。iPad のホーム画面に置いて使う。

## このフォルダの中身

| ファイル | 役割 |
|---|---|
| `index.html` | アプリ本体。これ1つで全部動く |
| `manifest.json` | ホーム画面に置いたときの名前とアイコンの設定 |
| `sw.js` | オフラインでも開けるようにする仕組み |
| `icon-*.png` | アイコン |
| `start-local.ps1` | このパソコンで動かすための簡易サーバー |

## このパソコンで動かす

`start-local.ps1` を右クリック →「PowerShell で実行」。
ブラウザが自動で開く。終わるときはその黒い窓で Ctrl+C。

PowerShell から実行する場合:

```powershell
cd $HOME\apps\chord-note
.\start-local.ps1
```

実行がブロックされたら、一度だけこれを打つ:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## iPad で使う

ここが本番。**マイクを使うには HTTPS が必要**で、`http://192.168...` のような
LAN 経由では Safari がマイクをブロックする。そのため置き場所が要る。

### GitHub Pages に置く（無料・HTTPS付き）

1. github.com でアカウントを作る
2. 新しいリポジトリを作る（Public）
3. このフォルダの中身を全部アップロードする
4. Settings → Pages → Source を `main` ブランチにして保存
5. 数分後に `https://<ユーザー名>.github.io/<リポジトリ名>/` で開ける

### ホーム画面に追加する

iPad の Safari でそのURLを開き、共有ボタン →「ホーム画面に追加」。
これでアドレスバーの無い全画面で起動し、見た目はアプリと変わらない。

## 使い方

**フッターの4つのタブ**

- 楽曲リスト … 登録した曲。お気に入り / よく使う / フォルダで絞り込める
- プレイリスト … 演奏順。本番用のセットリスト
- 新規登録 … 曲を作る。音から / ファイルから の2通り
- コード … 押さえ方。ルート音と種類を選ぶ

**曲を作る3つの入口**

1. マイクで録音 → コード進行・キー・テンポを自動で解析
2. 音源ファイルを読み込む → 同じ解析をかける
3. コード譜ファイルを取り込む（.md / .txt / .docx、フォルダごと可）

**演奏中**

- コード名をタップ → 押さえ方が出る
- スライダーで BPM を変える → 自動スクロールの速さが変わる
- 左右に大きくスワイプ → プレイリストの前後の曲へ
- 上下にスワイプ → 手動で位置を調整（自動スクロールは一旦止まる）

## データの保存先

曲のデータはブラウザの中に保存される。**ブラウザの履歴やサイトデータを消すと
一緒に消えるので、大事な曲は「書き出し」でファイルに残しておくこと。**

- 曲ごと … 曲画面の「書き出し」→ `.md` ファイル
- フォルダごと … 楽曲リストのフォルダ見出しの「このフォルダを書き出す」→ `.zip`

書き出した `.md` は、そのまま読み込み直せる。

## 歌詞の文字起こし

別途入れた Faster-Whisper-XXL を使う。

```powershell
$ex = "$HOME\apps\Faster-Whisper-XXL_r245.4_windows\Faster-Whisper-XXL\faster-whisper-xxl.exe"
& $ex "音源.mp3" -l ja -m large-v2 -o . -pp -f all
```

出てきた `.srt` から歌詞だけ取り出す（文字コードの指定を忘れないこと）:

```powershell
$p = "曲名"
$lines = Get-Content "$p.srt" -Encoding UTF8 | Where-Object { $_ -notmatch '^\d+$' -and $_ -notmatch '-->' -and $_.Trim() -ne '' } | ForEach-Object { ($_ -replace [char]0x266A, '').Trim() }
[System.IO.File]::WriteAllLines("$p.txt", $lines, [System.Text.UTF8Encoding]::new($true))
```

## 作り直すとき・直すとき

`index.html` の中は上から順にこうなっている。

- 0章 … 音源の解析エンジン（FFT・クロマ・テンポ・キー・コード推定）
- 1章 … コード譜テキストの正規化とパーサー
- 2章 … 移調
- 3章 … コードダイアグラム
- 4章 … サンプル曲
- 5章以降 … 画面の描画と操作

一番壊しやすいのは**文字幅の計算**(`charWidth` / `colToPx`)。
日本語は半角の2文字分の幅があるので、コード位置を文字数で数えると歌詞とずれる。
canvas で実際の幅を測ってピクセル位置を出しているので、ここは触らないこと。
