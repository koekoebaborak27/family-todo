# 図（mermaid）の作成・更新手順

ドキュメントに埋め込む構成図・フロー図は **mermaid を別ファイル（`.mmd`）で管理し、SVG に変換して `.md` から画像参照する**。`.md` に mermaid ブロックを直接埋め込まない。

> 理由: ブラウザネイティブの mermaid 描画は環境差（フォント・バージョン）で**日本語が文字切れ**しやすい。`.mmd` を固定の Docker イメージで SVG 化すれば、誰のパソコン（Windows / Mac / Linux / CI）で変換しても同じ図になり、差分レビューも `.mmd` で追える。

## 1. 命名規約

同じドキュメントに複数の図が載ることを想定し、**図番号**で対応付ける。

```
<ドキュメント名>.md          ← 正本（図は画像参照）
<ドキュメント名>.<図番号>.mmd ← 図のソース（mermaid）
<ドキュメント名>.<図番号>.svg ← .mmd から生成した画像（コミット対象）
```

- 図番号は **2 桁ゼロ埋め**（`01`, `02`, …）。同一ドキュメント内で図ごとに採番する。
- 例（`docs/specs/02_basic-design/`）:
  ```
  画面遷移図.md
  画面遷移図.01.mmd
  画面遷移図.01.svg
  ```
- `.mmd` と `.svg` は**同じディレクトリ**に置く（`.md` からの相対参照を単純に保つ）。
- `.svg` は生成物だが**コミットする**（GitHub 等で `.md` を開いたとき図が表示されるため）。`.mmd` を変更したら必ず `.svg` を再生成して一緒にコミットする。

## 2. 前提ツール

- **Docker Desktop**。`docker --version` で使えるか確認できる。図を書かないなら不要。
- 変換には **mermaid-cli の公式 Docker イメージ**（`minlag/mermaid-cli`）を使う。`npm install -g` によるローカルインストールは不要。
  - このイメージには**日本語フォント（Noto Sans CJK JP）が同梱済み**なので、Windows / Mac / Linux / CI のどれで実行しても同じ見た目になる。OS ごとのフォント導入は不要。
  - **タグ（バージョン）を固定して使う**（`:latest` は使わない）。バージョンが変わると描画エンジンごとレイアウトが微妙に変わり、`.mmd` が同じでも `.svg` の見た目がズレることがあるため。現在の固定バージョンは `11.12.0`。上げる場合は [Docker Hub のタグ一覧](https://hub.docker.com/r/minlag/mermaid-cli/tags)で安定版（ベータでないもの）を確認して置き換える。
  - `--no-sandbox` 等の puppeteer 設定はこのイメージの中に既定で組み込まれているため、自前で設定ファイルを用意する必要はない。

## 3. `.mmd` テンプレート

**先頭に init ディレクティブを必ず入れる**。これがないと描画フォントと計測フォントが食い違い、ボックス幅が足りず文字が切れる。

```
%%{init: {'theme':'default','themeVariables':{'fontFamily':"'Noto Sans CJK JP', sans-serif"},'flowchart':{'nodeSpacing':50,'rankSpacing':85,'padding':12}}}%%
flowchart TB
  %% ここに図の定義
```

- `fontFamily` … mermaid のテキスト幅計測を実フォントに合わせ、**文字切れを防ぐ**最重要設定。Docker イメージに `Noto Sans CJK JP` が同梱されているため、これを固定で指定すればよい（OS ごとのフォールバックチェーンは不要）: `'Noto Sans CJK JP', sans-serif`
- `nodeSpacing` / `rankSpacing` … ノード/段の間隔。**エッジラベルがノードに重なる**ときは `rankSpacing` を広げる（80〜100 程度）。
- 設定を `.mmd` に内包しておくことで、変換時に追加オプション（`-c`）が不要になり再現性が高い。

## 4. 新しい図を追加する

1. `<doc>.<NN>.mmd` を作成（§3 のテンプレートから）。
2. SVG に変換（§6）。
3. `<doc>.md` の該当箇所に画像参照と再生成メモを書く:
   ```markdown
   ![図のタイトル](./<doc>.<NN>.svg)

   > 図のソースは [`<doc>.<NN>.mmd`](./<doc>.<NN>.mmd)（mermaid）。編集後は次で再生成する（プロジェクトのルートフォルダで実行。要 Docker Desktop 起動）:
   >
   > ```powershell
   > docker run --rm -v ${PWD}:/data minlag/mermaid-cli:11.12.0 -i docs/<doc>.<NN>.mmd -o docs/<doc>.<NN>.svg
   > ```
   ```
4. `.mmd` / `.svg` / `.md` を一緒にコミット。

## 5. 既存の図を更新する

1. `<doc>.<NN>.mmd` を編集。
2. 同名で `.svg` を再生成（§6）。**`.svg` を手で編集しない**（次回再生成で消える）。
3. `.mmd` と `.svg` をセットでコミット。

## 6. 変換コマンド

`.mmd` → `.svg`（1 ファイル）。**リポジトリ直下**で実行する。出力名を `.<NN>.svg` に合わせる:

```powershell
docker run --rm -v ${PWD}:/data minlag/mermaid-cli:11.12.0 -i docs/specs/02_basic-design/画面遷移図.01.mmd -o docs/specs/02_basic-design/画面遷移図.01.svg
```

- `-v ${PWD}:/data` … 今いるフォルダ（プロジェクト直下）をコンテナの `/data` として見せる。`-i` / `-o` のパスはプロジェクト直下からの相対パスで指定する。
- macOS / Linux（bash/zsh）では `${PWD}` の代わりに `$(pwd)` を使う。
- 初回はイメージのダウンロードで数十秒〜数分かかるが、2 回目以降はローカルにキャッシュされるため速い。

### 仕上がり確認（任意）

SVG は端末で直接見られないため、確認したいときは PNG を一時出力して目視する（PNG はコミットしない）:

```powershell
docker run --rm -v ${PWD}:/data minlag/mermaid-cli:11.12.0 -i docs/specs/02_basic-design/画面遷移図.01.mmd -o docs/preview.png -e png -s 2 -b white
```

## 7. レイアウト崩れの対処

| 症状 | 対処 |
|---|---|
| 日本語が切れる / はみ出す | `.mmd` 先頭の init ディレクティブで `fontFamily` に `'Noto Sans CJK JP'` を指定しているか確認（§3） |
| エッジラベルがノードに重なる | `rankSpacing` を広げる。関連ノードを `subgraph` でグルーピングして段を分けると交差が減る |
| `docker: command not found` / 接続エラー | Docker Desktop が起動しているか確認する |
| `-i`/`-o` で指定したファイルが見つからない | プロジェクトのルートフォルダで実行しているか、パスが `docs/xxx.mmd` のようにルートからの相対パスになっているか確認する |
| Git Bash（MSYS）でコンテナの中が空に見える／`-i` で指定したファイルが見つからない（PowerShell では起きない） | Git Bash は `-v ${PWD}:/data` のようなパスを Windows 形式へ自動変換し、`-v` の対象を壊すことがある。`docker run` の前に `MSYS_NO_PATHCONV=1` を付けて実行する（例: `MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd)":/data minlag/mermaid-cli:11.12.0 -i docs/xxx.mmd -o docs/xxx.svg`） |
