# デプロイ手順書

草野球記録アプリ (`baseball-score-app`) のデプロイ手順をまとめたドキュメントです。

---

## アーキテクチャ概要

```
ローカル編集 (app フォルダ)
  ↓ push-*.bat を実行
GitHub リポジトリ (du0000du/baseball-score-app)
  ↓ main ブランチへの push を検知
Vercel (自動デプロイ)
  ↓ ビルド完了
本番 URL: https://baseball-score-app-seven.vercel.app
```

---

## 通常デプロイ手順

### 1. ファイルを編集する

`C:\Users\daiki\Desktop\000_Uematsu\003_事業\01_野球スコアアプリ\app\` 配下のファイルを直接編集します。

### 2. デプロイスクリプトを用意する

デプロイするファイルが決まったら、対応するスクリプトを更新または新規作成します。

**スクリプト構成 (2 ファイル)**:

```
push-<feature>.sh   ← Git Bash スクリプト（実際の処理）
run-<feature>.bat   ← ダブルクリック用の起動ラッパー
```

**`run-<feature>.bat` テンプレート**:
```bat
@echo off
"C:\Program Files\Git\bin\bash.exe" "%~dp0push-<feature>.sh"
```

**`push-<feature>.sh` テンプレート**:
```bash
#!/bin/bash
set -e
REPO="/c/Users/daiki/Desktop/temp-baseball-fix"
APP="/c/Users/daiki/Desktop/000_Uematsu/003_事業/01_野球スコアアプリ/app"
LOG="$APP/push_<feature>_log.txt"

echo "=== Start $(date) ===" > "$LOG"

# リポジトリの準備
if [ ! -d "$REPO/.git" ]; then
  echo "Cloning repo..." >> "$LOG"
  git clone https://github.com/du0000du/baseball-score-app.git "$REPO" >> "$LOG" 2>&1
else
  echo "Pulling latest..." >> "$LOG"
  cd "$REPO" && git pull origin main >> "$LOG" 2>&1
fi

cd "$REPO"
echo "Copying files..." >> "$LOG"

# ── ディレクトリ作成 ──
mkdir -p "app/(protected)/_components" \
         "app/(protected)/dashboard" \
         "app/(protected)/games" \
         "app/(protected)/games/[id]"

# ── コピー対象ファイル（必要なものを列挙）──
cp "$APP/app/globals.css"                               "app/globals.css"
cp "$APP/tailwind.config.ts"                            "tailwind.config.ts"
cp "$APP/app/(protected)/stats/page.tsx"                "app/(protected)/stats/page.tsx"
# cp "$APP/app/(protected)/dashboard/page.tsx"          "app/(protected)/dashboard/page.tsx"
# ...

echo "Files copied." >> "$LOG"

# ── コミット＆プッシュ ──
git add -A >> "$LOG" 2>&1
git -c user.email="d.uematsu@transdata.tv" -c user.name="Daiki Uematsu" \
  commit -m "fix: <コミットメッセージをここに>" >> "$LOG" 2>&1 \
  || echo "Nothing to commit" >> "$LOG"

