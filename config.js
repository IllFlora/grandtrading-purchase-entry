// グラトレ 仕入れ入力 — 設定
// apiUrls: 拠点ごとの Apps Script ウェブアプリ URL（…/exec）。拠点別に別スプレッドシートを使う運用
//          1枚に両拠点をまとめる場合は apiUrl に1本だけ書けばよい（apiUrls が空の拠点は apiUrl を使う）
// mock:    true にすると API を使わず端末内だけで動く（画面確認・デモ用。mock-data.js を読み込む）。index.html?mock=1 でも同じ
window.GT_PURCHASE_CONFIG = {
  apiUrls: {
    '長野': '',
    '千葉': ''
  },
  apiUrl: '',
  sites: ['長野', '千葉'],
  mock: false,
  version: '2026-09-08.2'
};
