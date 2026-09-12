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
      unpricedHint: 'この商品は単価が都度決めです。数量だけ登録し、金額は管理者がシートで入れます。',
      save: '登録する', todayEntries: '本日の登録', refresh: '更新', retry: '再送',
      apiNotSet: 'API URL が未設定です（config.js）。登録は端末内に保存され、設定後に送信されます。',
      settings: '設定', language: '言語', masters: 'マスター', reload: '再取得', pendingLabel: '送信待ち', version: '版',
      changeSite: '拠点を選び直す', frequent: 'よく使う', noMatch: '該当なし', saved: '登録しました', sent: '送信済み', waiting: '送信待ち',
      cancelled: '取消', errorLabel: 'エラー', cancel: '取消', confirmCancel: 'この登録を取り消しますか？', pendingText: '送信待ち {n}件',
      qtyInvalid: '数量を入力してください', siteRequired: '拠点を選んでください', badPin: '登録できませんでした。管理者に連絡してください',
      netError: '通信できません。電波を確認してください', offlineStart: 'オフラインのため保存済みマスターで開始します',
      mastersAt: '取得 {t}', mastersNone: '未取得', apiOff: '未設定', mockOn: 'モック（端末内のみ）', selectFirst: '取引先と商品を選んでください',
      by: '入力', cancelFailed: '取り消せませんでした', mastersUpdated: 'マスターを更新しました', unit_kg: 'kg',
      unitPrice: '単価', amount: '金額', supplierPrice: '取引先別単価',
      addSupplier: '＋「{name}」を新しい取引先として追加', confirmAddSup: '「{name}」を取引先に追加します。\n会社名・店名にまちがいはありませんか？',
      supAdded: '取引先を追加しました：{code} {name}', supExists: 'すでに登録されていました：{code} {name}',
      needOnline: '追加は、電波のあるところでしてください', featureNotReady: 'この機能はまだ使えません。管理者に連絡してください',
      addItem: '＋「{name}」を新しい商品として追加', newItemTitle: '新しい商品を追加', itemNameLabel: '商品名', unitWord: '単位',
      priceYen: '単価（円）', priceHint: '単価がわからなければ空欄でOK。入れた単価は事務所が月末に確認します',
      addItemSubmit: '追加する', cancelAdd: 'やめる', itemAdded: '商品を追加しました：{code} {name}', itemExists: 'すでに登録されていました：{code} {name}',
      nameRequired: '商品名を入れてください', priceInvalid: '単価は数字で入れてください', pendingPrice: '現場入力の単価'
    },
    en: {
      appTitle: 'Purchase Entry', setupLead: 'Which site are you at? (first time only)', site: 'Site', userName: 'Your name (optional)',
      userPlaceholder: 'e.g. Yamada', start: 'Start', date: 'Date', today: 'Today', supplier: 'Supplier', item: 'Item', qty: 'Quantity', change: 'Change',
      searchPlaceholder: 'Search by code or name', notePlaceholder: 'Note (optional)',
      unpricedHint: 'This item has no fixed unit price. Enter the quantity only; the office sets the amount in the sheet.',
      save: 'Save', todayEntries: "Today's entries", refresh: 'Refresh', retry: 'Retry',
      apiNotSet: 'API URL is not set (config.js). Entries stay on this device and are sent once it is set.',
      settings: 'Settings', language: 'Language', masters: 'Master data', reload: 'Reload', pendingLabel: 'Pending', version: 'Version',
      changeSite: 'Change site', frequent: 'Frequent', noMatch: 'No match', saved: 'Saved', sent: 'Sent', waiting: 'Pending',
      cancelled: 'Cancelled', errorLabel: 'Error', cancel: 'Cancel', confirmCancel: 'Cancel this entry?', pendingText: '{n} pending',
      qtyInvalid: 'Enter a quantity', siteRequired: 'Choose a site', badPin: 'Could not save. Please contact the administrator.',
      netError: 'Cannot reach the server. Check your connection.', offlineStart: 'Offline: starting with cached master data',
      mastersAt: 'fetched {t}', mastersNone: 'not loaded', apiOff: 'not set', mockOn: 'mock (device only)', selectFirst: 'Choose a supplier and an item',
      by: 'by', cancelFailed: 'Could not cancel', mastersUpdated: 'Master data updated', unit_kg: 'kg',
      unitPrice: 'Unit price', amount: 'Amount', supplierPrice: 'supplier price',
      addSupplier: '+ Add "{name}" as a new supplier', confirmAddSup: 'Add "{name}" as a supplier?\nPlease check the company or shop name is correct.',
      supAdded: 'Supplier added: {code} {name}', supExists: 'Already registered: {code} {name}',
      needOnline: 'You need a connection to add this. Try again where you have signal.', featureNotReady: 'This is not available yet. Please contact the administrator.',
      addItem: '+ Add "{name}" as a new item', newItemTitle: 'Add a new item', itemNameLabel: 'Item name', unitWord: 'Unit',
      priceYen: 'Unit price (yen)', priceHint: 'Leave the price blank if you do not know it. The office checks any price you enter at month end.',
      addItemSubmit: 'Add', cancelAdd: 'Cancel', itemAdded: 'Item added: {code} {name}', itemExists: 'Already registered: {code} {name}',
      nameRequired: 'Enter the item name', priceInvalid: 'Enter the price as a number', pendingPrice: 'price set on site'
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
  function setLang(l) { S.lang = l; LS.set('gtp_lang', l); applyI18n(); if (S.masters) { renderPicker('sup'); renderPicker('item'); renderSelected(); renderToday(); } }

  // ─── 通信 ───
  function apiUrlFor(site) { return (CFG.apiUrls && CFG.apiUrls[site]) || CFG.apiUrl || ''; }
  // PIN は現場に入力させない。config.js の値を使う（古い端末に残っている保存値より config を優先）
  function pinFor(site) { return (CFG.pins && CFG.pins[site]) || CFG.pin || S.pin || ''; }
  function apiReady() { return !!(CFG.mock || apiUrlFor(S.site)); }
  function setNet(state) { S.netOk = state; var d = $('netDot'); d.className = 'dot ' + (state === true ? 'ok' : state === false ? 'bad' : navigator.onLine ? 'busy' : 'bad'); }
  function api(action, body, opts) {
    body = body || {}; opts = opts || {};
    if (CFG.mock) return mockApi(action, body).then(function (j) { setNet(true); return j; });
    var url = apiUrlFor(S.site);
    if (!url) return Promise.reject({ code: 'no_api', message: t('apiNotSet') });
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl && setTimeout(function () { ctl.abort(); }, opts.timeout || 25000);
    var base = { action: action, site: S.site, pin: pinFor(S.site) };
    var req;
    if (action === 'add' || action === 'cancel' || action === 'addSupplier' || action === 'addItem') {
      Object.keys(base).forEach(function (k) { body[k] = base[k]; });
      req = fetch(url, { method: 'POST', body: JSON.stringify(body), signal: ctl && ctl.signal, redirect: 'follow' });
    } else {
      var q = Object.keys(base).map(function (k) { return k + '=' + encodeURIComponent(base[k]); });
      Object.keys(body).forEach(function (k) { q.push(k + '=' + encodeURIComponent(body[k])); });
      req = fetch(url + '?' + q.join('&'), { signal: ctl && ctl.signal, redirect: 'follow' });
    }
    return req.then(function (r) { return r.text(); }).then(function (txt) {
      if (timer) clearTimeout(timer);
      var j; try { j = JSON.parse(txt); } catch (e) { throw { code: 'bad_response', message: 'サーバー応答が不正: ' + txt.slice(0, 80) }; }
      if (!j.ok) throw { code: j.code || 'error', message: j.error || 'error' };
      setNet(true); return j;
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      if (err && err.code && err.code !== 'bad_response') throw err;   // サーバーが返した業務エラー
      setNet(false); throw { code: 'network', message: t('netError') };
    });
  }
  // モック: config.mock=true のとき。API を叩かず端末内で完結（画面確認用）
  function mockApi(action, body) {
    return loadMockData().then(function () {
      var m = window.GT_MOCK_MASTERS && window.GT_MOCK_MASTERS[S.site];
      if (!m) throw { code: 'bad_site', message: 'mock: site not found' };
      var log = LS.get('gtp_mock_log', []);
      if (action === 'masters') return { ok: true, items: m.items.map(function (r) { return { code: r[0], name: r[1], en: r[2], unit: r[4], price: r[3] === '' || r[3] == null ? null : Number(r[3]), priced: r[3] !== '' && r[3] !== null, pending: String(r[5] || '').indexOf('単価要確認') >= 0 }; }), suppliers: m.suppliers.map(function (r) { return { code: r[0], name: r[1], en: r[2] }; }), prices: m.prices || {}, pricePairs: Object.keys(m.prices || {}), features: ['addSupplier', 'addItem'], cancelHours: 24 };
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
      if (action === 'cancel') { log.forEach(function (l) { if (l.id === body.id) l.status = '取消'; }); LS.set('gtp_mock_log', log); return { ok: true }; }
      if (action === 'recent') {
        var items = {}, sups = {}; m.items.forEach(function (r) { items[r[0]] = r; }); m.suppliers.forEach(function (r) { sups[r[0]] = r; });
        return { ok: true, entries: log.filter(function (l) { return l.site === S.site && l.createdAt.slice(0, 10) === todayStr(); }).map(function (l) { var it = items[l.itemCode] || [], sp = sups[l.supCode] || []; return { id: l.id, createdAt: l.createdAt, date: l.date, supCode: l.supCode, supName: sp[1] || '', itemCode: l.itemCode, itemName: it[1] || '', itemEn: it[2] || '', unit: it[4] || '', qty: l.qty, priced: l.price != null, price: l.price == null ? null : l.price, amount: l.price == null ? null : l.price * l.qty, priceKind: l.priceKind, status: l.status, user: l.user, note: l.note }; }).reverse() };
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
  function useMasters(m) {
    S.masters = m;
    var it = {}, sp = {};
    m.items.forEach(function (i) { it[i.code] = i; }); m.suppliers.forEach(function (s) { sp[s.code] = s; });
    S.itemByCode = it; S.supByCode = sp;
    renderPicker('sup'); renderPicker('item'); renderSelected(); renderToday();
    $('dMasters').textContent = m.fetchedAt ? t('mastersAt', { t: m.fetchedAt.replace('T', ' ').slice(5, 16) }) : t('mastersNone');
  }
  function loadMasters(force) {
    var cached = LS.get(mastersKey(), null);
    if (cached && !force) useMasters(cached);
    if (!apiReady() && cached) return Promise.resolve(cached);
    return api('masters').then(function (j) {
      var m = { fetchedAt: nowIso(), items: j.items, suppliers: j.suppliers, prices: j.prices || {}, pricePairs: j.pricePairs || [], features: j.features || [], cancelHours: j.cancelHours || 24 };
      LS.set(mastersKey(), m); useMasters(m); return m;
    }).catch(function (err) {
      if (cached) return cached;
      throw err;
    });
  }

  // ─── ピッカー ───
  function freqKey(kind) { return 'gtp_freq_' + S.site + '_' + kind; }
  function bumpFreq(kind, code) { var f = LS.get(freqKey(kind), {}); f[code] = (f[code] || 0) + 1; LS.set(freqKey(kind), f); }
  function frequentCodes(kind) { var f = LS.get(freqKey(kind), {}); return Object.keys(f).sort(function (a, b) { return f[b] - f[a]; }).slice(0, 8).map(Number); }
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
    if (!S.masters) return;
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
    if (!confirm(t('confirmAddSup', { name: name }))) return;
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
  function change(kind) { if (kind === 'sup') S.sup = null; else { S.item = null; $('itemAddForm').classList.add('hidden'); } renderSelected(); $(kind + 'Search').value = ''; renderPicker(kind); setTimeout(function () { $(kind + 'Search').focus(); }, 50); }
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
    S.queue.push({ id: e.id, date: e.date, supCode: e.supCode, itemCode: e.itemCode, qty: e.qty, note: e.note, user: e.user }); LS.set('gtp_queue', S.queue);
    bumpFreq('sup', e.supCode); bumpFreq('item', e.itemCode);
    toast(t('saved') + '：' + displayName(S.item) + ' ' + fmtQty(qty) + unitLabel(S.item.unit) + (p ? ' = ' + fmtYen(qty * p.price) : ''), 'ok');
    S.item = null; $('qtyInput').value = ''; $('noteInput').value = ''; $('itemSearch').value = '';
    renderSelected(); renderPicker('item'); renderToday();
    $('itemCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    flush();
  }
  function flush() {
    renderPending();
    if (S.busy || !S.queue.length || !apiReady()) return Promise.resolve();
    S.busy = true; setNet(null);
    var batch = S.queue.slice(0, 50);
    return api('add', { entries: batch, meta: { user: S.user, device: S.device } }).then(function (j) {
      (j.results || []).forEach(function (r) {
        var e = S.today.filter(function (x) { return x.id === r.id; })[0];
        if (r.ok) { S.queue = S.queue.filter(function (q) { return q.id !== r.id; }); if (e) { e.status = 'ok'; e.error = ''; if (r.price !== undefined) e.price = r.price; } }   // 単価はサーバー確定値で上書き
        else { S.queue = S.queue.filter(function (q) { return q.id !== r.id; }); if (e) { e.status = 'error'; e.error = r.error || 'error'; } }
      });
      LS.set('gtp_queue', S.queue); saveToday(); renderToday();
    }).catch(function (err) {
      if (err && err.code === 'bad_pin') { toast(t('badPin'), 'bad'); }
    }).then(function () { S.busy = false; renderPending(); if (S.queue.length && S.netOk) return flush(); });
  }
  function renderPending() {
    var n = S.queue.length; $('pendingBar').classList.toggle('hidden', n === 0);
    $('pendingText').textContent = t('pendingText', { n: n }); $('dPending').textContent = n;
    $('apiWarn').classList.toggle('hidden', apiReady());
  }
  function cancelEntry(e) {
    if (!confirm(t('confirmCancel'))) return;
    if (e.status === 'wait') { S.queue = S.queue.filter(function (q) { return q.id !== e.id; }); LS.set('gtp_queue', S.queue); S.today = S.today.filter(function (x) { return x.id !== e.id; }); saveToday(); renderToday(); renderPending(); return; }
    api('cancel', { id: e.id, meta: { user: S.user, device: S.device } }).then(function () { e.status = 'cancel'; saveToday(); renderToday(); toast(t('cancelled'), 'ok'); })
      .catch(function (err) { toast(t('cancelFailed') + (err && err.message ? '：' + err.message : ''), 'bad'); });
  }
  function refreshRecent() {
    if (!apiReady()) return Promise.resolve();
    return api('recent', { days: 1 }).then(function (j) {
      var mine = {}; S.today.forEach(function (e) { mine[e.id] = e; });
      (j.entries || []).forEach(function (r) {
        var st = r.status === '取消' ? 'cancel' : 'ok';
        if (mine[r.id]) { mine[r.id].status = st; mine[r.id].error = ''; if (r.price !== undefined) mine[r.id].price = r.price; }
        else {
          var it = S.itemByCode && S.itemByCode[r.itemCode], sp = S.supByCode && S.supByCode[r.supCode];
          S.today.push({ id: r.id, createdAt: r.createdAt, date: r.date, supCode: r.supCode, supName: r.supName, supEn: sp ? sp.en : '', itemCode: r.itemCode, itemName: r.itemName, itemEn: it ? it.en : '', unit: r.unit, priced: r.priced, price: r.price == null ? null : r.price, qty: r.qty, note: r.note, user: r.user, status: st, remote: true });
        }
      });
      S.today.sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
      saveToday(); renderToday();
    }).catch(function () { });
  }
  function renderToday() {
    var td = todayStr();
    S.today = S.today.filter(function (e) { return e.createdAt.slice(0, 10) === td; });
    var box = $('todayList'); box.innerHTML = '';
    $('todayCount').textContent = S.today.filter(function (e) { return e.status !== 'cancel'; }).length;
    if (!S.today.length) { box.innerHTML = '<div class="empty">—</div>'; return; }
    S.today.forEach(function (e) {
      var d = document.createElement('div'); d.className = 'entry' + (e.status === 'cancel' ? ' cancelled' : '');
      var itName = S.lang === 'en' && e.itemEn ? e.itemEn : e.itemName, spName = S.lang === 'en' && e.supEn ? e.supEn : e.supName;
      var st = e.status === 'ok' ? '<span class="st ok">' + esc(t('sent')) + '</span>' : e.status === 'wait' ? '<span class="st wait">' + esc(t('waiting')) + '</span>' : e.status === 'cancel' ? '<span class="st cancel">' + esc(t('cancelled')) + '</span>' : '<span class="st wait" title="' + esc(e.error) + '">' + esc(t('errorLabel')) + '</span>';
      d.innerHTML = '<span class="t">' + esc(e.createdAt.slice(11, 16)) + '</span><div class="body"><b>' + esc(spName) + '</b><small>' + esc(itName) + (e.date !== td ? ' · ' + esc(e.date) : '') + (e.user ? ' · ' + esc(e.user) : '') + (e.error ? ' · ' + esc(e.error) : '') + '</small></div>' +
        '<span class="q">' + esc(fmtQty(e.qty)) + '<small> ' + esc(unitLabel(e.unit)) + '</small>' + (e.price != null ? '<em>' + esc(fmtYen(e.qty * e.price)) + '</em>' : '') + '</span>' + st;
      if (e.status !== 'cancel' && !e.remote) { var x = document.createElement('button'); x.type = 'button'; x.className = 'x'; x.textContent = t('cancel'); x.onclick = function () { cancelEntry(e); }; d.appendChild(x); }
      box.appendChild(d);
    });
  }

  // ─── 画面遷移 ───
  function toast(msg, cls) { var el = $('toast'); el.textContent = msg; el.className = 'toast ' + (cls || ''); clearTimeout(toast.timer); toast.timer = setTimeout(function () { el.classList.add('hidden'); }, 2200); }
  function showSetup(err) {
    $('app').classList.add('hidden'); $('setup').classList.remove('hidden');
    var box = $('siteButtons'); box.innerHTML = '';
    (CFG.sites || ['長野', '千葉']).forEach(function (s) { var b = document.createElement('button'); b.type = 'button'; b.className = 'site-btn' + (S.site === s ? ' active' : ''); b.textContent = siteLabel(s); b.onclick = function () { S.site = s; box.querySelectorAll('.site-btn').forEach(function (x) { x.classList.toggle('active', x === b); }); }; box.appendChild(b); });
    $('userInput').value = S.user || ''; $('setupError').textContent = err || '';
    applyI18n();
  }
  function start() {
    var user = $('userInput').value.trim();
    if (!S.site) { $('setupError').textContent = t('siteRequired'); return; }
    S.user = user; $('startBtn').disabled = true; $('setupError').textContent = '';
    var done = function () { LS.set('gtp_site', S.site); LS.set('gtp_user', S.user); $('startBtn').disabled = false; showApp(); };
    if (!apiReady()) { done(); return; }
    api('masters').then(function (j) { LS.set(mastersKey(), { fetchedAt: nowIso(), items: j.items, suppliers: j.suppliers, prices: j.prices || {}, pricePairs: j.pricePairs || [], features: j.features || [], cancelHours: j.cancelHours || 24 }); done(); })
      .catch(function (err) {
        $('startBtn').disabled = false;
        if (err && err.code === 'bad_pin') { $('setupError').textContent = t('badPin'); return; }
        if (err && err.code === 'network' && LS.get(mastersKey(), null)) { toast(t('offlineStart'), 'bad'); done(); return; }
        $('setupError').textContent = (err && err.message) || t('netError');
      });
  }
  function showApp() {
    $('setup').classList.add('hidden'); $('app').classList.remove('hidden');
    S.queue = LS.get('gtp_queue', []); S.today = LS.get(todayKey(), []);
    $('userLabel').textContent = S.user || '—'; $('dSite').textContent = siteLabel(S.site); $('dUser').value = S.user; $('dVersion').textContent = CFG.version || '';
    var au = apiUrlFor(S.site);
    $('dApi').textContent = CFG.mock ? t('mockOn') : (au ? au.replace(/^https?:\/\//, '').slice(0, 40) + '…' : t('apiOff'));
    if (!$('dateInput').value) $('dateInput').value = todayStr();
    applyI18n(); renderPending(); renderToday(); setNet(null);
    loadMasters(false).then(function () { return flush(); }).then(function () { return refreshRecent(); }).catch(function (err) { toast((err && err.message) || t('netError'), 'bad'); });
  }

  // ─── 起動 ───
  function init() {
    S.lang = LS.get('gtp_lang', (navigator.language || 'ja').indexOf('ja') === 0 ? 'ja' : 'en');
    S.site = LS.get('gtp_site', ''); S.user = LS.get('gtp_user', '');
    LS.del('gtp_pin');   // 旧版が端末に保存していたPINは残さない
    // 拠点ごとのURL（?site=長野）で開くと拠点選択を飛ばせる。QRやホーム画面用
    var q = /[?&]site=([^&]+)/.exec(location.search);
    if (q) { var qs = decodeURIComponent(q[1]); if ((CFG.sites || []).indexOf(qs) >= 0) S.site = qs; }
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
    window.addEventListener('online', function () { setNet(null); flush(); }); window.addEventListener('offline', function () { setNet(false); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden && !$('app').classList.contains('hidden')) { flush().then(refreshRecent); } });
    setInterval(function () { if (!$('app').classList.contains('hidden')) flush(); }, 30000);

    if (S.site) showApp(); else showSetup();
  }
  init();
})();
