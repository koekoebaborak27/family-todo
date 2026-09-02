# 単体テスト仕様書: iOSインストール案内

## 1. テスト対象

- 対象機能: iOSインストール案内
- 対象画面またはAPI: バナー・Drawer（独立したページではなく、ToDo一覧画面・家族グループ作成・参加画面の上に重ねて表示する）
- 対象ファイル: `apps/frontend/src/modules/ios-install-guide/service.ts`、`apps/frontend/src/modules/ios-install-guide/storage.ts`、`apps/frontend/src/modules/ios-install-guide/ui/ios-install-banner.tsx`、`apps/frontend/src/modules/ios-install-guide/ui/ios-install-drawer.tsx`、`apps/frontend/src/modules/todo/ui/todo-list-screen.tsx`、`apps/frontend/src/modules/family/ui/family-setup-screen.tsx`
- 関連DBテーブル: 無し（端末のlocalStorageにのみ記録し、サーバーへは送らない）
- 関連設計書: [`24_iOSインストール案内.md`](../../../../specs/02_basic-design/family-todo/24_iOSインストール案内.md)（本テスト仕様書作成にあわせて、表示条件のUser-Agent判定範囲について設計書と実装の食い違いを解消済み。詳細は「7. 補足」参照）

## 2. 前提条件

- 実行環境: ローカル（`pnpm dev:backend` = http://localhost:8787 / `pnpm dev:frontend` = http://localhost:3000）
- ログインユーザー: 実際のGoogleアカウントは使用せず、[`ローカルD1へのセッション投入によるUI確認.md`](../../../../todo/notes/ローカルD1へのセッション投入によるUI確認.md)の手順でログイン済み状態を再現する
  - `U1`: `users`に1件、`family_id = F1`（家族グループ所属済み。ToDo一覧画面の確認に使用）
  - `U2`: `users`に1件、`family_id = NULL`（家族グループ未所属。家族グループ作成・参加画面の確認に使用）
- 権限: 「6. 権限による差」のとおり、グループへの所属や役割による違いは無い
- 事前DB状態: バナーの表示自体はDBに依存しない。ログイン状態を作るための`F1`（`families`に1件）・`U1`・`U2`のシードのみ用意する
- 使用するテストデータ:
  - iOS Safari UA: `Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1`
  - iOS上の非Safariブラウザ（Chrome for iOS）UA: `Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.80 Mobile/15E148 Safari/604.1`
  - 非iOSのUA（Android Chrome）: `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36`
  - localStorageキー: `ios-install-guide-dismissed-at`（値は閉じた日時のミリ秒）
  - `navigator.standalone`: Safari固有のプロパティ。ホーム画面から起動した状態を`true`、それ以外を`false`または未定義として模擬する

## 3. テスト観点

- 正常系: 対象2画面でのバナー表示、バナーの表示内容、「追加のしかた」からのDrawer表示、Drawerの表示内容、Drawerの「閉じる」、バナーの「×」（閉じた日時の保存）、閉じてから7日未満/以上での再表示制御、iOS上の非Safariブラウザでの表示
- 異常系: localStorageが使用できない環境（プライベートブラウズ等）での挙動
- 境界値: 閉じてからちょうど7日経過（表示される）／僅かに届かない（表示されない）
- 権限: 無し（グループ所属・役割による違いは無いため、専用のテストケースは設けない）
- DB更新: 無し（すべてのテストケースでDB変化なし）
- 画面表示: 対象外画面でのバナー非設置、ホーム画面追加済みでの非表示、非iOS端末での非表示

## 4. テストケース一覧

