# 附属小 受験れんしゅう（家庭用 PWA）

年長の子どもと保護者が1台のスマホ（Android Chrome）で使う、小学校入学検査の練習アプリ。

- 指示は1回だけ読み上げ、答えに詰まると「大丈夫です」で次へ（本番の再現）
- 声で答える問題は音声認識＋読み仮名（kuromoji.js）で自動判定。保護者がワンタップで直せる
- 保護者モード（右上を2秒長押し）：進捗（レベル）一覧・記録・運動生活ログ・ネタ帳・問題カタログ・設定
- データはすべて端末の中（IndexedDB）。録音は保存しない。音声認識のときだけ音声が Google のサーバーで文字になる
- 歌詞・音源・外部の画像は入れていない（絵は SVG と絵文字。歌は YouTube へのリンク）

## 使い方（開発）

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 判定・問題生成・進捗のテスト
npm run build      # dist/ に出力（辞書は prebuild で public/dict にコピー）
```

作りと分担は `docs/ARCHITECTURE.md`。

## 公開

`main` に push すると GitHub Actions（`.github/workflows/deploy.yml`）でテスト → ビルド → GitHub Pages に公開する。リポジトリの Settings → Pages で Source を「GitHub Actions」にしておく。マイクを使うため HTTPS で開くこと。検索には出さない（`noindex`）。
