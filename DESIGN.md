# DESIGN.md — デザインシステム正本

> このファイルは **React + Tailwind CSS + Shadcn/UI を採用する場合**のデザインの正本です。
> 画面を持たないプロジェクト（CLI・API・バッチ）や別の UI スタックを選ぶ場合は、このファイルを削除するか、選んだスタックの規約へ書き換えてください。
> その場合は `AGENTS.md`・`CLAUDE.md`・`.github/copilot-instructions.md`・`REVIEW.md` の参照も併せて直します。
> AGENTS.md / CLAUDE.md からは常時ロードせず、UI 作業時にオンデマンドで参照します。
> 全 AI ツール（Claude / Codex / Copilot）と人間が共通で従う一次情報です。
>
> 運用ルール: このファイルは「コードと同じ」扱い。3〜6か月ごと、または見た目の破綻が増えたら剪定する。
> 本書は**方針**のみを記述する。色コード・`--radius` などの具体値はここに書かず、正本である `src/app/globals.css`（`@theme`）と shadcn テンプレートで管理する（値の二重管理・ドリフトを避ける）。

---

## 1. 原則（Design Principles）

- **一貫性を装飾性より優先する**。同じ操作・同じ情報は、画面をまたいで同じ部品・同じ見た目で表す（業務システムとして予測可能であることを最重視）。
- **余白とグルーピングで構造を示す**。罫線や装飾の多用に頼らず、余白で情報の階層を語る。
- **トークン外の値を直書きしない**。新しい値が必要ならまず globals.css のトークンを増やす。
- **Shadcn/UI を土台にし、上書きは Tailwind ユーティリティで最小限に**。色味・角丸など「全体の見た目」を変えるときは、各コンポーネントを個別上書きせず globals.css（`@theme`）/ shadcn テンプレートを編集して一元的に効かせる。

---

## 2. デザイントークン（正本は `src/app/globals.css` の `@theme`）

> Tailwind CSS v4（CSS-first）。トークンの実体は `src/app/globals.css` の CSS 変数 + `@theme inline`（light/dark, base=slate）に定義する。`tailwind.config.ts` は無い。新トークンが要るときは globals.css に追加する。

### カラー
セマンティック変数で参照する（生の HEX を JSX に書かない）。各トークンは**用途（意味）で選ぶ**。実体の値は globals.css 側にあり、ここでは管理しない。

| トークン | 用途（セマンティクス） |
| --- | --- |
| `background` / `foreground` | ページ地・本文 |
| `card` / `card-foreground` | カード面・その上のテキスト |
| `popover` / `popover-foreground` | ポップオーバー・ドロップダウン面 |
| `primary` / `primary-foreground` | 主要アクション |
| `secondary` / `secondary-foreground` | 補助アクション |
| `muted` / `muted-foreground` | 補助テキスト・控えめな背景 |
| `accent` / `accent-foreground` | ホバー・選択中などの強調面 |
| `destructive` / `destructive-foreground` | 破壊的操作 |
| `border` / `input` / `ring` | 枠線・入力・フォーカスリング |
| `sidebar` / `sidebar-foreground` | ヘッダー・サイドバーのナビ面（ライト/ダーク共通で常時ダークのシャドウ配色） |
| `sidebar-primary` / `sidebar-primary-foreground` | ナビ面上のブランド強調 |
| `sidebar-accent` / `sidebar-accent-foreground` | ナビ面上のホバー・選択中の項目 |
| `sidebar-border` / `sidebar-ring` | ナビ面上の枠線・フォーカスリング |

> 使い方: `bg-primary text-primary-foreground`。`bg-[#xxxxxx]` は禁止。色味を変えたいときは JSX を個別上書きせず globals.css のトークンを編集し、全体へ反映する。

### タイポグラフィ
| 用途 | クラス（例） |
| --- | --- |
| H1 | `text-3xl font-semibold tracking-tight` |
| H2 | `text-2xl font-semibold` |
| 本文 | `text-sm leading-relaxed` / `text-base` |
| 補助 | `text-sm text-muted-foreground` |

フォント: `next/font` で `src/app/layout.tsx` に読み込む（font-family の値は実装側で管理し、ここには書かない）。

### 間隔（Spacing）
- 4px グリッド（Tailwind 標準スケール）に従う。任意値で隙間を作らない。
- セクション間・カード内の余白も標準スケールから選ぶ（具体値は実装裁量。同種の画面では揃える）。

### 角丸・影・境界
- 角丸: `rounded-lg` を既定（`--radius` に連動。変更は globals.css 側で）。
- 影: 多用しない。必要時は標準ユーティリティ（`shadow-sm` 等）から選び、任意値は作らない。
- 境界: `border border-border`。

---

## 3. コンポーネントの使い分け

| やりたいこと | 使うもの | 備考 |
| --- | --- | --- |
| モーダル（デスクトップ中心） | `Dialog` | フォーカストラップ既定 |
| モーダル（モバイル中心） | `Drawer` | 下からスライド |
| 選択肢が少ない単一選択 | `Select` | 5件以下の目安 |
| 選択肢が多い／検索したい | `Command` (combobox) | 大量候補向け |
| 一時通知 | `Sonner` (toast) | 永続情報には使わない |
| 破壊的確認 | `AlertDialog` | 取り消し不可操作のみ |
| 補足情報 | `Tooltip` / `HoverCard` | 必須情報は本文に出す |