| No | 区分 | テストケース名 | 前提条件 | 操作手順 | 期待結果 | エビデンス |
|---|---|---|---|---|---|---|
| TC-001 | 正常系 | ToDo一覧画面でのバナー表示 | `U1`でログイン済み。iOS Safari UA、`navigator.standalone`は`false`、`dismissedAt`は未保存 | `/todos`を開く | ヘッダー直下にバナーが表示される | `001_ToDo一覧バナー表示.png` |
| TC-002 | 正常系 | 家族グループ作成・参加画面でのバナー表示 | `U2`でログイン済み。iOS Safari UA、`navigator.standalone`は`false`、`dismissedAt`は未保存 | `/family/setup`を開く | 画面最上部にバナーが表示される | `002_家族グループ作成参加バナー表示.png` |
| TC-003 | 正常系 | バナーの表示内容 | TC-001の状態から | バナーを確認する | アイコンと`ホーム画面に追加すると、通知を受け取れます。`、「追加のしかた」ボタン、`aria-label`が`閉じる`の「×」ボタンが表示される | `003_バナー表示内容.png` |
| TC-004 | 正常系 | 「追加のしかた」からDrawerを開く | TC-001の状態から | 「追加のしかた」を押す | 手順を説明するDrawerが開く | `004_Drawer表示.png` |
| TC-005 | 正常系 | Drawerの表示内容 | TC-004の状態から | Drawerの内容を確認する | 見出し`ホーム画面に追加する`、説明文`iPhone・iPadでは、ホーム画面に追加したときだけ通知を受け取れます。次の手順で追加してください。`、手順`1. 画面の下にある「共有」ボタン（□に↑のアイコン）を押します。`・`2. メニューを下にスクロールして「ホーム画面に追加」を押します。`・`3. 右上の「追加」を押します。`、補足`追加した後は、ホーム画面のアイコンからアプリを開いてください。`、「閉じる」ボタンが表示される | `005_Drawer表示内容.png` |
| TC-006 | 正常系 | Drawerの「閉じる」 | TC-004の状態から | Drawer内の「閉じる」を押す | Drawerが閉じ、バナーは表示されたままになる（バナーを閉じたことにはならない） | `006_Drawer閉じる.png` |
| TC-007 | 正常系 | バナーの「×」 | TC-001の状態から | バナーの「×」を押す | バナーが消え、閉じた日時（現在時刻のミリ秒）がlocalStorageの`ios-install-guide-dismissed-at`に保存される | `007_バナー閉じる.png` |
| TC-008 | 正常系 | 閉じてから7日未満の再訪問 | `U1`でログイン済み。iOS Safari UA、`navigator.standalone`は`false`、`dismissedAt`が現在時刻の3日前 | `/todos`を開く | バナーは表示されない | `008_7日未満は非表示.png` |
| TC-009 | 正常系 | 閉じてから7日経過後の再訪問 | `U1`でログイン済み。iOS Safari UA、`navigator.standalone`は`false`、`dismissedAt`が現在時刻の8日前 | `/todos`を開く | バナーが再び表示される | `009_7日経過で再表示.png` |
| TC-010 | 正常系 | iOS上の非Safariブラウザでの表示 | `U1`でログイン済み。iOS上のChrome（CriOS）UA、`navigator.standalone`は未定義、`dismissedAt`は未保存 | `/todos`を開く | バナーが表示される | `010_iOS非Safariでも表示.png` |
| TC-011 | 境界値 | 閉じてからちょうど7日経過 | `U1`でログイン済み。iOS Safari UA、`navigator.standalone`は`false`、`dismissedAt`が現在時刻のちょうど7日前（`7 * 24 * 60 * 60 * 1000`ミリ秒前） | `/todos`を開く | バナーが表示される | `011_7日ちょうどで表示.png` |
| TC-012 | 境界値 | 閉じてから7日に僅かに届かない | `U1`でログイン済み。iOS Safari UA、`navigator.standalone`は`false`、`dismissedAt`が現在時刻の7日前より1分だけ後（6日23時間59分前） | `/todos`を開く | バナーは表示されない | `012_7日未満僅差で非表示.png` |
| TC-013 | 異常系 | ホーム画面に追加済み | `U1`でログイン済み。iOS Safari UA、`navigator.standalone`は`true`、`dismissedAt`は未保存 | `/todos`を開く | バナーは表示されない | `013_ホーム画面追加済みは非表示.png` |
| TC-014 | 異常系 | 非iOS端末 | `U1`でログイン済み。Android Chrome UA | `/todos`を開く | バナーは表示されない | `014_非iOSは非表示.png` |
| TC-015 | 異常系 | 対象外画面ではバナーが設置されていない | `U1`でログイン済み。iOS Safari UA、`navigator.standalone`は`false`、`dismissedAt`は未保存 | `/settings`（個人設定画面）を開く | バナー相当の要素が存在しない | `015_対象外画面は非設置.png` |
| TC-016 | 異常系 | localStorageが使用できない環境 | `U1`でログイン済み。iOS Safari UA、`navigator.standalone`は`false`。`localStorage`への書き込みが例外を投げる状態 | `/todos`を開き、バナーの「×」を押した後、ページを再読み込みする | 「×」を押した操作はエラーにならずバナーは一旦消えるが、閉じた日時が保存されないため再読み込み後にバナーが再び表示される | `016_保存不可でも再表示.png` |

## 5. DB確認内容

| No | テーブル | 条件 | カラム | 期待値 |
|---|---|---|---|---|
| TC-001〜TC-016 | - | - | - | 該当なし（DB変化なし。この機能はサーバーへの通信・DB更新を行わず、localStorageにのみ記録するため） |

DB変化が無いテストケースは、テーブル以降を「該当なし（DB変化なし）」と明記する。

## 6. 未確定事項

- なし

## 7. 補足

- 設計書「2. 表示条件」の1・2番目の条件は、当初「iOSのSafariで開いている」ことを前提にしていたが、実装（`isIosUserAgent`）はUser-Agentに`iPhone`・`iPad`・`iPod`のいずれかを含むかのみを判定しており、iOS上のSafari以外のブラウザ（Chrome for iOS等）でもバナーが表示される。`navigator.standalone`もSafari固有のプロパティで、他ブラウザでは常に「未追加」扱いになる。ユーザー承認のうえ実装どおりにテストし、設計書の該当箇所を実装に合わせた文言へ修正済み（TC-010で確認）。
- 「追加のしかたを見る」ボタン（個人設定画面）からのDrawer表示は、表示条件にかかわらず直接開ける独立した経路のため、[UT_22_個人設定.md](../settings/UT_22_個人設定.md)のTC-009・TC-010で確認済み。本仕様書では重複を避け対象外とした。
