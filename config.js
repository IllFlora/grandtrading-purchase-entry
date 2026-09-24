// グラトレ 仕入れ入力 — 設定
// apiUrls: 拠点ごとの Apps Script ウェブアプリ URL（…/exec）。拠点別に別スプレッドシートを使う運用
//          1枚に両拠点をまとめる場合は apiUrl に1本だけ書けばよい（apiUrls が空の拠点は apiUrl を使う）
// pins:    拠点ごとのPIN。2026-09-10 から現場には入力させず、アプリが自動で送る（原さんの決定）。
//          設定シートのPINを変えたらここも直して push すること。両方そろって初めて動く
// mock:    true にすると API を使わず端末内だけで動く（画面確認・デモ用。mock-data.js を読み込む）。index.html?mock=1 でも同じ
window.GT_PURCHASE_CONFIG = {
  apiUrls: {
    '長野': 'https://script.google.com/macros/s/AKfycbxUcq8pgHVHjt1Mv5t_P2bM_s1r2u0qjqq1BaO9r68APAuBGJus4aHwWXaNx_Cfs72g/exec',
    '千葉': 'https://script.google.com/macros/s/AKfycbzjsgLbL7Mj4yXiunmetNVQ2c-Eni_fjDl9zHZg0EDm9MlzOXPigLpFpppGw_YUnd65/exec'
  },
  apiUrl: '',
  pins: {
    '長野': '3344',
    '千葉': '2828'
  },
  sites: ['長野', '千葉'],
  mock: false,
  version: '2026-09-24.2'
};
