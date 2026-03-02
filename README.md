# Stoic Habit Tracker

画像イメージに寄せた、スプレッドシート風の習慣管理アプリです。  
`index.html` を開くだけで使えます（インストール不要）。

## 主な機能
- 月間の習慣チェックシート（行: 習慣 / 列: 日付）
- `WEEK 1, WEEK 2...` 形式の週ブロック表示
- 各セルはチェックボックスで達成ON/OFF
- 習慣項目の追加（項目名 + 目標回数）
- 習慣項目のクイック追加（`+ QUICK ADD`）
- 習慣項目の編集（項目名・目標回数を直接編集）
- 習慣項目の削除（`×` ボタン）
- 右パネルにスタイリッシュな月間ドーナツ進捗
- Top Daily Habits ランキング
- 月内の日別達成バー
- 共有リンクで友達と進捗共有（SELF/FRIENDモード切替）
- データ保存（ブラウザの localStorage）

## 起動方法
1. `/Users/miraihimeno/Documents/New project/index.html` をダブルクリック
2. もしくはブラウザへドラッグ&ドロップ

## Web公開 (GitHub Pages)
1. GitHubで空のリポジトリを作成（例: `stoic-habit-tracker`）
2. このフォルダで以下を実行
   - `git remote add origin <YOUR_REPO_URL>`
   - `git push -u origin main`
3. GitHubの `Settings > Pages` で
   - `Source: GitHub Actions` を選択
4. 数分後に `https://<username>.github.io/<repo>/` で公開

このプロジェクトには `.github/workflows/pages.yml` を追加済みなので、`main` へのpushで自動デプロイされます。

## 動画背景について
- `MONTHLY TRACKER` の背景動画は `./assets/sunset-sea.mp4` を参照します。
- 動画を使う場合は `/Users/miraihimeno/Documents/New project/assets/sunset-sea.mp4` に配置してください。

## 共有機能の使い方
1. 自分側で `共有コードを作成` を押す（共有リンクが生成される）
2. 友達にリンクを送る
3. 友達はSafariのアドレスバーにそのリンクを貼って開く
4. 自動で友達データが読み込まれ、`FRIEND MODE` で表示される

## ファイル
- `index.html`: 画面構造
- `styles.css`: スプレッドシート風デザイン
- `webapp.js`: データ管理・集計・描画
