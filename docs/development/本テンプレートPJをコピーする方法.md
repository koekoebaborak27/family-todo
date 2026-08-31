# 本テンプレートPJをコピーする方法

新しいプロジェクトを始めるときに、このテンプレート（`ai-dev-template`）から新しいリポジトリを作る手順。**「リポジトリをどう作るか」がこのファイルの範囲**で、コピー後の中身の書き換え（`AGENTS.md` のプレースホルダなど）は [`README.md`](../../README.md)「新規プロジェクトへのコピー方法」の 2 番以降を参照。

## どちらの方法を使うか

| | 方法A（推奨） | 方法B |
|---|---|---|
| 必要なもの | `gh`（GitHub CLI）がインストール・認証済み | ブラウザだけ |
| 履歴 | テンプレートの1コミットだけを引き継ぐ、きれいな新規履歴 | 手元で作り直すので、これもきれいな新規履歴 |
| 手数 | コマンド1〜2回 | ブラウザ操作＋コマンド数回 |
| 前提作業 | `ai-dev-template` を一度だけ「テンプレートリポジトリ」に設定する（下記） | 無し |

迷ったら**方法A**でよい。`gh` が使えない環境（他の人のPC、CI 等）では方法Bを使う。

---

## 方法A: GitHub の「テンプレートリポジトリ」機能を使う（推奨）

GitHub には、あるリポジトリを「テンプレート」に指定しておくと、そこから**コミット履歴を持たない新しいリポジトリ**をワンクリック（または1コマンド）で作れる機能がある。`ai-dev-template` はこの機能を使う前提で作ってある。

### 事前準備（最初の1回だけでよい）

`ai-dev-template` を「テンプレートリポジトリ」に設定する。GitHub 側の設定を1回変えるだけなので、以後どのプロジェクトを作るときも繰り返す必要はない。

```bash
gh repo edit koekoebaborak27/ai-dev-template --template
```

このコマンドは、GitHub の当該リポジトリの Settings にある「Template repository」というチェックボックスを ON にする。ON にすると、リポジトリのトップページに緑色の **「Use this template」** ボタンが現れ、`gh repo create` の `--template` オプションが使えるようになる。

**確認方法**: ブラウザで https://github.com/koekoebaborak27/ai-dev-template を開き、緑色の「Use this template」ボタンが表示されていれば設定できている。

### A-1. gh CLI を使う場合（最短）

新しいプロジェクトを作るたびに、次の**1コマンドだけ**でよい。

```bash
cd C:/work/code/kojin_learn
```

まず作業したい場所（新しいリポジトリのフォルダをこの直下に作る）へ移動する。

```bash
gh repo create koekoebaborak27/<新しいリポジトリ名> --private --template koekoebaborak27/ai-dev-template --clone
```

このコマンドが行うこと:

| 部分 | 意味 |
|---|---|
| `koekoebaborak27/<新しいリポジトリ名>` | GitHub 上に作る新しいリポジトリの場所。`<新しいリポジトリ名>` は例えば `family-todo` のように置き換える |
| `--private` | 非公開で作る。公開してよいなら `--public` に変える |
| `--template koekoebaborak27/ai-dev-template` | このリポジトリの中身をコピー元にする（`ai-dev-template` をテンプレート化済みであることが前提） |
| `--clone` | GitHub 上に作成した直後、カレントディレクトリ（`C:/work/code/kojin_learn`）の下に同名フォルダとしてそのままクローンする |

実行すると `C:/work/code/kojin_learn/<新しいリポジトリ名>/` が作られ、その中に `ai-dev-template` の最新コミットの中身がコピーされた**新規の1コミット**が入った状態になる。`git remote` も自動的に GitHub 側へ設定済みなので、`git remote add` は不要。

```bash
cd C:/work/code/kojin_learn/<新しいリポジトリ名>
```

```bash
git log --oneline -1 && git remote -v
```

コミットが1件だけあり、`origin` が新しいリポジトリの URL を指していれば成功。ここから [`README.md`](../../README.md) の「新規プロジェクトへのコピー方法」2番以降（プレースホルダの書き換え等）へ進む。

### A-2. gh CLI を使わない場合（ブラウザの「Use this template」ボタン）

