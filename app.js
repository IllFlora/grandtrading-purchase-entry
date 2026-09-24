/* グラトレ 仕入れ入力 — 現場アプリ本体
 * 方針: ログインなし。現場は拠点を選ぶだけ（2026-09-10 原さん決定でPIN入力も廃止）。
 *       PIN は config.js の pins から自動で送る（GAS側の検証はそのまま。変えたい時は設定シートと config.js の両方を直す）。
 *       入力は端末内キューに保存してから Apps Script API へ送る。
 *       電波が無くても登録操作は完了し、復帰後に自動再送する。
 *       単価・金額は画面に出す（2026-09-08 原さん決定。取引先別単価 → 商品マスタ単価 の順で API から受け取る）。
 */
(function () {
  'use strict';
  var CFG = window.GT_PURCHASE_CONFIG || {};
  if (/[?&]mock=1/.test(location.search)) CFG.mock = true;   // 画面確認用: index.html?mock=1 で端末内モック
  var $ = function (id) { return document.getElementById(id); };
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { } }
  };

  var I18N = {
    ja: {
      appTitle: '仕入れ入力', setupLead: 'どこの拠点ですか？（初回だけ）', site: '拠点', userName: 'あなたの名前（入れなくてもOK）',
      userPlaceholder: '例: 山田', start: 'はじめる', date: '日付', today: '今日', supplier: '取引先', item: '商品', qty: '数量', change: '変更',
      searchPlaceholder: 'コードまたは名前で検索', notePlaceholder: 'メモ（任意）',
      unpricedHint: 'この商品は単価が都度決めです。数量だけ登録し、金額は経理がシートで入れます。',
      save: '登録する', todayEntries: '最近の登録（3日分）', refresh: '更新', retry: '再送',
      apiNotSet: 'API URL が未設定です（config.js）。登録は端末内に保存され、設定後に送信されます。',
      settings: '設定', language: '言語', masters: 'マスター', reload: '再取得', pendingLabel: '送信待ち', version: '版',
      changeSite: '拠点を選び直す', frequent: 'よく使う', noMatch: '該当なし', saved: '登録しました', sent: '送信済み', waiting: '送信待ち',
      cancelled: '取消', errorLabel: 'エラー', pendingText: '送信待ち {n}件',
      qtyInvalid: '数量を入力してください', siteRequired: '拠点を選んでください', badPin: '登録できませんでした。経理に連絡してください',
      netError: '通信できません。電波を確認してください', offlineStart: 'オフラインのため保存済みマスターで開始します',
      mastersAt: '取得 {t}', mastersNone: '未取得', apiOff: '未設定', mockOn: 'モック（端末内のみ）', selectFirst: '取引先と商品を選んでください',
      by: '入力', mastersUpdated: 'マスターを更新しました', unit_kg: 'kg',
      unitPrice: '単価', amount: '金額', supplierPrice: '取引先別単価',
      addSupplier: '＋「{name}」を新しい取引先として追加', confirmAddSup: '「{name}」を取引先に追加します。\n会社名・店名にまちがいはありませんか？',
      supAdded: '取引先を追加しました：{code} {name}', supExists: 'すでに登録されていました：{code} {name}',
      needOnline: '追加は、電波のあるところでしてください', featureNotReady: 'この機能はまだ使えません。経理に連絡してください',
      addItem: '＋「{name}」を新しい商品として追加', newItemTitle: '新しい商品を追加', itemNameLabel: '商品名', unitWord: '単位',
      priceYen: '単価（円）', priceHint: '単価がわからなければ空欄でOK。入れた単価は経理が月末に確認します',
      addItemSubmit: '追加する', cancelAdd: 'やめる', itemAdded: '商品を追加しました：{code} {name}', itemExists: 'すでに登録されていました：{code} {name}',
      nameRequired: '商品名を入れてください', priceInvalid: '単価は数字で入れてください', pendingPrice: '現場入力の単価',
      fixReq: '修正依頼', reqTitle: 'どこがちがいますか？', kind_qty: '数量がちがう', kind_cancel: '取り消したい', kind_other: 'その他',
      correctQty: '正しい数量', reqNote: 'メモ（任意）', reqNoteOther: 'どう直してほしいか（必ず書く）', reqSend: '経理に送る', reqClose: 'やめる',
      reqSent: '修正依頼を送りました。経理が直します', reqOpen: '修正依頼中', reqDone: '経理が対応済み', needOnlineReq: '修正依頼は、電波のあるところで送ってください',
      reqKindRequired: 'どこがちがうかを選んでください', reqNoteRequired: 'どう直してほしいかを書いてください', reqSameQty: '今と同じ数量です',
      reqSending: '送っています…', reqAlready: 'この登録はすでに修正依頼中です。経理の対応を待ってください',
      mastersLoading: '取引先・商品を読み込んでいます…', mastersSlow: '朝いちばんは30秒ほどかかることがあります。そのまま待ってください',
      mastersFailed: '読み込めませんでした。電波を確認して、もう一度押してください', tryAgain: 'もう一度読み込む',
      ok: 'OK', no: 'キャンセル'
    },
    en: {
      appTitle: 'Purchase Entry', setupLead: 'Which site are you at? (first time only)', site: 'Site', userName: 'Your name (optional)',
      userPlaceholder: 'e.g. Yamada', start: 'Start', date: 'Date', today: 'Today', supplier: 'Supplier', item: 'Item', qty: 'Quantity', change: 'Change',
      searchPlaceholder: 'Search by code or name', notePlaceholder: 'Note (optional)',
      unpricedHint: 'This item has no fixed unit price. Enter the quantity only; the office sets the amount in the sheet.',
      save: 'Save', todayEntries: 'Recent entries (3 days)', refresh: 'Refresh', retry: 'Retry',
      apiNotSet: 'API URL is not set (config.js). Entries stay on this device and are sent once it is set.',
      settings: 'Settings', language: 'Language', masters: 'Master data', reload: 'Reload', pendingLabel: 'Pending', version: 'Version',
      changeSite: 'Change site', frequent: 'Frequent', noMatch: 'No match', saved: 'Saved', sent: 'Sent', waiting: 'Pending',
      cancelled: 'Cancelled', errorLabel: 'Error', pendingText: '{n} pending',
      qtyInvalid: 'Enter a quantity', siteRequired: 'Choose a site', badPin: 'Could not save. Please contact the administrator.',
      netError: 'Cannot reach the server. Check your connection.', offlineStart: 'Offline: starting with cached master data',
      mastersAt: 'fetched {t}', mastersNone: 'not loaded', apiOff: 'not set', mockOn: 'mock (device only)', selectFirst: 'Choose a supplier and an item',
      by: 'by', mastersUpdated: 'Master data updated', unit_kg: 'kg',
      unitPrice: 'Unit price', amount: 'Amount', supplierPrice: 'supplier price',
      addSupplier: '+ Add "{name}" as a new supplier', confirmAddSup: 'Add "{name}" as a supplier?\nPlease check the company or shop name is correct.',
      supAdded: 'Supplier added: {code} {name}', supExists: 'Already registered: {code} {name}',
      needOnline: 'You need a connection to add this. Try again where you have signal.', featureNotReady: 'This is not available yet. Please contact the administrator.',
      addItem: '+ Add "{name}" as a new item', newItemTitle: 'Add a new item', itemNameLabel: 'Item name', unitWord: 'Unit',
      priceYen: 'Unit price (yen)', priceHint: 'Leave the price blank if you do not know it. The office checks any price you enter at month end.',
      addItemSubmit: 'Add', cancelAdd: 'Cancel', itemAdded: 'Item added: {code} {name}', itemExists: 'Already registered: {code} {name}',
      nameRequired: 'Enter the item name', priceInvalid: 'Enter the price as a number', pendingPrice: 'price set on site',
      fixReq: 'Request fix', reqTitle: 'What is wrong?', kind_qty: 'Wrong quantity', kind_cancel: 'Cancel this entry', kind_other: 'Other',
      correctQty: 'Correct quantity', reqNote: 'Note (optional)', reqNoteOther: 'What should be fixed (required)', reqSend: 'Send to office', reqClose: 'Close',
      reqSent: 'Fix request sent. The office will correct it.', reqOpen: 'Fix requested', reqDone: 'Fixed by office', needOnlineReq: 'You need a connection to send a fix request.',
      reqKindRequired: 'Choose what is wrong', reqNoteRequired: 'Write what should be fixed', reqSameQty: 'That is the same quantity',
      reqSending: 'Sending…', reqAlready: 'A fix is already requested for this entry. Please wait for the office.',
      mastersLoading: 'Loading suppliers and items…', mastersSlow: 'The first load of the day can take about 30 seconds. Please wait.',
      mastersFailed: 'Could not load. Check your connection and tap the button again.', tryAgain: 'Load again',
      ok: 'OK', no: 'Cancel'
    }
  };
  var UNIT_EN = { 'kg': 'kg', '個': 'pcs', '本': 'pcs', '枚': 'pcs', '台': 'units', '箱': 'boxes', '式': 'lot', '一式': 'lot', '袋': 'bags', '円': 'yen' };
  var SITE_EN = { '長野': 'Nagano', '千葉': 'Chiba' };

  var S = { lang: 'ja', site: '', pin: '', user: '', device: '', masters: null, sup: null, item: null, today: [], queue: [], busy: false, netOk: null };

  function t(key, vars) {
    var s = (I18N[S.lang] && I18N[S.lang][key]) || I18N.ja[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
    return s;
  }
  function unitLabel(u) { return S.lang === 'en' ? (UNIT_EN[u] || u || '') : (u || ''); }
  function siteLabel(s) { return S.lang === 'en' ? (SITE_EN[s] || s) : s; }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function nowIso() { var d = new Date(); return todayStr() + 'T' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2); }
  function uid(p) { return (p || 'E') + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtQty(q) { var n = Number(q); return isFinite(n) ? String(Math.round(n * 1000) / 1000) : String(q); }

  // ─── i18n 反映 ───
  function applyI18n() {
    document.documentElement.lang = S.lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) { el.placeholder = t(el.getAttribute('data-i18n-placeholder')); });
    document.querySelectorAll('.lang').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-lang') === S.lang); });
    $('langBtn').textContent = S.lang === 'ja' ? 'EN' : 'JA';
    $('siteLabel').textContent = siteLabel(S.site);
    document.title = 'Grand Trading ' + t('appTitle');
  }
  function setLang(l) { S.lang = l; LS.set('gtp_lang', l); applyI18n(); if (S.masters) { renderPicker('sup'); renderPicker('item'); renderSelected(); renderToday(); } else if (!$('app').classList.contains('hidden')) { renderMastersState(); renderToday(); } }

  // ─── 通信 ───
  function apiUrlFor(site) { return (CFG.apiUrls && CFG.apiUrls[site]) || CFG.apiUrl || ''; }
  // PIN は現場に入力させない。config.js の値を使う（古い端末に残っている保存値より config を優先）
  function pinFor(site) { return (CFG.pins && CFG.pins[site]) || CFG.pin || S.pin || ''; }
  function apiReady() { return !!(CFG.mock || apiUrlFor(S.site)); }
  function setNet(state) { S.netOk = state; var d = $('netDot'); d.className = 'dot ' + (state === true ? 'ok' : state === false ? 'bad' : navigator.onLine ? 'busy' : 'bad'); }
  // Apps Script は朝いちばんなど久しぶりの呼び出しで30秒前後かかることがあり、Google 側が一時的に 404 のHTMLを返すこともある（2026-09-13 実測）。
  // そのため待ち時間は長めにし、読み込み（masters / recent）は自動で2回までやり直す。
  // 書き込みは「Googleの一時エラー」のときだけ1回やり直す（サーバーはID・名前で二重登録を防ぐので、やり直しても増えない）。
  var POST_ACTIONS = ['add', 'fixRequest', 'addSupplier', 'addItem'];
  function api(action, body, opts) {
    body = body || {}; opts = opts || {};
    if (CFG.mock) return mockApi(action, body).then(function (j) { setNet(true); return j; });
    var url = apiUrlFor(S.site);
    if (!url) return Promise.reject({ code: 'no_api', message: t('apiNotSet') });
    var isPost = POST_ACTIONS.indexOf(action) >= 0, site = S.site;
    var retries = opts.retries != null ? opts.retries : (isPost ? 1 : 2);
    var attempt = function (left) {
      return apiOnce(url, action, body, isPost, site, opts.timeout || 60000).catch(function (err) {
        var retryable = err && (err.code === 'bad_response' || (!isPost && err.code === 'network'));
        if (!retryable || left <= 0 || navigator.onLine === false) throw err;
        return new Promise(function (res) { setTimeout(res, (retries - left + 1) * 1500); }).then(function () { return attempt(left - 1); });
      });
    };
    return attempt(retries).catch(function (err) {
      if (err && err.code && err.code !== 'bad_response' && err.code !== 'network') throw err;   // サーバーが返した業務エラー
      setNet(false); throw { code: 'network', message: t('netError') };
    });
  }
  function apiOnce(url, action, body, isPost, site, timeout) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl && setTimeout(function () { ctl.abort(); }, timeout);
    var base = { action: action, site: site, pin: pinFor(site) };
    var req;
    if (isPost) {
      var payload = {}; Object.keys(body).forEach(function (k) { payload[k] = body[k]; });
      Object.keys(base).forEach(function (k) { payload[k] = base[k]; });
      req = fetch(url, { method: 'POST', body: JSON.stringify(payload), signal: ctl && ctl.signal, redirect: 'follow' });
    } else {
      var q = Object.keys(base).map(function (k) { return k + '=' + encodeURIComponent(base[k]); });
      Object.keys(body).forEach(function (k) { q.push(k + '=' + encodeURIComponent(body[k])); });
      req = fetch(url + '?' + q.join('&'), { signal: ctl && ctl.signal, redirect: 'follow' });
    }
    return req.then(function (r) { return r.text(); }).then(function (txt) {
      if (timer) clearTimeout(timer);
      var j; try { j = JSON.parse(txt); } catch (e) { throw { code: 'bad_response', message: 'bad response: ' + String(txt).slice(0, 80) }; }
      if (!j || !j.ok) throw { code: (j && j.code) || 'error', message: (j && j.error) || 'error' };
      setNet(true); return j;
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      if (err && err.code) throw err;
      throw { code: 'network', message: t('netError') };   // 通信断・タイムアウト
    });
  }
  // モック: config.mock=true のとき。API を叩かず端末内で完結（画面確認用）
  function mockApi(action, body) {
    return loadMockData().then(function () {
      var m = window.GT_MOCK_MASTERS && window.GT_MOCK_MASTERS[S.site];
      if (!m) throw { code: 'bad_site', message: 'mock: site not found' };
      var log = LS.get('gtp_mock_log', []);
      if (action === 'masters') return { ok: true, items: m.items.map(function (r) { return { code: r[0], name: r[1], en: r[2], unit: r[4], price: r[3] === '' || r[3] == null ? null : Number(r[3]), priced: r[3] !== '' && r[3] !== null, pending: String(r[5] || '').indexOf('単価要確認') >= 0 }; }), suppliers: m.suppliers.map(function (r) { return { code: r[0], name: r[1], en: r[2] }; }), prices: m.prices || {}, pricePairs: Object.keys(m.prices || {}), features: ['addSupplier', 'addItem', 'fixRequest'], cancelHours: 0 };
      if (action === 'addItem') {
        var inm = String(body.name || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
        var same2 = m.items.filter(function (r) { return normName(r[1]) === normName(inm); })[0];
        if (same2) return { ok: true, dup: true, item: { code: same2[0], name: same2[1], en: same2[2], unit: same2[4], price: same2[3] === '' ? null : same2[3], priced: same2[3] !== '' } };
        var icode = m.items.reduce(function (a, r) { return Math.max(a, Number(r[0]) || 0); }, 0) + 1;
        var ip = body.price === '' || body.price == null ? '' : Number(body.price);
        m.items.push([icode, inm, '', ip, body.unit || 'kg', ip === '' ? 'アプリから追加（モック）' : '【単価要確認】アプリから追加（モック）']);
        return { ok: true, created: true, item: { code: icode, name: inm, en: '', unit: body.unit || 'kg', price: ip === '' ? null : ip, priced: ip !== '', pending: ip !== '' } };
      }
      if (action === 'addSupplier') {
        var nm = String(body.name || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
        if (!nm) throw { code: 'bad_name', message: 'mock: name required' };
        var same = m.suppliers.filter(function (r) { return normName(r[1]) === normName(nm); })[0];
        if (same) return { ok: true, dup: true, supplier: { code: same[0], name: same[1], en: same[2] } };
        var code = m.suppliers.reduce(function (a, r) { return Math.max(a, Number(r[0]) || 0); }, 0) + 1;
        m.suppliers.push([code, nm, '', 'アプリから追加（モック）']);
        return { ok: true, created: true, supplier: { code: code, name: nm, en: '' } };
      }
      if (action === 'add') {
        var mi = {}; m.items.forEach(function (r) { mi[r[0]] = r; }); var mp = m.prices || {};
        var results = body.entries.map(function (e) {
          if (log.some(function (l) { return l.id === e.id; })) return { id: e.id, ok: true, dup: true };
          var it = mi[e.itemCode] || [], vp = mp[e.supCode + '|' + e.itemCode];
          var price = vp != null ? vp : (it[3] === '' || it[3] == null ? null : Number(it[3])), kind = vp != null ? '取引先別' : (price == null ? '未設定' : 'マスター');
          log.push({ id: e.id, createdAt: nowIso(), date: e.date, supCode: e.supCode, itemCode: e.itemCode, qty: e.qty, price: price, priceKind: kind, status: '有効', user: e.user, note: e.note, site: S.site });
          return { id: e.id, ok: true, price: price, priceKind: kind };
        });
        LS.set('gtp_mock_log', log); return { ok: true, results: results };
      }
      if (action === 'fixRequest') {
        var reqs = LS.get('gtp_mock_req', {});
        if (reqs[body.reqId]) return { ok: true, dup: true };
        var tgt = log.filter(function (l) { return l.id === body.id; })[0];
        if (!tgt) throw { code: 'not_found', message: 'mock: not found' };
        if (tgt.status === '取消') throw { code: 'already_cancelled', message: 'この登録はすでに取消になっています' };
        if (tgt.req === '依頼中') throw { code: 'already_requested', message: 'この登録はすでに修正依頼中です' };
        reqs[body.reqId] = { id: body.id, kind: body.kind, qty: body.qty, note: body.note }; LS.set('gtp_mock_req', reqs);
        tgt.req = '依頼中'; LS.set('gtp_mock_log', log);
        return { ok: true, created: true, notified: false };
      }
      if (action === 'recent') {
        var items = {}, sups = {}; m.items.forEach(function (r) { items[r[0]] = r; }); m.suppliers.forEach(function (r) { sups[r[0]] = r; });
        return { ok: true, entries: log.filter(function (l) { return l.site === S.site && l.createdAt.slice(0, 10) >= daysAgoStr(RECENT_DAYS - 1); }).map(function (l) { var it = items[l.itemCode] || [], sp = sups[l.supCode] || []; return { id: l.id, createdAt: l.createdAt, date: l.date, supCode: l.supCode, supName: sp[1] || '', itemCode: l.itemCode, itemName: it[1] || '', itemEn: it[2] || '', unit: it[4] || '', qty: l.qty, priced: l.price != null, price: l.price == null ? null : l.price, amount: l.price == null ? null : l.price * l.qty, priceKind: l.priceKind, status: l.status, user: l.user, note: l.note, req: l.req || '' }; }).reverse() };
      }
      throw { code: 'unknown' };
    });
  }
  function loadMockData() {
    if (window.GT_MOCK_MASTERS) return Promise.resolve();
    return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = 'mock-data.js'; s.onload = res; s.onerror = function () { rej({ code: 'mock', message: 'mock-data.js が無い' }); }; document.head.appendChild(s); });
  }

  // ─── マスター ───
  function mastersKey() { return 'gtp_masters_' + S.site; }
  function validMasters(m) { return !!(m && Array.isArray(m.items) && Array.isArray(m.suppliers)); }
  function useMasters(m) {
    S.masters = m; S.mastersState = 'ok';
    var it = {}, sp = {};
    m.items.forEach(function (i) { it[i.code] = i; }); m.suppliers.forEach(function (s) { sp[s.code] = s; });
    S.itemByCode = it; S.supByCode = sp;
    renderPicker('sup'); renderPicker('item'); renderSelected(); renderToday();
    $('dMasters').textContent = m.fetchedAt ? t('mastersAt', { t: String(m.fetchedAt).replace('T', ' ').slice(5, 16) }) : t('mastersNone');
  }
  function loadMasters(force) {
    var cached = LS.get(mastersKey(), null);
    if (!validMasters(cached)) cached = null;   // 壊れた保存値では起動を止めない
    if (cached && !force) useMasters(cached);
    if (!apiReady() && cached) return Promise.resolve(cached);
    var site = S.site;
    if (!S.masters) { S.mastersState = 'loading'; renderMastersState(); }
    return api('masters').then(function (j) {
      if (site !== S.site) return S.masters;   // 読み込み中に拠点を変えた
      var m = { fetchedAt: nowIso(), items: j.items || [], suppliers: j.suppliers || [], prices: j.prices || {}, pricePairs: j.pricePairs || [], features: j.features || [], cancelHours: j.cancelHours || 0 };
      LS.set(mastersKey(), m); useMasters(m); return m;
    }).catch(function (err) {
      if (cached) return cached;
      if (site === S.site && !S.masters) { S.mastersState = 'error'; S.mastersError = err; renderMastersState(); }
      throw err;
    });
  }
  // マスター未取得のあいだ、取引先・商品の一覧に「読み込み中」「読み込めなかった＋もう一度」を出す（空の一覧のまま止まって見えないように）
  function renderMastersState() {
    if (S.masters) return;
    ['sup', 'item'].forEach(function (kind) {
      $(kind + 'Frequent').innerHTML = ''; $(kind + 'Add').classList.add('hidden');
      var box = $(kind + 'List');
      if (S.mastersState === 'error') {
        var err = S.mastersError || {};
        var msg = err.code === 'network' ? t('mastersFailed') : err.code === 'bad_pin' || err.code === 'no_pin' || err.code === 'wrong_sheet' ? t('badPin') : (err.message || t('mastersFailed'));
        box.innerHTML = '<div class="empty state"><b>' + esc(msg) + '</b><button type="button" class="ghost retry-masters">' + esc(t('tryAgain')) + '</button></div>';
        box.querySelector('.retry-masters').onclick = function () { loadMasters(true).then(function () { flush(); refreshRecent(); }).catch(function () { }); };
      } else {
        box.innerHTML = '<div class="empty state"><span class="spinner"></span><b>' + esc(t('mastersLoading')) + '</b><small>' + esc(t('mastersSlow')) + '</small></div>';
      }
    });
  }

  // ─── ピッカー ───
  // 「よく使う」: 取引先は拠点ごと、商品は取引先ごと（2026-09-24〜 現場要望「業者を変えたら前の業者の商品履歴を出さない」）
  function freqKey(kind) { return 'gtp_freq_' + S.site + '_' + kind + (kind === 'item' ? '_' + (S.sup ? S.sup.code : '') : ''); }
  function bumpFreq(kind, code) { if (kind === 'item' && !S.sup) return; var f = LS.get(freqKey(kind), {}); f[code] = (f[code] || 0) + 1; LS.set(freqKey(kind), f); }
  function frequentCodes(kind) { if (kind === 'item' && !S.sup) return []; var f = LS.get(freqKey(kind), {}); return Object.keys(f).sort(function (a, b) { return f[b] - f[a]; }).slice(0, 8).map(Number); }
  // 検索は全角・半角、スペース、大文字小文字を区別しない（「ﾐｰﾄ」でも「ミート」が出る、「６４」でもコード64が出る）
  function matches(q, o) {
    if (!q) return true;
    var nq = normName(q); if (!nq) return true;
    return String(o.code) === nq || String(o.code).indexOf(nq) === 0 || normName(o.name).indexOf(nq) >= 0 || normName(o.en).indexOf(nq) >= 0;
  }
  function normName(s) { return String(s == null ? '' : s).normalize('NFKC').replace(/\s+/g, '').toLowerCase(); }
  function hasFeature(f) { return !!(S.masters && (S.masters.features || []).indexOf(f) >= 0); }
  function displayName(o) { return S.lang === 'en' && o.en ? o.en : o.name; }
  function subName(o) { return S.lang === 'en' && o.en ? o.name : ''; }
  // 単価の決定（シート側と同じ順）: 選択中の取引先×この商品の取引先別単価 → 商品マスタの単価 → なし
  function priceFor(item) {
    if (!item) return null;
    var map = (S.masters && S.masters.prices) || {};
    if (S.sup && map[S.sup.code + '|' + item.code] != null) return { price: Number(map[S.sup.code + '|' + item.code]), kind: 'sup' };
    if (item.price != null && item.price !== '') return { price: Number(item.price), kind: item.pending ? 'pending' : 'master' };
    return null;
  }
  function isPriced(item) {
    if (!item) return false;
    if (priceFor(item)) return true;
    var pairs = (S.masters && S.masters.pricePairs) || [];   // 旧キャッシュ（単価なし）との互換
    return !!(item.priced || (S.sup && pairs.indexOf(S.sup.code + '|' + item.code) >= 0));
  }
  function fmtYen(n) { var v = Math.round(Number(n)); return '¥' + (isFinite(v) ? v.toLocaleString('ja-JP') : '?'); }
  function priceTag(o) { var p = priceFor(o); return p ? ' ' + fmtYen(p.price) : (isPriced(o) ? '' : ' ・?'); }
  function updateAmount() {
    var p = priceFor(S.item), line = $('priceLine');
    if (!S.item || !p) { line.classList.add('hidden'); return; }
    line.classList.remove('hidden');
    $('priceValue').textContent = fmtYen(p.price) + (S.item.unit ? '/' + unitLabel(S.item.unit) : '');
    var k = $('priceKind'); k.textContent = p.kind === 'sup' ? t('supplierPrice') : p.kind === 'pending' ? t('pendingPrice') : '';
    k.classList.toggle('hidden', p.kind === 'master'); k.classList.toggle('warn', p.kind === 'pending');
    var q = qtyValue(); $('amountValue').textContent = q === null ? '—' : fmtYen(q * p.price);
  }
  function renderPicker(kind) {
    if (!S.masters) { renderMastersState(); return; }
    var list = kind === 'sup' ? S.masters.suppliers : S.masters.items;
    var q = $(kind + 'Search').value.trim();
    var byCode = kind === 'sup' ? S.supByCode : S.itemByCode;
    var chips = $(kind + 'Frequent'); chips.innerHTML = '';
    if (!q) frequentCodes(kind).forEach(function (c) {
      var o = byCode[c]; if (!o) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.innerHTML = '<i>' + esc(o.code) + '</i>' + esc(displayName(o));
      b.onclick = function () { select(kind, o); }; chips.appendChild(b);
    });
    var box = $(kind + 'List'); box.innerHTML = '';
    var hits = list.filter(function (o) { return matches(q, o); });
    if (kind === 'sup') renderAddSupplier(q, list); else renderAddItem(q, list);
    if (!hits.length) { box.innerHTML = '<div class="empty">' + esc(t('noMatch')) + '</div>'; return; }
    var frag = document.createDocumentFragment();
    hits.forEach(function (o) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'row';
      var sub = subName(o);
      b.innerHTML = '<span class="code">' + esc(o.code) + '</span><span class="name">' + esc(displayName(o)) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' +
        (kind === 'item' ? '<span class="tag">' + esc(unitLabel(o.unit)) + esc(priceTag(o)) + '</span>' : '');
      b.onclick = function () { select(kind, o); };
      frag.appendChild(b);
    });
    box.appendChild(frag);
  }
  // 検索した名前がどの取引先とも一致しないとき、その名前で追加するボタンを出す（数字だけの検索はコード検索なので出さない）
  function renderAddSupplier(q, list) {
    var btn = $('supAdd'); if (!btn) return;
    var show = hasFeature('addSupplier') && normName(q).length >= 2 && !/^[0-9]+$/.test(normName(q)) &&
      !list.some(function (o) { return normName(o.name) === normName(q); });
    btn.classList.toggle('hidden', !show);
    if (show) { btn.textContent = t('addSupplier', { name: q }); btn.dataset.name = q; }
  }
  function addSupplier() {
    var btn = $('supAdd'), name = (btn.dataset.name || '').trim();
    if (!name) return;
    if (!CFG.mock && (!navigator.onLine || !apiReady())) { toast(t('needOnline'), 'bad'); return; }
    ask(t('confirmAddSup', { name: name })).then(function (yes) { if (yes) doAddSupplier(btn, name); });
  }
  function doAddSupplier(btn, name) {
    btn.disabled = true;
    api('addSupplier', { name: name, meta: { user: S.user, device: S.device } }).then(function (j) {
      var sp = j.supplier;
      if (!S.masters.suppliers.some(function (o) { return o.code === sp.code; })) S.masters.suppliers.push(sp);
      S.masters.suppliers.sort(function (a, b) { return a.code - b.code; });
      LS.set(mastersKey(), S.masters);
      $('supSearch').value = '';
      useMasters(S.masters);
      select('sup', S.supByCode[sp.code]);
      bumpFreq('sup', sp.code);
      toast(t(j.created ? 'supAdded' : 'supExists', { code: sp.code, name: sp.name }), 'ok');
    }).catch(function (err) {
      if (err && err.code === 'network') toast(t('needOnline'), 'bad');
      else if (err && /unknown/.test(err.message || err.code || '')) toast(t('featureNotReady'), 'bad');
      else toast((err && err.message) || t('netError'), 'bad');
    }).then(function () { btn.disabled = false; });
  }
  var UNIT_CHOICES = ['kg', '個', '本', '枚', '台', '箱', '袋', '一式'];
  function renderAddItem(q, list) {
    var btn = $('itemAdd'); if (!btn) return;
    var show = hasFeature('addItem') && normName(q).length >= 2 && !/^[0-9]+$/.test(normName(q)) &&
      !list.some(function (o) { return normName(o.name) === normName(q); }) && $('itemAddForm').classList.contains('hidden');
    btn.classList.toggle('hidden', !show);
    if (show) { btn.textContent = t('addItem', { name: q }); btn.dataset.name = q; }
  }
  function openItemForm() {
    var sel = $('newItemUnit'); sel.innerHTML = '';
    UNIT_CHOICES.forEach(function (u) { var o = document.createElement('option'); o.value = u; o.textContent = unitLabel(u); sel.appendChild(o); });
    $('newItemName').value = $('itemAdd').dataset.name || ''; $('newItemPrice').value = ''; $('newItemError').textContent = '';
    $('itemAdd').classList.add('hidden'); $('itemAddForm').classList.remove('hidden');
    setTimeout(function () { $('newItemPrice').focus(); }, 50);
  }
  function closeItemForm() { $('itemAddForm').classList.add('hidden'); renderPicker('item'); }
  function submitItem() {
    var name = $('newItemName').value.trim(), unit = $('newItemUnit').value;
    var raw = $('newItemPrice').value.normalize('NFKC').replace(/[,円\s]/g, '');
    if (!name) { $('newItemError').textContent = t('nameRequired'); return; }
    if (raw !== '' && !(isFinite(Number(raw)) && Number(raw) >= 0)) { $('newItemError').textContent = t('priceInvalid'); return; }
    if (!CFG.mock && (!navigator.onLine || !apiReady())) { $('newItemError').textContent = t('needOnline'); return; }
    var btn = $('newItemSubmit'); btn.disabled = true; $('newItemError').textContent = '';
    api('addItem', { name: name, unit: unit, price: raw, meta: { user: S.user, device: S.device } }).then(function (j) {
      var it = j.item;
      if (!S.masters.items.some(function (o) { return o.code === it.code; })) S.masters.items.push(it);
      S.masters.items.sort(function (a, b) { return a.code - b.code; });
      LS.set(mastersKey(), S.masters);
      $('itemAddForm').classList.add('hidden'); $('itemSearch').value = '';
      useMasters(S.masters);
      select('item', S.itemByCode[it.code]);
      bumpFreq('item', it.code);
      toast(t(j.created ? 'itemAdded' : 'itemExists', { code: it.code, name: it.name }), 'ok');
    }).catch(function (err) {
      if (err && err.code === 'network') $('newItemError').textContent = t('needOnline');
      else if (err && /unknown/.test(err.message || err.code || '')) $('newItemError').textContent = t('featureNotReady');
      else $('newItemError').textContent = (err && err.message) || t('netError');
    }).then(function () { btn.disabled = false; });
  }
  function select(kind, o) {
    if (kind === 'sup') S.sup = o; else S.item = o;
    if (kind === 'sup') renderPicker('item');   // 取引先が変わると「?」（単価未設定）の表示も変わる
    renderSelected();
    if (kind === 'sup') { if (!S.item) { $('itemCard').scrollIntoView({ behavior: 'smooth', block: 'start' }); setTimeout(function () { $('itemSearch').focus(); }, 250); } else $('qtyInput').focus(); }
    else { $('qtyCard').scrollIntoView({ behavior: 'smooth', block: 'start' }); setTimeout(function () { $('qtyInput').focus(); }, 250); }
  }
  function renderSelected() {
    ['sup', 'item'].forEach(function (kind) {
      var o = kind === 'sup' ? S.sup : S.item, sel = $(kind + 'Selected'), pick = $(kind + 'Picker'), chg = $(kind + 'Change');
      if (o) {
        var sub = subName(o);
        sel.innerHTML = '<span class="code">' + esc(o.code) + '</span><span class="name">' + esc(displayName(o)) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' + (kind === 'item' ? '<span class="tag">' + esc(unitLabel(o.unit)) + esc(priceTag(o)) + '</span>' : '');
        sel.classList.remove('hidden'); pick.classList.add('hidden'); chg.classList.remove('hidden');
      } else { sel.classList.add('hidden'); pick.classList.remove('hidden'); chg.classList.add('hidden'); }
    });
    $('unitLabel').textContent = S.item ? unitLabel(S.item.unit) : '';
    $('unpricedHint').classList.toggle('hidden', !(S.item && !isPriced(S.item)));
    updateSaveBtn();
  }
  function change(kind) { if (kind === 'sup') S.sup = null; else { S.item = null; $('itemAddForm').classList.add('hidden'); } renderSelected(); $(kind + 'Search').value = ''; renderPicker(kind); if (kind === 'sup') renderPicker('item'); setTimeout(function () { $(kind + 'Search').focus(); }, 50); }
  function qtyValue() { var v = $('qtyInput').value.replace(/[０-９．]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/,/g, '').trim(); var n = Number(v); return v && isFinite(n) && n > 0 ? n : null; }
  function updateSaveBtn() { $('saveBtn').disabled = !(S.sup && S.item && qtyValue() !== null && $('dateInput').value); updateAmount(); }

  // ─── 登録・キュー ───
  function todayKey() { return 'gtp_today_' + S.site; }
  function saveToday() { LS.set(todayKey(), S.today); }
  function save() {
    var qty = qtyValue();
    if (!S.sup || !S.item) { $('saveError').textContent = t('selectFirst'); return; }
    if (qty === null) { $('saveError').textContent = t('qtyInvalid'); return; }
    $('saveError').textContent = '';
    var p = priceFor(S.item);
    var e = { id: uid('E'), createdAt: nowIso(), date: $('dateInput').value, supCode: S.sup.code, supName: S.sup.name, supEn: S.sup.en || '',
      itemCode: S.item.code, itemName: S.item.name, itemEn: S.item.en || '', unit: S.item.unit, priced: isPriced(S.item), price: p ? p.price : null, qty: qty,
      note: $('noteInput').value.trim(), user: S.user, status: 'wait', error: '' };
    S.today.unshift(e); saveToday();
    S.queue.push({ id: e.id, site: S.site, date: e.date, supCode: e.supCode, itemCode: e.itemCode, qty: e.qty, note: e.note, user: e.user }); LS.set('gtp_queue', S.queue);
    bumpFreq('sup', e.supCode); bumpFreq('item', e.itemCode);
    toast(t('saved') + '：' + displayName(S.item) + ' ' + fmtQty(qty) + unitLabel(S.item.unit) + (p ? ' = ' + fmtYen(qty * p.price) : ''), 'ok');
    S.item = null; $('qtyInput').value = ''; $('noteInput').value = ''; $('itemSearch').value = '';
    renderSelected(); renderPicker('item'); renderToday();
    $('itemCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    flush();
  }
  // 送信待ちは拠点ごと。拠点を切り替えても、別拠点の分を今の拠点のシートへ送らない（取引先・商品コードは拠点ごとに別物）
  function siteQueue() { return S.queue.filter(function (q) { return q.site === S.site; }); }
  function flush() {
    renderPending();
    if (S.busy || !siteQueue().length || !apiReady()) return Promise.resolve();
    S.busy = true; setNet(null);
    var before = siteQueue().length;
    var batch = siteQueue().slice(0, 50).map(function (q) { return { id: q.id, date: q.date, supCode: q.supCode, itemCode: q.itemCode, qty: q.qty, note: q.note, user: q.user }; });
    return api('add', { entries: batch, meta: { user: S.user, device: S.device } }).then(function (j) {
      (j.results || []).forEach(function (r) {
        var e = S.today.filter(function (x) { return x.id === r.id; })[0];
        S.queue = S.queue.filter(function (q) { return q.id !== r.id; });
        if (r.ok) { if (e) { e.status = 'ok'; e.error = ''; if (r.price !== undefined) e.price = r.price; } }   // 単価はサーバー確定値で上書き
        else if (e) { e.status = 'error'; e.error = r.error || 'error'; }
      });
      LS.set('gtp_queue', S.queue); saveToday(); renderToday();
    }).catch(function (err) {
      if (err && (err.code === 'bad_pin' || err.code === 'no_pin' || err.code === 'wrong_sheet')) { toast(t('badPin'), 'bad'); }
    }).then(function () {
      S.busy = false; renderPending();
      var left = siteQueue().length;
      if (left && S.netOk && left < before) return flush();   // 減っているときだけ続ける（応答がおかしいときに送り続けない）
    });
  }
  function renderPending() {
    var n = siteQueue().length; $('pendingBar').classList.toggle('hidden', n === 0);
    $('pendingText').textContent = t('pendingText', { n: n }); $('dPending').textContent = n;
    $('apiWarn').classList.toggle('hidden', apiReady());
  }
  function refreshRecent() {
    if (!apiReady()) return Promise.resolve();
    return api('recent', { days: RECENT_DAYS }).then(function (j) {
      var mine = {}; S.today.forEach(function (e) { mine[e.id] = e; });
      (j.entries || []).forEach(function (r) {
        var st = r.status === '取消' ? 'cancel' : 'ok';
        var e = mine[r.id];
        if (e) {   // 経理がシートで直した数量・取消・依頼の状態もここで反映される
          e.status = st; e.error = ''; e.qty = r.qty; e.date = r.date; e.unit = r.unit || e.unit;
          // 送った直後の「依頼中」は、それより前に作られた一覧（行き違い・サーバーの一時保存）で消さない
          if (r.req || !(e.req === '依頼中' && e.reqAt && Date.now() - e.reqAt < REQ_HOLD_MS)) e.req = r.req || '';
          if (r.price !== undefined) e.price = r.price;
        }
        else {
          var it = S.itemByCode && S.itemByCode[r.itemCode], sp = S.supByCode && S.supByCode[r.supCode];
          S.today.push({ id: r.id, createdAt: r.createdAt, date: r.date, supCode: r.supCode, supName: r.supName, supEn: sp ? sp.en : '', itemCode: r.itemCode, itemName: r.itemName, itemEn: it ? it.en : '', unit: r.unit, priced: r.priced, price: r.price == null ? null : r.price, qty: r.qty, note: r.note, user: r.user, status: st, req: r.req || '', remote: true });
        }
      });
      S.today.sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
      saveToday(); renderToday();
    }).catch(function () { });
  }
  // 一覧は直近3日分（登録日時で判断）。同じ拠点なら他の端末で入れた分も出る
  // 2026-09-24〜 取消・数量の修正は経理が行う（現場からの要望）。現場は送信済みの登録に「修正依頼」を送るだけ。依頼中は「修正依頼中」と出る
  var RECENT_DAYS = 3;
  function daysAgoStr(n) { var d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function parseQty(v) { var s = String(v == null ? '' : v).normalize('NFKC').replace(/,/g, '').trim(); var n = Number(s); return s && isFinite(n) && n > 0 ? n : null; }
  var REQ_KINDS = ['qty', 'cancel', 'other'];
  // 修正依頼フォームの中身と送信中の状態は画面の外に持つ。一覧を描き直しても（電波復帰・アプリに戻る・更新）入力途中や送信中が消えないように
  var REQ_FORM = {};   // 登録ID → { reqId, kind, qtyRaw, note, sending, error, sent }
  var REQ_HOLD_MS = 15 * 60 * 1000;
  function openReq(e, d) {
    if (d.querySelector('.reqbox')) return;
    var f = REQ_FORM[e.id] || (REQ_FORM[e.id] = { reqId: uid('R'), kind: '', qtyRaw: fmtQty(e.qty), note: '', sending: false, error: '', sent: '' });
    var box = document.createElement('div'); box.className = 'reqbox';
    box.innerHTML = '<b></b><div class="kinds"></div>' +
      '<div class="rq-qty hidden"><label></label><div class="rq-row"><input type="text" inputmode="decimal" autocomplete="off"><span class="u"></span></div></div>' +
      '<label class="rq-note-l"></label><input class="rq-note" maxlength="200" autocomplete="off">' +
      '<div class="rq-actions"><button type="button" class="ghost rq-close"></button><button type="button" class="primary rq-send"></button></div><div class="error"></div>';
    var kinds = box.querySelector('.kinds'), qbox = box.querySelector('.rq-qty'), qinp = qbox.querySelector('input');
    var note = box.querySelector('.rq-note'), noteL = box.querySelector('.rq-note-l'), err = box.querySelector('.error'), send = box.querySelector('.rq-send');
    box.querySelector('b').textContent = t('reqTitle');
    qbox.querySelector('label').textContent = t('correctQty'); qbox.querySelector('.u').textContent = unitLabel(e.unit);
    qinp.value = f.qtyRaw; note.value = f.note; err.textContent = f.error;
    qinp.oninput = function () { f.qtyRaw = qinp.value; }; note.oninput = function () { f.note = note.value; };
    box.querySelector('.rq-close').textContent = t('reqClose');
    send.textContent = t(f.sending ? 'reqSending' : 'reqSend'); send.disabled = f.sending;
    var pick = function (k, focus) {
      f.kind = k;
      kinds.querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x.getAttribute('data-kind') === k); });
      qbox.classList.toggle('hidden', k !== 'qty'); noteL.textContent = t(k === 'other' ? 'reqNoteOther' : 'reqNote');
      if (focus) setTimeout(function () { if (k === 'qty') { qinp.focus(); qinp.select(); } else if (k === 'other') note.focus(); }, 30);
    };
    REQ_KINDS.forEach(function (k) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = t('kind_' + k); b.setAttribute('data-kind', k); b.disabled = f.sending;
      b.onclick = function () { f.error = ''; err.textContent = ''; pick(k, true); };
      kinds.appendChild(b);
    });
    noteL.textContent = t('reqNote');
    if (f.kind) pick(f.kind, false);
    box.querySelector('.rq-close').onclick = function () { if (f.sending) return; delete REQ_FORM[e.id]; box.remove(); };
    send.onclick = function () { sendReq(e); };
    d.appendChild(box);
  }
  function sendReq(e) {
    var f = REQ_FORM[e.id]; if (!f || f.sending) return;
    var q = null, note = String(f.note || '').trim(), msg = '';
    if (!f.kind) msg = t('reqKindRequired');
    else if (f.kind === 'qty' && (q = parseQty(f.qtyRaw)) === null) msg = t('qtyInvalid');
    else if (f.kind === 'qty' && q === Number(e.qty)) msg = t('reqSameQty');
    else if (f.kind === 'other' && !note) msg = t('reqNoteRequired');
    else if (!CFG.mock && (!navigator.onLine || !apiReady())) msg = t('needOnlineReq');
    if (msg) { f.error = msg; renderToday(); return; }
    // 通信が途切れたあと内容を変えて送り直すときは、別の依頼にする（同じIDだとサーバーは最初の内容のまま「重複」として扱う）
    var payload = JSON.stringify([f.kind, q, note]);
    if (f.sent && f.sent !== payload) f.reqId = uid('R');
    f.sent = payload; f.sending = true; f.error = ''; renderToday();
    var done = function (toastMsg, cls) { delete REQ_FORM[e.id]; saveToday(); renderToday(); toast(toastMsg, cls); };
    api('fixRequest', { id: e.id, reqId: f.reqId, kind: f.kind, qty: q === null ? '' : q, note: note, meta: { user: S.user, device: S.device } }).then(function () {
      e.req = '依頼中'; e.reqAt = Date.now(); done(t('reqSent'), 'ok');
    }).catch(function (x) {
      f.sending = false;
      if (x && x.code === 'already_requested') { e.req = '依頼中'; e.reqAt = Date.now(); done(t('reqAlready'), 'bad'); return; }
      if (x && x.code === 'already_cancelled') { e.status = 'cancel'; done(x.message, 'bad'); return; }
      f.error = x && x.code === 'network' ? t('needOnlineReq') : ((x && x.message) || t('netError'));
      renderToday();
    });
  }
  function renderToday() {
    var td = todayStr(), from = daysAgoStr(RECENT_DAYS - 1);
    S.today = (Array.isArray(S.today) ? S.today : []).filter(function (e) { return e && typeof e.createdAt === 'string' && e.createdAt.slice(0, 10) >= from && String(e.id).indexOf('MIG-') !== 0; });
    var box = $('todayList'); box.innerHTML = '';
    $('todayCount').textContent = S.today.filter(function (e) { return e.status !== 'cancel'; }).length;
    if (!S.today.length) { box.innerHTML = '<div class="empty">—</div>'; return; }
    S.today.forEach(function (e) {
      var d = document.createElement('div'); d.className = 'entry' + (e.status === 'cancel' ? ' cancelled' : '');
      var itName = S.lang === 'en' && e.itemEn ? e.itemEn : e.itemName, spName = S.lang === 'en' && e.supEn ? e.supEn : e.supName;
      var st = e.status === 'ok' ? '<span class="st ok">' + esc(t('sent')) + '</span>' : e.status === 'wait' ? '<span class="st wait">' + esc(t('waiting')) + '</span>' : e.status === 'cancel' ? '<span class="st cancel">' + esc(t('cancelled')) + '</span>' : '<span class="st wait" title="' + esc(e.error) + '">' + esc(t('errorLabel')) + '</span>';
      var day = e.createdAt.slice(0, 10), when = (day === td ? '' : '<i>' + Number(day.slice(5, 7)) + '/' + Number(day.slice(8, 10)) + '</i>') + esc(e.createdAt.slice(11, 16));
      d.innerHTML = '<div class="line"><span class="t">' + when + '</span><div class="body"><b>' + esc(spName) + '</b><small>' + esc(itName) + (e.date !== td ? ' · ' + esc(e.date) : '') + (e.user ? ' · ' + esc(e.user) : '') + (e.error ? ' · ' + esc(e.error) : '') + '</small></div>' +
        '<span class="q">' + esc(fmtQty(e.qty)) + '<small> ' + esc(unitLabel(e.unit)) + '</small>' + (e.price != null ? '<em>' + esc(fmtYen(e.qty * e.price)) + '</em>' : '') + '</span>' + st + '</div>';
      if (e.status === 'ok' && hasFeature('fixRequest')) {   // 送信待ち・エラーの登録は、まだシートに無いので依頼できない
        var acts = document.createElement('div'); acts.className = 'acts';
        if (e.req === '依頼中') acts.innerHTML = '<span class="req-open">' + esc(t('reqOpen')) + '</span>';
        else {
          if (e.req === '対応済み') acts.innerHTML = '<span class="req-done">' + esc(t('reqDone')) + '</span>';
          var rb = document.createElement('button'); rb.type = 'button'; rb.className = 'rq'; rb.textContent = t('fixReq'); rb.onclick = function () { openReq(e, d); }; acts.appendChild(rb);
        }
        d.appendChild(acts);
        if (REQ_FORM[e.id] && e.req !== '依頼中') openReq(e, d);   // 描き直す前に開いていたフォームを戻す
      } else if (e.status === 'cancel' && e.req) {   // 経理が取消で対応した依頼も「対応済み」と分かるように
        var ca = document.createElement('div'); ca.className = 'acts';
        ca.innerHTML = '<span class="' + (e.req === '対応済み' ? 'req-done' : 'req-open') + '">' + esc(t(e.req === '対応済み' ? 'reqDone' : 'reqOpen')) + '</span>';
        d.appendChild(ca);
      }
      box.appendChild(d);
    });
  }

  // ─── 画面遷移 ───
  // エラーは読み切れるよう長めに出す
  function toast(msg, cls) { var el = $('toast'); el.textContent = msg; el.className = 'toast ' + (cls || ''); clearTimeout(toast.timer); toast.timer = setTimeout(function () { el.classList.add('hidden'); }, cls === 'bad' ? 4500 : 2200); }
  // 確認ダイアログ。window.confirm は LINE などのアプリ内ブラウザで出ずに「キャンセル」扱いになることがあるため、画面内に出す
  function ask(msg) {
    return new Promise(function (resolve) {
      var box = $('confirmBox');
      $('confirmText').textContent = msg; $('confirmYes').textContent = t('ok'); $('confirmNo').textContent = t('no');
      var done = function (v) { box.classList.add('hidden'); $('confirmYes').onclick = $('confirmNo').onclick = box.onclick = null; resolve(v); };
      $('confirmYes').onclick = function (ev) { ev.stopPropagation(); done(true); };
      $('confirmNo').onclick = function (ev) { ev.stopPropagation(); done(false); };
      box.onclick = function (ev) { if (ev.target === box) done(false); };
      box.classList.remove('hidden');
      setTimeout(function () { $('confirmYes').focus(); }, 30);
    });
  }
  function showSetup(err) {
    $('app').classList.add('hidden'); $('setup').classList.remove('hidden');
    var box = $('siteButtons'); box.innerHTML = '';
    (CFG.sites || ['長野', '千葉']).forEach(function (s) { var b = document.createElement('button'); b.type = 'button'; b.className = 'site-btn' + (S.site === s ? ' active' : ''); b.textContent = siteLabel(s); b.onclick = function () { S.site = s; box.querySelectorAll('.site-btn').forEach(function (x) { x.classList.toggle('active', x === b); }); }; box.appendChild(b); });
    $('userInput').value = S.user || ''; $('setupError').textContent = err || '';
    applyI18n();
  }
  // 「はじめる」は通信を待たずにすぐ画面へ進む（以前はマスター取得を待っていたため、サーバーが遅い朝は25秒で失敗して先へ進めなかった）
  function start() {
    var user = $('userInput').value.trim();
    if (!S.site) { $('setupError').textContent = t('siteRequired'); return; }
    if (LS.get('gtp_site', '') !== S.site || !S.masters) {   // 拠点を変えたら、前の拠点で選んだ取引先・商品を持ち越さない
      S.sup = null; S.item = null; S.masters = null; S.itemByCode = null; S.supByCode = null;
      $('supSearch').value = ''; $('itemSearch').value = ''; $('qtyInput').value = ''; $('itemAddForm').classList.add('hidden');
    }
    S.user = user; $('setupError').textContent = '';
    LS.set('gtp_site', S.site); LS.set('gtp_user', S.user);
    safeShowApp();
  }
  function showApp() {
    $('setup').classList.add('hidden'); $('app').classList.remove('hidden');
    var qd = LS.get('gtp_queue', []), legacy = false;
    S.queue = (Array.isArray(qd) ? qd : []).filter(function (q) { return q && q.id; });
    S.queue.forEach(function (q) { if (!q.site) { q.site = S.site; legacy = true; } });   // 旧版の送信待ち（拠点なし）は今の拠点の分とみなす
    if (legacy) LS.set('gtp_queue', S.queue);
    var td = LS.get(todayKey(), []); S.today = Array.isArray(td) ? td : [];
    $('userLabel').textContent = S.user || '—'; $('dSite').textContent = siteLabel(S.site); $('dUser').value = S.user; $('dVersion').textContent = CFG.version || '';
    var au = apiUrlFor(S.site);
    $('dApi').textContent = CFG.mock ? t('mockOn') : (au ? au.replace(/^https?:\/\//, '').slice(0, 40) + '…' : t('apiOff'));
    if (!$('dateInput').value) $('dateInput').value = todayStr();
    applyI18n(); renderPending(); renderSelected(); renderToday(); setNet(null);
    if (!S.masters) renderMastersState();
    // マスターが取れなくても、送信待ちの送信と最近の登録の取得は進める
    loadMasters(false).catch(function () { }).then(function () { return flush(); }).then(function () { return refreshRecent(); });
  }
  // 端末に残った古い・壊れた保存データで画面が作れないときは、送信待ち以外の保存値を消して開き直す
  function safeShowApp() {
    try { showApp(); }
    catch (err) {
      LS.del(todayKey()); LS.del(mastersKey()); S.today = []; S.masters = null; S.sup = null; S.item = null;
      try { showApp(); } catch (err2) { showSetup('起動エラー / Startup error: ' + String((err2 && err2.message) || err2)); }
    }
  }

  // ─── 起動 ───
  function init() {
    S.lang = LS.get('gtp_lang', (navigator.language || 'ja').indexOf('ja') === 0 ? 'ja' : 'en');
    S.site = LS.get('gtp_site', ''); S.user = LS.get('gtp_user', '');
    LS.del('gtp_pin');   // 旧版が端末に保存していたPINは残さない
    (CFG.sites || []).forEach(function (s) { LS.del('gtp_freq_' + s + '_item'); });   // 旧版の「拠点ごとの商品履歴」（2026-09-24 から取引先ごと）
    // 拠点ごとのURL（?site=長野）で開くと拠点選択を飛ばせる。QRやホーム画面用
    var q = /[?&]site=([^&#]+)/.exec(location.search);
    if (q) { var qs = ''; try { qs = decodeURIComponent(q[1].replace(/\+/g, ' ')).trim(); } catch (e) { qs = ''; } if ((CFG.sites || []).indexOf(qs) >= 0) S.site = qs; }
    S.device = LS.get('gtp_device', ''); if (!S.device) { S.device = uid('D'); LS.set('gtp_device', S.device); }

    document.querySelectorAll('.lang').forEach(function (b) { b.onclick = function () { setLang(b.getAttribute('data-lang')); }; });
    $('langBtn').onclick = function () { setLang(S.lang === 'ja' ? 'en' : 'ja'); };
    $('startBtn').onclick = start;
    $('userInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') start(); });
    $('todayBtn').onclick = function () { $('dateInput').value = todayStr(); updateSaveBtn(); };
    $('dateInput').onchange = updateSaveBtn;
    $('supSearch').oninput = function () { renderPicker('sup'); }; $('itemSearch').oninput = function () { renderPicker('item'); };
    $('supChange').onclick = function () { change('sup'); };
    $('supAdd').onclick = addSupplier;
    $('itemAdd').onclick = openItemForm; $('newItemCancel').onclick = closeItemForm; $('newItemSubmit').onclick = submitItem;
    $('newItemPrice').addEventListener('keydown', function (e) { if (e.key === 'Enter') submitItem(); }); $('itemChange').onclick = function () { change('item'); };
    $('qtyInput').oninput = updateSaveBtn;
    $('qtyInput').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !$('saveBtn').disabled) save(); });
    $('saveBtn').onclick = save;
    $('retryBtn').onclick = function () { flush(); };
    $('refreshBtn').onclick = function () { flush().then(refreshRecent); };
    $('settingsBtn').onclick = function () { $('drawer').classList.remove('hidden'); };
    document.querySelectorAll('[data-close]').forEach(function (el) { el.onclick = function () { $('drawer').classList.add('hidden'); }; });
    $('dUser').onchange = function () { S.user = $('dUser').value.trim(); LS.set('gtp_user', S.user); $('userLabel').textContent = S.user || '—'; };
    $('dReload').onclick = function () { loadMasters(true).then(function () { toast(t('mastersUpdated'), 'ok'); }).catch(function (err) { toast((err && err.message) || t('netError'), 'bad'); }); };
    $('dResetSite').onclick = function () { $('drawer').classList.add('hidden'); showSetup(); };
    // 電波が戻った・アプリに戻ってきたときは、読み込めていないマスターも取り直す
    var resume = function () { if ($('app').classList.contains('hidden')) return; if (!S.masters && S.mastersState !== 'loading') loadMasters(true).catch(function () { }); flush().then(refreshRecent); };
    window.addEventListener('online', function () { setNet(null); resume(); }); window.addEventListener('offline', function () { setNet(false); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) resume(); });
    setInterval(function () { if (!$('app').classList.contains('hidden')) flush(); }, 30000);
    registerOffline();

    if (S.site) safeShowApp(); else showSetup();
  }
  // 電波がない場所でもアプリの画面を開けるよう、画面のファイルを端末に保存する（sw.js。通信できるときは常に最新を取りに行く）
  function registerOffline() {
    if (CFG.mock || !('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
    try { navigator.serviceWorker.register('sw.js').catch(function () { }); } catch (e) { }
  }
  try { init(); }
  catch (err) {   // 起動で落ちても真っ白にしない
    try { showSetup('起動エラー / Startup error: ' + String((err && err.message) || err)); } catch (e2) { }
  }
})();
