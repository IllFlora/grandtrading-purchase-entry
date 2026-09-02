# Grand Trading 仕入れ入力（現場アプリ）

輸出現場が持ち込み品の計量結果（日付・取引先・商品・数量）をスマホから登録し、Google スプレッドシートへ自動反映する静的Webアプリ。
バックエンドは Google Apps Script（別途 `apps-script/Code.gs`）。ログインは無く、拠点ごとの PIN で利用する。

- `index.html` / `app.js` / `styles.css` — アプリ本体（依存ライブラリなし）
- `config.js` — `apiUrl` に Apps Script ウェブアプリの URL を設定する
- `mock-data.js` — `index.html?mock=1` で API を使わずに画面確認するためのマスター（生成物）

設計・運用・導入手順は親フォルダの `README.md` と `仕様書.md` を参照。
このリポジトリに営業データ・単価・PIN は含めない。
