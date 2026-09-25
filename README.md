# sena-flyer-prompt

スマートフォンで画像生成用プロンプトの JSON を編集する静的 Web アプリです。外部ライブラリやサーバー処理は使いません。入力データはブラウザの `localStorage` に保存されます。

## ローカル起動

```sh
python3 -m http.server 8000
```

`http://localhost:8000` を開いてください。Vercel ではリポジトリをそのまま静的サイトとして公開できます。