`ai-dev-template` を「事前準備」の手順でテンプレート化してあれば、`gh` を使わなくてもブラウザだけで同じことができる。

1. ブラウザで https://github.com/koekoebaborak27/ai-dev-template を開く。
2. 緑色の **「Use this template」** ボタン → **「Create a new repository」** を選ぶ。
3. 案内画面で以下を入力する。

| 項目 | 入力・選択する内容 |
|---|---|
| Owner | `koekoebaborak27`（自分のアカウント） |
| Repository name | 新しいプロジェクトの名前（例: `family-todo`） |
| Description | 任意 |
| Public / Private | 公開してよいものだけ Public。迷ったら Private |
| Include all branches | チェックしない（`ai-dev-template` は `main` しか無いので不要） |

4. 緑色の **「Create repository」** ボタンを押す。これで GitHub 上に、テンプレートの中身を持つ新しい1コミットのリポジトリができる。
5. 作成後のページに表示される clone 用の URL（`git@github.com:koekoebaborak27/<新しいリポジトリ名>.git` または `https://github.com/koekoebaborak27/<新しいリポジトリ名>.git`）を控え、手元へ持ってくる。

```bash
cd C:/work/code/kojin_learn
```

```bash
git clone git@github.com:koekoebaborak27/<新しいリポジトリ名>.git
```

SSH 鍵を設定していない場合は、代わりに HTTPS の URL を使う。

```bash
git clone https://github.com/koekoebaborak27/<新しいリポジトリ名>.git
```

```bash
cd <新しいリポジトリ名>
```

以降は方法Aと同じく、[`README.md`](../../README.md) の 2 番以降へ進む。

---

## 方法B: テンプレートリポジトリ機能を使わない（完全手動）

`ai-dev-template` をテンプレート化したくない場合、または GitHub 以外の場所（社内 Git サーバー等）にプロジェクトを作りたい場合の方法。`git clone` で中身だけを持ってきて、履歴を作り直す。

### 1. テンプレートの中身だけを、履歴を持たずに手元へコピーする

`--depth 1` を付けて浅く（最新コミットだけ）clone し、あとで `.git` ごと消すことで、`ai-dev-template` 側のコミット履歴を引き継がないようにする。

```bash
cd C:/work/code/kojin_learn
```

```bash
git clone --depth 1 https://github.com/koekoebaborak27/ai-dev-template.git <新しいリポジトリ名>
```

```bash
cd <新しいリポジトリ名>
```

### 2. テンプレート側の Git 履歴を切り離す

```bash
rm -rf .git
```

`.git` フォルダを消すと、そのフォルダは「ただのファイルの集まり」に戻る（`ai-dev-template` への参照が一切無くなる）。

```bash
git init
```

このフォルダを新しい Git リポジトリとして初期化する。

### 3. GitHub 上に空のリポジトリを作る

ブラウザで https://github.com/new を開き、次のとおり入力する。

| 項目 | 入力・選択する内容 |
|---|---|
| Owner | `koekoebaborak27` |
| Repository name | `<新しいリポジトリ名>`（手順1で使ったものと同じにする） |
| Public / Private | 用途に応じて選ぶ |
| Initialize this repository with | **すべてチェックを外す**（README・.gitignore・license のいずれも追加しない） |

**「Initialize this repository with」を1つでもチェックすると、あとの push が衝突するので必ず外す。**

「Create repository」を押す。

### 4. コミットして push する

```bash
git add -A
```

```bash
git commit -m "chore: ai-dev-templateから新規プロジェクトを作成する"
```

```bash
git branch -M main
```

このフォルダの既定ブランチ名を `main` に揃える（`git init` 直後のブランチ名は環境によって `master` になることがあるため）。

```bash
git remote add origin https://github.com/koekoebaborak27/<新しいリポジトリ名>.git
```

SSH を使う場合はこちら。

```bash
git remote add origin git@github.com:koekoebaborak27/<新しいリポジトリ名>.git
```

```bash
git push -u origin main
```

### 5. 反映されたか確認する

```bash
git log --oneline -1 --decorate
```

`(HEAD -> main, origin/main)` と表示されれば成功。以降は [`README.md`](../../README.md) の 2 番以降へ進む。