echo "Pushing..." >> "$LOG"
git push origin main >> "$LOG" 2>&1
echo "Exit code: $?" >> "$LOG"
echo "=== Done ===" >> "$LOG"
```

### 3. バットファイルをダブルクリックして実行

1. エクスプローラーで `app` フォルダを開く
2. `run-<feature>.bat` をダブルクリック
3. ウィンドウが自動的に閉じればOK

### 4. ログを確認する

```
app/push_<feature>_log.txt
```

正常完了時の末尾:
```
Pushing...
Everything up-to-date   ← すでにプッシュ済み
Exit code: 0
=== Done ===
```

または:

```
Pushing...
Exit code: 0
=== Done ===
```

### 5. Vercel のビルドを確認する

https://vercel.com/du0000dus-projects/baseball-score-app/deployments

- Status: **Ready** ＋ **Current** であれば本番反映済み
- ビルド時間: 約 30〜60 秒

---

## Supabase DB マイグレーション

コードと同時に DB スキーマも変える場合は、Vercel デプロイの前後どちらかに実施します（基本的に先行推奨）。

1. https://supabase.com/dashboard/project/gankicjpcfmiarmhzeqs/sql にアクセス
2. SQL エディタで DDL を実行
3. "Success. No rows returned" を確認

**例 (batting_order 制約拡張)**:
```sql
ALTER TABLE at_bats DROP CONSTRAINT at_bats_batting_order_check;
ALTER TABLE at_bats ADD CONSTRAINT at_bats_batting_order_check CHECK (batting_order BETWEEN 1 AND 12);
```

---

## よくあるトラブル

| 症状 | 原因 | 対処 |
|------|------|------|
| `.bat` 実行してもウィンドウが出ない | スクリプトが瞬時に完了/失敗 | ログファイルを確認 |
| `fatal: could not read Username` | Git 認証情報がない | Windows Git の資格情報マネージャーで再認証 |
| `Nothing to commit` | 前回のプッシュで反映済み | ログを確認して問題なければOK |
| Vercel ビルド失敗 | TypeScript エラーなど | Vercel ダッシュボードのログで詳細確認 |
| ダークモードで白背景が出る | `select`/`input` に `bg-lv1` が未指定 | Tailwind クラス `bg-lv1 text-main` を追加 |

---

## 再発防止：デザイントークン必須ファイル

ダークモード崩れの根本原因は「ローカル修正済みファイルがデプロイスクリプトに含まれていなかった」こと。
新しいデプロイスクリプトを作るときは、以下のファイルを**常に含める**。

| ファイル | 理由 |
|---|---|
| `app/(protected)/layout.tsx` | ページ全体の背景色を定義 (`bg-lv2`)。抜けると全画面が白背景になる |
| `app/globals.css` | CSS変数（カラートークン定義）の本体 |
| `tailwind.config.ts` | Tailwindトークン定義。これが古いとクラスが無効になる |

### 禁止パターン（過去のバグ原因）

```tsx
// ❌ NG: 存在しないカラー `night` を使用 → dark: 上書きが無効になる
<div className="min-h-screen bg-gray-50 dark:bg-night-950">

// ✅ OK: デザイントークンを使う
<div className="min-h-screen bg-lv2">
```

```tsx
// ❌ NG: ハードコードされたカラー → ダーク/ライト切り替え時に色が変わらない
<span className="text-green-500">○</span>
<span className="text-yellow-500">△</span>

// ✅ OK: セマンティックトークン
<span className="text-pos-t">○</span>
<span className="text-neu-t">△</span>
```

### 新機能を追加するときのチェックリスト

1. `bg-gray-*`, `bg-white`, `bg-black` などのハードコードカラーを使っていないか？
2. `dark:bg-*` で存在しないカラー名（`night` など）を使っていないか？
3. `tailwind.config.ts` にないカラーを `dark:` バリアントで使っていないか？
4. デプロイスクリプトに `layout.tsx` / `globals.css` / `tailwind.config.ts` を含めたか？

---

## 主要ファイルマップ

```
app/
├── app/
│   ├── globals.css                         # デザイントークン (CSS変数)
│   ├── (protected)/
│   │   ├── dashboard/page.tsx              # ダッシュボード
│   │   ├── games/page.tsx                  # 試合一覧
│   │   ├── games/[id]/page.tsx             # 試合詳細
│   │   ├── games/[id]/at-bats/page.tsx     # 打席入力
│   │   ├── games/[id]/pitching/page.tsx    # 投手成績入力
│   │   ├── stats/page.tsx                  # 成績ページ
│   │   └── _components/
│   │       ├── Nav.tsx                     # ナビゲーション
│   │       ├── ThemeProvider.tsx           # ダーク/ライトモード
│   │       └── DirectionChart.tsx          # 打球方向チャート
├── tailwind.config.ts                      # デザイントークン → Tailwind クラス
├── supabase/migrations/                    # DB マイグレーション履歴
└── DEPLOY.md                               # このファイル
```

---

## デザイントークン早見表

| Tailwindクラス | 用途 |
|---|---|
| `bg-lv1` / `bg-lv2` | カード背景 / ページ背景 |
| `text-main` / `text-sub1` / `text-sub2` | 本文 / サブ / キャプション |
| `text-accent` | タイトル・KPI数値の強調色 |
| `text-theme` / `bg-theme` | ボタン・リンク・フォーカス |
| `border-s1` / `border-s2` | 目立つ罫線 / 細い罫線 |
| `bg-pos text-pos-t` | ポジティブ状態（安打・勝利）|
| `bg-neg text-neg-t` | ネガティブ状態（アウト・敗戦）|
| `bg-neu text-neu-t` | ニュートラル状態（引き分け）|