- フォームは `react-hook-form` + `zod` + Shadcn の `Form` を基本構成にする。

> アイコン（`lucide-react`）・トースト（`sonner`）・`cn()` などツールの既定は §7 実装ルールに集約。

---

## 4. レイアウト / レスポンシブ

- ブレークポイントは Tailwind 既定（`sm md lg xl`）。独自 px ブレークポイントを足さない。
- モバイルファースト。基底スタイル → `md:` 以降で拡張。
- 最大幅・ガターは `container` ＋標準スケールで与える（具体値は実装裁量。独自 px ブレークポイントや任意値は足さない）。

---

## 5. アクセシビリティ（必須）

- すべてのインタラクティブ要素はキーボード操作可能・フォーカス可視（`focus-visible:ring`）。
- アイコンのみのボタンには `aria-label` を付ける。
- 画像には意味に応じた `alt`（装飾は `alt=""`）。
- 色のみで状態を伝えない（テキスト/アイコンを併用）。
- コントラスト比は本文 4.5:1 以上。

---

## 6. do / don't

✅ DO
- `cn()` で条件付きクラスを合成する。
- Shadcn コンポーネントの variant を使う（`<Button variant="outline">`）。
- 既存パターンを `src/shared/ui/`（汎用プリミティブ）・`src/modules/<機能>/ui/`（機能専用）・`src/app/(main)/` の既存画面から踏襲する。

❌ DON'T
- 任意値（`p-[7px]`, `text-[#abc123]`, `top-[42px]`）を使う。
- ネイティブ `<button>` / `<input>` を素で使う（Shadcn 版を使う）。
- 色やサイズをインライン `style` で当てる。
- 1 回限りのために新トークン/新コンポーネントを増やす（既存で表現できないか先に確認）。

---

## 7. 実装ルール（このリポジトリ固有）

> 以下は**このテンプレート既定の実装ルール**。ここに出てくる共通部品（`<SortableTableHead>` / `<SearchConditionCard>` / `cn()` など）はプロジェクト側で作る前提です。作らない・別の方式にする場合は該当節を書き換えてください。

### コンポーネントの追加・配置
- 新規 UI 部品は **公式 CLI で追加**する: `pnpm dlx shadcn@latest add <name>`（`components.json` 準拠 = `style: new-york` / `baseColor: slate` / RSC 有効）。
- 汎用プリミティブの配置先は `src/shared/ui`。**機能専用**コンポーネントは各モジュールの `src/modules/<機能>/ui/` に置く（`shared/ui` には汎用のみ）。
- クラス結合は `cn()`（`@/shared/ui/utils`、clsx + tailwind-merge）を使う。
- アイコンは `lucide-react`（既定 `size-4` = 16px）、トースト通知は `sonner`（`@/shared/ui/toaster`）。

### Server / Client の使い分け
- 表示のみは Server Component（デフォルト）。フォーム・対話・状態を持つものだけ `"use client"`。

### 一覧（テーブル）
- 一覧は**サーバ駆動のソート/ページング + 素の `<Table>`**（`@/shared/ui/table`）で実装する。
- **TanStack Table は不採用**（サーバページング前提で主価値を使わず、依存・攻撃面を最小化するため）。
- データを表示する列の見出しには共通の `<SortableTableHead>` を使う。見出しを初めて選択したときはその列の昇順、同じ見出しを再度選択したときは昇順と降順を切り替える。
- ソート条件はURLクエリの `sort` / `order` に保持し、検索条件は維持したままページ番号を1へ戻す。画面に表示中の1ページだけでなく、検索結果全体をサーバー側で並べ替えてからページングする。
- 現在のソート列と方向はアイコンおよび `aria-sort` で示す。見出しのリンクはキーボード操作とフォーカス表示に対応する。
- 行の操作ボタンを置く末尾列はソート対象外とし、見出しの「操作」という文字列は表示しない。空の見出しセルには支援技術向けのアクセシブルな名前を設定する。
- 共通 `<Table>` は本文を最大 10 行表示し、11 行目以降を表内で縦スクロールする。縦スクロール中も列ヘッダーを上端へ固定する。
- セルは既定で折り返さない。表示幅を超える場合は表内で横スクロールし、本文の行高と表示行数を一定に保つ。
- 最大高さなどの具体値は本書へ重複記載せず、`src/app/globals.css` のトークンで一元管理する。

### 検索条件
- 検索条件がある一覧画面は、共通の `<SearchConditionCard>`（`@/shared/ui/search-condition-card`）で検索フォームを囲む。画面ごとに開閉 UI を再実装しない。
- 初期表示は展開状態にする。利用者が閉じて再度開いた場合も、送信前の入力値を保持する。
- 開閉ボタンは開閉状態に応じたラベルと `aria-expanded` / `aria-controls` を持ち、キーボードで操作できるようにする。
- 検索条件が存在しない一覧画面には、空のアコーディオンや検索フォームを追加しない。新規登録など検索以外のフォームは対象外とする。

---
