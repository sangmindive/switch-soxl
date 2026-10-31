(function () {
  "use strict";

  var E = window.SwitchEngine;
  var S = window.SwitchSeed;
  var KEY = "switch-v3-state";
  var SYNC_KEY = "switch-v3-sync";
  var ESCAPE_KEY = "switch-escape-v1";
  var ESCAPE_FILE = "switch-escape-v1.json";
  var PENDING_KEY = "switch-v3-pending";
  var ESCAPE_PENDING_KEY = "switch-v3-escape-pending";
  var localPending = false;
  var escapePending = false;
  try { localPending = localStorage.getItem(PENDING_KEY) === "1"; } catch (e) {}
  try { escapePending = localStorage.getItem(ESCAPE_PENDING_KEY) === "1"; } catch (e) {}
  var BAR_SLOTS = {
    acc1: { label: "1번 계좌" },
    acc2: { label: "2번 계좌" },
    escape: { label: "탈출 업다운" },
  };
  var state = loadState();
  var tab = "home";
  var statsMode = "month";
  var statsYear = 2026;
  var pxSpan = "all";
  var pxFocus = "";
  var pxCycleOn = true;
  var pxCustomFrom = "";
  var pxCustomTo = "";
  var SOXL_CLOSE_FLOOR = "2026-08-18";
  var SOXL_CLOSE_SEED = {
    "2026-08-18": 129.1, "2026-08-19": 120.74, "2026-08-20": 122.21, "2026-08-21": 120.6, "2026-08-24": 111.16,
    "2026-08-25": 115.67, "2026-08-26": 116.6, "2026-08-27": 123.05, "2026-08-28": 111.34, "2026-08-31": 112.79,
    "2026-09-01": 105.91, "2026-09-02": 106.35, "2026-09-03": 106.74, "2026-09-04": 117.28, "2026-09-08": 123.27,
    "2026-09-09": 125.87, "2026-09-10": 115.76, "2026-09-11": 121.82, "2026-09-14": 101.13, "2026-09-15": 102.32,
    "2026-09-16": 103.97, "2026-09-17": 114.82, "2026-09-18": 123.67, "2026-09-21": 141.93, "2026-09-22": 151.95,
    "2026-09-23": 146.25, "2026-09-24": 146.33, "2026-09-25": 151.45, "2026-09-28": 142.29, "2026-09-29": 147,
    "2026-09-30": 147.86, "2026-10-01": 153.69, "2026-10-02": 163.71, "2026-10-05": 164.27, "2026-10-06": 164.26,
    "2026-10-07": 158.91, "2026-10-08": 142.52, "2026-10-09": 139.76, "2026-10-12": 128.4, "2026-10-13": 127.57,
    "2026-10-14": 110.54, "2026-10-15": 107.35, "2026-10-16": 93.67, "2026-10-19": 98.65, "2026-10-20": 97.55
  };
  var pxStickRight = true;
  var pxScrollLeft = 0;
  var pxChartSig = "";
  var pxResizeTimer = null;
  var pxViewFrom = "";
  var pxViewTo = "";
  var pxCalTarget = "";
  var pxCalMonth = "2026-10";
  var pxPinnedDate = "";
  var pxUnpin = null;
  var pxRangeDrag = null;
  var pxSlide = 0;
  var pxWheel = null;
  var pxPinch = null;
  var pxTouchZoom = false;
  var pxPlotTap = null;
  var pxPlotHover = null;
  var pxPlotLeave = null;
  var OHLC_KEY = "switch-soxl-ohlc-v1";
  var ohlcSpan = "all";
  var ohlcCustomFrom = "";
  var ohlcCustomTo = "";
  var ohlcStickRight = true;
  var ohlcChartSig = "";
  var ohlcViewFrom = "";
  var ohlcViewTo = "";
  var ohlcCalTarget = "";
  var ohlcCalMonth = "2026-10";
  var ohlcPinned = "";
  var ohlcUnpin = null;
  var ohlcDrag = null;
  var ohlcWheel = null;
  var ohlcPinch = null;
  var ohlcTouchZoom = false;
  var ohlcPlotTap = null;
  var ohlcPlotHover = null;
  var ohlcPlotLeave = null;
  var ohlcBars = null;
  var ohlcFetched = 0;
  var ohlcBusy = false;
  var ohlcErr = "";
  var pushTimer = null;
  var syncing = false;
  var pushQueued = false;
  var pullQueued = false;
  var firstSyncDone = false;
  var autoFillTimer = null;
  var autoFillBusy = false;
  var fillAsOf = "";
  var orderHistDate = "";
  var histLadder = null;

  function bookOf(s) {
    return {
      settings: JSON.parse(JSON.stringify(s.settings)),
      settingsRev: Number(s.settingsRev) || 0,
      updownTrades: JSON.parse(JSON.stringify(s.updownTrades || [])),
      tteolTrades: JSON.parse(JSON.stringify(s.tteolTrades || [])),
      deletedUd: (s.deletedUd || []).slice(),
      deletedTt: (s.deletedTt || []).slice(),
    };
  }

  function blankBook() {
    var settings = E.defaultSettings();
    settings.capital = 0;
    return {
      settings: settings,
      updownTrades: [],
      tteolTrades: [],
      deletedUd: [],
      deletedTt: [],
      settingsRev: 0,
    };
  }

  function attachAccounts(root) {
    if (!root || typeof root !== "object") root = S.sheetSnapshot();
    if (!root.closeDb) root.closeDb = [];
    if (!root.market) root.market = E.defaultMarket();
    var hasBooks = root.accounts && root.accounts["1"] && root.accounts["1"].settings;
    if (!hasBooks) {
      if (!root.settings || !root.updownTrades) {
        var seed = S.sheetSnapshot();
        root.settings = root.settings || seed.settings;
        root.updownTrades = root.updownTrades || seed.updownTrades;
        root.tteolTrades = root.tteolTrades || seed.tteolTrades;
        root.market = root.market || seed.market;
      }
      root.accounts = {
        "1": bookOf(root),
        "2": blankBook(),
      };
      root.accountId = "1";
    }
    if (!root.accounts["2"] || !root.accounts["2"].settings) root.accounts["2"] = blankBook();
    if (root.accountId !== "1" && root.accountId !== "2") root.accountId = "1";
    root.barLeft = canonBar(root.barLeft) || "acc1";
    root.barRight = canonBar(root.barRight) || "acc2";
    root.barLeftOff = !!root.barLeftOff;
    root.barRightOff = !!root.barRightOff;
    root.autoFill = !!root.autoFill;
    if (!root.autoFillLast) root.autoFillLast = "";
    if (root.view !== "1" && root.view !== "2" && root.view !== "escape") root.view = root.accountId || "1";
    if (!Number(root.settingsRev) && root.accounts[root.accountId]) {
      root.settingsRev = Number(root.accounts[root.accountId].settingsRev) || 0;
    }
    if (root.settings && root.updownTrades) root.accounts[root.accountId] = bookOf(root);
    ["1", "2"].forEach(function (id) {
      if (root.accounts[id] && root.accounts[id].settings) {
        root.accounts[id].settings.applySheetF8Limit = true;
      }
    });
    var active = root.accounts[root.accountId];
    root.settingsRev = Number(active.settingsRev) || Number(root.settingsRev) || 0;
    active.settingsRev = root.settingsRev;
    root.settings = active.settings;
    root.updownTrades = active.updownTrades || [];
    root.tteolTrades = active.tteolTrades || [];
    root.deletedUd = active.deletedUd || [];
    root.deletedTt = active.deletedTt || [];
    return root;
  }

  function stashActive() {
    if (!state || !state.settings) return;
    attachAccounts(state);
  }

  function canonBar(k) {
    if (!k) return "";
    if (k === "escape" || String(k).indexOf("escape") === 0) return "escape";
    if (k === "acc1" || k === "acc2") return k;
    return "";
  }

  function isEscapeView() {
    return state.view === "escape";
  }

  function loadEscape() {
    try {
      var raw = localStorage.getItem(ESCAPE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  var undoStack = [];
  var lastSnap = null;

  function captureSnap() {
    stashActive();
    return {
      state: JSON.parse(JSON.stringify(state)),
      escape: localStorage.getItem(ESCAPE_KEY),
    };
  }
  function pushLastSnap() {
    if (!lastSnap) return;
    undoStack.push(lastSnap);
    if (undoStack.length > 40) undoStack.shift();
    updateUndoBtn();
  }
  function updateUndoBtn() {
    var btn = document.getElementById("btn-undo");
    if (!btn) return;
    btn.disabled = !undoStack.length;
  }
  function restoreSnap(snap) {
    state = attachAccounts(JSON.parse(JSON.stringify(snap.state)));
    state.rev = Date.now();
    if (snap.escape == null) localStorage.removeItem(ESCAPE_KEY);
    else localStorage.setItem(ESCAPE_KEY, snap.escape);
    setPending(true);
    saveState();
    lastSnap = captureSnap();
    schedulePush();
    scheduleEscapePush();
    render();
    updateUndoBtn();
  }
  function undoLast() {
    var snap = undoStack.pop();
    if (!snap) {
      toast("되돌릴 작업 없음");
      return;
    }
    restoreSnap(snap);
    toast("되돌렸습니다");
  }

  function saveEscape(esc, opts) {
    if (!(opts && opts.noUndo)) pushLastSnap();
    esc.rev = Date.now();
    localStorage.setItem(ESCAPE_KEY, JSON.stringify(esc));
    setEscapePending(true);
    lastSnap = captureSnap();
    scheduleEscapePush();
  }

  function escapeToViewState(esc) {
    var settings = E.defaultSettings();
    settings.symbol = (esc && esc.symbol) || "SOXL";
    settings.capital = esc ? (Number(esc.old) || 0) + (Number(esc.add) || 0) : 0;
    settings.seedSplit = esc && esc.split ? Number(esc.split) : 15;
    settings.seedSplitFixed = true;
    settings.reinvest = 0;
    settings.udLadderCount = esc ? Number(esc.steps) || 0 : 0;
    settings.udStepQty = esc ? Number(esc.stepq) || 0 : 0;
    settings.applySheetF8Limit = false;
    settings.autoTransfer = false;
    settings.fee = esc && esc.fee != null && esc.fee !== "" ? Number(esc.fee) : 0;
    var ud = ((esc && esc.trades) || []).map(function (t, i) {
      var isStart = t.type === "이관";
      var price = isStart ? Number(t.lp) || Number(esc.last) || Number(t.price) : Number(t.price);
      var qty = Number(t.qty) || 0;
      return {
        date: t.date,
        type: t.type === "매도" ? "매도" : "매수",
        pot: Number(t.pot) || 0,
        price: price,
        qty: qty,
        holdQty: t.holdQty != null ? Number(t.holdQty) : 0,
        avg: Number(t.avg) || 0,
        cost: t.cost != null ? Number(t.cost) : undefined,
        amount: isStart ? Number(t.cost) || 0 : price * qty,
        fee: Number(t.fee) || 0,
        cycle: 1,
        seq: i + 1,
      };
    });
    return {
      settings: settings,
      updownTrades: ud,
      tteolTrades: [],
      market: state.market,
      closeDb: state.closeDb || [],
    };
  }

  function displaySrc() {
    if (!isEscapeView()) return state;
    return escapeToViewState(loadEscape());
  }

  function round2(x) {
    return E.excelRound(Number(x), 2);
  }
  function down0(x) {
    return Math.floor(Number(x) + 1e-12);
  }
  function down2(x) {
    var v = Number(x);
    var sign = v < 0 ? -1 : 1;
    return (sign * Math.floor(Math.abs(v) * 100 + 1e-10)) / 100;
  }
  function replayEscape(d) {
    var live = { qty: 0, avg: 0, cost: 0, port: 0, last: 0, started: false, lastDate: "" };
    var trades = (d && d.trades) || [];
    var i;
    for (i = 0; i < trades.length; i++) {
      var t = trades[i];
      live.started = true;
      if (t.date) live.lastDate = t.date;
      if (t.type === "이관") {
        live.qty = Number(t.holdQty != null ? t.holdQty : t.qty) || 0;
        live.avg = Number(t.avg) || 0;
        live.cost = t.cost != null && t.cost !== "" ? Number(t.cost) : Number(d.cost);
        if (!live.cost && live.qty && live.avg) live.cost = round2(live.qty * live.avg);
        live.port = Number(t.pot) || 0;
        live.last = Number(t.lp) || Number(d.last) || 0;
      } else if (t.type === "매수") {
        var bq = Number(t.qty) || 0;
        var bp = Number(t.price) || 0;
        live.qty += bq;
        live.cost = round2((live.cost || 0) + bp * bq);
        live.avg = live.qty ? live.cost / live.qty : 0;
        live.port = t.pot != null ? Number(t.pot) : live.port + 1;
        live.last = bp;
      } else if (t.type === "매도") {
        var sq = Number(t.qty) || 0;
        var sp = Number(t.price) || 0;
        live.qty -= sq;
        if (live.qty < 0) live.qty = 0;
        live.cost = round2((live.avg || 0) * live.qty);
        live.port = live.port ? live.port - 1 : 0;
        live.last = sp;
      }
    }
    return live;
  }
  function escapeCalc(esc) {
    var live = replayEscape(esc || {});
    var split = (esc && Number(esc.split)) || 15;
    var cap = ((esc && Number(esc.old)) || 0) + ((esc && Number(esc.add)) || 0);
    var shot = split ? round2(cap / split) : 0;
    var closePx = Number(esc && esc.close);
    if (!closePx) closePx = Number((state.market || {}).lastClose) || Number((state.market || {}).price) || 0;
    if (!live.started) {
      return {
        started: false, qty: 0, avg: 0, cost: 0, split: split, port: 0, closePx: closePx,
        cap: cap, shot: shot, lp: 0, buy: "", sell: "", buyQty: 0, sellQty: 0, steps: Number(esc && esc.steps) || 0, stepq: Number(esc && esc.stepq) || 0, lastDate: "",
      };
    }
    var lp = live.last;
    var buy = live.port ? round2(lp * (1 - 0.002 * (20 / split) * live.port)) : round2(lp * 1.1);
    var sell = live.qty ? lp : "";
    var buyQty = buy ? down0(shot / buy) : 0;
    var sellQty = live.port ? down0(live.qty / live.port) : 0;
    return {
      started: true, qty: live.qty, avg: live.avg, cost: live.cost, split: split, port: live.port,
      closePx: closePx, cap: cap, shot: shot, lp: lp, buy: buy, sell: sell, buyQty: buyQty, sellQty: sellQty,
      steps: Number(esc && esc.steps) || 0, stepq: Number(esc && esc.stepq) || 0,
      lastDate: live.lastDate || "",
    };
  }
  function escapeFillType(esc, c, closeDate) {
    if (!c || !c.started) return "";
    if (closeDate && c.lastDate && c.lastDate === closeDate) return "";
    var closePx = round2(c.closePx);
    if (c.buy !== "" && closePx <= round2(c.buy)) return "매수";
    if (c.sell !== "" && closePx > round2(c.sell)) return "매도";
    return "";
  }
  function setTxt(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  function renderEscapePanels() {
    var esc = loadEscape() || {};
    var c = escapeCalc(esc);
    var closeDate = (state.market && state.market.closeDate) || esc.date;
    var fillKind = escapeFillType(esc, c, closeDate);
    var willBuy = fillKind === "매수";
    var willSell = fillKind === "매도";
    setTxt("swesc-buy", c.buy === "" ? "—" : money(c.buy));
    setTxt("swesc-sell", c.sell === "" ? "—" : money(c.sell));
    setTxt("swesc-buy-qty", c.started ? c.buyQty + "주" : "—");
    setTxt("swesc-sell-qty", c.sellQty ? c.sellQty + "주" : "—");
    setTxt("swesc-buy-port", c.started ? (c.port ? "포트" + (c.port + 1) : "포트1") : "—");
    setTxt("swesc-sell-port", c.port ? "포트" + (c.port - 1) : "—");
    setTxt("swesc-buy-gap", c.buy && c.lp ? "LP 대비 " + pct(c.buy / c.lp - 1) : "");
    setTxt("swesc-sell-gap", c.sell && c.lp ? "LP 대비 " + pct(c.sell / c.lp - 1) : "");
    setTxt("swesc-buy-if", c.buy === "" ? "—" : "종가 ≤ " + money(c.buy));
    setTxt("swesc-sell-if", c.sell === "" ? "보유 0" : "종가 ≥ " + money(c.sell));
    setTxt("swesc-hold", c.qty ? c.qty + "주 · " + usd(c.avg) : "0주");
    setTxt("swesc-port", c.started ? String(c.port) : "0");
    setTxt("swesc-cap", money(c.cap));
    setTxt("swesc-shot", money(c.shot));
    setTxt("swesc-used", money(c.cost));
    var left = c.cap - c.cost;
    setTxt("swesc-left", money(left));
    setTxt("swesc-leftn", (c.shot ? down0(left / c.shot) : 0) + "회");
    setTxt("swesc-lp", c.lp ? money(c.lp) + " · 직전 체결" : "—");
    var evalAmt = c.qty * c.closePx;
    var evalPct = c.cost ? evalAmt / c.cost - 1 : 0;
    var be = c.qty ? c.cost / c.qty : 0;
    setTxt("swesc-eval", c.started ? money(evalAmt) + " · " + pct(evalPct) : "—");
    setTxt("swesc-be", c.started && c.closePx ? money(be) + " (" + pct(be / c.closePx - 1) + ")" : "—");
    var sugEl = document.getElementById("sug-swesc-ud");
    var fillBtn = document.getElementById("btn-swesc-fill-ud");
    if (!c.started) {
      if (sugEl) sugEl.innerHTML = "<div class='note'>탈출 시작 후 체결할 수 있습니다</div>";
      if (fillBtn) fillBtn.disabled = true;
    } else if (willBuy && !willSell) {
      if (sugEl) {
        sugEl.innerHTML =
          "<div class='loc-data'><div class='loc-data-top'><strong>매수</strong></div>" +
          "<div class='loc-data-amt pos'>" + money(c.closePx) + " × " + c.buyQty + "주</div>" +
          "<div class='loc-data-meta'>포트 " + (c.port ? c.port + 1 : 1) + "</div></div>";
      }
      if (fillBtn) fillBtn.disabled = false;
    } else if (willSell && !willBuy) {
      if (sugEl) {
        sugEl.innerHTML =
          "<div class='loc-data'><div class='loc-data-top'><strong>매도</strong></div>" +
          "<div class='loc-data-amt neg'>" + money(c.closePx) + " × " + c.sellQty + "주</div>" +
          "<div class='loc-data-meta'>포트 " + c.port + "</div></div>";
      }
      if (fillBtn) fillBtn.disabled = false;
    } else {
      if (sugEl) sugEl.innerHTML = "<div class='note'>업다운 제안 없음. 밴드 밖 (미체결)</div>";
      if (fillBtn) fillBtn.disabled = true;
    }
    setTxt("swesc-steps", String(c.steps || 0));
    setTxt("swesc-stepq", String(c.stepq || 0));
    var tb = document.getElementById("swesc-ladder");
    if (tb) {
      var html = "";
      if (c.started && c.buy !== "") {
        html += ladderRow("매수", "buy", c.buy, "buy", c.buyQty, c.buyQty, 0);
        var cum = c.buyQty;
        var i;
        for (i = 1; i <= c.steps && c.stepq; i++) {
          cum += c.stepq;
          var px = down2(c.shot / cum);
          html += ladderRow(i, "", px, "buy", c.stepq, cum, c.buy ? px / c.buy - 1 : "");
        }
        if (!c.steps) html += "<tr><td colspan='5'>정액 주문 0 · 추가 계단 없음</td></tr>";
      } else {
        html += ladderRow("매수", "buy", "", "empty", "", "", "");
      }
      html += ladderRow(
        "매도",
        "sell",
        c.sell === "" ? "" : c.sell,
        c.sell === "" ? "empty" : "sell",
        c.sell === "" ? "" : c.sellQty,
        "",
        ""
      );
      tb.innerHTML = html;
    }
  }
  function applyEscapeFill(type, opts) {
    var silent = !!(opts && opts.silent);
    var esc = loadEscape();
    if (!esc || !(esc.trades || []).length) {
      if (!silent) toast("탈출에서 먼저 시작하세요");
      return silent ? "탈출 없음" : undefined;
    }
    var c = escapeCalc(esc);
    var closePx = c.closePx;
    var date = (state.market && state.market.closeDate) || esc.date;
    if (!type) {
      type = escapeFillType(esc, c, date);
      if (!type) {
        if (!silent) toast("밴드 밖 (미체결)");
        return silent ? "제안 없음" : undefined;
      }
    }
    if (type === "매수") {
      if (escapeFillType(esc, c, date) !== "매수") {
        if (!silent) toast("매수 조건 아님");
        return silent ? "매수 조건 아님" : undefined;
      }
      if (!c.buyQty) {
        if (!silent) toast("수량 0");
        return silent ? "수량 0" : undefined;
      }
      var hold = c.qty + c.buyQty;
      var cost = c.cost + closePx * c.buyQty;
      var avg = hold ? cost / hold : 0;
      var pot = c.port ? c.port + 1 : 1;
      var buyAmt = closePx * c.buyQty;
      esc.trades.push({ date: date, type: "매수", pot: pot, price: closePx, qty: c.buyQty, holdQty: hold, avg: avg, cost: round2(cost), amount: buyAmt, fee: down2(buyAmt * (Number(esc.fee) || 0)) });
    } else {
      if (escapeFillType(esc, c, date) !== "매도") {
        if (!silent) toast("매도 조건 아님");
        return silent ? "매도 조건 아님" : undefined;
      }
      if (!c.sellQty) {
        if (!silent) toast("수량 0");
        return silent ? "수량 0" : undefined;
      }
      var hold2 = c.qty - c.sellQty;
      if (hold2 < 0) hold2 = 0;
      var sellAmt = closePx * c.sellQty;
      esc.trades.push({ date: date, type: "매도", pot: c.port, price: closePx, qty: c.sellQty, holdQty: hold2, avg: c.avg, amount: sellAmt, fee: down2(sellAmt * (Number(esc.fee) || 0)) });
    }
    esc.close = closePx;
    saveEscape(esc, { noUndo: silent });
    if (!silent) {
      render();
      toast(type + " 반영");
    }
    return silent ? "업다운 " + type : undefined;
  }

  function selectAccount(id) {
    if (id !== "1" && id !== "2") return;
    fillAsOf = "";
    attachAccounts(state);
    var sameBook = state.accountId === id;
    if (sameBook && state.view === id) return;
    if (!sameBook && state.view !== "escape") state.accounts[state.accountId] = bookOf(state);
    else if (!sameBook) stashActive();
    state.accountId = id;
    state.view = id;
    var book = state.accounts[id];
    state.settings = book.settings;
    state.settingsRev = Number(book.settingsRev) || 0;
    state.updownTrades = book.updownTrades;
    state.tteolTrades = book.tteolTrades;
    state.deletedUd = book.deletedUd || [];
    state.deletedTt = book.deletedTt || [];
    persist();
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && ((parsed.settings && parsed.updownTrades) || (parsed.accounts && parsed.accounts["1"]))) {
          if (!parsed.closeDb) parsed.closeDb = [];
          return attachAccounts(parsed);
        }
      }
    } catch (e) {}
    return attachAccounts(S.sheetSnapshot());
  }

  function saveState() {
    stashActive();
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function setPending(on) {
    localPending = !!on;
    try {
      if (on) localStorage.setItem(PENDING_KEY, "1");
      else localStorage.removeItem(PENDING_KEY);
    } catch (e) {}
  }

  function setEscapePending(on) {
    escapePending = !!on;
    try {
      if (on) localStorage.setItem(ESCAPE_PENDING_KEY, "1");
      else localStorage.removeItem(ESCAPE_PENDING_KEY);
    } catch (e) {}
  }

  function newSyncNonce() {
    return String(Date.now()) + "-" + Math.random().toString(36).slice(2);
  }

  function loadSyncCfg() {
    try {
      var cfg = JSON.parse(localStorage.getItem(SYNC_KEY) || "{}");
      if (cfg && cfg.token && cfg.gistId) return cfg;
    } catch (e) {}
    return { token: "", gistId: "" };
  }

  function saveSyncCfg(cfg) {
    localStorage.setItem(SYNC_KEY, JSON.stringify({ token: cfg.token || "", gistId: cfg.gistId || "" }));
  }

  function encodePair(cfg) {
    var json = JSON.stringify({ t: cfg.token, g: cfg.gistId });
    return btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  function decodePair(raw) {
    var s = String(raw || "").trim().replace(/\s+/g, "");
    if (!s) throw new Error("empty");
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    var o = JSON.parse(decodeURIComponent(escape(atob(s))));
    if (!o || !o.t || !o.g) throw new Error("bad");
    return { token: o.t, gistId: o.g };
  }

  function gistHeaders(token) {
    return {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  function cleanToken(raw) {
    var s = String(raw || "").trim().replace(/^Bearer\s+/i, "").replace(/^token\s+/i, "");
    var m = s.match(/(ghp_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+|gho_[A-Za-z0-9]+)/);
    return m ? m[1] : s.replace(/\s+/g, "");
  }

  function setSyncMsg(text, ok) {
    var el = document.getElementById("sync-msg");
    if (!el) return;
    el.textContent = text;
    el.style.color = ok ? "var(--green)" : ok === false ? "var(--red)" : "";
  }

  function gistApiError(r, data) {
    var msg = (data && data.message) || ("HTTP " + r.status);
    if (r.status === 401) return "토큰이 잘못됐거나 만료됐습니다. 새로 만들어 붙여넣으세요.";
    if (r.status === 403 || /resource not accessible|gists/i.test(msg)) {
      return "Gists 권한이 없습니다. 클래식 토큰이면 gist 체크, 세분화된 토큰이면 Account permissions → Gists: Read and write.";
    }
    return msg;
  }

  function readGistResponse(r) {
    return r
      .json()
      .catch(function () {
        return {};
      })
      .then(function (data) {
        if (!r.ok) throw new Error(gistApiError(r, data));
        return data;
      });
  }

  function gistBody() {
    stashActive();
    var files = {
      "switch-v3-state.json": { content: JSON.stringify(state) },
    };
    var esc = loadEscape();
    if (esc) files[ESCAPE_FILE] = { content: JSON.stringify(esc) };
    return {
      description: "Switch SOXL device sync",
      public: false,
      files: files,
    };
  }

  function numOrNull(v) {
    var n = Number(v);
    return isFinite(n) && n > 0 ? n : null;
  }

  function mergeCloseList(primary, secondary) {
    var map = {};
    function put(list) {
      (list || []).forEach(function (r) {
        if (!r || !r.date) return;
        var close = numOrNull(r.close);
        if (close == null) return;
        map[r.date] = { date: r.date, close: close };
      });
    }
    put(secondary);
    put(primary);
    return Object.keys(map)
      .map(function (k) {
        return map[k];
      })
      .sort(function (a, b) {
        return a.date < b.date ? 1 : -1;
      });
  }

  function tradeKey(t) {
    if (t && t.id) return "id:" + t.id;
    return [
      t.date || "",
      t.seq || 0,
      t.type || "",
      t.pot == null ? "" : t.pot,
      t.rank == null ? "" : t.rank,
      t.price == null ? "" : t.price,
      t.qty == null ? "" : t.qty,
    ].join("|");
  }

  function rememberDeleted(which, trades) {
    var key = which === "tt" ? "deletedTt" : "deletedUd";
    var cur = state[key] || [];
    (trades || []).forEach(function (t) {
      if (!t) return;
      var k = tradeKey(t);
      if (cur.indexOf(k) < 0) cur.push(k);
    });
    if (cur.length > 4000) cur = cur.slice(cur.length - 4000);
    state[key] = cur;
  }

  function mergeIdList(a, b) {
    var map = {};
    (a || []).concat(b || []).forEach(function (k) {
      if (k) map[k] = 1;
    });
    return Object.keys(map);
  }

  function mergeTradeLists(localList, remoteList, deleted, localRev, remoteRev) {
    var drop = {};
    (deleted || []).forEach(function (k) {
      drop[k] = 1;
    });
    var map = {};
    function put(list, overwriteTie) {
      (list || []).forEach(function (t) {
        if (!t) return;
        var k = tradeKey(t);
        if (drop[k]) return;
        var prev = map[k];
        if (!prev) {
          map[k] = t;
          return;
        }
        var pe = Number(prev.editedAt) || 0;
        var te = Number(t.editedAt) || 0;
        if (te > pe || (te === pe && overwriteTie)) map[k] = t;
      });
    }
    var remoteNewer = (Number(remoteRev) || 0) >= (Number(localRev) || 0);
    put(remoteNewer ? localList : remoteList, false);
    put(remoteNewer ? remoteList : localList, true);
    return Object.keys(map)
      .map(function (k) {
        return map[k];
      })
      .sort(function (a, b) {
        if ((a.date || "") !== (b.date || "")) return a.date < b.date ? 1 : -1;
        return (b.seq || 0) - (a.seq || 0);
      });
  }

  function applyCloseOnto(market, closes, localM, remoteM, localRev, remoteRev) {
    if (closes.length) {
      market.lastClose = closes[0].close;
      market.closeDate = closes[0].date;
      market.tradeDate = closes[0].date;
      if (closes.length > 1) {
        market.prevClose = closes[1].close;
        market.prevCloseDate = closes[1].date;
      }
      return;
    }
    var ld = (localM && localM.closeDate) || "";
    var rd = (remoteM && remoteM.closeDate) || "";
    var src = rd > ld ? remoteM : ld > rd ? localM : remoteRev >= localRev ? remoteM : localM;
    src = src || {};
    if (numOrNull(src.lastClose) == null) {
      var other = src === remoteM ? localM : remoteM;
      if (other && numOrNull(other.lastClose) != null) src = other;
    }
    market.lastClose = numOrNull(src.lastClose);
    market.closeDate = src.closeDate || "";
    market.prevClose = numOrNull(src.prevClose);
    market.prevCloseDate = src.prevCloseDate || "";
    market.prevPrevClose = numOrNull(src.prevPrevClose);
    market.tradeDate = src.tradeDate || src.closeDate || "";
  }

  function bookSnap(book) {
    book = book || {};
    return {
      settings: book.settings || {},
      settingsRev: Number(book.settingsRev) || 0,
      updownTrades: book.updownTrades || [],
      tteolTrades: book.tteolTrades || [],
      deletedUd: (book.deletedUd || []).slice(),
      deletedTt: (book.deletedTt || []).slice(),
    };
  }

  function newerSettings(localBook, remoteBook) {
    var localRev = Number(localBook && localBook.settingsRev) || 0;
    var remoteRev = Number(remoteBook && remoteBook.settingsRev) || 0;
    if (remoteRev > localRev && remoteBook && remoteBook.settings) return remoteBook;
    if (localRev > remoteRev && localBook && localBook.settings) return localBook;
    return null;
  }

  function settingScore(touch, key, bookRev, otherTouch) {
    var t = Number(touch && touch[key]) || 0;
    if (t) return t;
    var other = Number(otherTouch && otherTouch[key]) || 0;
    if (other) return 0;
    return Number(bookRev) || 0;
  }

  function mergeSettings(localBook, remoteBook) {
    var ls = (localBook && localBook.settings) || {};
    var rs = (remoteBook && remoteBook.settings) || {};
    var lrev = Number(localBook && localBook.settingsRev) || 0;
    var rrev = Number(remoteBook && remoteBook.settingsRev) || 0;
    var lt = ls.fieldRev || {};
    var rt = rs.fieldRev || {};
    var keys = {};
    Object.keys(ls).forEach(function (k) { keys[k] = 1; });
    Object.keys(rs).forEach(function (k) { keys[k] = 1; });
    delete keys.fieldRev;
    var settings = {};
    var fieldRev = {};
    Object.keys(keys).forEach(function (k) {
      var lHas = Object.prototype.hasOwnProperty.call(ls, k);
      var rHas = Object.prototype.hasOwnProperty.call(rs, k);
      var lScore = lHas ? settingScore(lt, k, lrev, rt) : 0;
      var rScore = rHas ? settingScore(rt, k, rrev, lt) : 0;
      var pickRemote = rScore > lScore || (rScore === lScore && rHas);
      if (pickRemote && rHas) settings[k] = rs[k];
      else if (lHas) settings[k] = ls[k];
      else settings[k] = rs[k];
      var won = pickRemote && rHas ? Number(rt[k]) || 0 : Number(lt[k]) || 0;
      if (won) fieldRev[k] = won;
    });
    settings.fieldRev = fieldRev;
    var rev = Math.max(lrev, rrev);
    Object.keys(fieldRev).forEach(function (k) {
      if (fieldRev[k] > rev) rev = fieldRev[k];
    });
    return { settings: settings, settingsRev: rev };
  }

  function mergeBook(localBook, remoteBook, localRev, remoteRev) {
    var newer = remoteRev > localRev ? remoteBook : localBook;
    var base = newer && newer.settings ? newer : localBook && localBook.settings ? localBook : remoteBook;
    var next = JSON.parse(JSON.stringify(base || blankBook()));
    next.deletedUd = mergeIdList(localBook && localBook.deletedUd, remoteBook && remoteBook.deletedUd);
    next.deletedTt = mergeIdList(localBook && localBook.deletedTt, remoteBook && remoteBook.deletedTt);
    var udMerged = mergeTradeLists(
      localBook && localBook.updownTrades,
      remoteBook && remoteBook.updownTrades,
      next.deletedUd,
      localRev,
      remoteRev
    );
    var ttMerged = mergeTradeLists(
      localBook && localBook.tteolTrades,
      remoteBook && remoteBook.tteolTrades,
      next.deletedTt,
      localRev,
      remoteRev
    );
    var udCollapsed = E.collapseFills(udMerged);
    var ttCollapsed = E.collapseFills(ttMerged);
    next.updownTrades = udCollapsed.list;
    next.tteolTrades = ttCollapsed.list;
    next.deletedUd = mergeIdList(next.deletedUd, udCollapsed.dropped);
    next.deletedTt = mergeIdList(next.deletedTt, ttCollapsed.dropped);
    var merged = mergeSettings(localBook, remoteBook);
    next.settings = merged.settings;
    next.settingsRev = merged.settingsRev;
    return next;
  }

  function syncSnapshot(s) {
    var copy = attachAccounts(JSON.parse(JSON.stringify(s || {})));
    var m = copy.market || {};
    return {
      accounts: {
        "1": bookSnap(copy.accounts["1"]),
        "2": bookSnap(copy.accounts["2"]),
      },
      closeDb: mergeCloseList(copy.closeDb, []),
      market: {
        lastClose: numOrNull(m.lastClose),
        closeDate: m.closeDate || "",
        prevClose: numOrNull(m.prevClose),
        prevCloseDate: m.prevCloseDate || "",
        prevPrevClose: numOrNull(m.prevPrevClose),
        tradeDate: m.tradeDate || "",
        closeHistory: mergeCloseList(m.closeHistory, []),
      },
      barLeft: canonBar(copy.barLeft) || "acc1",
      barRight: canonBar(copy.barRight) || "acc2",
      barLeftOff: !!copy.barLeftOff,
      barRightOff: !!copy.barRightOff,
      barRev: Number(copy.barRev) || 0,
      autoFill: !!copy.autoFill,
      autoFillLast: copy.autoFillLast || "",
    };
  }

  function reconcile(local, remote) {
    var remoteOk = remote && ((remote.settings && remote.updownTrades) || (remote.accounts && remote.accounts["1"]));
    if (!remoteOk) {
      return { state: local, push: false, changed: false };
    }
    var remoteHadAccounts = !!(remote.accounts && remote.accounts["1"] && remote.accounts["2"]);
    local = attachAccounts(JSON.parse(JSON.stringify(local)));
    remote = attachAccounts(JSON.parse(JSON.stringify(remote)));
    var localRev = Number(local.rev) || 0;
    var remoteRev = Number(remote.rev) || 0;
    var base = remoteRev > localRev ? remote : local;
    var next = JSON.parse(JSON.stringify(base));
    if (!next.market) next.market = {};
    if (!next.closeDb) next.closeDb = [];
    var higherRev = remoteRev > localRev ? remoteRev : localRev;
    var closePrimary = remoteRev > localRev ? remote : local;
    var closeSecondary = closePrimary === remote ? local : remote;
    next.accounts["1"] = mergeBook(local.accounts["1"], remote.accounts["1"], localRev, remoteRev);
    next.accounts["2"] = mergeBook(local.accounts["2"], remote.accounts["2"], localRev, remoteRev);
    next.accountId = local.accountId || "1";
    var localBarRev = Number(local.barRev) || 0;
    var remoteBarRev = Number(remote.barRev) || 0;
    var barSrc = remoteBarRev > localBarRev ? remote : localBarRev > remoteBarRev ? local : remoteRev > localRev ? remote : local;
    next.barLeft = canonBar(barSrc.barLeft) || canonBar(local.barLeft) || canonBar(remote.barLeft) || "acc1";
    next.barRight = canonBar(barSrc.barRight) || canonBar(local.barRight) || canonBar(remote.barRight) || "acc2";
    next.barLeftOff = !!barSrc.barLeftOff;
    next.barRightOff = !!barSrc.barRightOff;
    next.barRev = Math.max(localBarRev, remoteBarRev);
    var lFillAt = Number(local.autoFillAt) || 0;
    var rFillAt = Number(remote.autoFillAt) || 0;
    if (lFillAt || rFillAt) {
      next.autoFill = lFillAt > rFillAt ? !!local.autoFill : !!remote.autoFill;
      next.autoFillAt = Math.max(lFillAt, rFillAt);
    } else {
      next.autoFill = !!barSrc.autoFill;
    }
    var lDay = local.autoFillLast || "";
    var rDay = remote.autoFillLast || "";
    next.autoFillLast = lDay > rDay ? lDay : rDay;
    next.telegramPending = Array.isArray(base.telegramPending) ? base.telegramPending.slice() : [];
    next.telegramSentClose = base.telegramSentClose || "";
    next.view = remoteRev > localRev ? remote.view || local.view : local.view || remote.view;
    if (next.view !== "1" && next.view !== "2" && next.view !== "escape") next.view = next.accountId || "1";
    next.settings = next.accounts[next.accountId].settings;
    next.updownTrades = next.accounts[next.accountId].updownTrades;
    next.tteolTrades = next.accounts[next.accountId].tteolTrades;
    next.closeDb = mergeCloseList(closePrimary.closeDb, closeSecondary.closeDb);
    next.market.closeHistory = mergeCloseList(
      (closePrimary.market || {}).closeHistory,
      (closeSecondary.market || {}).closeHistory
    );
    applyCloseOnto(next.market, next.closeDb, local.market, remote.market, localRev, remoteRev);
    var live = local.market || {};
    if (live.price) next.market.price = live.price;
    if (live.changePct != null && live.changePct !== "") next.market.changePct = live.changePct;
    if (live.phase) next.market.phase = live.phase;
    var before = JSON.stringify(syncSnapshot(local));
    var after = JSON.stringify(syncSnapshot(next));
    var remoteSnap = JSON.stringify(syncSnapshot(remote));
    var push = after !== remoteSnap || !remoteHadAccounts;
    if (push) {
      next.rev = Date.now();
      next.syncNonce = newSyncNonce();
    } else {
      next.rev = higherRev;
    }
    return { state: next, push: push, changed: before !== after };
  }

  function renderSyncUi() {
    var status = document.getElementById("sync-status");
    var tokenEl = document.getElementById("sync-token");
    var codeEl = document.getElementById("sync-code");
    if (!status) return;
    var cfg = loadSyncCfg();
    if (cfg.token && cfg.gistId) {
      status.textContent = "연결됨";
      status.className = "pos";
      if (tokenEl && !tokenEl.value) tokenEl.value = cfg.token;
      if (codeEl && !codeEl.value) codeEl.value = encodePair(cfg);
    } else {
      status.textContent = "미연결";
      status.className = "";
    }
  }

  function schedulePush() {
    var cfg = loadSyncCfg();
    if (!cfg.token || !cfg.gistId) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      pushRemote().catch(function (err) {
        toast("동기화 실패 · " + (err.message || "네트워크"));
      });
    }, 700);
  }

  function readRemoteState(gist) {
    var file = gist && gist.files && gist.files["switch-v3-state.json"];
    if (!file || !file.content) return null;
    return JSON.parse(file.content);
  }

  function ingestEscapeGist(gist) {
    var file = gist && gist.files && gist.files[ESCAPE_FILE];
    if (!file || !file.content) return false;
    try {
      var remote = JSON.parse(file.content);
      var local = loadEscape();
      var lr = Number(local && local.rev) || 0;
      var rr = Number(remote && remote.rev) || 0;
      if (!escapePending) {
        if (localStorage.getItem(ESCAPE_KEY) !== file.content) {
          localStorage.setItem(ESCAPE_KEY, file.content);
          return true;
        }
        return false;
      }
      if (rr > lr) {
        localStorage.setItem(ESCAPE_KEY, file.content);
        setEscapePending(false);
        return true;
      }
      if (lr >= rr) scheduleEscapePush();
    } catch (e) {}
    return false;
  }

  var escapePushTimer = null;
  function scheduleEscapePush() {
    var cfg = loadSyncCfg();
    if (!cfg.token || !cfg.gistId || !escapePending) return;
    clearTimeout(escapePushTimer);
    escapePushTimer = setTimeout(function () {
      var esc = loadEscape();
      if (!esc || !escapePending) return;
      var body = { files: {} };
      body.files[ESCAPE_FILE] = { content: JSON.stringify(esc) };
      fetch("https://api.github.com/gists/" + cfg.gistId, {
        method: "PATCH",
        headers: gistHeaders(cfg.token),
        body: JSON.stringify(body),
      }).then(function (r) {
        if (r.ok) setEscapePending(false);
      }).catch(function () {});
    }, 700);
  }

  function markSyncReady() {
    firstSyncDone = true;
  }

  function adoptRemote(local, remote) {
    var next = JSON.parse(JSON.stringify(remote));
    var live = (local && local.market) || {};
    if (!next.market) next.market = {};
    if (live.price) next.market.price = live.price;
    if (live.changePct != null && live.changePct !== "") next.market.changePct = live.changePct;
    if (live.phase) next.market.phase = live.phase;
    var view = local && local.view;
    var accountId = local && local.accountId;
    next = attachAccounts(next);
    if (view === "1" || view === "2") {
      next.view = view;
      if (next.accountId !== view) {
        next.accountId = view;
        var book = next.accounts[view];
        next.settings = book.settings;
        next.settingsRev = Number(book.settingsRev) || 0;
        next.updownTrades = book.updownTrades || [];
        next.tteolTrades = book.tteolTrades || [];
        next.deletedUd = book.deletedUd || [];
        next.deletedTt = book.deletedTt || [];
      }
    } else if (view === "escape") {
      next.view = "escape";
      if (accountId === "1" || accountId === "2") next.accountId = accountId;
    }
    return next;
  }

  function pullRemote() {
    var cfg = loadSyncCfg();
    if (!cfg.token || !cfg.gistId) {
      markSyncReady();
      return Promise.resolve(false);
    }
    if (syncing) {
      pullQueued = true;
      return Promise.resolve(false);
    }
    syncing = true;
    return fetch("https://api.github.com/gists/" + cfg.gistId, { headers: gistHeaders(cfg.token) })
      .then(readGistResponse)
      .then(function (gist) {
        var escChanged = ingestEscapeGist(gist);
        var remote = readRemoteState(gist);
        if (!remote) {
          syncing = false;
          markSyncReady();
          if (escChanged) render();
          if (pullQueued) {
            pullQueued = false;
            return pullRemote();
          }
          if (localPending && pushQueued) {
            pushQueued = false;
            return pushRemote().then(function () {
              return escChanged;
            });
          }
          pushQueued = false;
          return escChanged;
        }
        if (!localPending) {
          var adopted = adoptRemote(state, remote);
          var changed = JSON.stringify(syncSnapshot(state)) !== JSON.stringify(syncSnapshot(adopted));
          state = adopted;
          saveState();
          syncing = false;
          markSyncReady();
          if (changed || escChanged) render();
          lastSnap = captureSnap();
          scheduleAutoFill();
          maybeCatchUpAutoFill();
          if (pullQueued) {
            pullQueued = false;
            return pullRemote();
          }
          return changed;
        }
        var rec = reconcile(state, remote);
        state = rec.state;
        saveState();
        syncing = false;
        markSyncReady();
        if (rec.changed || escChanged) render();
        lastSnap = captureSnap();
        scheduleAutoFill();
        maybeCatchUpAutoFill();
        if (pullQueued) {
          pullQueued = false;
          return pullRemote();
        }
        if (!rec.push && !pushQueued) {
          setPending(false);
          return rec.changed;
        }
        pushQueued = false;
        return pushRemote().then(function () {
          return true;
        });
      })
      .catch(function (err) {
        syncing = false;
        markSyncReady();
        throw err;
      });
  }

  function pushRemote(attempt) {
    var cfg = loadSyncCfg();
    if (!cfg.token || !cfg.gistId) return Promise.resolve();
    if (syncing) {
      pushQueued = true;
      return Promise.resolve();
    }
    syncing = true;
    pushQueued = false;
    attempt = attempt || 0;
    return fetch("https://api.github.com/gists/" + cfg.gistId, { headers: gistHeaders(cfg.token) })
      .then(readGistResponse)
      .then(function (gist) {
        var remote = readRemoteState(gist);
        if (remote) {
          var rec = reconcile(state, remote);
          state = rec.state;
          saveState();
          lastSnap = captureSnap();
          if (!rec.push) {
            setPending(false);
            if (rec.changed) render();
            return null;
          }
        } else {
          state.rev = Date.now();
          state.syncNonce = newSyncNonce();
          saveState();
        }
        var sentNonce = state.syncNonce;
        return fetch("https://api.github.com/gists/" + cfg.gistId, {
          method: "PATCH",
          headers: gistHeaders(cfg.token),
          body: JSON.stringify(gistBody()),
        })
          .then(readGistResponse)
          .then(function () {
            return fetch("https://api.github.com/gists/" + cfg.gistId, { headers: gistHeaders(cfg.token) }).then(readGistResponse);
          })
          .then(function (again) {
            var saved = readRemoteState(again);
            if (sentNonce && saved && saved.syncNonce !== sentNonce && attempt < 4) return { retry: true };
            if (!saved || saved.syncNonce === sentNonce) setPending(false);
            return null;
          });
      })
      .then(function (step) {
        syncing = false;
        markSyncReady();
        if (step && step.retry) return pushRemote(attempt + 1);
        if (pullQueued) {
          pullQueued = false;
          return pullRemote();
        }
        if (pushQueued) return pushRemote(0);
      })
      .catch(function (err) {
        syncing = false;
        markSyncReady();
        throw err;
      });
  }

  function createSyncFromHere() {
    var token = cleanToken(document.getElementById("sync-token").value);
    if (!token) {
      token = cleanToken(document.getElementById("sync-code").value);
      if (token) document.getElementById("sync-token").value = token;
    }
    if (!token) {
      setSyncMsg("토큰을 위에 붙여넣으세요.", false);
      toast("GitHub 토큰을 먼저 넣으세요");
      return;
    }
    setSyncMsg("GitHub에 연결 중…");
    if (!state.rev) state.rev = Date.now();
    saveState();
    fetch("https://api.github.com/gists", {
      method: "POST",
      headers: gistHeaders(token),
      body: JSON.stringify(gistBody()),
    })
      .then(readGistResponse)
      .then(function (gist) {
        if (!gist || !gist.id) throw new Error("Gist ID를 받지 못했습니다");
        var cfg = { token: token, gistId: gist.id };
        saveSyncCfg(cfg);
        var codeEl = document.getElementById("sync-code");
        if (codeEl) codeEl.value = encodePair(cfg);
        renderSyncUi();
        setSyncMsg("연결됨. 아래 코드를 폰에 붙여넣으세요.", true);
        toast("연결됨 · 코드를 폰에 붙여넣으세요");
      })
      .catch(function (err) {
        var msg = err && err.message ? err.message : "네트워크";
        if (/Failed to fetch|NetworkError/i.test(msg)) {
          msg = "GitHub에 닿지 못했습니다. 토큰은 gist 권한이 있는 클래식(ghp_) 토큰이어야 합니다.";
        }
        setSyncMsg("연결 실패 · " + msg, false);
        toast("연결 실패 · " + msg);
      });
  }

  function joinSyncFromCode() {
    try {
      var cfg = decodePair(document.getElementById("sync-code").value);
      saveSyncCfg(cfg);
      var tokenEl = document.getElementById("sync-token");
      if (tokenEl) tokenEl.value = cfg.token;
      renderSyncUi();
      pullRemote()
        .then(function (changed) {
          toast(changed ? "다른 기기 데이터를 불러왔습니다" : "연결됨 · 이미 최신");
        })
        .catch(function (err) {
          toast("불러오기 실패 · " + (err.message || "네트워크"));
        });
    } catch (e) {
      toast("연결 코드가 올바르지 않습니다");
    }
  }

  function money(n, d) {
    if (n === "" || n == null || Number.isNaN(n)) return "";
    return Number(n).toLocaleString("en-US", {
      minimumFractionDigits: d == null ? 2 : d,
      maximumFractionDigits: d == null ? 2 : d,
    });
  }

  function usd(n, d) {
    var s = money(n, d);
    return s ? "$" + s : "";
  }

  function pct(n) {
    if (n === "" || n == null || Number.isNaN(n)) return "";
    return (Number(n) * 100).toFixed(2) + "%";
  }

  function sameCycle(a, b) {
    var na = Number(a);
    var nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
    return a === b;
  }

  function cycleRealized(trades, cycle) {
    var n = 0;
    (trades || []).forEach(function (t) {
      if (!sameCycle(t.cycle, cycle)) return;
      var p = Number(t.pnl);
      if (t.pnl != null && t.pnl !== "" && Number.isFinite(p)) n += p;
    });
    return n;
  }

  function logPnl(v) {
    if (v == null || v === "" || !Number.isFinite(Number(v))) return "—";
    var n = Number(v);
    var body = money(Math.abs(n));
    if (!body) return "—";
    return (n < 0 ? "-$" : "$") + body;
  }

  function homeDayBuy(out) {
    var parts = [];
    if (Number(out.udDayBuy) > 0) parts.push(Number(out.udDayBuy));
    if (out.ttDayBuy !== "" && out.ttDayBuy != null && Number(out.ttDayBuy) > 0) parts.push(Number(out.ttDayBuy));
    if (!parts.length) return "없음";
    var sum = 0;
    for (var i = 0; i < parts.length; i++) sum += parts[i];
    return money(sum);
  }

  function homeDayShot(out) {
    var d = Number(out.D16);
    var j = Number(out.J16);
    if (!isFinite(d)) d = 0;
    if (!isFinite(j)) j = 0;
    if (d <= 0 && j <= 0) return "없음";
    return money(d + j);
  }

  function toast(msg) {
    var el = document.getElementById("toast");
    el.textContent = msg;
    el.style.display = "block";
    setTimeout(function () {
      el.style.display = "none";
    }, 5000);
  }

  function near(a, b, eps) {
    return Math.abs(Number(a) - Number(b)) <= (eps == null ? 1e-4 : eps);
  }

  function parityOk(out) {
    var exp = S.expectedSheet;
    var baseline = isBaselineSnapshot();
    if (!baseline) return { ok: null, text: "시트 시드와 다른 상태 · 공식은 시트 서식" };
    var keys = ["C19", "B19", "F19", "E19", "D16", "J16", "I19", "H19", "C8", "J3", "B13", "C13"];
    for (var i = 0; i < keys.length; i++) {
      if (!near(out[keys[i]], exp[keys[i]], keys[i] === "C8" ? 0.02 : 1e-4)) {
        return { ok: false, text: "정합 실패 " + keys[i] };
      }
    }
    return { ok: true, text: "시트 스냅샷 정합 OK" };
  }

  function isBaselineSnapshot() {
    if (state.updownTrades.length !== S.sheetSnapshot().updownTrades.length) return false;
    if (state.settings.capital !== 500000) return false;
    if (state.market.lastClose !== 121.82) return false;
    return state.updownTrades[0] && state.updownTrades[0].date === "2026-09-11" && state.updownTrades[0].type === "매도";
  }

  var TABS = { home: 1, orders: 1, journal: 1, stats: 1, settings: 1, closes: 1 };

  function tabFromUrl() {
    var h = (location.hash || "").replace(/^#/, "");
    if (TABS[h]) return h;
    try {
      var saved = sessionStorage.getItem("switch-v3-tab");
      if (TABS[saved]) return saved;
    } catch (e) {}
    return "home";
  }

  function setTab(name) {
    if (!TABS[name]) name = "home";
    tab = name;
    document.querySelectorAll(".nav-item").forEach(function (b) {
      b.classList.toggle("active", b.dataset.tab === name);
    });
    document.querySelectorAll(".page").forEach(function (p) {
      p.classList.toggle("active", p.id === "page-" + name);
    });
    try {
      sessionStorage.setItem("switch-v3-tab", name);
    } catch (e) {}
    if (location.hash !== "#" + name) {
      history.replaceState(null, "", "#" + name);
    }
    if (name === "stats") {
      renderPriceChart();
      ensureOhlc();
      renderOhlcChart();
    }
  }

  function bindNum(sel, obj, key, asInt) {
    var el = document.querySelector(sel);
    if (!el) return;
    el.value = obj[key];
    el.onchange = function () {
      obj[key] = asInt ? parseInt(el.value, 10) || 0 : parseFloat(el.value);
      persist();
    };
  }

  function persist(opts) {
    if (!(opts && (opts.noUndo || opts.keepRev))) pushLastSnap();
    if (!(opts && opts.keepRev)) state.rev = Date.now();
    var publish = !(opts && opts.sync === false);
    if (publish) setPending(true);
    saveState();
    lastSnap = captureSnap();
    render();
    updateUndoBtn();
    if (publish && firstSyncDone) schedulePush();
  }

  function barKey(side) {
    var key = side === "right" ? state.barRight : state.barLeft;
    return BAR_SLOTS[key] ? key : side === "right" ? "acc2" : "acc1";
  }

  function barActive(key) {
    if (key === "acc1") return state.view !== "escape" && (state.accountId || "1") === "1";
    if (key === "acc2") return state.view !== "escape" && state.accountId === "2";
    if (key === "escape") return state.view === "escape";
    return false;
  }

  function activateBar(key) {
    if (key === "acc1") return selectAccount("1");
    if (key === "acc2") return selectAccount("2");
    if (key === "escape") {
      if (state.view === "escape") return;
      if (state.view !== "escape") stashActive();
      state.view = "escape";
      persist();
    }
  }

  function localDayKey(d) {
    d = d || new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  function scheduleAutoFill() {
    if (autoFillTimer) {
      clearTimeout(autoFillTimer);
      autoFillTimer = null;
    }
    if (!state || !state.autoFill) return;
    var now = new Date();
    var next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0, 0, 0);
    if (now.getTime() >= next.getTime()) next.setDate(next.getDate() + 1);
    autoFillTimer = setTimeout(function () {
      runAutoFill();
    }, Math.max(1000, next.getTime() - now.getTime()));
  }

  function maybeCatchUpAutoFill() {
    if (!state || !state.autoFill || autoFillBusy) return;
    var now = new Date();
    if (now.getHours() < 7) return;
    if (state.autoFillLast === localDayKey(now)) return;
    runAutoFill();
  }

  function switchBookSilent(id) {
    attachAccounts(state);
    if (state.view !== "escape" && state.accountId !== id) state.accounts[state.accountId] = bookOf(state);
    else if (state.view === "escape") stashActive();
    state.accountId = id;
    state.view = id;
    var book = state.accounts[id];
    state.settings = book.settings;
    state.settingsRev = Number(book.settingsRev) || 0;
    state.updownTrades = book.updownTrades;
    state.tteolTrades = book.tteolTrades;
    state.deletedUd = book.deletedUd || [];
    state.deletedTt = book.deletedTt || [];
  }

  function fmtFillLine(book, kind, t) {
    if (!t) return "";
    var px = t.price != null && t.price !== "" ? Number(t.price) : "";
    var qty = t.qty != null ? t.qty : "";
    var extra = t.pot != null && t.pot !== "" ? " 포트" + t.pot : t.rank != null && t.rank !== "" ? " 랭크" + t.rank : "";
    var pxText = px === "" || !isFinite(px) ? "-" : E.excelRound(px, 2);
    return (t.date || "") + " · " + book + " · " + kind + " " + (t.type || "") + extra + " · $" + pxText + " × " + qty + "주";
  }

  function queueFillLines(lines) {
    var day = state.market && state.market.closeDate;
    var next = [];
    (lines || []).forEach(function (line) {
      if (!line) return;
      if (day && String(line).indexOf(day) !== 0) return;
      if (next.indexOf(line) < 0) next.push(line);
    });
    state.telegramPending = next;
  }

  function idSet(list) {
    var map = {};
    (list || []).forEach(function (t) {
      if (t && t.id) map[t.id] = 1;
    });
    return map;
  }

  function linesAfter(book, kind, list, before) {
    var lines = [];
    (list || []).forEach(function (t) {
      if (!t || !t.id || before[t.id]) return;
      lines.push(fmtFillLine(book, kind, t));
    });
    return lines;
  }

  function fillCurrentSilent() {
    if (isEscapeView()) {
      var escBefore = loadEscape();
      var beforeN = escBefore && escBefore.trades ? escBefore.trades.length : 0;
      var escText = applyEscapeFill("", { silent: true }) || "제안 없음";
      var escAfter = loadEscape();
      if (escAfter && escAfter.trades && escAfter.trades.length > beforeN) {
        queueFillLines([fmtFillLine("탈출 업다운", "업다운", escAfter.trades[escAfter.trades.length - 1])]);
      }
      return escText;
    }
    var book = state.accountId === "2" ? "2번 계좌" : "1번 계좌";
    var beforeUd = idSet(state.updownTrades);
    var beforeTt = idSet(state.tteolTrades);
    var parts = [];
    var r = E.applySuggested(state, "ud");
    if (r.ok) {
      maybeAutoTransfer();
      parts.push("업다운 " + r.trade.type);
    } else if (r.reason && (r.reason.indexOf("당일") === 0 || r.reason.indexOf("이미") === 0)) {
      parts.push("업다운 있음");
    }
    var r2 = E.applySuggested(state, "tteol");
    if (r2.ok) {
      maybeAutoTransfer();
      parts.push("떨 " + r2.trade.type);
    } else if (r2.reason && (r2.reason.indexOf("당일") === 0 || r2.reason.indexOf("이미") === 0)) {
      parts.push("떨 있음");
    }
    queueFillLines(linesAfter(book, "업다운", state.updownTrades, beforeUd).concat(linesAfter(book, "떨", state.tteolTrades, beforeTt)));
    return parts.length ? parts.join(" · ") : "제안 없음";
  }

  function runAutoFill() {
    scheduleAutoFill();
    if (!state || !state.autoFill || autoFillBusy) return;
    if (state.autoFillLast === localDayKey()) return;
    if (syncing) return;
    autoFillBusy = true;
    pullRemote().then(function () {
      if (!state || !state.autoFill || state.autoFillLast === localDayKey()) {
        autoFillBusy = false;
        return;
      }
      var symbol = String((state.settings && state.settings.symbol) || "SOXL").toUpperCase();
      return fetchCnbcQuote(symbol)
        .then(function (q) {
          applyLiveQuote(q);
        }, function () {})
        .then(function () {
          if (!state || !state.autoFill || state.autoFillLast === localDayKey()) return;
          var day = localDayKey();
          var prevView = state.view;
          var prevId = state.accountId || "1";
          var keys = [];
          function addKey(k, off) {
            if (off) return;
            k = canonBar(k);
            if (k && keys.indexOf(k) < 0) keys.push(k);
          }
          addKey(state.barLeft, state.barLeftOff);
          addKey(state.barRight, state.barRightOff);
          var notes = [];
          if (!keys.length) notes.push("미사용");
          keys.forEach(function (key) {
            var label = BAR_SLOTS[key] ? BAR_SLOTS[key].label : key;
            if (key === "escape") {
              if (state.view !== "escape") stashActive();
              state.view = "escape";
            } else {
              switchBookSilent(key === "acc2" ? "2" : "1");
            }
            notes.push(label + " " + fillCurrentSilent());
          });
          state.autoFillLast = day;
          state.barRev = Date.now();
          if (prevView === "escape") {
            if (state.view !== "escape") stashActive();
            state.view = "escape";
          } else {
            switchBookSilent(prevId);
          }
          persist({ noUndo: true });
          toast("자동 기입 · " + notes.join(" / "));
        });
    }).then(function () {
      autoFillBusy = false;
    }, function () {
      autoFillBusy = false;
    });
  }

  function renderAccountSeg() {
    document.querySelectorAll("#account-seg button").forEach(function (b) {
      var key = barKey(b.dataset.side);
      var slot = BAR_SLOTS[key];
      b.textContent = slot ? slot.label : key;
      b.classList.toggle("active", barActive(key));
    });
  }

  function suggestOpts() {
    var opts = {};
    if (fillAsOf) opts.fillAsOf = fillAsOf;
    else if (state && state.market && state.market.closeDate) opts.fillAsOf = state.market.closeDate;
    return opts;
  }

  function repairPersist(opts) {
    opts = opts || {};
    if (!firstSyncDone) opts.sync = false;
    persist(opts);
  }

  function render() {
    if (repairCopiedClose()) {
      repairPersist({ keepRev: true, noUndo: true });
      return;
    }
    if (E.repairSpikedCloses(state)) {
      repairPersist({ noUndo: true });
      return;
    }
    if (E.repairOffCentPrices(state)) {
      repairPersist({ noUndo: true });
      return;
    }
    if (E.repairAccountSheets(state)) {
      repairPersist({ noUndo: true });
      return;
    }
    if (dropOpenSessionCloses()) {
      repairPersist({ noUndo: true, keepRev: true });
      return;
    }
    if (backfillCloseSeed()) {
      repairPersist({ noUndo: true, keepRev: true });
      return;
    }
    var appEl = document.querySelector(".app");
    if (appEl) appEl.classList.toggle("esc-view", isEscapeView());
    if (isEscapeView()) renderEscapePanels();
    var src = displaySrc();
    var out = E.compute(src, suggestOpts());
    if (isEscapeView()) {
      out.I19 = "";
      out.H19 = "";
      out.ttLadder = [];
      out.suggestedTt = { type: "", reason: "탈출 업다운 · 떨 없음" };
      out.openRanks = [];
      out.C54 = "";
    }
    renderAccountSeg();
    if (out.repairedTt && !isEscapeView()) {
      state.rev = Date.now();
      saveState();
      lastSnap = captureSnap();
      if (firstSyncDone) {
        setPending(true);
        schedulePush();
      }
    }
    var s = state.settings;
    var m = state.market;
    var p = parityOk(out);
    var badge = document.getElementById("parity");
    if (p.ok === false) {
      badge.style.display = "";
      badge.className = "badge err";
      badge.textContent = p.text;
    } else {
      badge.style.display = "none";
    }
    var cyclePnl = Number(out.H8) || 0;
    var cycleRet = s.capital ? cyclePnl / s.capital : 0;
    var pnl = document.getElementById("home-pnl");
    if (pnl) {
      pnl.textContent = (cyclePnl >= 0 ? "+" : "") + money(cyclePnl);
      pnl.className = "hero-pnl " + (cyclePnl >= 0 ? "pos" : "neg");
    }
    var ret = document.getElementById("v-L3");
    if (ret && ret.classList.contains("hero-ret")) {
      ret.className = "hero-ret " + (cycleRet >= 0 ? "pos" : "neg");
    }
    applyHomePnlFold();
    var sym = document.getElementById("set-symbol-label");
    if (sym) sym.textContent = s.symbol;

    document.getElementById("hero-ud-buy-px").textContent = money(out.C19);
    document.getElementById("hero-ud-buy-qty").textContent = out.B19;
    document.getElementById("hero-ud-sell-px").textContent = out.F19 === "" ? "없음" : money(out.F19);
    document.getElementById("hero-ud-sell-qty").textContent = out.E19 === "" ? "" : out.E19;
    document.getElementById("hero-tt-buy-px").textContent = out.I19 === "" ? "없음" : money(out.I19);
    document.getElementById("hero-tt-buy-qty").textContent = out.H19 === "" ? "" : out.H19;
    var ttSellEl = document.getElementById("hero-tt-sell");
    if (!out.openRanks.length) {
      ttSellEl.className = "tt-sell-list empty";
      ttSellEl.textContent = "보유 랭크 없음";
    } else {
      ttSellEl.className = "tt-sell-list";
      ttSellEl.innerHTML = out.openRanks
        .map(function (r) {
          return "<span class='tt-sell-line'>#" + r.rank + " " + money(r.sellPrice) + " x " + r.qty + "</span>";
        })
        .join("");
    }

    document.getElementById("hero-ud-buy-px").className = "v buy";
    document.getElementById("hero-ud-sell-px").className = out.F19 === "" ? "v empty" : "v sell";
    document.getElementById("hero-tt-buy-px").className = out.I19 === "" ? "v empty" : "v buy";

    document.getElementById("set-symbol").value = s.symbol;
    document.getElementById("set-capital").value = s.capital;
    document.getElementById("set-fee").value = s.fee;
    document.getElementById("set-seed").value = s.seedSplit;
    document.getElementById("set-rank").value = s.rankSplit;
    document.getElementById("set-inc").value = Math.round(Number(s.splitIncrease) * 1000) / 10;
    document.getElementById("set-hold").value = s.rankHoldDays;
    document.getElementById("set-reinvest").value = Math.round(Number(s.reinvest) * 1000) / 10;
    document.getElementById("set-fixed").checked = !!s.seedSplitFixed;
    document.getElementById("set-blocked").checked = !!s.buyBlocked;
    document.getElementById("set-f8").checked = !!s.applySheetF8Limit;
    var j16El = document.getElementById("set-j16");
    if (j16El) j16El.value = s.j16Mode === "loan" ? "loan" : "cap";
    document.getElementById("set-auto").checked = !!s.autoTransfer;
    document.getElementById("set-ud-steps").value = s.udLadderCount;
    document.getElementById("set-tt-steps").value = s.tteolLadderCount;
    document.getElementById("set-ud-qty").value = s.udStepQty;
    document.getElementById("set-tt-qty").value = s.tteolStepQty;
    var barLeftEl = document.getElementById("set-bar-left");
    var barRightEl = document.getElementById("set-bar-right");
    if (barLeftEl) barLeftEl.value = barKey("left");
    if (barRightEl) barRightEl.value = barKey("right");
    var leftOffEl = document.getElementById("set-bar-left-off");
    var rightOffEl = document.getElementById("set-bar-right-off");
    if (leftOffEl) leftOffEl.checked = !!state.barLeftOff;
    if (rightOffEl) rightOffEl.checked = !!state.barRightOff;
    var autoFillEl = document.getElementById("set-auto-fill");
    if (autoFillEl) autoFillEl.checked = !!state.autoFill;
    markPresetButtons();
    fillText("v-ud-orders", src.settings.udLadderCount);
    fillText("v-ud-step", src.settings.udStepQty);
    fillText("v-tt-orders", isEscapeView() ? 0 : s.tteolLadderCount);
    fillText("v-tt-step", isEscapeView() ? 0 : s.tteolStepQty);

    fillText("live-price", money(m.price));
    var tabPx = usd(m.price);
    var tabChg = signedPct(m.changePct);
    document.title = tabPx && tabChg !== "—" ? "Switch · " + tabPx + " · " + tabChg : tabPx ? "Switch · " + tabPx : "Switch · SOXL";
    var chgEl = document.getElementById("live-chg");
    if (chgEl) {
      chgEl.textContent = pct(m.changePct);
      chgEl.className = "hero-quote " + (m.changePct > 0 ? "pos" : m.changePct < 0 ? "neg" : "");
    }
    var usdEl = document.getElementById("live-usd");
    if (usdEl) {
      var chgRate = Number(m.changePct);
      var usdBase = Number(m.prevClose);
      if (m.phase && m.phase !== "REG_MKT") {
        var closedPx = Number(m.lastClose);
        if (isFinite(closedPx) && closedPx > 0) usdBase = closedPx;
      }
      if (isFinite(chgRate) && isFinite(usdBase) && usdBase > 0) {
        var shownRate = Number((chgRate * 100).toFixed(2)) / 100;
        var usdChg = usdBase * shownRate;
        usdEl.textContent = (usdChg > 0 ? "+" : usdChg < 0 ? "-" : "") + money(Math.abs(usdChg));
        usdEl.className = "quote-usd " + (usdChg > 0 ? "pos" : usdChg < 0 ? "neg" : "");
      } else {
        usdEl.textContent = "—";
        usdEl.className = "quote-usd";
      }
    }
    fillText("v-I3", money(out.I3));
    fillText("v-J3", out.J3);
    fillText("v-K3", money(out.K3));
    fillText("v-L3", pct(s.capital ? (Number(out.H8) || 0) / s.capital : 0));
    fillText("v-B8", out.B8);
    var seedUsed = (out.E16 || 0) + (out.K16 || 0);
    var seedRatio = out.C8 > 0 ? seedUsed / out.C8 : 0;
    if (seedRatio < 0) seedRatio = 0;
    if (seedRatio > 1) seedRatio = 1;
    var seedBar = document.getElementById("v-seed-bar");
    if (seedBar) seedBar.style.width = (seedRatio * 100).toFixed(1) + "%";
    fillText("v-seed-pct", "(" + Math.round(seedRatio * 100) + "%)");
    fillText("v-C8", money(out.C8));
    fillText("v-seed-used", money(seedUsed));
    fillText("v-D8", money(out.D8));
    fillText("v-dayshot", homeDayShot(out));
    fillText("v-daybuy", homeDayBuy(out));
    fillText("v-pr", out.F8);
    fillText("v-hold-total", (out.G8 || 0) + "주");
    fillText("v-E8", pct(out.E8));
    fillText("v-F8", out.F8);
    fillText("v-G8", out.G8);
    fillText("v-H8", money(out.H8));
    fillText("v-I8", pct(out.I8));
    fillText("v-ud-shot", money(out.D16));
    fillText("v-tt-shot", money(out.J16));
    fillText("v-ud-daybuy", money(out.udDayBuy));
    fillText("v-tt-daybuy", out.ttDayBuy === "" ? "없음" : money(out.ttDayBuy));
    fillText("v-B13", out.B13);
    fillText("v-C13", out.C13);
    fillText("v-C13-head", out.C13);
    fillText("v-D13", money(out.D13));
    fillText("v-E13", money(out.E13));
    fillText("v-F13", pct(out.F13));
    fillText("v-H13", out.H13);
    fillText("v-I13", out.I13);
    fillText("v-tt-hold", out.I13);
    fillText("v-tt-cycle", out.B8);
    var ttShown = cycleRealized(state.tteolTrades, out.B8);
    fillText("v-J13", money(out.J13));
    fillText("v-K13", money(ttShown));
    fillText("v-L13", pct(out.C8 ? ttShown / out.C8 : 0));
    fillText("v-D16", money(out.D16));
    fillText("v-E16", money(out.E16));
    fillText("v-F16", pct(out.F16));
    fillText("v-I16", out.I16);
    fillText("v-J16", money(out.J16, 3));
    fillText("v-K16", money(out.K16));
    fillText("v-L16", pct(out.L16));
    fillText("v-B19", out.B19);
    fillText("v-C19", money(out.C19));
    fillText("v-D19", money(out.D19));
    fillText("v-E19", out.E19 === "" ? "" : out.E19);
    fillText("v-F19", out.F19 === "" ? "" : money(out.F19));
    fillText("v-H19", out.H19 === "" ? "" : out.H19);
    fillText("v-I19", out.I19 === "" ? "" : money(out.I19));
    fillText("v-comb-avg", out.holdQty ? money(out.combAvg, 2) : "—");
    fillText("v-lp", money(out.D19));
    fillText("v-all-avg", out.holdQty ? money(out.combAvg, 4) : "—");
    fillText("v-all-eval", out.holdQty ? money(out.combEval) : "—");
    var allEvalEl = document.getElementById("v-all-eval");
    if (allEvalEl) allEvalEl.className = out.holdQty && out.combEval < 0 ? "neg" : out.holdQty && out.combEval > 0 ? "pos" : "";
    fillText("v-all-evalpct", out.holdQty ? pct(out.combEvalPct) : "—");
    fillText("v-ud-avg", out.C13 ? money(out.avg, 4) : "—");
    fillText("v-ud-eval", out.C13 ? money(out.udEval) : "—");
    var udEvalEl = document.getElementById("v-ud-eval");
    if (udEvalEl) udEvalEl.className = out.C13 && out.udEval < 0 ? "neg" : out.C13 && out.udEval > 0 ? "pos" : "";
    fillText("v-ud-evalpct", out.C13 ? pct(out.udEvalPct) : "—");
    fillText("v-tt-avg", out.I13 ? money(out.ttAvg, 4) : "—");
    fillText("v-tt-eval", out.I13 ? money(out.ttEval) : "—");
    var ttEvalEl = document.getElementById("v-tt-eval");
    if (ttEvalEl) ttEvalEl.className = out.I13 && out.ttEval < 0 ? "neg" : out.I13 && out.ttEval > 0 ? "pos" : "";
    fillText("v-tt-evalpct", out.I13 ? pct(out.ttEvalPct) : "—");
    renderCloseDb();
    renderSyncUi();

    renderLadder("ud-ladder", out.udLadder, "ud", out);
    renderLadder("tt-ladder", out.ttLadder, "tt", out);
    renderOrderHist();
    renderSuggested(out);
    renderRanks(out);
    renderUdLog();
    renderTtLog();
    renderStats(out);
  }

  function realizedRows() {
    var rows = [];
    function add(list) {
      (list || []).forEach(function (t) {
        if (t.pnl === "" || t.pnl == null || Number.isNaN(Number(t.pnl))) return;
        if (!t.date) return;
        rows.push({ date: t.date, pnl: Number(t.pnl), cycle: t.cycle });
      });
    }
    add(state.updownTrades);
    add(state.tteolTrades);
    return rows;
  }

  function finiteNum(v) {
    if (v == null || v === "") return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  function chronoTrade(a, b) {
    if ((a.date || "") !== (b.date || "")) return a.date < b.date ? -1 : 1;
    return (a.seq || 0) - (b.seq || 0);
  }

  function isoAddDays(iso, days) {
    var p = String(iso).split("-");
    var dt = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
  }

  function xmlEsc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function markerLabel(ratio) {
    if (ratio == null || !isFinite(ratio)) return "";
    var p = ratio * 100;
    var digits = Math.abs(p) < 1 ? 2 : 1;
    var body = p.toFixed(digits);
    if (p > 0) body = "+" + body;
    return body + "%";
  }

  function shareText(q) {
    var n = finiteNum(q);
    if (n == null || n < 0) n = 0;
    var digits = Math.abs(n - Math.round(n)) < 1e-6 ? 0 : 2;
    return n.toLocaleString("en-US", { maximumFractionDigits: digits }) + "주";
  }

  function sideLabel(side) {
    return side === "tt" ? "떨사" : "업다운";
  }

  function priceChartModel() {
    var events = [];
    (state.updownTrades || []).forEach(function (t) {
      if (t && t.date) events.push({ side: "ud", t: t });
    });
    (state.tteolTrades || []).forEach(function (t) {
      if (t && t.date) events.push({ side: "tt", t: t });
    });
    events.sort(function (a, b) {
      return chronoTrade(a.t, b.t);
    });

    var byRank = {};
    var udHold = 0;
    var udCost = 0;
    var ttHold = 0;
    var ttCost = 0;
    var curDate = "";
    var snaps = [];
    var markers = [];
    var fillByDate = {};

    function flush() {
      if (!curDate) return;
      snaps.push({ date: curDate, hold: udHold + ttHold, cost: udCost + ttCost });
    }

    function rememberFill(t) {
      var px = finiteNum(t.price);
      if (px != null && px > 0) fillByDate[t.date] = px;
    }

    function pushMarker(t, basis, side) {
      if (t.type !== "매도") return;
      var pnl = finiteNum(t.pnl);
      if (pnl == null || Math.abs(pnl) < 1) return;
      var base = finiteNum(basis);
      var qty = finiteNum(t.qty);
      markers.push({
        date: t.date,
        pnl: pnl,
        pct: base && base > 0 ? pnl / base : null,
        price: finiteNum(t.price) || 0,
        side: side === "tt" ? "tt" : "ud",
        qty: qty != null && qty > 0 ? qty : 0,
      });
    }

    events.forEach(function (ev) {
      var t = ev.t;
      if (t.date !== curDate) {
        flush();
        curDate = t.date;
      }
      rememberFill(t);
      if (ev.side === "ud") {
        var hold = finiteNum(t.holdQty);
        if (hold == null) hold = udHold;
        var cost = finiteNum(t.cost);
        if (cost == null) cost = (finiteNum(t.avg) || 0) * hold;
        udHold = hold;
        udCost = cost;
        var qty = finiteNum(t.qty) || 0;
        var avg = finiteNum(t.avg) || 0;
        pushMarker(t, qty * avg, "ud");
        return;
      }
      if (t.type === "매수") {
        var buyQty = finiteNum(t.qty) || 0;
        var buyCost = finiteNum(t.amount);
        if (buyCost == null) buyCost = (finiteNum(t.price) || 0) * buyQty;
        byRank[t.rank] = { qty: buyQty, cost: buyCost };
      } else if (t.type === "매도") {
        var lot = byRank[t.rank];
        var basis = lot ? lot.cost : 0;
        delete byRank[t.rank];
        pushMarker(t, basis, "tt");
      }
      ttHold = 0;
      ttCost = 0;
      Object.keys(byRank).forEach(function (k) {
        ttHold += byRank[k].qty;
        ttCost += byRank[k].cost;
      });
    });
    flush();

    var closeMap = {};
    (state.closeDb || []).forEach(function (r) {
      var px = r && finiteNum(r.close);
      if (r && r.date && px != null && px > 0) closeMap[r.date] = px;
    });
    var market = state.market || {};
    var liveClose = finiteNum(market.lastClose);
    if (market.closeDate && liveClose != null && liveClose > 0 && closeMap[market.closeDate] == null) {
      closeMap[market.closeDate] = liveClose;
    }
    Object.keys(SOXL_CLOSE_SEED).forEach(function (d) {
      if (closeMap[d] == null) closeMap[d] = SOXL_CLOSE_SEED[d];
    });

    var tradeDates = snaps.map(function (s) {
      return s.date;
    });
    markers.forEach(function (m) {
      tradeDates.push(m.date);
    });
    tradeDates.sort();
    var firstTrade = tradeDates.length ? tradeDates[0] : "";
    var lastTrade = tradeDates.length ? tradeDates[tradeDates.length - 1] : "";
    var closeDates = Object.keys(closeMap).sort();
    var lastCloseDate = closeDates.length ? closeDates[closeDates.length - 1] : "";
    var start = SOXL_CLOSE_FLOOR;
    if (closeDates.length && closeDates[0] < start) start = closeDates[0];
    var end = lastCloseDate > lastTrade ? lastCloseDate : lastTrade || lastCloseDate;
    if (!start || !end) return { dates: [], closes: {}, avg: {}, shares: {}, markers: [], fillFallback: false, cycleEnds: {} };

    var dateSet = {};
    closeDates.forEach(function (d) {
      if (d >= start && d <= end) dateSet[d] = true;
    });
    tradeDates.forEach(function (d) {
      if (d >= start && d <= end) dateSet[d] = true;
    });
    var dates = Object.keys(dateSet).sort();
    var closes = {};
    var sawClose = false;
    dates.forEach(function (d) {
      if (closeMap[d] != null) {
        closes[d] = closeMap[d];
        sawClose = true;
      }
    });
    var fillFallback = !sawClose;
    if (fillFallback) {
      dates.forEach(function (d) {
        if (fillByDate[d] != null) closes[d] = fillByDate[d];
      });
    }

    var avg = {};
    var prevAvg = {};
    var cost = {};
    var shares = {};
    var snapIdx = -1;
    var lastAvg = null;
    dates.forEach(function (d) {
      while (snapIdx + 1 < snaps.length && snaps[snapIdx + 1].date <= d) snapIdx++;
      var snap = snapIdx >= 0 ? snaps[snapIdx] : null;
      prevAvg[d] = lastAvg;
      shares[d] = snap ? snap.hold : 0;
      if (snap && snap.hold > 0) {
        avg[d] = snap.cost / snap.hold;
        cost[d] = snap.cost;
        lastAvg = avg[d];
      }
    });

    markers = markers.filter(function (m) {
      return m.date >= start && m.date <= end;
    });
    var cycleEnds = {};
    (state.updownTrades || []).forEach(function (t) {
      if (!t || t.type !== "매도" || !t.date) return;
      if (finiteNum(t.holdQty) !== 0) return;
      if (t.date < start || t.date > end) return;
      cycleEnds[t.date] = true;
    });
    return { dates: dates, closes: closes, avg: avg, prevAvg: prevAvg, cost: cost, shares: shares, markers: markers, cycleEnds: cycleEnds, fillFallback: fillFallback && dates.length > 0 };
  }

  function dotDate(iso) {
    iso = String(iso || "");
    if (iso.length < 10) return "";
    return iso.slice(0, 4) + "." + iso.slice(5, 7) + "." + iso.slice(8, 10);
  }

  function chartViewWidth(hostId) {
    var host = document.getElementById(hostId || "st-px-chart");
    if (host && host.clientWidth >= 120) return host.clientWidth;
    var page = document.getElementById("page-home");
    if (page && page.clientWidth >= 120) return Math.max(120, page.clientWidth - 32);
    return Math.max(280, Math.min(1040, window.innerWidth - 64));
  }

  function shortDot(iso) {
    iso = String(iso || "");
    if (iso.length < 10) return "";
    return iso.slice(2, 4) + "." + iso.slice(5, 7) + "." + iso.slice(8, 10);
  }

  function parseDotDate(s) {
    var p = String(s || "").trim().split(".");
    if (p.length !== 3) return "";
    var y = p[0];
    var m = p[1];
    var d = p[2];
    if (y.length === 2) y = String(2000 + Number(y));
    if (!/^\d{4}$/.test(y) || !/^\d{2}$/.test(m) || !/^\d{2}$/.test(d)) return "";
    var iso = y + "-" + m + "-" + d;
    var dt = new Date(iso + "T00:00:00Z");
    if (isNaN(dt.getTime())) return "";
    if (dt.getUTCFullYear() !== Number(y) || dt.getUTCMonth() + 1 !== Number(m) || dt.getUTCDate() !== Number(d)) return "";
    return iso;
  }

  function formatDotInput(raw) {
    var digits = String(raw || "").replace(/\D/g, "").slice(0, 6);
    var out = digits.slice(0, 2);
    if (digits.length > 2) out += "." + digits.slice(2, 4);
    if (digits.length > 4) out += "." + digits.slice(4, 6);
    return out;
  }

  function tipDate(iso) {
    var p = String(iso || "").split("-");
    if (p.length < 3) return iso || "";
    return Number(p[1]) + "." + p[2];
  }

  function chartWindow(dates, span) {
    var end = dates[dates.length - 1];
    var start = dates[0];
    if (span === "custom" && pxCustomFrom && pxCustomTo) {
      start = pxCustomFrom < pxCustomTo ? pxCustomFrom : pxCustomTo;
      end = pxCustomFrom < pxCustomTo ? pxCustomTo : pxCustomFrom;
    } else if (span !== "all" && span !== "custom") {
      var cut = isoAddDays(end, -(parseInt(span, 10) - 1));
      if (cut > start) start = cut;
    }
    var sliced = [];
    dates.forEach(function (d) {
      if (d >= start && d <= end) sliced.push(d);
    });
    return {
      start: sliced.length ? sliced[0] : start,
      end: sliced.length ? sliced[sliced.length - 1] : end,
      dates: sliced
    };
  }

  function syncPxRangeButtons() {
    document.querySelectorAll("#px-range > button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.span === String(pxSpan));
    });
    var custom = document.getElementById("px-custom");
    if (custom) custom.classList.toggle("active", pxSpan === "custom");
  }

  function paintPxDates(start, end) {
    pxViewFrom = start || "";
    pxViewTo = end || "";
    var fromEl = document.getElementById("px-from");
    var toEl = document.getElementById("px-to");
    var showFrom = pxSpan === "custom" && pxCustomFrom ? pxCustomFrom : start;
    var showTo = pxSpan === "custom" && pxCustomTo ? pxCustomTo : end;
    if (fromEl && showFrom) fromEl.textContent = shortDot(showFrom);
    if (toEl && showTo) toEl.textContent = shortDot(showTo);
  }

  function closePxCal() {
    var cal = document.getElementById("px-cal");
    if (cal) cal.hidden = true;
    pxCalTarget = "";
    var fromEl = document.getElementById("px-from");
    var toEl = document.getElementById("px-to");
    if (fromEl) fromEl.classList.remove("open");
    if (toEl) toEl.classList.remove("open");
  }

  function renderPxCal() {
    var grid = document.getElementById("px-cal-grid");
    var title = document.getElementById("px-cal-title");
    if (!grid || !title) return;
    var parts = String(pxCalMonth || "").split("-");
    var y = Number(parts[0]);
    var m = Number(parts[1]);
    if (!y || !m) return;
    title.textContent = y + "." + (m < 10 ? "0" : "") + m;
    var first = new Date(Date.UTC(y, m - 1, 1));
    var startDow = first.getUTCDay();
    var days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var from = pxCustomFrom || pxViewFrom;
    var to = pxCustomTo || pxViewTo;
    if (from && to && from > to) {
      var swap = from;
      from = to;
      to = swap;
    }
    var html = "";
    var i;
    for (i = 0; i < startDow; i++) html += "<span></span>";
    for (var d = 1; d <= days; d++) {
      var iso = y + "-" + (m < 10 ? "0" : "") + m + "-" + (d < 10 ? "0" : "") + d;
      var cls = "";
      if (from && to && iso >= from && iso <= to) cls = iso === from || iso === to ? "edge" : "in";
      else if (iso === from || iso === to) cls = "edge";
      html += "<button type='button' data-date='" + iso + "'" + (cls ? " class='" + cls + "'" : "") + ">" + d + "</button>";
    }
    grid.innerHTML = html;
  }

  function placePxCal(btn) {
    var wrap = document.querySelector(".px-range-wrap");
    var cal = document.getElementById("px-cal");
    if (!wrap || !cal || !btn) return;
    var br = btn.getBoundingClientRect();
    var wr = wrap.getBoundingClientRect();
    var calW = cal.offsetWidth || 280;
    var left = br.left - wr.left;
    if (left + calW > wr.width) left = Math.max(0, wr.width - calW);
    cal.style.left = left + "px";
    cal.style.top = br.bottom - wr.top + 6 + "px";
  }

  function openPxCal(which, btn) {
    pxCalTarget = which;
    var seed = which === "from" ? pxCustomFrom || pxViewFrom : pxCustomTo || pxViewTo;
    if (!seed) seed = SOXL_CLOSE_FLOOR;
    pxCalMonth = String(seed).slice(0, 7);
    var fromEl = document.getElementById("px-from");
    var toEl = document.getElementById("px-to");
    if (fromEl) fromEl.classList.toggle("open", which === "from");
    if (toEl) toEl.classList.toggle("open", which === "to");
    var cal = document.getElementById("px-cal");
    if (cal) cal.hidden = false;
    renderPxCal();
    placePxCal(btn);
  }

  function zoomPxAt(clientX, deltaY) {
    var w = pxWheel;
    if (!w || !w.dates || w.dates.length < 2 || !w.scroller) return;
    var full = w.dates;
    var rect = w.scroller.getBoundingClientRect();
    var svgX = clientX - rect.left + w.scroller.scrollLeft;
    var anchor = w.dateAt(svgX);
    var iAnchor = full.indexOf(anchor);
    if (iAnchor < 0) iAnchor = full.length - 1;
    var i0 = full.indexOf(w.start);
    var i1 = full.indexOf(w.end);
    if (i0 < 0) i0 = 0;
    if (i1 < 0) i1 = full.length - 1;
    if (i1 < i0) i1 = i0;
    var span = Math.max(1, i1 - i0);
    var dy = deltaY;
    var next = Math.round(span * Math.exp(dy * 0.002));
    var minSpan = Math.min(4, full.length - 1);
    if (next < minSpan) next = minSpan;
    if (next > full.length - 1) next = full.length - 1;
    if (next === span) {
      if (next >= full.length - 1 && pxSpan !== "all") {
        pxSpan = "all";
        pxStickRight = false;
        renderPriceChart();
      }
      return;
    }
    var ratio = (iAnchor - i0) / span;
    if (ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;
    var left = Math.round(iAnchor - ratio * next);
    var right = left + next;
    if (left < 0) {
      left = 0;
      right = next;
    }
    if (right > full.length - 1) {
      right = full.length - 1;
      left = right - next;
    }
    if (left < 0) left = 0;
    if (left === 0 && right === full.length - 1) {
      pxSpan = "all";
    } else {
      pxSpan = "custom";
      pxCustomFrom = full[left];
      pxCustomTo = full[right];
    }
    pxStickRight = false;
    renderPriceChart();
  }

  function zoomPxByWheel(ev) {
    var host = document.getElementById("st-px-chart");
    if (!host || !host.contains(ev.target)) return;
    ev.preventDefault();
    var dy = ev.deltaY;
    if (ev.deltaMode === 1) dy *= 16;
    else if (ev.deltaMode === 2) dy *= 400;
    zoomPxAt(ev.clientX, dy);
  }

  function pinchSpan(touches) {
    var dx = touches[0].clientX - touches[1].clientX;
    var dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function applyPinchWindow(leftF, rightF) {
    var w = pxWheel;
    if (!w || !w.dates || w.dates.length < 2) return;
    var full = w.dates;
    var maxI = full.length - 1;
    var left = Math.round(leftF);
    var right = Math.round(rightF);
    if (right - left < 4) {
      var mid = (leftF + rightF) / 2;
      left = Math.round(mid - 2);
      right = left + 4;
    }
    if (left < 0) left = 0;
    if (right > maxI) right = maxI;
    if (right <= left) return;
    if (left === 0 && right === maxI) {
      if (pxSpan === "all") return;
      pxSpan = "all";
      pxStickRight = false;
      pxSlide = 0;
      renderPriceChart();
      return;
    }
    var from = full[left];
    var to = full[right];
    if (pxSpan === "custom" && from === pxCustomFrom && to === pxCustomTo) return;
    pxSpan = "custom";
    pxCustomFrom = from;
    pxCustomTo = to;
    pxStickRight = false;
    pxSlide = 0;
    renderPriceChart();
  }

  function queuePinchWindow(leftF, rightF) {
    if (!pxPinch) return;
    pxPinch.pending = { left: leftF, right: rightF };
    if (pxPinch.frame) return;
    pxPinch.frame = requestAnimationFrame(function () {
      if (!pxPinch) return;
      pxPinch.frame = 0;
      var pending = pxPinch.pending;
      pxPinch.pending = null;
      if (!pending) return;
      applyPinchWindow(pending.left, pending.right);
    });
  }

  function pinchWindowFromScale(scale) {
    if (!pxPinch || !(scale > 0)) return;
    var span0 = Math.max(1, pxPinch.i1 - pxPinch.i0);
    var fullN = pxPinch.count || span0 + 1;
    var maxSpan = Math.max(1, fullN - 1);
    var next = span0 / scale;
    var minSpan = Math.min(4, maxSpan);
    if (next < minSpan) next = minSpan;
    if (next > maxSpan) next = maxSpan;
    var ratio = (pxPinch.anchor - pxPinch.i0) / span0;
    if (ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;
    var left = pxPinch.anchor - ratio * next;
    var right = left + next;
    if (left < 0) {
      left = 0;
      right = next;
    }
    if (right > maxSpan) {
      right = maxSpan;
      left = right - next;
    }
    if (left < 0) left = 0;
    queuePinchWindow(left, right);
  }

  function onPxTouchStart(ev) {
    if (ev.touches.length < 2) return;
    var w = pxWheel;
    if (!w || !w.dates || w.dates.length < 2 || !w.scroller) return;
    pxTouchZoom = true;
    var i0 = w.dates.indexOf(w.start);
    var i1 = w.dates.indexOf(w.end);
    if (i0 < 0) i0 = 0;
    if (i1 < 0) i1 = w.dates.length - 1;
    var rect = w.scroller.getBoundingClientRect();
    var midX = (ev.touches[0].clientX + ev.touches[1].clientX) / 2;
    var t = rect.width ? (midX - rect.left) / rect.width : 0.5;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    pxPinch = {
      dist: pinchSpan(ev.touches),
      i0: i0,
      i1: i1,
      anchor: i0 + (i1 - i0) * t,
      count: w.dates.length,
      frame: 0,
      pending: null
    };
    ev.preventDefault();
  }

  function onPxTouchMove(ev) {
    if (ev.touches.length < 2 || !pxPinch) return;
    ev.preventDefault();
    if (pxPinch.useGesture) return;
    var dist = pinchSpan(ev.touches);
    if (!(pxPinch.dist > 8) || !(dist > 8)) return;
    pinchWindowFromScale(dist / pxPinch.dist);
  }

  function onPxTouchEnd(ev) {
    if (ev.touches.length >= 2) return;
    if (pxPinch && pxPinch.frame) cancelAnimationFrame(pxPinch.frame);
    if (pxPinch && pxPinch.pending) applyPinchWindow(pxPinch.pending.left, pxPinch.pending.right);
    pxPinch = null;
    setTimeout(function () {
      pxTouchZoom = false;
    }, 400);
  }

  function onPxGesture(ev) {
    pxTouchZoom = true;
    ev.preventDefault();
    if (ev.type === "gesturestart") return;
    if (!pxPinch || !(ev.scale > 0)) return;
    pxPinch.useGesture = true;
    pinchWindowFromScale(ev.scale);
  }

  function paintSlide() {
    var plot = document.querySelector("#st-px-chart .px-plot");
    if (!plot) return;
    if (!pxSlide) {
      plot.style.transform = "";
      return;
    }
    var w = pxWheel;
    if (!w || !w.dates) return;
    var i0 = w.dates.indexOf(w.start);
    var i1 = w.dates.indexOf(w.end);
    var span = Math.max(1, (i1 < 0 ? 0 : i1) - (i0 < 0 ? 0 : i0));
    var width = (w.scroller && w.scroller.clientWidth) || plot.getBoundingClientRect().width || 1;
    plot.style.transform = "translateX(" + ((-pxSlide * width) / span).toFixed(2) + "px)";
  }

  function slideWindow(i0Float, span, full) {
    var maxI0 = full.length - 1 - span;
    if (i0Float < 0) i0Float = 0;
    if (i0Float > maxI0) i0Float = maxI0;
    var i0 = Math.floor(i0Float + 1e-6);
    if (i0 < 0) i0 = 0;
    if (i0 > maxI0) i0 = maxI0;
    var i1 = i0 + span;
    pxSlide = i0Float - i0;
    if (pxSlide < 0) pxSlide = 0;
    var from = full[i0];
    var to = full[i1];
    if (!(pxSpan === "custom" && from === pxCustomFrom && to === pxCustomTo)) {
      pxSpan = "custom";
      pxCustomFrom = from;
      pxCustomTo = to;
      pxStickRight = false;
      renderPriceChart();
    }
    paintSlide();
  }

  function snapSlide() {
    var w = pxWheel;
    if (w && pxSlide >= 0.5) {
      var full = w.dates;
      var i0 = full.indexOf(w.start);
      var i1 = full.indexOf(w.end);
      var span = i1 - i0;
      if (i0 >= 0 && span > 0 && i0 + span < full.length - 1) {
        pxSpan = "custom";
        pxCustomFrom = full[i0 + 1];
        pxCustomTo = full[i0 + span + 1];
        pxStickRight = false;
        pxSlide = 0;
        renderPriceChart();
        return;
      }
    }
    pxSlide = 0;
    paintSlide();
  }

  function applyPxRangeDrag(ev) {
    var drag = pxRangeDrag;
    if (!drag) return;
    var brush = document.querySelector("#st-px-chart .px-brush");
    if (!brush) return;
    var rect = brush.getBoundingClientRect();
    if (!rect.width) return;
    var full = drag.dates;
    var n = full.length;
    if (n < 2) return;
    function idx(clientX) {
      var t = (clientX - rect.left) / rect.width;
      if (t < 0) t = 0;
      if (t > 1) t = 1;
      return Math.round(t * (n - 1));
    }
    var i0 = drag.i0;
    var i1 = drag.i1;
    var span = drag.i1 - drag.i0;
    if (drag.mode === "move" || drag.mode === "plot") {
      var days;
      if (drag.mode === "plot") {
        var plotW = drag.plotW || 1;
        days = -((ev.clientX - drag.x) / plotW) * span;
      } else {
        var t0 = (drag.x - rect.left) / rect.width;
        var t1 = (ev.clientX - rect.left) / rect.width;
        if (t0 < 0) t0 = 0;
        if (t0 > 1) t0 = 1;
        if (t1 < 0) t1 = 0;
        if (t1 > 1) t1 = 1;
        days = (t1 - t0) * (n - 1);
      }
      slideWindow(drag.i0 + days, span, full);
      return;
    }
    if (drag.mode === "start") {
      i0 = idx(ev.clientX);
      if (i0 < 0) i0 = 0;
      if (i0 > i1 - 1) i0 = i1 - 1;
    } else if (drag.mode === "end") {
      i1 = idx(ev.clientX);
      if (i1 > n - 1) i1 = n - 1;
      if (i1 < i0 + 1) i1 = i0 + 1;
    }
    if (i0 < 0) i0 = 0;
    if (i1 > n - 1) i1 = n - 1;
    if (i1 <= i0) return;
    var from = full[i0];
    var to = full[i1];
    if (pxSpan === "custom" && from === pxCustomFrom && to === pxCustomTo) return;
    pxSpan = "custom";
    pxCustomFrom = from;
    pxCustomTo = to;
    pxStickRight = false;
    renderPriceChart();
  }

  function shiftPxCal(delta) {
    var parts = String(pxCalMonth || "").split("-");
    var dt = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1 + delta, 1));
    var m = dt.getUTCMonth() + 1;
    pxCalMonth = dt.getUTCFullYear() + "-" + (m < 10 ? "0" : "") + m;
    renderPxCal();
  }

  function easternParts(now) {
    var parts = {};
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(now || new Date()).forEach(function (p) {
      if (p.type !== "literal") parts[p.type] = p.value;
    });
    var hour = Number(parts.hour);
    if (hour === 24) hour = 0;
    return {
      date: parts.year + "-" + parts.month + "-" + parts.day,
      mins: hour * 60 + Number(parts.minute)
    };
  }

  function closeIsFinal(sessionDate, now) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(sessionDate || ""))) return false;
    var et = easternParts(now);
    if (sessionDate < et.date) return true;
    if (sessionDate > et.date) return false;
    return et.mins >= 16 * 60;
  }

  function dropOpenSessionCloses() {
    var changed = false;
    function keep(row) {
      if (!row || !row.date) return false;
      if (closeIsFinal(row.date)) return true;
      changed = true;
      return false;
    }
    state.closeDb = (state.closeDb || []).filter(keep);
    var m = state.market;
    if (m && m.closeHistory) {
      var before = m.closeHistory.length;
      m.closeHistory = m.closeHistory.filter(keep);
      if (m.closeHistory.length !== before) changed = true;
    }
    if (m && m.closeDate && !closeIsFinal(m.closeDate)) {
      var latest = (state.closeDb || [])[0];
      var prev = (state.closeDb || [])[1];
      m.closeDate = latest ? latest.date : "";
      m.tradeDate = m.closeDate;
      if (latest && isFinite(Number(latest.close))) m.lastClose = Number(latest.close);
      if (prev && isFinite(Number(prev.close))) {
        m.prevCloseDate = prev.date;
        m.prevClose = Number(prev.close);
      }
      changed = true;
    }
    return changed;
  }

  function sessionFillReady(sug, fallbackDate) {
    var d = (sug && sug.date) || fallbackDate || "";
    return !!(sug && sug.type) && closeIsFinal(d);
  }

  function backfillCloseSeed() {
    state.closeDb = state.closeDb || [];
    var have = {};
    state.closeDb.forEach(function (r) {
      if (r && r.date) have[r.date] = true;
    });
    var changed = false;
    Object.keys(SOXL_CLOSE_SEED).forEach(function (d) {
      if (have[d] || !closeIsFinal(d)) return;
      state.closeDb.push({ date: d, close: SOXL_CLOSE_SEED[d] });
      changed = true;
    });
    if (!changed) return false;
    state.closeDb.sort(function (a, b) {
      return a.date < b.date ? 1 : -1;
    });
    return true;
  }

  function syncPxLegend() {
    document.querySelectorAll(".px-legend [data-series]").forEach(function (b) {
      var s = b.getAttribute("data-series");
      b.classList.remove("is-on", "is-dim", "is-off");
      if (s === "cycle") {
        if (!pxCycleOn) b.classList.add("is-off");
        else if (pxFocus) b.classList.add("is-dim");
        return;
      }
      if (pxFocus === s) b.classList.add("is-on");
      else if (pxFocus) b.classList.add("is-dim");
    });
  }

  function ensurePxMount(host) {
    var body = host.querySelector(".px-chart-body");
    var layer = host.querySelector(".px-pinch-layer");
    if (!body) {
      body = document.createElement("div");
      body.className = "px-chart-body";
      while (host.firstChild) body.appendChild(host.firstChild);
      host.appendChild(body);
    }
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "px-pinch-layer";
      layer.setAttribute("aria-hidden", "true");
      host.appendChild(layer);
    }
    return { body: body, layer: layer };
  }

  function placePinchLayer(host) {
    var layer = host.querySelector(".px-pinch-layer");
    var scroller = host.querySelector(".px-scroll");
    if (!layer) return;
    if (!scroller) {
      layer.style.display = "none";
      return;
    }
    var hr = host.getBoundingClientRect();
    var sr = scroller.getBoundingClientRect();
    layer.style.display = "";
    layer.style.left = sr.left - hr.left + "px";
    layer.style.top = sr.top - hr.top + "px";
    layer.style.width = sr.width + "px";
    layer.style.height = sr.height + "px";
  }

  function renderPriceChart() {
    var host = document.getElementById("st-px-chart");
    syncPxLegend();
    if (!host) return;
    var mount = ensurePxMount(host);
    syncPxRangeButtons();
    var model = priceChartModel();
    if (!model.dates.length) {
      pxChartSig = "";
      pxUnpin = null;
      pxPlotTap = null;
      pxPlotHover = null;
      pxPlotLeave = null;
      mount.body.innerHTML = "<p class='note'>종가나 매매 기록이 없습니다.</p>";
      mount.layer.style.display = "none";
      return;
    }

    var win = chartWindow(model.dates, pxSpan);
    paintPxDates(win.start, win.end);
    var dates = win.dates;
    var n = dates.length;
    if (!n) {
      pxChartSig = "";
      pxUnpin = null;
      pxPlotTap = null;
      pxPlotHover = null;
      pxPlotLeave = null;
      mount.body.innerHTML = "<p class='note'>이 기간에 기록이 없습니다.</p>";
      mount.layer.style.display = "none";
      return;
    }

    var H = 268;
    var axisW = 52;
    var padL = 10;
    var padR = 18;
    var plotT = 28;
    var plotB = H - 36;
    var viewW = chartViewWidth();
    var slot = Math.max(220, viewW - axisW);
    var plotW = slot;
    var indexOf = {};
    dates.forEach(function (d, i) {
      indexOf[d] = i;
    });

    function xOf(i) {
      if (n === 1) return plotW / 2;
      return padL + (i / (n - 1)) * (plotW - padL - padR);
    }

    var markerList = model.markers.filter(function (m) {
      return m.date >= win.start && m.date <= win.end && indexOf[m.date] != null;
    });

    var ys = [];
    dates.forEach(function (d) {
      if (model.closes[d] != null) ys.push(model.closes[d]);
      if (model.avg[d] != null) ys.push(model.avg[d]);
    });
    markerList.forEach(function (m) {
      var yv = model.closes[m.date] != null ? model.closes[m.date] : m.price;
      if (yv) ys.push(yv);
    });
    var minY = ys.length ? Math.min.apply(null, ys) : 0;
    var maxY = ys.length ? Math.max.apply(null, ys) : 1;
    var span = maxY - minY || Math.max(1, Math.abs(maxY) * 0.04);
    minY -= span * 0.14;
    maxY += span * 0.18;
    span = maxY - minY;

    var sigParts = [pxSpan, pxFocus, pxCycleOn ? "1" : "0", pxCustomFrom, pxCustomTo, String(plotW), win.start, win.end, model.fillFallback ? "1" : "0"];
    dates.forEach(function (d) {
      var c = model.closes[d];
      var a = model.avg[d];
      sigParts.push((c == null ? "" : c.toFixed(4)) + "/" + (a == null ? "" : a.toFixed(4)) + "/" + (model.shares && model.shares[d] != null ? model.shares[d] : ""));
    });
    markerList.forEach(function (m) {
      sigParts.push(m.date + ":" + m.side + ":" + m.pnl.toFixed(2) + ":" + m.qty);
    });
    Object.keys(model.cycleEnds || {}).sort().forEach(function (d) {
      sigParts.push("cycle:" + d);
    });
    var sig = sigParts.join("|");
    if (sig === pxChartSig && host.querySelector(".px-scroll")) return;
    pxChartSig = sig;

    function yOf(v) {
      return plotB - ((v - minY) / span) * (plotB - plotT);
    }

    function pathOf(map, bridge) {
      var d = "";
      var pen = false;
      dates.forEach(function (date, i) {
        var v = map[date];
        if (v == null || !isFinite(v)) {
          if (!bridge) pen = false;
          return;
        }
        d += (pen ? "L" : "M") + xOf(i).toFixed(2) + " " + yOf(v).toFixed(2) + " ";
        pen = true;
      });
      return d;
    }

    var step = span / 4;
    var mag = Math.pow(10, Math.floor(Math.log10(step)));
    var err = step / mag;
    if (err >= 7.5) mag *= 10;
    else if (err >= 3.5) mag *= 5;
    else if (err >= 1.5) mag *= 2;
    var ticks = [];
    var tickStart = Math.ceil(minY / mag) * mag;
    for (var tv = tickStart; tv <= maxY + mag * 0.01; tv += mag) ticks.push(tv);
    var tickDigits = mag < 1 ? 2 : mag < 10 ? 1 : 0;

    var axis = [];
    axis.push(
      "<svg class='px-axis' style='width:" +
        axisW +
        "px;height:" +
        H +
        "px' viewBox='0 0 " +
        axisW +
        " " +
        H +
        "' aria-hidden='true'>"
    );
    var plot = [];
    plot.push(
      "<svg class='px-plot' id='px-plot' style='width:" +
        plotW +
        "px;height:" +
        H +
        "px' viewBox='0 0 " +
        plotW +
        " " +
        H +
        "' role='img' aria-label='종가, 평단, 매도 수익과 매도 손절'>"
    );
    ticks.forEach(function (v) {
      var y = yOf(v);
      if (y < plotT - 2 || y > plotB + 2) return;
      plot.push(
        "<line x1='0' y1='" +
          y.toFixed(2) +
          "' x2='" +
          plotW +
          "' y2='" +
          y.toFixed(2) +
          "' stroke='#eef0f4' stroke-width='1'/>"
      );
      axis.push(
        "<text x='" +
          (axisW - 6) +
          "' y='" +
          y.toFixed(2) +
          "' text-anchor='end' dominant-baseline='middle' fill='#9ca3af' font-size='10' font-family='Pretendard, sans-serif'>$" +
          v.toFixed(tickDigits) +
          "</text>"
      );
    });
    axis.push("</svg>");

    if (pxCycleOn) {
      var cycleOp = pxFocus ? 0.18 : 1;
      Object.keys(model.cycleEnds || {}).sort().forEach(function (d) {
        if (indexOf[d] == null) return;
        var cx = xOf(indexOf[d]);
        var bw = 2;
        plot.push(
          "<rect x='" +
            (cx - bw / 2).toFixed(2) +
            "' y='" +
            plotT +
            "' width='" +
            bw +
            "' height='" +
            (plotB - plotT) +
            "' rx='2' fill='#64748b' opacity='" +
            cycleOp +
            "'><title>" +
            xmlEsc(d + " 사이클 종료") +
            "</title></rect>"
        );
      });
    }

    var closePath = pathOf(model.closes, true);
    var avgPath = pathOf(model.avg, false);
    var closeOp = pxFocus === "avg" ? 0.2 : 1;
    var avgOp = pxFocus === "close" ? 0.2 : 1;
    var closeW = pxFocus === "close" ? 3.1 : 1.75;
    var avgW = pxFocus === "avg" ? 2.8 : 1.6;
    if (closePath) {
      plot.push(
        "<path d='" +
          closePath.trim() +
          "' fill='none' stroke='#111827' stroke-width='" +
          closeW +
          "' stroke-linejoin='round' stroke-linecap='round' opacity='" +
          closeOp +
          "'/>"
      );
    }
    if (avgPath) {
      plot.push(
        "<path d='" +
          avgPath.trim() +
          "' fill='none' stroke='#8b7cf6' stroke-width='" +
          avgW +
          "' stroke-dasharray='5 3.5' stroke-linejoin='round' stroke-linecap='round' opacity='" +
          avgOp +
          "'/>"
      );
    }

    var groups = {};
    markerList.forEach(function (m) {
      if (!groups[m.date]) groups[m.date] = [];
      groups[m.date].push(m);
    });
    var placed = [];
    Object.keys(groups)
      .sort()
      .forEach(function (date) {
        var list = groups[date];
        list.sort(function (a, b) {
          return b.pnl - a.pnl;
        });
        var xi = indexOf[date];
        if (xi == null) return;
        var baseX = xOf(xi);
        list.forEach(function (m, i) {
          var value = model.closes[date] != null ? model.closes[date] : m.price;
          if (!value) return;
          var x = baseX;
          var y = yOf(value);
          var up = m.pnl > 0;
          var tipY = up ? y - i * 12 : y + i * 12;
          var label = markerLabel(m.pct);
          if (label === "+0.0%" || label === "-0.0%" || label === "+0.00%" || label === "-0.00%") label = "";
          var labelW = Math.max(28, label.length * 5.6);
          function hits(box) {
            for (var p = 0; p < placed.length; p++) {
              var other = placed[p];
              if (Math.abs(other.x - box.x) < (other.w + box.w) / 2 && Math.abs(other.y - box.y) < 12) return true;
            }
            return false;
          }
          var labelY = up ? tipY - 11 : tipY + 19;
          var labelX = x;
          var guard = 0;
          while (label && guard < 8 && hits({ x: labelX, y: labelY, w: labelW })) {
            labelY += up ? -11 : 11;
            guard++;
          }
          if (labelY < 11) labelY = 11;
          if (labelY > H - 40) labelY = H - 40;
          if (label && hits({ x: labelX, y: labelY, w: labelW })) label = "";
          if (label) placed.push({ x: labelX, y: labelY, w: labelW });
          var color = up ? "#ef4444" : "#2563eb";
          var tri = up ? "0,0 5,-8 -5,-8" : "0,0 5,8 -5,8";
          var tip = m.date + " " + sideLabel(m.side) + (up ? " 매도 수익 " : " 매도 손절 ") + (label || "") + " " + money(m.pnl);
          plot.push("<g>");
          plot.push("<title>" + xmlEsc(tip) + "</title>");
          plot.push(
            "<polygon points='" +
              tri +
              "' transform='translate(" +
              x.toFixed(2) +
              " " +
              tipY.toFixed(2) +
              ")' fill='" +
              color +
              "'/>"
          );
          if (label) {
            plot.push(
              "<text x='" +
                labelX.toFixed(2) +
                "' y='" +
                labelY.toFixed(2) +
                "' text-anchor='middle' fill='" +
                color +
                "' font-size='9' font-weight='700' font-family='Pretendard, sans-serif'>" +
                xmlEsc(label) +
                "</text>"
            );
          }
          plot.push("</g>");
        });
      });

    var shown = [];
    dates.forEach(function (d, i) {
      var x = xOf(i);
      var force = i === 0 || i === n - 1;
      if (!force && shown.length && x - shown[shown.length - 1].x < 70) return;
      if (!force && plotW - padR - x < 70) return;
      if (i === n - 1 && shown.length > 1 && x - shown[shown.length - 1].x < 56) shown.pop();
      shown.push({ i: i, x: x, d: d });
    });
    var prevShownYear = "";
    shown.forEach(function (item) {
      var anchor = item.i === 0 ? "start" : item.i === n - 1 ? "end" : "middle";
      var year = item.d.slice(0, 4);
      var text = item.d.slice(5).replace("-", ".");
      if (item.i === 0 || year !== prevShownYear) text = item.d.slice(2, 4) + "." + text;
      prevShownYear = year;
      plot.push(
        "<text x='" +
          item.x.toFixed(2) +
          "' y='" +
          (H - 16) +
          "' text-anchor='" +
          anchor +
          "' fill='#9ca3af' font-size='10' font-family='Pretendard, sans-serif'>" +
          text +
          "</text>"
      );
    });
    plot.push(
      "<line class='px-guide' x1='0' y1='" +
        plotT +
        "' x2='0' y2='" +
        plotB +
        "' stroke='#9ca3af' stroke-dasharray='3 3' stroke-width='1' visibility='hidden'/>"
    );
    plot.push("<circle class='px-guide-dot' r='4.5' fill='#fff' stroke='#111827' stroke-width='1.6' visibility='hidden'/>");
    plot.push("</svg>");

    var html = [];
    html.push("<div class='px-chart-layout'>");
    html.push(axis.join(""));
    html.push("<div class='px-scroll' tabindex='0' aria-label='종가와 평단. 마우스 휠이나 두 손가락으로 기간을 늘리거나 줄일 수 있습니다.'>");
    html.push(plot.join(""));
    html.push("</div>");
    html.push(
      "<div class='px-brush' role='slider' aria-orientation='horizontal' aria-label='보이는 기간. 끝을 끌면 늘리거나 줄이고, 가운데를 끌면 이동합니다.' aria-controls='px-plot'>"
    );
    html.push("<div class='px-brush-track'></div><div class='px-brush-win'></div></div>");
    html.push("</div>");
    html.push("<div class='px-tip' hidden></div>");
    html.push("<p class='note px-span-note'></p>");
    if (model.fillFallback) html.push("<p class='note'>종가 기록이 없어 체결 단가로 이었습니다.</p>");
    mount.body.innerHTML = html.join("");
    placePinchLayer(host);

    var scroller = host.querySelector(".px-scroll");
    var brush = host.querySelector(".px-brush");
    if (pxRangeDrag && brush) brush.classList.add("is-drag");
    var thumb = host.querySelector(".px-brush-win");
    var note = host.querySelector(".px-span-note");
    var guide = host.querySelector(".px-guide");
    var guideDot = host.querySelector(".px-guide-dot");
    var tip = host.querySelector(".px-tip");
    var hoverDate = "";
    var pinnedDate = pxPinnedDate && indexOf[pxPinnedDate] != null ? pxPinnedDate : "";
    if (pxPinnedDate && !pinnedDate) pxPinnedDate = "";

    function tipRow(k, v, cls) {
      return "<div class='px-tip-row'><span>" + xmlEsc(k) + "</span><b class='" + (cls || "") + "'>" + xmlEsc(v) + "</b></div>";
    }

    function hideGuide() {
      hoverDate = "";
      if (guide) guide.setAttribute("visibility", "hidden");
      if (guideDot) guideDot.setAttribute("visibility", "hidden");
      if (tip) {
        tip.hidden = true;
        tip.classList.remove("is-pin");
      }
    }

    function hideTip() {
      if (pinnedDate) return showTip(pinnedDate);
      hideGuide();
    }

    pxUnpin = function () {
      pinnedDate = "";
      pxPinnedDate = "";
      hideGuide();
    };

    function showTip(date) {
      if (!date || indexOf[date] == null) return hideGuide();
      hoverDate = date;
      var x = xOf(indexOf[date]);
      if (guide) {
        guide.setAttribute("x1", x.toFixed(2));
        guide.setAttribute("x2", x.toFixed(2));
        guide.setAttribute("visibility", "visible");
      }
      var close = model.closes[date];
      if (guideDot && close != null) {
        guideDot.setAttribute("cx", x.toFixed(2));
        guideDot.setAttribute("cy", yOf(close).toFixed(2));
        guideDot.setAttribute("visibility", "visible");
      } else if (guideDot) {
        guideDot.setAttribute("visibility", "hidden");
      }
      if (!tip) return;
      var pinned = pinnedDate === date;
      tip.classList.toggle("is-pin", pinned);
      var rows = [
        "<div class='px-tip-date'>" +
          xmlEsc(tipDate(date)) +
          (pinned ? "<span class='px-tip-pin'>고정</span>" : "") +
          "</div>"
      ];
      if (model.cycleEnds && model.cycleEnds[date]) rows.push(tipRow("사이클", "종료"));
      if (close != null) rows.push(tipRow("종가", usd(close)));
      var avgNow = model.avg[date];
      var avgBefore = model.prevAvg[date];
      if (avgNow != null) {
        var avgText =
          avgBefore != null && Math.abs(avgBefore - avgNow) >= 0.005 ? usd(avgBefore) + " → " + usd(avgNow) : usd(avgNow);
        rows.push(tipRow("평단", avgText));
      }
      rows.push(tipRow("갯수", shareText(model.shares ? model.shares[date] : 0)));
      if (model.cost[date] != null) rows.push(tipRow("투입원금", usd(model.cost[date], 0)));
      var dayMarks = [];
      markerList.forEach(function (m) {
        if (m.date === date) dayMarks.push(m);
      });
      dayMarks.sort(function (a, b) {
        if (a.side !== b.side) return a.side === "ud" ? -1 : 1;
        return b.pnl - a.pnl;
      });
      dayMarks.forEach(function (m) {
        var gain = m.pnl > 0;
        var body = (gain ? "+" : "-") + usd(Math.abs(m.pnl));
        var pctText = markerLabel(m.pct);
        if (pctText) body += "  " + pctText;
        rows.push(tipRow(sideLabel(m.side) + (gain ? " 매도 수익" : " 매도 손절"), body, gain ? "up" : "down"));
      });
      tip.innerHTML = rows.join("");
      tip.hidden = false;
      var hostRect = host.getBoundingClientRect();
      var plotRect = scroller.getBoundingClientRect();
      var localX = plotRect.left - hostRect.left + (x - scroller.scrollLeft);
      var tipW = tip.offsetWidth || 220;
      var left = localX + 16;
      if (left + tipW > host.clientWidth - 6) left = localX - tipW - 16;
      if (left < 4) left = 4;
      tip.style.left = left + "px";
      tip.style.top = "8px";
    }

    function dateAt(px) {
      if (n <= 1) return dates[0];
      var inner = plotW - padL - padR;
      var t = (px - padL) / inner;
      if (t < 0) t = 0;
      if (t > 1) t = 1;
      return dates[Math.round(t * (n - 1))];
    }

    pxPlotTap = function (clientX) {
      var rect = scroller.getBoundingClientRect();
      var date = dateAt(clientX - rect.left + scroller.scrollLeft);
      if (!date) return;
      if (pinnedDate === date) {
        pinnedDate = "";
        pxPinnedDate = "";
        hideGuide();
        return;
      }
      pinnedDate = date;
      pxPinnedDate = date;
      showTip(date);
    };

    pxPlotHover = function (clientX) {
      if (pinnedDate) return;
      var rect = scroller.getBoundingClientRect();
      showTip(dateAt(clientX - rect.left + scroller.scrollLeft));
    };
    pxPlotLeave = hideTip;

    function paintNote() {
      if (!note) return;
      var from = dateAt(scroller.scrollLeft + padL);
      var to = dateAt(scroller.scrollLeft + scroller.clientWidth - padR);
      note.textContent = dotDate(from) + " – " + dotDate(to);
    }

    function placeThumb() {
      var full = model.dates;
      var nFull = full.length;
      brush.classList.remove("is-fit");
      if (nFull < 2) {
        thumb.style.left = "0%";
        thumb.style.width = "100%";
        brush.setAttribute("aria-valuenow", "0");
        brush.setAttribute("aria-valuemax", "0");
        return;
      }
      var i0 = full.indexOf(win.start);
      var i1 = full.indexOf(win.end);
      if (i0 < 0) i0 = 0;
      if (i1 < 0) i1 = nFull - 1;
      if (i1 < i0) i1 = i0;
      var left = (i0 / (nFull - 1)) * 100;
      var width = ((i1 - i0) / (nFull - 1)) * 100;
      if (width < 3) {
        var mid = left + width / 2;
        width = 3;
        left = Math.max(0, Math.min(97, mid - 1.5));
      }
      if (left + width > 100) left = 100 - width;
      thumb.style.left = left + "%";
      thumb.style.width = width + "%";
      brush.setAttribute("aria-valuenow", String(i0));
      brush.setAttribute("aria-valuemax", String(nFull - 1));
    }

    function pinScroll() {
      var max = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      if (pxStickRight) scroller.scrollLeft = max;
      else scroller.scrollLeft = Math.max(0, Math.min(pxScrollLeft, max));
      placeThumb();
      paintNote();
    }

    scroller.addEventListener("scroll", function () {
      pxScrollLeft = scroller.scrollLeft;
      var max = scroller.scrollWidth - scroller.clientWidth;
      if (max > 2) pxStickRight = pxScrollLeft >= max - 8;
      placeThumb();
      paintNote();
      if (pinnedDate) showTip(pinnedDate);
      else if (hoverDate) showTip(hoverDate);
    }, { passive: true });
    scroller.addEventListener("mousemove", function (ev) {
      if (pinnedDate) return;
      var rect = scroller.getBoundingClientRect();
      showTip(dateAt(ev.clientX - rect.left + scroller.scrollLeft));
    });
    scroller.addEventListener("mouseleave", hideTip);
    var press = null;
    scroller.addEventListener("pointerdown", function (ev) {
      if (ev.button != null && ev.button !== 0) return;
      press = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
    });
    scroller.addEventListener("pointerup", function (ev) {
      if (pxTouchZoom) {
        press = null;
        return;
      }
      if (!press || press.id !== ev.pointerId) return;
      var dx = ev.clientX - press.x;
      var dy = ev.clientY - press.y;
      press = null;
      if (dx * dx + dy * dy > 36) return;
      var rect = scroller.getBoundingClientRect();
      var date = dateAt(ev.clientX - rect.left + scroller.scrollLeft);
      if (!date) return;
      if (pinnedDate === date) {
        pinnedDate = "";
        pxPinnedDate = "";
        hideGuide();
        return;
      }
      pinnedDate = date;
      pxPinnedDate = date;
      showTip(date);
    });
    scroller.addEventListener("keydown", function (ev) {
      var step = Math.max(48, Math.round(scroller.clientWidth * 0.4));
      if (ev.key === "ArrowRight") {
        scroller.scrollLeft += step;
        ev.preventDefault();
      } else if (ev.key === "ArrowLeft") {
        scroller.scrollLeft -= step;
        ev.preventDefault();
      }
    });

    function brushIndexes(clientX) {
      var full = model.dates;
      var nFull = full.length;
      var rect = brush.getBoundingClientRect();
      var i0 = nFull ? full.indexOf(win.start) : 0;
      var i1 = nFull ? full.indexOf(win.end) : 0;
      if (i0 < 0) i0 = 0;
      if (i1 < 0) i1 = Math.max(0, nFull - 1);
      var leftPx = nFull > 1 ? (i0 / (nFull - 1)) * rect.width : 0;
      var rightPx = nFull > 1 ? (i1 / (nFull - 1)) * rect.width : rect.width;
      var x = clientX - rect.left;
      var thumb = rightPx - leftPx;
      var edge = thumb < 48 ? 0 : 14;
      var mode = "move";
      if (edge && Math.abs(x - leftPx) <= edge) mode = "start";
      else if (edge && Math.abs(x - rightPx) <= edge) mode = "end";
      return { i0: i0, i1: i1, mode: mode };
    }
    brush.addEventListener("pointermove", function (ev) {
      if (pxRangeDrag) return;
      var hit = brushIndexes(ev.clientX);
      brush.classList.toggle("is-edge", hit.mode !== "move");
    });
    brush.addEventListener("pointerdown", function (ev) {
      var full = model.dates;
      if (!full || full.length < 2) return;
      var hit = brushIndexes(ev.clientX);
      var i0 = hit.i0;
      var i1 = hit.i1;
      if (hit.mode === "move") {
        var rect = brush.getBoundingClientRect();
        var t = (ev.clientX - rect.left) / rect.width;
        if (t < 0) t = 0;
        if (t > 1) t = 1;
        var center = Math.round(t * (full.length - 1));
        var span = i1 - i0;
        if (center < i0 || center > i1) {
          i0 = center - Math.round(span / 2);
          i1 = i0 + span;
          if (i0 < 0) {
            i0 = 0;
            i1 = span;
          }
          if (i1 > full.length - 1) {
            i1 = full.length - 1;
            i0 = i1 - span;
          }
        }
      }
      pxRangeDrag = { mode: hit.mode, i0: i0, i1: i1, x: ev.clientX, dates: full.slice() };
      brush.classList.add("is-drag");
      var capHost = document.getElementById("st-px-chart");
      if (capHost && ev.pointerId != null) {
        try { capHost.setPointerCapture(ev.pointerId); } catch (err) {}
      }
      applyPxRangeDrag(ev);
      ev.preventDefault();
    });

    pxWheel = {
      dates: model.dates,
      start: win.start,
      end: win.end,
      dateAt: dateAt,
      scroller: scroller
    };
    paintSlide();
    pinScroll();
    if (pinnedDate) showTip(pinnedDate);
    requestAnimationFrame(function () {
      pinScroll();
      if (pinnedDate) showTip(pinnedDate);
    });
  }


  function ohlcCacheRead() {
    try {
      var raw = localStorage.getItem(OHLC_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.bars || !data.bars.length) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function ohlcCacheWrite(bars) {
    try {
      localStorage.setItem(OHLC_KEY, JSON.stringify({ fetched: Date.now(), bars: bars }));
    } catch (e) {}
  }

  function ohlcParseCnbc(data) {
    var rows = data && data.barData && data.barData.priceBars;
    if (!rows || !rows.length) throw new Error("parse");
    var out = [];
    rows.forEach(function (b) {
      var t = String(b.tradeTime || "");
      if (t.length < 8) return;
      var date = t.slice(0, 4) + "-" + t.slice(4, 6) + "-" + t.slice(6, 8);
      var open = Number(b.open);
      var high = Number(b.high);
      var low = Number(b.low);
      var close = Number(b.close);
      if (!(close > 0) || !(high > 0) || !(low > 0)) return;
      out.push([date, open > 0 ? open : close, high, low, close]);
    });
    out.sort(function (a, b) {
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    });
    if (!out.length) throw new Error("parse");
    return out;
  }

  function ohlcSeries() {
    var rows = (ohlcBars || []).slice();
    var seen = {};
    rows.forEach(function (b) {
      seen[b[0]] = true;
    });
    function pushClose(date, close) {
      close = Number(close);
      if (!date || seen[date] || !(close > 0) || !closeIsFinal(date)) return;
      seen[date] = true;
      rows.push([date, null, close, close, close]);
    }
    (state.closeDb || []).forEach(function (r) {
      if (r) pushClose(r.date, r.close);
    });
    var market = state.market || {};
    pushClose(market.closeDate, market.lastClose);
    rows.sort(function (a, b) {
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    });
    return rows;
  }

  function ohlcStale() {
    if (!ohlcBars || !ohlcBars.length) return true;
    return Date.now() - ohlcFetched > 6 * 3600 * 1000;
  }

  function ensureOhlc() {
    if (!ohlcBars) {
      var cached = ohlcCacheRead();
      if (cached) {
        ohlcBars = cached.bars;
        ohlcFetched = Number(cached.fetched) || 0;
      }
    }
    if (ohlcBars && ohlcBars.length && !ohlcStale()) return;
    if (ohlcBusy) return;
    ohlcBusy = true;
    ohlcErr = "";
    var endAt = new Date(Date.now() + 4 * 86400000);
    function ohlcPad(n) { return n < 10 ? "0" + n : "" + n; }
    var endStamp = endAt.getUTCFullYear() + ohlcPad(endAt.getUTCMonth() + 1) + ohlcPad(endAt.getUTCDate()) + "000000";
    var url = "https://ts-api.cnbc.com/harmony/app/bars/SOXL/1D/20100311000000/" + endStamp + "/adjusted/EST5EDT.json";
    fetchJson(url).then(ohlcParseCnbc).then(function (bars) {
      ohlcBars = bars;
      ohlcFetched = Date.now();
      ohlcErr = "";
      ohlcCacheWrite(bars);
      ohlcChartSig = "";
      renderOhlcChart();
    }, function () {
      if (!ohlcBars || !ohlcBars.length) ohlcErr = "일봉을 불러오지 못했습니다.";
      ohlcChartSig = "";
      renderOhlcChart();
    }).then(function () {
      ohlcBusy = false;
    });
  }

  function ohlcWindow(dates) {
    var end = dates[dates.length - 1];
    var start = dates[0];
    if (ohlcSpan === "custom" && ohlcCustomFrom && ohlcCustomTo) {
      start = ohlcCustomFrom < ohlcCustomTo ? ohlcCustomFrom : ohlcCustomTo;
      end = ohlcCustomFrom < ohlcCustomTo ? ohlcCustomTo : ohlcCustomFrom;
    } else if (ohlcSpan !== "all" && ohlcSpan !== "custom") {
      var cut = isoAddDays(end, -(parseInt(ohlcSpan, 10) - 1));
      if (cut > start) start = cut;
    }
    var sliced = [];
    dates.forEach(function (d) {
      if (d >= start && d <= end) sliced.push(d);
    });
    return {
      start: sliced.length ? sliced[0] : start,
      end: sliced.length ? sliced[sliced.length - 1] : end,
      dates: sliced
    };
  }

  function syncOhlcRange() {
    document.querySelectorAll("#ohlc-range > button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.span === String(ohlcSpan));
    });
    var custom = document.getElementById("ohlc-custom");
    if (custom) custom.classList.toggle("active", ohlcSpan === "custom");
  }

  function paintOhlcDates(start, end) {
    ohlcViewFrom = start || "";
    ohlcViewTo = end || "";
    var fromEl = document.getElementById("ohlc-from");
    var toEl = document.getElementById("ohlc-to");
    var showFrom = ohlcSpan === "custom" && ohlcCustomFrom ? ohlcCustomFrom : start;
    var showTo = ohlcSpan === "custom" && ohlcCustomTo ? ohlcCustomTo : end;
    if (fromEl && showFrom) fromEl.textContent = shortDot(showFrom);
    if (toEl && showTo) toEl.textContent = shortDot(showTo);
  }

  function closeOhlcCal() {
    var cal = document.getElementById("ohlc-cal");
    if (cal) cal.hidden = true;
    ohlcCalTarget = "";
    var fromEl = document.getElementById("ohlc-from");
    var toEl = document.getElementById("ohlc-to");
    if (fromEl) fromEl.classList.remove("open");
    if (toEl) toEl.classList.remove("open");
  }

  function renderOhlcCal() {
    var grid = document.getElementById("ohlc-cal-grid");
    var title = document.getElementById("ohlc-cal-title");
    if (!grid || !title) return;
    var parts = String(ohlcCalMonth || "").split("-");
    var y = Number(parts[0]);
    var m = Number(parts[1]);
    if (!y || !m) return;
    title.textContent = y + "." + (m < 10 ? "0" : "") + m;
    var first = new Date(Date.UTC(y, m - 1, 1));
    var startDow = first.getUTCDay();
    var days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var from = ohlcCustomFrom || ohlcViewFrom;
    var to = ohlcCustomTo || ohlcViewTo;
    if (from && to && from > to) {
      var swap = from;
      from = to;
      to = swap;
    }
    var html = "";
    var i;
    for (i = 0; i < startDow; i++) html += "<span></span>";
    for (var d = 1; d <= days; d++) {
      var iso = y + "-" + (m < 10 ? "0" : "") + m + "-" + (d < 10 ? "0" : "") + d;
      var cls = "";
      if (from && to && iso >= from && iso <= to) cls = iso === from || iso === to ? "edge" : "in";
      else if (iso === from || iso === to) cls = "edge";
      html += "<button type='button' data-date='" + iso + "'" + (cls ? " class='" + cls + "'" : "") + ">" + d + "</button>";
    }
    grid.innerHTML = html;
  }

  function placeOhlcCal(btn) {
    var wrap = document.getElementById("ohlc-range-wrap");
    var cal = document.getElementById("ohlc-cal");
    if (!wrap || !cal || !btn) return;
    var br = btn.getBoundingClientRect();
    var wr = wrap.getBoundingClientRect();
    var calW = cal.offsetWidth || 280;
    var left = br.left - wr.left;
    if (left + calW > wr.width) left = Math.max(0, wr.width - calW);
    cal.style.left = left + "px";
    cal.style.top = br.bottom - wr.top + 6 + "px";
  }

  function openOhlcCal(which, btn) {
    ohlcCalTarget = which;
    var seed = which === "from" ? ohlcCustomFrom || ohlcViewFrom : ohlcCustomTo || ohlcViewTo;
    if (!seed) seed = "2010-03-11";
    ohlcCalMonth = String(seed).slice(0, 7);
    var fromEl = document.getElementById("ohlc-from");
    var toEl = document.getElementById("ohlc-to");
    if (fromEl) fromEl.classList.toggle("open", which === "from");
    if (toEl) toEl.classList.toggle("open", which === "to");
    var cal = document.getElementById("ohlc-cal");
    if (cal) cal.hidden = false;
    renderOhlcCal();
    placeOhlcCal(btn);
  }

  function shiftOhlcCal(delta) {
    var parts = String(ohlcCalMonth || "").split("-");
    var dt = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1 + delta, 1));
    var m = dt.getUTCMonth() + 1;
    ohlcCalMonth = dt.getUTCFullYear() + "-" + (m < 10 ? "0" : "") + m;
    renderOhlcCal();
  }

  function ohlcApplyWindow(left, right, full) {
    if (!full || full.length < 2) return;
    var maxI = full.length - 1;
    if (left < 0) left = 0;
    if (right > maxI) right = maxI;
    if (right <= left) return;
    if (left === 0 && right === maxI) {
      if (ohlcSpan === "all") return;
      ohlcSpan = "all";
      ohlcStickRight = false;
      renderOhlcChart();
      return;
    }
    var from = full[left];
    var to = full[right];
    if (ohlcSpan === "custom" && from === ohlcCustomFrom && to === ohlcCustomTo) return;
    ohlcSpan = "custom";
    ohlcCustomFrom = from;
    ohlcCustomTo = to;
    ohlcStickRight = false;
    renderOhlcChart();
  }

  function zoomOhlcAt(clientX, deltaY) {
    var w = ohlcWheel;
    if (!w || !w.dates || w.dates.length < 2 || !w.scroller) return;
    var full = w.dates;
    var rect = w.scroller.getBoundingClientRect();
    var svgX = clientX - rect.left + w.scroller.scrollLeft;
    var anchor = w.dateAt(svgX);
    var iAnchor = full.indexOf(anchor);
    if (iAnchor < 0) iAnchor = full.length - 1;
    var i0 = full.indexOf(w.start);
    var i1 = full.indexOf(w.end);
    if (i0 < 0) i0 = 0;
    if (i1 < 0) i1 = full.length - 1;
    if (i1 < i0) i1 = i0;
    var span = Math.max(1, i1 - i0);
    var next = Math.round(span * Math.exp(deltaY * 0.002));
    var minSpan = Math.min(4, full.length - 1);
    if (next < minSpan) next = minSpan;
    if (next > full.length - 1) next = full.length - 1;
    if (next === span) {
      if (next >= full.length - 1 && ohlcSpan !== "all") {
        ohlcSpan = "all";
        ohlcStickRight = false;
        renderOhlcChart();
      }
      return;
    }
    var ratio = (iAnchor - i0) / span;
    if (ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;
    var left = Math.round(iAnchor - ratio * next);
    var right = left + next;
    if (left < 0) {
      left = 0;
      right = next;
    }
    if (right > full.length - 1) {
      right = full.length - 1;
      left = right - next;
    }
    if (left < 0) left = 0;
    ohlcApplyWindow(left, right, full);
  }

  function ohlcPinchSpan(touches) {
    var dx = touches[0].clientX - touches[1].clientX;
    var dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function queueOhlcPinch(leftF, rightF) {
    if (!ohlcPinch) return;
    ohlcPinch.pending = { left: leftF, right: rightF };
    if (ohlcPinch.frame) return;
    ohlcPinch.frame = requestAnimationFrame(function () {
      if (!ohlcPinch) return;
      ohlcPinch.frame = 0;
      var pending = ohlcPinch.pending;
      ohlcPinch.pending = null;
      if (!pending || !ohlcWheel) return;
      ohlcApplyWindow(Math.round(pending.left), Math.round(pending.right), ohlcWheel.dates);
    });
  }

  function ohlcPinchScale(scale) {
    if (!ohlcPinch || !(scale > 0)) return;
    var span0 = Math.max(1, ohlcPinch.i1 - ohlcPinch.i0);
    var fullN = ohlcPinch.count || span0 + 1;
    var maxSpan = Math.max(1, fullN - 1);
    var next = span0 / scale;
    var minSpan = Math.min(4, maxSpan);
    if (next < minSpan) next = minSpan;
    if (next > maxSpan) next = maxSpan;
    var ratio = (ohlcPinch.anchor - ohlcPinch.i0) / span0;
    if (ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;
    var left = ohlcPinch.anchor - ratio * next;
    var right = left + next;
    if (left < 0) {
      left = 0;
      right = next;
    }
    if (right > maxSpan) {
      right = maxSpan;
      left = right - next;
    }
    if (left < 0) left = 0;
    queueOhlcPinch(left, right);
  }

  function ohlcApplyDrag(ev) {
    var drag = ohlcDrag;
    if (!drag) return;
    var brush = document.querySelector("#ohlc-chart .px-brush");
    var full = drag.dates;
    var n = full.length;
    if (n < 2) return;
    var i0 = drag.i0;
    var i1 = drag.i1;
    var span = drag.i1 - drag.i0;
    if (drag.mode === "move" || drag.mode === "plot") {
      var days;
      if (drag.mode === "plot") {
        days = -((ev.clientX - drag.x) / (drag.plotW || 1)) * span;
      } else if (brush) {
        var rect = brush.getBoundingClientRect();
        if (!rect.width) return;
        var t0 = (drag.x - rect.left) / rect.width;
        var t1 = (ev.clientX - rect.left) / rect.width;
        if (t0 < 0) t0 = 0;
        if (t0 > 1) t0 = 1;
        if (t1 < 0) t1 = 0;
        if (t1 > 1) t1 = 1;
        days = (t1 - t0) * (n - 1);
      } else return;
      var i0f = drag.i0 + days;
      var maxI0 = n - 1 - span;
      if (i0f < 0) i0f = 0;
      if (i0f > maxI0) i0f = maxI0;
      ohlcApplyWindow(Math.round(i0f), Math.round(i0f) + span, full);
      return;
    }
    if (!brush) return;
    var bar = brush.getBoundingClientRect();
    if (!bar.width) return;
    function idx(clientX) {
      var t = (clientX - bar.left) / bar.width;
      if (t < 0) t = 0;
      if (t > 1) t = 1;
      return Math.round(t * (n - 1));
    }
    if (drag.mode === "start") {
      i0 = idx(ev.clientX);
      if (i0 > i1 - 1) i0 = i1 - 1;
      if (i0 < 0) i0 = 0;
    } else if (drag.mode === "end") {
      i1 = idx(ev.clientX);
      if (i1 < i0 + 1) i1 = i0 + 1;
      if (i1 > n - 1) i1 = n - 1;
    }
    ohlcApplyWindow(i0, i1, full);
  }

  function ohlcPxText(n) {
    if (n == null || !isFinite(Number(n))) return "—";
    var v = Number(n);
    return usd(v, Math.abs(v) < 10 ? 4 : 2);
  }

  function renderOhlcChart() {
    var host = document.getElementById("ohlc-chart");
    if (!host) return;
    var mount = ensurePxMount(host);
    syncOhlcRange();
    var series = ohlcBars && ohlcBars.length ? ohlcSeries() : [];
    if (!series.length) {
      ohlcChartSig = "";
      ohlcUnpin = null;
      ohlcPlotTap = null;
      ohlcPlotHover = null;
      ohlcPlotLeave = null;
      mount.body.innerHTML = "<p class='note'>" + (ohlcErr || (ohlcBusy ? "SOXL 일봉을 불러오는 중입니다." : "SOXL 일봉을 불러오는 중입니다.")) + "</p>";
      mount.layer.style.display = "none";
      return;
    }
    var allDates = series.map(function (b) { return b[0]; });
    var byDate = {};
    series.forEach(function (b) { byDate[b[0]] = b; });
    var win = ohlcWindow(allDates);
    paintOhlcDates(win.start, win.end);
    var dates = win.dates;
    var n = dates.length;
    if (!n) {
      ohlcChartSig = "";
      mount.body.innerHTML = "<p class='note'>이 기간에 기록이 없습니다.</p>";
      mount.layer.style.display = "none";
      return;
    }
    var H = 268;
    var axisW = 52;
    var padL = 10;
    var padR = 18;
    var plotT = 28;
    var plotB = H - 36;
    var viewW = chartViewWidth("ohlc-chart");
    var plotW = Math.max(220, viewW - axisW);
    var indexOf = {};
    dates.forEach(function (d, i) { indexOf[d] = i; });
    function xOf(i) {
      if (n === 1) return plotW / 2;
      return padL + (i / (n - 1)) * (plotW - padL - padR);
    }
    var minY = Infinity;
    var maxY = -Infinity;
    dates.forEach(function (d) {
      var b = byDate[d];
      if (!b) return;
      if (b[3] < minY) minY = b[3];
      if (b[2] > maxY) maxY = b[2];
    });
    if (!isFinite(minY) || !isFinite(maxY)) {
      minY = 0;
      maxY = 1;
    }
    var spanY = maxY - minY || Math.max(1, Math.abs(maxY) * 0.04);
    minY -= spanY * 0.1;
    maxY += spanY * 0.12;
    if (minY < 0) minY = 0;
    spanY = maxY - minY || 1;
    var sig = [ohlcSpan, ohlcCustomFrom, ohlcCustomTo, String(plotW), win.start, win.end, String(n), String(series.length)].join("|");
    if (sig === ohlcChartSig && host.querySelector(".px-scroll")) {
      ohlcWheel = {
        dates: allDates,
        start: win.start,
        end: win.end,
        dateAt: ohlcWheel ? ohlcWheel.dateAt : function () { return dates[0]; },
        scroller: host.querySelector(".px-scroll")
      };
      return;
    }
    ohlcChartSig = sig;
    function yOf(v) {
      return plotB - ((v - minY) / spanY) * (plotB - plotT);
    }
    var step = spanY / 4;
    var mag = Math.pow(10, Math.floor(Math.log10(step)));
    var err = step / mag;
    if (err >= 7.5) mag *= 10;
    else if (err >= 3.5) mag *= 5;
    else if (err >= 1.5) mag *= 2;
    var ticks = [];
    var tickStart = Math.ceil(minY / mag) * mag;
    for (var tv = tickStart; tv <= maxY + mag * 0.01; tv += mag) ticks.push(tv);
    var tickDigits = mag < 1 ? 2 : mag < 10 ? 1 : 0;
    var axis = [];
    axis.push("<svg class='px-axis' style='width:" + axisW + "px;height:" + H + "px' viewBox='0 0 " + axisW + " " + H + "' aria-hidden='true'>");
    var plot = [];
    plot.push("<svg class='px-plot' id='ohlc-plot' style='width:" + plotW + "px;height:" + H + "px' viewBox='0 0 " + plotW + " " + H + "' role='img' aria-label='SOXL 시가, 고가, 저가, 종가'>");
    ticks.forEach(function (v) {
      var y = yOf(v);
      if (y < plotT - 2 || y > plotB + 2) return;
      plot.push("<line x1='0' y1='" + y.toFixed(2) + "' x2='" + plotW + "' y2='" + y.toFixed(2) + "' stroke='#eef0f4' stroke-width='1'/>");
      axis.push("<text x='" + (axisW - 6) + "' y='" + y.toFixed(2) + "' text-anchor='end' dominant-baseline='middle' fill='#9ca3af' font-size='10' font-family='Pretendard, sans-serif'>$" + v.toFixed(tickDigits) + "</text>");
    });
    axis.push("</svg>");
    var candles = n <= 320;
    if (!candles) {
      var up = "";
      var down = [];
      var closeD = "";
      var pen = false;
      dates.forEach(function (d, i) {
        var b = byDate[d];
        if (!b) return;
        var x = xOf(i).toFixed(2);
        up += (i ? "L" : "M") + x + " " + yOf(b[2]).toFixed(2) + " ";
        down.push(x + " " + yOf(b[3]).toFixed(2));
        closeD += (pen ? "L" : "M") + x + " " + yOf(b[4]).toFixed(2) + " ";
        pen = true;
      });
      if (down.length) {
        plot.push("<path d='" + (up + "L" + down.reverse().join(" L") + " Z") + "' fill='rgba(17,24,39,0.08)' stroke='none'/>");
      }
      if (closeD) plot.push("<path d='" + closeD.trim() + "' fill='none' stroke='#111827' stroke-width='1.6' stroke-linejoin='round' stroke-linecap='round'/>");
    } else {
      var gap = n <= 1 ? 8 : xOf(1) - xOf(0);
      var bw = Math.max(2.2, Math.min(11, gap * 0.62));
      dates.forEach(function (d, i) {
        var b = byDate[d];
        if (!b) return;
        var open = b[1];
        var high = b[2];
        var low = b[3];
        var close = b[4];
        var x = xOf(i);
        var color = open == null || close >= open ? "#ef4444" : "#2563eb";
        plot.push("<line x1='" + x.toFixed(2) + "' y1='" + yOf(high).toFixed(2) + "' x2='" + x.toFixed(2) + "' y2='" + yOf(low).toFixed(2) + "' stroke='" + color + "' stroke-width='1.2'/>");
        if (open != null) {
          var top = yOf(Math.max(open, close));
          var bot = yOf(Math.min(open, close));
          var bh = Math.max(1.2, bot - top);
          plot.push("<rect x='" + (x - bw / 2).toFixed(2) + "' y='" + top.toFixed(2) + "' width='" + bw.toFixed(2) + "' height='" + bh.toFixed(2) + "' fill='" + color + "'/>");
        }
      });
    }
    var shown = [];
    dates.forEach(function (d, i) {
      var x = xOf(i);
      var force = i === 0 || i === n - 1;
      if (!force && shown.length && x - shown[shown.length - 1].x < 70) return;
      if (!force && plotW - padR - x < 70) return;
      if (i === n - 1 && shown.length > 1 && x - shown[shown.length - 1].x < 56) shown.pop();
      shown.push({ i: i, x: x, d: d });
    });
    var prevYear = "";
    shown.forEach(function (item) {
      var anchor = item.i === 0 ? "start" : item.i === n - 1 ? "end" : "middle";
      var year = item.d.slice(0, 4);
      var text = item.d.slice(5).replace("-", ".");
      if (item.i === 0 || year !== prevYear) text = item.d.slice(2, 4) + "." + text;
      prevYear = year;
      plot.push("<text x='" + item.x.toFixed(2) + "' y='" + (H - 16) + "' text-anchor='" + anchor + "' fill='#9ca3af' font-size='10' font-family='Pretendard, sans-serif'>" + text + "</text>");
    });
    plot.push("<line class='px-guide' x1='0' y1='" + plotT + "' x2='0' y2='" + plotB + "' stroke='#9ca3af' stroke-dasharray='3 3' stroke-width='1' visibility='hidden'/>");
    plot.push("<circle class='px-guide-dot' r='4.5' fill='#fff' stroke='#111827' stroke-width='1.6' visibility='hidden'/>");
    plot.push("</svg>");
    var html = [];
    html.push("<div class='px-chart-layout'>");
    html.push(axis.join(""));
    html.push("<div class='px-scroll' tabindex='0' aria-label='SOXL 일봉. 마우스 휠이나 두 손가락으로 기간을 늘리거나 줄일 수 있습니다.'>");
    html.push(plot.join(""));
    html.push("</div>");
    html.push("<div class='px-brush' role='slider' aria-orientation='horizontal' aria-label='보이는 기간. 끝을 끌면 늘리거나 줄이고, 가운데를 끌면 이동합니다.' aria-controls='ohlc-plot'>");
    html.push("<div class='px-brush-track'></div><div class='px-brush-win'></div></div>");
    html.push("</div>");
    html.push("<div class='px-tip' hidden></div>");
    html.push("<p class='note px-span-note'></p>");
    if (ohlcErr) html.push("<p class='note'>" + xmlEsc(ohlcErr) + "</p>");
    mount.body.innerHTML = html.join("");
    placePinchLayer(host);
    var scroller = host.querySelector(".px-scroll");
    var brush = host.querySelector(".px-brush");
    var thumb = host.querySelector(".px-brush-win");
    var note = host.querySelector(".px-span-note");
    var guide = host.querySelector(".px-guide");
    var guideDot = host.querySelector(".px-guide-dot");
    var tip = host.querySelector(".px-tip");
    if (ohlcDrag && brush) brush.classList.add("is-drag");
    var pinnedDate = ohlcPinned && indexOf[ohlcPinned] != null ? ohlcPinned : "";
    if (ohlcPinned && !pinnedDate) ohlcPinned = "";
    function hideGuide() {
      if (guide) guide.setAttribute("visibility", "hidden");
      if (guideDot) guideDot.setAttribute("visibility", "hidden");
      if (tip) {
        tip.hidden = true;
        tip.classList.remove("is-pin");
      }
    }
    ohlcUnpin = function () {
      pinnedDate = "";
      ohlcPinned = "";
      hideGuide();
    };
    function showTip(date) {
      if (!date || indexOf[date] == null) return hideGuide();
      var b = byDate[date];
      var x = xOf(indexOf[date]);
      if (guide) {
        guide.setAttribute("x1", x.toFixed(2));
        guide.setAttribute("x2", x.toFixed(2));
        guide.setAttribute("visibility", "visible");
      }
      if (guideDot && b) {
        guideDot.setAttribute("cx", x.toFixed(2));
        guideDot.setAttribute("cy", yOf(b[4]).toFixed(2));
        guideDot.setAttribute("visibility", "visible");
      }
      if (!tip || !b) return;
      var pinned = pinnedDate === date;
      tip.classList.toggle("is-pin", pinned);
      var prev = indexOf[date] > 0 ? byDate[dates[indexOf[date] - 1]] : null;
      var prevClose = prev ? prev[4] : null;
      var tone = prevClose != null ? (b[4] > prevClose ? "up" : b[4] < prevClose ? "down" : "") : "";
      var rows = ["<div class='px-tip-date'>" + xmlEsc(shortDot(date)) + (pinned ? "<span class='px-tip-pin'>고정</span>" : "") + "</div>"];
      function row(k, v, cls) {
        rows.push("<div class='px-tip-row'><span>" + xmlEsc(k) + "</span><b class='" + (cls || "") + "'>" + xmlEsc(v) + "</b></div>");
      }
      row("종가", ohlcPxText(b[4]), tone);
      if (b[1] != null) {
        row("시가", ohlcPxText(b[1]));
        row("고가", ohlcPxText(b[2]));
        row("저가", ohlcPxText(b[3]));
      }
      tip.innerHTML = rows.join("");
      tip.hidden = false;
      var hostRect = host.getBoundingClientRect();
      var plotRect = scroller.getBoundingClientRect();
      var localX = plotRect.left - hostRect.left + (x - scroller.scrollLeft);
      var tipW = tip.offsetWidth || 180;
      var left = localX + 16;
      if (left + tipW > host.clientWidth - 6) left = localX - tipW - 16;
      if (left < 4) left = 4;
      tip.style.left = left + "px";
      tip.style.top = "8px";
    }
    function dateAt(px) {
      if (n <= 1) return dates[0];
      var inner = plotW - padL - padR;
      var t = (px - padL) / inner;
      if (t < 0) t = 0;
      if (t > 1) t = 1;
      return dates[Math.round(t * (n - 1))];
    }
    ohlcPlotTap = function (clientX) {
      var rect = scroller.getBoundingClientRect();
      var date = dateAt(clientX - rect.left + scroller.scrollLeft);
      if (!date) return;
      if (pinnedDate === date) {
        pinnedDate = "";
        ohlcPinned = "";
        hideGuide();
        return;
      }
      pinnedDate = date;
      ohlcPinned = date;
      showTip(date);
    };
    ohlcPlotHover = function (clientX) {
      if (pinnedDate) return;
      var rect = scroller.getBoundingClientRect();
      showTip(dateAt(clientX - rect.left + scroller.scrollLeft));
    };
    ohlcPlotLeave = function () {
      if (pinnedDate) return showTip(pinnedDate);
      hideGuide();
    };
    function paintNote() {
      if (!note) return;
      note.textContent = dotDate(dates[0]) + " – " + dotDate(dates[n - 1]);
    }
    function placeThumb() {
      var nFull = allDates.length;
      if (!brush || !thumb) return;
      brush.classList.remove("is-fit");
      if (nFull < 2) {
        thumb.style.left = "0%";
        thumb.style.width = "100%";
        return;
      }
      var i0 = allDates.indexOf(win.start);
      var i1 = allDates.indexOf(win.end);
      if (i0 < 0) i0 = 0;
      if (i1 < 0) i1 = nFull - 1;
      var left = (i0 / (nFull - 1)) * 100;
      var width = ((i1 - i0) / (nFull - 1)) * 100;
      if (width < 3) {
        var mid = left + width / 2;
        width = 3;
        left = Math.max(0, Math.min(97, mid - 1.5));
      }
      if (left + width > 100) left = 100 - width;
      thumb.style.left = left + "%";
      thumb.style.width = width + "%";
    }
    paintNote();
    placeThumb();
    if (brush && thumb) {
      function brushHit(clientX) {
        var rect = brush.getBoundingClientRect();
        var i0 = allDates.indexOf(win.start);
        var i1 = allDates.indexOf(win.end);
        if (i0 < 0) i0 = 0;
        if (i1 < 0) i1 = Math.max(0, allDates.length - 1);
        var leftPx = allDates.length > 1 ? (i0 / (allDates.length - 1)) * rect.width : 0;
        var rightPx = allDates.length > 1 ? (i1 / (allDates.length - 1)) * rect.width : rect.width;
        var x = clientX - rect.left;
        var edge = rightPx - leftPx < 48 ? 0 : 14;
        var mode = "move";
        if (edge && Math.abs(x - leftPx) <= edge) mode = "start";
        else if (edge && Math.abs(x - rightPx) <= edge) mode = "end";
        return { i0: i0, i1: i1, mode: mode };
      }
      brush.addEventListener("pointerdown", function (ev) {
        if (allDates.length < 2) return;
        var hit = brushHit(ev.clientX);
        ohlcDrag = { mode: hit.mode, i0: hit.i0, i1: hit.i1, x: ev.clientX, dates: allDates.slice() };
        brush.classList.add("is-drag");
        try { host.setPointerCapture(ev.pointerId); } catch (err) {}
        ev.preventDefault();
      });
    }
    ohlcWheel = { dates: allDates, start: win.start, end: win.end, dateAt: dateAt, scroller: scroller };
    if (pinnedDate) showTip(pinnedDate);
  }

  function renderStats(out) {
    renderPriceChart();
    ensureOhlc();
    renderOhlcChart();
    var cap = state.settings.capital || 0;
    var rows = realizedRows();
    fillText("st-k3", (out.K3 >= 0 ? "+" : "") + money(out.K3));
    fillText("st-l3", pct(out.L3));
    fillText("st-cap", money(cap, 0));
    var k3 = document.getElementById("st-k3");
    if (k3) k3.className = "v " + (out.K3 >= 0 ? "pos" : "neg");
    var l3 = document.getElementById("st-l3");
    if (l3) l3.className = "v " + (out.L3 >= 0 ? "pos" : "neg");

    var closed = {};
    (state.updownTrades || []).forEach(function (t) {
      if (t.type === "매도" && t.holdQty === 0 && t.cycle) closed[t.cycle] = true;
    });
    var cycleIds = Object.keys(closed);
    fillText("st-cycles", cycleIds.length);
    fillText("st-count", rows.length);

    var daySum = 0;
    cycleIds.forEach(function (c) {
      var dates = (state.updownTrades || [])
        .filter(function (t) {
          return String(t.cycle) === String(c) && t.date;
        })
        .map(function (t) {
          return t.date;
        })
        .sort();
      if (dates.length) {
        daySum += Math.max(1, Math.round((Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / 86400000) + 1);
      }
    });
    fillText("st-days", cycleIds.length ? (daySum / cycleIds.length).toFixed(1) + "일" : "—");

    var years = {};
    rows.forEach(function (r) {
      years[r.date.slice(0, 4)] = true;
    });
    var yearList = Object.keys(years).sort();
    if (yearList.indexOf(String(statsYear)) < 0 && yearList.length) statsYear = parseInt(yearList[yearList.length - 1], 10);
    if (!yearList.length) yearList = [String(statsYear)];
    document.querySelectorAll("#st-mode button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.mode === statsMode);
    });
    document.getElementById("st-years").innerHTML = yearList
      .map(function (y) {
        return (
          "<button type='button' data-year='" +
          y +
          "'" +
          (Number(y) === statsYear ? " class='active'" : "") +
          ">" +
          y +
          "년</button>"
        );
      })
      .join("");
    document.getElementById("st-years").style.display = statsMode === "month" ? "" : "none";

    var items = [];
    var periodPnl = 0;
    var periodLabel = "";
    if (statsMode === "month") {
      periodLabel = statsYear + "년 월별";
      for (var m = 1; m <= 12; m++) {
        var key = statsYear + "-" + (m < 10 ? "0" : "") + m;
        var v = 0;
        rows.forEach(function (r) {
          if (r.date.slice(0, 7) === key) v += r.pnl;
        });
        periodPnl += v;
        items.push({ label: String(m), pnl: v });
      }
    } else {
      periodLabel = "연간";
      yearList.forEach(function (y) {
        var v = 0;
        rows.forEach(function (r) {
          if (r.date.slice(0, 4) === y) v += r.pnl;
        });
        periodPnl += v;
        items.push({ label: y, pnl: v });
      });
    }

    fillText("st-period-label", periodLabel + " 실현손익");
    var pp = document.getElementById("st-period-pnl");
    var tone = periodPnl > 0 ? "gain" : periodPnl < 0 ? "loss" : "";
    if (pp) {
      pp.textContent = (periodPnl >= 0 ? "+" : "") + money(periodPnl);
      pp.className = "hero-quote " + tone;
    }
    var retEl = document.getElementById("st-period-ret");
    if (retEl) {
      retEl.textContent = "수익률 " + pct(cap ? periodPnl / cap : 0);
      retEl.className = "k " + tone;
    }

    var max = 1;
    items.forEach(function (it) {
      if (Math.abs(it.pnl) > max) max = Math.abs(it.pnl);
    });
    document.getElementById("st-chart").innerHTML = items
      .map(function (it) {
        var h = Math.max(2, Math.round((Math.abs(it.pnl) / max) * 96));
        var cls = it.pnl > 0 ? "pos" : it.pnl < 0 ? "neg" : "zero";
        return (
          "<div class='bar-col'><div class='bar-track'><div class='bar-fill " +
          cls +
          "' style='height:" +
          h +
          "px'></div></div><span>" +
          it.label +
          "</span></div>"
        );
      })
      .join("");

    document.getElementById("st-table").innerHTML = items
      .map(function (it) {
        var ret = cap ? it.pnl / cap : 0;
        var cls = it.pnl > 0 ? "gain" : it.pnl < 0 ? "loss" : "empty";
        return (
          "<tr><td>" +
          (statsMode === "month" ? statsYear + "-" + (it.label.length < 2 ? "0" : "") + it.label : it.label) +
          "</td><td class='" +
          cls +
          "'>" +
          (it.pnl ? (it.pnl >= 0 ? "+" : "") + money(it.pnl) : "—") +
          "</td><td class='" +
          cls +
          "'>" +
          (it.pnl ? pct(ret) : "—") +
          "</td></tr>"
        );
      })
      .join("");
  }

  function fillText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function ladderPrice(price) {
    if (price === "" || price == null) return "없음";
    if (typeof price === "string") return price;
    return money(price);
  }

  function ladderRow(label, labelClass, price, priceClass, add, cum, drop) {
    var dropText = drop === "" || drop == null || Number.isNaN(drop) ? "" : pct(drop);
    return (
      "<tr class='ladder-" +
      (labelClass === "sell" ? "sell" : label === "매수" ? "buy" : "step") +
      "'><td class='" +
      labelClass +
      "'>" +
      label +
      "</td><td class='" +
      priceClass +
      "'>" +
      ladderPrice(price) +
      "</td><td>" +
      (add === "" || add == null ? "" : add) +
      "</td><td>" +
      (cum === "" || cum == null ? "" : cum) +
      "</td><td>" +
      dropText +
      "</td></tr>"
    );
  }

  function closeOn(date) {
    if (!date || !state) return NaN;
    var db = state.closeDb || [];
    var i;
    for (i = 0; i < db.length; i++) {
      if (db[i] && db[i].date === date && Number(db[i].close) > 0) return Number(db[i].close);
    }
    var m = state.market || {};
    var hist = m.closeHistory || [];
    for (i = 0; i < hist.length; i++) {
      if (hist[i] && hist[i].date === date && Number(hist[i].close) > 0) return Number(hist[i].close);
    }
    if (m.closeDate === date && Number(m.lastClose) > 0) return Number(m.lastClose);
    if (SOXL_CLOSE_SEED[date] > 0) return SOXL_CLOSE_SEED[date];
    return NaN;
  }

  function histLadderNow() {
    var s = (state && state.settings) || {};
    var id = state && state.accountId;
    if (!histLadder || histLadder.accountId !== id) {
      histLadder = {
        accountId: id,
        udLadderCount: Number(s.udLadderCount) || 0,
        udStepQty: Number(s.udStepQty) || 0,
        tteolLadderCount: Number(s.tteolLadderCount) || 0,
        tteolStepQty: Number(s.tteolStepQty) || 0,
      };
    }
    return histLadder;
  }

  function bookOrdersOn(date) {
    if (!date || !state) return null;
    var basis = E.previousTradingDate(date);
    var px = closeOn(basis);
    if (!(px > 0)) return null;
    var prevPx = closeOn(E.previousTradingDate(basis));
    var virt = E.clone(state);
    virt.updownTrades = (virt.updownTrades || []).filter(function (t) {
      return t.date && t.date <= basis;
    });
    virt.tteolTrades = (virt.tteolTrades || []).filter(function (t) {
      return t.date && t.date <= basis;
    });
    var h = histLadderNow();
    virt.settings.udLadderCount = h.udLadderCount;
    virt.settings.udStepQty = h.udStepQty;
    virt.settings.tteolLadderCount = h.tteolLadderCount;
    virt.settings.tteolStepQty = h.tteolStepQty;
    virt.market = Object.assign({}, virt.market, {
      lastClose: px,
      prevClose: prevPx > 0 ? prevPx : px,
      closeDate: basis,
      tradeDate: basis,
      price: px,
      changePct: prevPx > 0 ? px / prevPx - 1 : 0,
      phase: "POST_MKT",
    });
    var out = E.compute(virt, { skipSuggest: true });
    out.histAsOf = basis;
    out.histSession = date;
    var fillPx = closeOn(date);
    if (fillPx > 0) {
      var fillState = E.clone(virt);
      fillState.market = Object.assign({}, virt.market, {
        lastClose: fillPx,
        prevClose: px,
        closeDate: date,
        tradeDate: date,
        price: fillPx,
        changePct: px > 0 ? fillPx / px - 1 : 0,
        phase: "POST_MKT",
      });
      var filled = E.compute(fillState, { fillAsOf: date });
      out.histFillUd = filled.suggestedUd || { type: "" };
      out.histFillTt = filled.suggestedTt || { type: "" };
      out.histFillPx = fillPx;
    }
    return out;
  }

  function histFillLine(title, sug) {
    if (!sug || !sug.type) {
      return "<div class='muted'>" + title + " 체결 없음" + (sug && sug.reason ? " · " + sug.reason : "") + "</div>";
    }
    var who = sug.pot != null ? "포트 " + sug.pot : "랭크 " + sug.rank;
    return (
      "<div class='" +
      (sug.type === "매도" ? "sell" : "buy") +
      "'>" +
      title +
      " " +
      sug.type +
      " " +
      money(sug.price) +
      " × " +
      sug.qty +
      "주 · " +
      who +
      "</div>"
    );
  }

  function renderOrderHist() {
    var wrap = document.getElementById("order-hist-wrap");
    if (!wrap || wrap.classList.contains("hidden")) return;
    var input = document.getElementById("order-hist-date");
    var date = orderHistDate || (state.market && state.market.closeDate) || "";
    if (input && input.value !== date) input.value = date;
    var lpEl = document.getElementById("order-hist-lp");
    var h = histLadderNow();
    fillText("hist-ud-orders", h.udLadderCount);
    fillText("hist-ud-step", h.udStepQty);
    fillText("hist-tt-orders", h.tteolLadderCount);
    fillText("hist-tt-step", h.tteolStepQty);
    var out = bookOrdersOn(date);
    if (!out) {
      if (lpEl) lpEl.textContent = "종가 없음";
      var fillMiss = document.getElementById("order-hist-fill");
      if (fillMiss) fillMiss.innerHTML = "";
      var empty = "<tr><td colspan='5'>종가 없음</td></tr>";
      var udEmpty = document.getElementById("hist-ud-ladder");
      var ttEmpty = document.getElementById("hist-tt-ladder");
      if (udEmpty) udEmpty.innerHTML = empty;
      if (ttEmpty) ttEmpty.innerHTML = empty;
      return;
    }
    if (lpEl) lpEl.textContent = "LP " + money(out.D19) + (out.histAsOf ? " · " + out.histAsOf : "");
    var fillEl = document.getElementById("order-hist-fill");
    if (fillEl) {
      fillEl.innerHTML = out.histFillPx
        ? histFillLine("업다운", out.histFillUd) + histFillLine("떨", out.histFillTt)
        : "<div class='muted'>그날 종가 없음</div>";
    }
    renderLadder("hist-ud-ladder", out.udLadder, "ud", out);
    renderLadder("hist-tt-ladder", out.ttLadder, "tt", out);
  }

  function renderLadder(id, rows, kind, out) {
    var tb = document.getElementById(id);
    var html = "";
    if (kind === "ud") {
      html += ladderRow("매수", "buy", out.C19, "buy", out.B19, out.B19, 0);
    } else {
      html += ladderRow("매수", "buy", out.I19, out.I19 === "" ? "empty" : "buy", out.H19, out.H19, out.I19 === "" ? "" : 0);
    }
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      html += ladderRow(i + 1, "", r.price, "buy", r.qty, r.cumQty, r.drop);
    }
    if (!rows.length) html += "<tr><td colspan='5'>정액 주문 0 · 추가 계단 없음</td></tr>";
    if (kind === "ud") {
      html += ladderRow("매도", "sell", out.F19, out.F19 === "" ? "empty" : "sell", out.E19, "", "");
    } else if (!out.openRanks.length) {
      html += ladderRow("매도", "sell", "", "empty", "", "", "");
    } else {
      out.openRanks.forEach(function (r) {
        html += ladderRow("매도 #" + r.rank, "sell", r.sellPrice, "sell", r.qty, "", "");
      });
    }
    tb.innerHTML = html;
  }

  function renderSuggested(out) {
    var ud = out.suggestedUd || {};
    var tt = out.suggestedTt || {};
    var date = state.market.closeDate;
    document.getElementById("btn-fill-ud").disabled = !sessionFillReady(ud, date);
    document.getElementById("btn-fill-tt").disabled = !sessionFillReady(tt, date);
    document.getElementById("sug-ud").innerHTML = sugHtml("업다운", ud, ud.date || date, "ud");
    document.getElementById("sug-tt").innerHTML = sugHtml("떨사오팔", tt, tt.date || date, "tt");
    var canMove = out.C54 !== "" && out.C54 != null;
    document.getElementById("v-C54").textContent = canMove ? "랭크 " + out.C54 : "";
    document.getElementById("v-B54").textContent = canMove ? state.market.closeDate : "";
    document.getElementById("btn-transfer").disabled = !canMove;
  }

  function sugDateSpan(side, date) {
    if (!date) return "";
    return "<span class='sug-date' data-sug='" + side + "'>" + date + "</span>";
  }

  function sugHtml(title, sug, date, side) {
    var when = sugDateSpan(side, date);
    if (!sug.type) {
      return "<div class='note'>" + when + (when ? " " : "") + title + " 제안 없음. " + (sug.reason || "") + "</div>";
    }
    var who = sug.pot != null ? "포트 " + sug.pot : "랭크 " + sug.rank;
    return (
      "<div class='loc-data'>" +
      "<div class='loc-data-top'><strong>" +
      sug.type +
      "</strong>" +
      when +
      "</div>" +
      "<div class='loc-data-amt " +
      (sug.type === "매도" ? "neg" : "pos") +
      "'>" +
      money(sug.price) +
      " × " +
      sug.qty +
      "주</div>" +
      "<div class='loc-data-meta'>" +
      who +
      " · " +
      money(sug.amount) +
      " · 수수료 " +
      money(sug.fee) +
      "</div></div>"
    );
  }

  function renderRanks(out) {
    var ranks = (out.openRanks || []).slice().sort(function (a, b) {
      return (a.rank || 0) - (b.rank || 0);
    });
    var html = ranks
      .map(function (r) {
        return (
          "<tr><td>" +
          r.rank +
          "</td><td>" +
          (r.buyDate || "") +
          "</td><td>" +
          (r.holdDays || "") +
          "</td><td>" +
          money(r.price) +
          "</td><td>" +
          r.qty +
          "</td><td class='sell'>" +
          money(r.sellPrice) +
          "</td></tr>"
        );
      })
      .join("");
    if (!html) html = "<tr><td colspan='6' class='empty'>보유 랭크 없음</td></tr>";
    document.getElementById("rank-body").innerHTML = html;
    var n = ranks.length;
    var btn = document.getElementById("btn-rank-table");
    var open = btn.getAttribute("aria-expanded") === "true";
    document.getElementById("rank-toggle-label").textContent = open
      ? "랭크 표 접기 · " + n
      : "랭크 표 열기 · " + n;
    btn.querySelector(".rank-arrow").textContent = open ? "▲" : "▼";
  }

  function logTypeClass(type) {
    if (type === "매도") return "sell";
    if (type === "떨") return "tteol";
    return "";
  }

  function logSep() {
    return "<span class='log-dot'>·</span>";
  }

  function logLine(dateText, restParts, delAttr, idx, side, latest) {
    var d = logEdit(side, idx, "date", dateText, "date");
    return (
      "<article class='log-row" + (latest ? " log-latest" : "") + "'><div class='log-main'>" +
      "<div class='log-date'>" +
      d +
      "</div><div class='log-line'>" +
      "<span class='log-date-inline'>" +
      d +
      "</span><span class='log-date-inline log-dot'>·</span>" +
      restParts.join(logSep()) +
      "</div></div><button class='btn ghost log-del' " +
      delAttr +
      "='" +
      idx +
      "'>삭제</button></article>"
    );
  }

  function logEdit(side, idx, key, shown, kind) {
    return (
      "<span class='log-edit' data-side='" +
      side +
      "' data-i='" +
      idx +
      "' data-k='" +
      key +
      "' data-kind='" +
      (kind || "num") +
      "'>" +
      shown +
      "</span>"
    );
  }

  function parseEditValue(kind, raw, key) {
    var s = String(raw == null ? "" : raw).trim();
    if (kind === "date") {
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      return null;
    }
    if (kind === "type") {
      if (s === "매수" || s === "매도" || s === "떨" || s === "이관") return s;
      return null;
    }
    s = s.replace(/[$,주원%]/g, "").replace(/,/g, "").trim();
    if (key === "pnl" && (!s || s === "—" || s === "-")) return "";
    var n = parseFloat(s);
    if (!isFinite(n)) return null;
    if (key === "qty" || key === "holdQty" || key === "pot" || key === "rank") return Math.round(n);
    return n;
  }

  function applyLogEdit(side, idx, key, raw) {
    var kind = key === "date" ? "date" : key === "type" ? "type" : "num";
    var val = parseEditValue(kind, raw, key);
    if (val == null) {
      toast("값을 확인하세요");
      render();
      return;
    }
    if (side === "esc") {
      var esc = loadEscape();
      if (!esc || !esc.trades || !esc.trades[idx]) return;
      pushLastSnap();
      var et = esc.trades[idx];
      if (key === "price") {
        et.price = val;
        et.amount = (Number(et.price) || 0) * (Number(et.qty) || 0);
        et.fee = down2(et.amount * (Number(esc.fee) || 0));
      } else if (key === "qty") {
        et.qty = val;
        et.amount = (Number(et.price) || 0) * val;
        et.fee = down2(et.amount * (Number(esc.fee) || 0));
      } else if (key === "holdQty") {
        et.holdQty = val;
        if (et.avg) et.cost = Number(et.avg) * val;
      } else if (key === "avg") {
        et.avg = val;
        if (et.holdQty) et.cost = val * Number(et.holdQty);
      } else {
        et[key] = val;
      }
      saveEscape(esc, { noUndo: true });
      render();
      toast("일지 수정");
      return;
    }
    var list = side === "tt" ? state.tteolTrades : state.updownTrades;
    var t = list && list[idx];
    if (!t) return;
    pushLastSnap();
    if (key === "price") {
      t.price = val;
      t.amount = (Number(t.price) || 0) * (Number(t.qty) || 0);
      if (state.settings && state.settings.fee) t.fee = E.excelRoundDown(t.amount * state.settings.fee, 2);
    } else if (key === "qty") {
      t.qty = val;
      t.amount = (Number(t.price) || 0) * val;
      if (state.settings && state.settings.fee) t.fee = E.excelRoundDown(t.amount * state.settings.fee, 2);
    } else if (key === "holdQty") {
      t.holdQty = val;
      if (t.avg) t.cost = Number(t.avg) * val;
    } else if (key === "avg") {
      t.avg = val;
      if (t.holdQty) t.cost = val * Number(t.holdQty);
    } else {
      t[key] = val;
    }
    if (key !== "pnl" && key !== "pot" && key !== "holdQty") {
      E.recomputeFromEdit(list, t, side === "tt" ? "tt" : "ud", (state.settings && state.settings.fee) || 0, key);
    }
    persist({ noUndo: true });
    toast("일지 수정");
  }

  function finishLogInput(input, save) {
    if (!input || input.getAttribute("data-done") === "1") return;
    input.setAttribute("data-done", "1");
    var side = input.getAttribute("data-side");
    var idx = parseInt(input.getAttribute("data-i"), 10);
    var key = input.getAttribute("data-k");
    var raw = input.value;
    if (save) applyLogEdit(side, idx, key, raw);
    else render();
  }

  function startLogEdit(span) {
    if (!span || !span.classList || !span.classList.contains("log-edit")) return;
    if (span.querySelector("input,select")) return;
    var kind = span.getAttribute("data-kind") || "num";
    var key = span.getAttribute("data-k");
    var side = span.getAttribute("data-side");
    var idx = span.getAttribute("data-i");
    var cur = span.textContent.trim();
    var el;
    if (kind === "type") {
      el = document.createElement("select");
      var opts = side === "esc" ? ["이관", "매수", "매도"] : side === "tt" ? ["매수", "매도"] : ["매수", "매도", "떨"];
      opts.forEach(function (o) {
        var op = document.createElement("option");
        op.value = o;
        op.textContent = o;
        el.appendChild(op);
      });
      var now = cur.replace(/[·\s]/g, "");
      el.value = opts.indexOf(now) >= 0 ? now : opts[0];
    } else {
      el = document.createElement("input");
      el.type = kind === "date" ? "date" : "text";
      el.inputMode = kind === "date" ? "text" : "decimal";
      el.value = kind === "date" ? cur : cur.replace(/[$,주—]/g, "").trim();
    }
    el.className = "log-edit-in";
    el.setAttribute("data-side", side);
    el.setAttribute("data-i", idx);
    el.setAttribute("data-k", key);
    span.textContent = "";
    span.appendChild(el);
    el.focus();
    if (el.select) el.select();
    el.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        finishLogInput(el, true);
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        finishLogInput(el, false);
      }
    });
    el.addEventListener("change", function () {
      if (kind === "type") finishLogInput(el, true);
    });
    el.addEventListener("blur", function () {
      setTimeout(function () {
        if (document.activeElement !== el) finishLogInput(el, true);
      }, 0);
    });
  }

  var lastLogTap = { t: 0, el: null };
  function startSugDateEdit(span) {
    if (!span || span.querySelector("input")) return;
    var cur = span.textContent.trim();
    var input = document.createElement("input");
    input.type = "date";
    input.className = "log-edit-in";
    input.value = /^\d{4}-\d{2}-\d{2}$/.test(cur) ? cur : state.market.closeDate || "";
    span.textContent = "";
    span.appendChild(input);
    input.focus();
    function done(save) {
      if (input.getAttribute("data-done") === "1") return;
      input.setAttribute("data-done", "1");
      if (save) fillAsOf = input.value || "";
      render();
    }
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        done(true);
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        done(false);
      }
    });
    input.addEventListener("change", function () {
      done(true);
    });
    input.addEventListener("blur", function () {
      setTimeout(function () {
        if (document.activeElement !== input) done(true);
      }, 0);
    });
  }

  function onSugDateEvent(ev) {
    var span = ev.target.closest ? ev.target.closest(".sug-date") : null;
    if (!span) return;
    if (ev.type === "dblclick") {
      ev.preventDefault();
      startSugDateEdit(span);
    }
  }

  function onJournalLogEvent(ev) {
    if (ev.target.closest && ev.target.closest(".log-del")) return;
    var span = ev.target.closest ? ev.target.closest(".log-edit") : null;
    if (!span) return;
    if (ev.type === "dblclick") {
      ev.preventDefault();
      startLogEdit(span);
      return;
    }
    if (ev.type === "touchend") {
      var now = Date.now();
      if (lastLogTap.el === span && now - lastLogTap.t < 420) {
        ev.preventDefault();
        startLogEdit(span);
        lastLogTap = { t: 0, el: null };
      } else {
        lastLogTap = { t: now, el: span };
      }
    }
  }

  function latestJournalDate() {
    var best = "";
    function scan(list) {
      (list || []).forEach(function (t) {
        if (t && t.date && t.date > best) best = t.date;
      });
    }
    scan(state.updownTrades);
    scan(state.tteolTrades);
    return best;
  }

  function renderUdLog() {
    if (isEscapeView()) {
      var esc = loadEscape();
      var rows = (esc && esc.trades) || [];
      var htmlEsc = rows
        .slice()
        .reverse()
        .map(function (t, revIdx) {
          var idx = rows.length - 1 - revIdx;
          var avg = t.avg == null || t.avg === "" ? "—" : usd(t.avg);
          var hold = t.holdQty == null || t.holdQty === "" ? "—" : t.holdQty;
          return logLine(
            t.date,
            [
              logEdit("esc", idx, "type", "<span class='pill " + logTypeClass(t.type) + "'>" + t.type + "</span>", "type"),
              logEdit("esc", idx, "pot", String(t.pot), "num"),
              logEdit("esc", idx, t.type === "이관" ? "avg" : "price", usd(t.type === "이관" ? t.avg : t.price), "num"),
              logEdit("esc", idx, "qty", t.qty + "주", "num"),
              "<span>보유 " + logEdit("esc", idx, "holdQty", String(hold), "num") + "</span>",
              logEdit("esc", idx, "avg", avg, "num"),
            ],
            "data-ud",
            idx,
            "esc",
            revIdx === 0
          );
        })
        .join("");
      document.getElementById("ud-log").innerHTML =
        htmlEsc || "<div class='log-row'><div class='log-line'><span class='empty'>기록 없음</span></div></div>";
      return;
    }
    var html = state.updownTrades
      .map(function (t, idx) {
        var avg = t.avg == null || t.avg === "" ? "—" : usd(t.avg);
        var hold = t.holdQty == null || t.holdQty === "" ? "—" : t.holdQty;
        return logLine(
          t.date,
          [
            logEdit("ud", idx, "type", "<span class='pill " + logTypeClass(t.type) + "'>" + t.type + "</span>", "type"),
            logEdit("ud", idx, "pot", String(t.pot), "num"),
            logEdit("ud", idx, "price", usd(t.price), "num"),
            logEdit("ud", idx, "qty", t.qty + "주", "num"),
            "<span>보유 " + logEdit("ud", idx, "holdQty", String(hold), "num") + "</span>",
            logEdit("ud", idx, "avg", avg, "num"),
            logEdit("ud", idx, "pnl", logPnl(t.pnl), "pnl"),
          ],
          "data-ud",
          idx,
          "ud",
          idx === 0 && t.date === latestJournalDate()
        );
      })
      .join("");
    document.getElementById("ud-log").innerHTML =
      html || "<div class='log-row'><div class='log-line'><span class='empty'>기록 없음</span></div></div>";
  }

  function tteolHoldStats(trades) {
    var items = (trades || []).map(function (t, idx) {
      return { t: t, idx: idx };
    });
    items.sort(function (a, b) {
      if (a.t.date !== b.t.date) return a.t.date < b.t.date ? -1 : 1;
      var ds = (a.t.seq || 0) - (b.t.seq || 0);
      if (ds) return ds;
      return b.idx - a.idx;
    });
    var byRank = {};
    var lastAvg = 0;
    var stats = new Array(items.length);
    items.forEach(function (item) {
      var t = item.t;
      if (t.type === "매수") {
        byRank[t.rank] = { price: Number(t.price) || 0, qty: Number(t.qty) || 0 };
      } else if (t.type === "매도") {
        delete byRank[t.rank];
      }
      var hold = 0;
      var cost = 0;
      Object.keys(byRank).forEach(function (k) {
        var r = byRank[k];
        hold += r.qty;
        cost += r.price * r.qty;
      });
      var avg = hold ? cost / hold : lastAvg;
      if (hold) lastAvg = avg;
      stats[item.idx] = { holdQty: hold, avg: avg };
    });
    return stats;
  }

  function renderTtLog() {
    if (isEscapeView()) {
      document.getElementById("tt-log").innerHTML =
        "<div class='log-row'><div class='log-line'><span class='empty'>탈출 업다운 · 떨 없음</span></div></div>";
      return;
    }
    var stats = tteolHoldStats(state.tteolTrades);
    var html = state.tteolTrades
      .map(function (t, idx) {
        var st = stats[idx] || {};
        var avg = st.avg == null || st.avg === "" ? "—" : usd(st.avg);
        var hold = st.holdQty == null || st.holdQty === "" ? "—" : st.holdQty;
        return logLine(
          t.date,
          [
            logEdit("tt", idx, "type", "<span class='pill " + logTypeClass(t.type) + "'>" + t.type + "</span>", "type"),
            logEdit("tt", idx, "rank", String(t.rank), "num"),
            logEdit("tt", idx, "price", usd(t.price), "num"),
            logEdit("tt", idx, "qty", t.qty + "주", "num"),
            "<span>보유 " + hold + "</span>",
            "<span>" + avg + "</span>",
            logEdit("tt", idx, "pnl", logPnl(t.pnl), "pnl"),
          ],
          "data-tt",
          idx,
          "tt",
          idx === 0 && t.date === latestJournalDate()
        );
      })
      .join("");
    document.getElementById("tt-log").innerHTML =
      html || "<div class='log-row'><div class='log-line'><span class='empty'>기록 없음</span></div></div>";
  }

  function matchedPreset(s) {
    var names = ["min", "simple", "compoundNew", "compoundOld"];
    for (var i = 0; i < names.length; i++) {
      var p = E.applyPreset(E.defaultSettings(), names[i]);
      if (
        near(s.seedSplit, p.seedSplit) &&
        near(s.rankSplit, p.rankSplit) &&
        near(s.splitIncrease, p.splitIncrease) &&
        near(s.reinvest, p.reinvest) &&
        !!s.seedSplitFixed === !!p.seedSplitFixed
      ) {
        return names[i];
      }
    }
    return "";
  }

  function markPresetButtons() {
    var name = matchedPreset(state.settings);
    document.querySelectorAll("[data-preset]").forEach(function (el) {
      el.classList.toggle("primary", el.getAttribute("data-preset") === name);
    });
  }

  function applyBarSlotsFromForm() {
    var barLeft = document.getElementById("set-bar-left").value;
    var barRight = document.getElementById("set-bar-right").value;
    var nextLeft = BAR_SLOTS[barLeft] ? barLeft : "acc1";
    var nextRight = BAR_SLOTS[barRight] ? barRight : "acc2";
    if (state.barLeft !== nextLeft || state.barRight !== nextRight) state.barRev = Date.now();
    state.barLeft = nextLeft;
    state.barRight = nextRight;
    var leftOffEl = document.getElementById("set-bar-left-off");
    var rightOffEl = document.getElementById("set-bar-right-off");
    var leftOff = !!(leftOffEl && leftOffEl.checked);
    var rightOff = !!(rightOffEl && rightOffEl.checked);
    if (!!state.barLeftOff !== leftOff || !!state.barRightOff !== rightOff) state.barRev = Date.now();
    state.barLeftOff = leftOff;
    state.barRightOff = rightOff;
    var autoEl = document.getElementById("set-auto-fill");
    var autoFill = !!(autoEl && autoEl.checked);
    var turnedOn = autoFill && !state.autoFill;
    if (!!state.autoFill !== autoFill) {
      state.barRev = Date.now();
      state.autoFillAt = Date.now();
    }
    state.autoFill = autoFill;
    if (autoFill) fillAsOf = "";
    scheduleAutoFill();
    if (turnedOn) maybeCatchUpAutoFill();
  }

  function readSettingsFromForm() {
    applyBarSlotsFromForm();
    if (isEscapeView()) {
      var esc = loadEscape();
      if (esc) {
        esc.fee = parseFloat(document.getElementById("set-fee").value) || 0;
        esc.symbol = document.getElementById("set-symbol").value.trim() || "SOXL";
        esc.split = parseFloat(document.getElementById("set-seed").value) || esc.split;
        esc.steps = parseInt(document.getElementById("set-ud-steps").value, 10) || 0;
        esc.stepq = parseInt(document.getElementById("set-ud-qty").value, 10) || 0;
        saveEscape(esc, { noUndo: true });
      }
      if (state.barLeft !== "escape" && state.barRight !== "escape") {
        selectAccount(state.accountId === "2" ? "2" : "1");
        return;
      }
      persist({ noUndo: true });
      return;
    }
    var s = state.settings;
    var prev = JSON.parse(JSON.stringify(s));
    s.symbol = document.getElementById("set-symbol").value.trim() || "SOXL";
    s.capital = parseFloat(document.getElementById("set-capital").value) || 0;
    s.fee = parseFloat(document.getElementById("set-fee").value) || 0;
    s.seedSplit = parseFloat(document.getElementById("set-seed").value) || 0;
    s.rankSplit = parseFloat(document.getElementById("set-rank").value) || 0;
    s.splitIncrease = (parseFloat(document.getElementById("set-inc").value) || 0) / 100;
    s.rankHoldDays = parseFloat(document.getElementById("set-hold").value) || 0;
    s.reinvest = (parseFloat(document.getElementById("set-reinvest").value) || 0) / 100;
    s.seedSplitFixed = document.getElementById("set-fixed").checked;
    s.buyBlocked = document.getElementById("set-blocked").checked;
    s.applySheetF8Limit = document.getElementById("set-f8").checked;
    var j16El = document.getElementById("set-j16");
    if (j16El) s.j16Mode = j16El.value === "loan" ? "loan" : "cap";
    s.autoTransfer = document.getElementById("set-auto").checked;
    s.udLadderCount = parseInt(document.getElementById("set-ud-steps").value, 10) || 0;
    s.tteolLadderCount = parseInt(document.getElementById("set-tt-steps").value, 10) || 0;
    s.udStepQty = parseInt(document.getElementById("set-ud-qty").value, 10) || 0;
    s.tteolStepQty = parseInt(document.getElementById("set-tt-qty").value, 10) || 0;
    if (!s.fieldRev || typeof s.fieldRev !== "object") s.fieldRev = {};
    var stamped = Date.now();
    Object.keys(s).forEach(function (k) {
      if (k === "fieldRev") return;
      if (JSON.stringify(prev[k]) !== JSON.stringify(s[k])) s.fieldRev[k] = stamped;
    });
    state.settingsRev = Date.now();
    persist();
  }

  function maybeAutoTransfer() {
    if (isEscapeView()) return;
    if (!state.settings.autoTransfer) return;
    var guard = 0;
    while (guard < 20) {
      var out = E.compute(state);
      if (out.C54 === "" || out.C54 == null) break;
      var r = E.transferOneRank(state);
      if (!r.ok) break;
      guard += 1;
    }
  }

  function bind() {
    document.getElementById("btn-undo").onclick = function () {
      undoLast();
    };
    document.addEventListener("keydown", function (ev) {
      var z = ev.key === "z" || ev.key === "Z";
      if (!(z && (ev.ctrlKey || ev.metaKey)) || ev.altKey || ev.shiftKey) return;
      var tag = (ev.target && ev.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (ev.target && ev.target.isContentEditable)) return;
      ev.preventDefault();
      undoLast();
    });
    document.querySelectorAll(".nav-item").forEach(function (b) {
      b.onclick = function () {
        setTab(b.dataset.tab);
      };
    });
    document.getElementById("btn-closedb").onclick = function () {
      setTab("closes");
    };
    document.getElementById("btn-closedb").onkeydown = function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        setTab("closes");
      }
    };
    document.getElementById("btn-closedb-home").onclick = function () {
      setTab("home");
    };
    document.querySelectorAll("#st-mode button").forEach(function (b) {
      b.onclick = function () {
        statsMode = b.dataset.mode;
        document.querySelectorAll("#st-mode button").forEach(function (x) {
          x.classList.toggle("active", x === b);
        });
        render();
      };
    });
    document.getElementById("st-years").onclick = function (ev) {
      var y = ev.target.getAttribute("data-year");
      if (!y) return;
      statsYear = parseInt(y, 10);
      render();
    };
    document.querySelectorAll("#px-range > button").forEach(function (b) {
      b.onclick = function () {
        pxSpan = b.dataset.span || "all";
        pxStickRight = true;
        closePxCal();
        renderPriceChart();
      };
    });
    var pxLegend = document.querySelector(".px-legend");
    if (pxLegend) {
      pxLegend.onclick = function (ev) {
        var node = ev.target;
        var series = "";
        while (node && node !== pxLegend) {
          if (node.getAttribute && node.getAttribute("data-series")) {
            series = node.getAttribute("data-series");
            break;
          }
          node = node.parentNode;
        }
        if (series === "cycle") pxCycleOn = !pxCycleOn;
        else if (series === "close" || series === "avg") pxFocus = pxFocus === series ? "" : series;
        else return;
        renderPriceChart();
      };
    }
    var pxFrom = document.getElementById("px-from");
    var pxTo = document.getElementById("px-to");
    function togglePxCal(which, btn) {
      var cal = document.getElementById("px-cal");
      if (pxCalTarget === which && cal && !cal.hidden) closePxCal();
      else openPxCal(which, btn);
    }
    if (pxFrom) {
      pxFrom.onclick = function (ev) {
        ev.stopPropagation();
        togglePxCal("from", pxFrom);
      };
    }
    if (pxTo) {
      pxTo.onclick = function (ev) {
        ev.stopPropagation();
        togglePxCal("to", pxTo);
      };
    }
    var pxCalPrev = document.getElementById("px-cal-prev");
    var pxCalNext = document.getElementById("px-cal-next");
    if (pxCalPrev) pxCalPrev.onclick = function (ev) { ev.stopPropagation(); shiftPxCal(-1); };
    if (pxCalNext) pxCalNext.onclick = function (ev) { ev.stopPropagation(); shiftPxCal(1); };
    var pxCalGrid = document.getElementById("px-cal-grid");
    if (pxCalGrid) {
      pxCalGrid.onclick = function (ev) {
        ev.stopPropagation();
        var iso = ev.target.getAttribute("data-date");
        if (!iso) return;
        var from = pxCalTarget === "from" ? iso : pxCustomFrom || pxViewFrom;
        var to = pxCalTarget === "to" ? iso : pxCustomTo || pxViewTo;
        if (!from) from = iso;
        if (!to) to = iso;
        if (from > to) {
          var swap = from;
          from = to;
          to = swap;
        }
        pxCustomFrom = from;
        pxCustomTo = to;
        pxSpan = "custom";
        pxStickRight = true;
        closePxCal();
        renderPriceChart();
      };
    }
    var pxChartHost = document.getElementById("st-px-chart");
    if (pxChartHost) {
      pxChartHost.addEventListener("wheel", zoomPxByWheel, { passive: false });
      pxChartHost.addEventListener("touchstart", onPxTouchStart, { passive: false, capture: true });
      pxChartHost.addEventListener("touchmove", onPxTouchMove, { passive: false, capture: true });
      pxChartHost.addEventListener("touchend", onPxTouchEnd, { passive: false, capture: true });
      pxChartHost.addEventListener("touchcancel", onPxTouchEnd, { passive: false, capture: true });
      pxChartHost.addEventListener("gesturestart", onPxGesture, { passive: false });
      pxChartHost.addEventListener("gesturechange", onPxGesture, { passive: false });
      var plotPress = null;
      pxChartHost.addEventListener("pointerdown", function (ev) {
        if (ev.button) return;
        var node = ev.target;
        while (node && node !== pxChartHost) {
          if (node.classList && node.classList.contains("px-brush")) return;
          node = node.parentNode;
        }
        var scroller = pxChartHost.querySelector(".px-scroll");
        var onLayer = ev.target.classList && ev.target.classList.contains("px-pinch-layer");
        if (!scroller || (!scroller.contains(ev.target) && !onLayer)) return;
        plotPress = { x: ev.clientX, y: ev.clientY, id: ev.pointerId, panning: false };
      });
      pxChartHost.addEventListener("pointermove", function (ev) {
        if (pxPinch) {
          plotPress = null;
          return;
        }
        if (!plotPress || plotPress.id !== ev.pointerId || (pxRangeDrag && pxRangeDrag.mode !== "plot")) return;
        var dx = ev.clientX - plotPress.x;
        var dy = ev.clientY - plotPress.y;
        if (!plotPress.panning) {
          if (dx * dx + dy * dy < 64) return;
          if (Math.abs(dx) < Math.abs(dy)) {
            plotPress = null;
            return;
          }
          var w = pxWheel;
          if (!w || !w.dates || w.dates.length < 2) return;
          var i0 = w.dates.indexOf(w.start);
          var i1 = w.dates.indexOf(w.end);
          if (i0 < 0 || i1 <= i0) return;
          plotPress.panning = true;
          pxTouchZoom = true;
          pxRangeDrag = {
            mode: "plot",
            i0: i0,
            i1: i1,
            x: plotPress.x,
            plotW: (w.scroller.getBoundingClientRect().width || w.scroller.clientWidth || 1),
            dates: w.dates.slice()
          };
          try { pxChartHost.setPointerCapture(ev.pointerId); } catch (err) {}
        }
        applyPxRangeDrag(ev);
        ev.preventDefault();
      });
      pxChartHost.addEventListener("pointerup", function (ev) {
        if (!plotPress || plotPress.id !== ev.pointerId) return;
        var panned = plotPress.panning;
        var x0 = plotPress.x;
        var y0 = plotPress.y;
        plotPress = null;
        if (panned) {
          setTimeout(function () { pxTouchZoom = false; }, 400);
          return;
        }
        if (!pxPlotTap) return;
        if (!(ev.target.classList && ev.target.classList.contains("px-pinch-layer"))) return;
        var dx = ev.clientX - x0;
        var dy = ev.clientY - y0;
        if (dx * dx + dy * dy > 36) return;
        pxPlotTap(ev.clientX);
      });
      pxChartHost.addEventListener("mousemove", function (ev) {
        if (!pxPlotHover) return;
        if (!(ev.target.classList && ev.target.classList.contains("px-pinch-layer"))) return;
        pxPlotHover(ev.clientX);
      });
      pxChartHost.addEventListener("mouseleave", function () {
        if (pxPlotLeave) pxPlotLeave();
      });
      pxChartHost.addEventListener("pointercancel", function () {
        plotPress = null;
      });
    }
    document.querySelectorAll("#ohlc-range > button").forEach(function (b) {
      b.onclick = function () {
        ohlcSpan = b.dataset.span || "all";
        ohlcStickRight = true;
        closeOhlcCal();
        renderOhlcChart();
      };
    });
    var ohlcFrom = document.getElementById("ohlc-from");
    var ohlcTo = document.getElementById("ohlc-to");
    function toggleOhlcCal(which, btn) {
      var cal = document.getElementById("ohlc-cal");
      if (ohlcCalTarget === which && cal && !cal.hidden) closeOhlcCal();
      else openOhlcCal(which, btn);
    }
    if (ohlcFrom) {
      ohlcFrom.onclick = function (ev) {
        ev.stopPropagation();
        toggleOhlcCal("from", ohlcFrom);
      };
    }
    if (ohlcTo) {
      ohlcTo.onclick = function (ev) {
        ev.stopPropagation();
        toggleOhlcCal("to", ohlcTo);
      };
    }
    var ohlcCalPrev = document.getElementById("ohlc-cal-prev");
    var ohlcCalNext = document.getElementById("ohlc-cal-next");
    if (ohlcCalPrev) ohlcCalPrev.onclick = function (ev) { ev.stopPropagation(); shiftOhlcCal(-1); };
    if (ohlcCalNext) ohlcCalNext.onclick = function (ev) { ev.stopPropagation(); shiftOhlcCal(1); };
    var ohlcCalGrid = document.getElementById("ohlc-cal-grid");
    if (ohlcCalGrid) {
      ohlcCalGrid.onclick = function (ev) {
        ev.stopPropagation();
        var iso = ev.target.getAttribute("data-date");
        if (!iso) return;
        var from = ohlcCalTarget === "from" ? iso : ohlcCustomFrom || ohlcViewFrom;
        var to = ohlcCalTarget === "to" ? iso : ohlcCustomTo || ohlcViewTo;
        if (!from) from = iso;
        if (!to) to = iso;
        if (from > to) {
          var swap = from;
          from = to;
          to = swap;
        }
        ohlcCustomFrom = from;
        ohlcCustomTo = to;
        ohlcSpan = "custom";
        ohlcStickRight = true;
        closeOhlcCal();
        renderOhlcChart();
      };
    }
    var ohlcHost = document.getElementById("ohlc-chart");
    if (ohlcHost) {
      ohlcHost.addEventListener("wheel", function (ev) {
        ev.preventDefault();
        var dy = ev.deltaY;
        if (ev.deltaMode === 1) dy *= 16;
        else if (ev.deltaMode === 2) dy *= 400;
        zoomOhlcAt(ev.clientX, dy);
      }, { passive: false });
      ohlcHost.addEventListener("touchstart", function (ev) {
        if (ev.touches.length < 2) return;
        var w = ohlcWheel;
        if (!w || !w.dates || w.dates.length < 2) return;
        ohlcTouchZoom = true;
        var i0 = w.dates.indexOf(w.start);
        var i1 = w.dates.indexOf(w.end);
        if (i0 < 0) i0 = 0;
        if (i1 < 0) i1 = w.dates.length - 1;
        var rect = w.scroller.getBoundingClientRect();
        var midX = (ev.touches[0].clientX + ev.touches[1].clientX) / 2;
        var t = rect.width ? (midX - rect.left) / rect.width : 0.5;
        if (t < 0) t = 0;
        if (t > 1) t = 1;
        ohlcPinch = { dist: ohlcPinchSpan(ev.touches), i0: i0, i1: i1, anchor: i0 + (i1 - i0) * t, count: w.dates.length, frame: 0, pending: null };
        ev.preventDefault();
      }, { passive: false, capture: true });
      ohlcHost.addEventListener("touchmove", function (ev) {
        if (ev.touches.length < 2 || !ohlcPinch) return;
        ev.preventDefault();
        var dist = ohlcPinchSpan(ev.touches);
        if (!(ohlcPinch.dist > 8) || !(dist > 8)) return;
        ohlcPinchScale(dist / ohlcPinch.dist);
      }, { passive: false, capture: true });
      var endOhlcPinch = function () {
        if (ohlcPinch && ohlcPinch.frame) cancelAnimationFrame(ohlcPinch.frame);
        if (ohlcPinch && ohlcPinch.pending && ohlcWheel) {
          ohlcApplyWindow(Math.round(ohlcPinch.pending.left), Math.round(ohlcPinch.pending.right), ohlcWheel.dates);
        }
        ohlcPinch = null;
        setTimeout(function () { ohlcTouchZoom = false; }, 400);
      }
      ohlcHost.addEventListener("touchend", function (ev) {
        if (ev.touches.length >= 2) return;
        endOhlcPinch();
      }, { passive: false, capture: true });
      ohlcHost.addEventListener("touchcancel", function (ev) {
        if (ev.touches.length >= 2) return;
        endOhlcPinch();
      }, { passive: false, capture: true });
      var ohlcPress = null;
      ohlcHost.addEventListener("pointerdown", function (ev) {
        if (ev.button) return;
        var node = ev.target;
        while (node && node !== ohlcHost) {
          if (node.classList && node.classList.contains("px-brush")) return;
          node = node.parentNode;
        }
        var scroller = ohlcHost.querySelector(".px-scroll");
        var onLayer = ev.target.classList && ev.target.classList.contains("px-pinch-layer");
        if (!scroller || (!scroller.contains(ev.target) && !onLayer)) return;
        ohlcPress = { x: ev.clientX, y: ev.clientY, id: ev.pointerId, panning: false };
      });
      ohlcHost.addEventListener("pointermove", function (ev) {
        if (ohlcPinch) {
          ohlcPress = null;
          return;
        }
        if (!ohlcPress || ohlcPress.id !== ev.pointerId || (ohlcDrag && ohlcDrag.mode !== "plot")) return;
        var dx = ev.clientX - ohlcPress.x;
        var dy = ev.clientY - ohlcPress.y;
        if (!ohlcPress.panning) {
          if (dx * dx + dy * dy < 64) return;
          if (Math.abs(dx) < Math.abs(dy)) {
            ohlcPress = null;
            return;
          }
          var w = ohlcWheel;
          if (!w || !w.dates || w.dates.length < 2) return;
          var i0 = w.dates.indexOf(w.start);
          var i1 = w.dates.indexOf(w.end);
          if (i0 < 0 || i1 <= i0) return;
          ohlcPress.panning = true;
          ohlcTouchZoom = true;
          ohlcDrag = {
            mode: "plot",
            i0: i0,
            i1: i1,
            x: ohlcPress.x,
            plotW: (w.scroller.getBoundingClientRect().width || w.scroller.clientWidth || 1),
            dates: w.dates.slice()
          };
          try { ohlcHost.setPointerCapture(ev.pointerId); } catch (err) {}
        }
        ohlcApplyDrag(ev);
        ev.preventDefault();
      });
      ohlcHost.addEventListener("pointerup", function (ev) {
        if (!ohlcPress || ohlcPress.id !== ev.pointerId) return;
        var panned = ohlcPress.panning;
        var x0 = ohlcPress.x;
        var y0 = ohlcPress.y;
        ohlcPress = null;
        if (panned) {
          setTimeout(function () { ohlcTouchZoom = false; }, 400);
          return;
        }
        if (!ohlcPlotTap) return;
        if (!(ev.target.classList && ev.target.classList.contains("px-pinch-layer"))) return;
        var dx = ev.clientX - x0;
        var dy = ev.clientY - y0;
        if (dx * dx + dy * dy > 36) return;
        ohlcPlotTap(ev.clientX);
      });
      ohlcHost.addEventListener("mousemove", function (ev) {
        if (!ohlcPlotHover) return;
        if (!(ev.target.classList && ev.target.classList.contains("px-pinch-layer"))) return;
        ohlcPlotHover(ev.clientX);
      });
      ohlcHost.addEventListener("mouseleave", function () {
        if (ohlcPlotLeave) ohlcPlotLeave();
      });
      ohlcHost.addEventListener("pointercancel", function () {
        ohlcPress = null;
      });
    }
    document.addEventListener("pointermove", function (ev) {
      if (pxRangeDrag) applyPxRangeDrag(ev);
      if (ohlcDrag) ohlcApplyDrag(ev);
    });
    document.addEventListener("pointerup", function (ev) {
      if (pxRangeDrag) {
        if (pxRangeDrag.mode === "move" || pxRangeDrag.mode === "plot") snapSlide();
        else applyPxRangeDrag(ev);
        pxRangeDrag = null;
        var bar = document.querySelector("#st-px-chart .px-brush");
        if (bar) bar.classList.remove("is-drag");
      }
      if (ohlcDrag) {
        ohlcDrag = null;
        var ohlcBar = document.querySelector("#ohlc-chart .px-brush");
        if (ohlcBar) ohlcBar.classList.remove("is-drag");
        setTimeout(function () { ohlcTouchZoom = false; }, 400);
      }
    });
    document.addEventListener("pointercancel", function () {
      if (pxRangeDrag && (pxRangeDrag.mode === "move" || pxRangeDrag.mode === "plot")) snapSlide();
      pxRangeDrag = null;
      ohlcDrag = null;
    });
    document.addEventListener("click", function (ev) {
      var cal = document.getElementById("px-cal");
      if (cal && !cal.hidden && !cal.contains(ev.target) && ev.target !== pxFrom && ev.target !== pxTo) closePxCal();
      var ocal = document.getElementById("ohlc-cal");
      var ohlcFromBtn = document.getElementById("ohlc-from");
      var ohlcToBtn = document.getElementById("ohlc-to");
      if (ocal && !ocal.hidden && !ocal.contains(ev.target) && ev.target !== ohlcFromBtn && ev.target !== ohlcToBtn) closeOhlcCal();
      if (pxPinnedDate && pxUnpin) {
        var host = document.getElementById("st-px-chart");
        if (!host || !host.contains(ev.target)) pxUnpin();
      }
      if (ohlcPinned && ohlcUnpin) {
        var ohost = document.getElementById("ohlc-chart");
        if (!ohost || !ohost.contains(ev.target)) ohlcUnpin();
      }
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") {
        closePxCal();
        closeOhlcCal();
      }
    });
    window.addEventListener("resize", function () {
      if (tab !== "stats") return;
      clearTimeout(pxResizeTimer);
      pxResizeTimer = setTimeout(function () {
        renderPriceChart();
        renderOhlcChart();
      }, 150);
    });
    document.querySelectorAll("#page-journal .seg button").forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll("#page-journal .seg button").forEach(function (x) {
          x.classList.toggle("active", x === b);
        });
        document.getElementById("log-ud").classList.toggle("hidden", b.dataset.log !== "ud");
        document.getElementById("log-tt").classList.toggle("hidden", b.dataset.log !== "tt");
      };
    });
    function bindFold(btnId, wrapId, after) {
      document.getElementById(btnId).onclick = function () {
        var open = this.getAttribute("aria-expanded") !== "true";
        this.setAttribute("aria-expanded", open ? "true" : "false");
        document.getElementById(wrapId).classList.toggle("hidden", !open);
        this.querySelector(".rank-arrow").textContent = open ? "▲" : "▼";
        if (after) after();
      };
    }
    bindFold("btn-rank-table", "rank-table-wrap", render);
    bindFold("btn-add-ud-form", "add-ud-wrap");
    bindFold("btn-add-tt-form", "add-tt-wrap");
    bindFold("btn-fold-acct", "fold-acct-wrap");
    bindFold("btn-fold-top", "fold-top-wrap");
    bindFold("btn-fold-split", "fold-split-wrap");
    bindFold("btn-fold-orders", "fold-orders-wrap");
    bindFold("btn-fold-sync", "fold-sync-wrap");
    bindFold("btn-order-hist", "order-hist-wrap", renderOrderHist);
    bindFold("btn-fold-px", "fold-px-wrap", function () {
      var open = document.getElementById("btn-fold-px").getAttribute("aria-expanded") === "true";
      if (!open) {
        closePxCal();
        return;
      }
      pxChartSig = "";
      renderPriceChart();
    });
    bindFold("btn-fold-ohlc", "fold-ohlc-wrap", function () {
      var open = document.getElementById("btn-fold-ohlc").getAttribute("aria-expanded") === "true";
      if (!open) {
        closeOhlcCal();
        return;
      }
      ohlcChartSig = "";
      renderOhlcChart();
    });
    bindFold("btn-fold-ret", "fold-ret-wrap", function () {
      var open = document.getElementById("btn-fold-ret").getAttribute("aria-expanded") === "true";
      var seg = document.getElementById("st-mode");
      if (seg) seg.hidden = !open;
    });
    document.getElementById("order-hist-date").addEventListener("change", function () {
      orderHistDate = this.value;
      renderOrderHist();
    });
    [
      "set-symbol",
      "set-capital",
      "set-fee",
      "set-seed",
      "set-rank",
      "set-inc",
      "set-hold",
      "set-reinvest",
      "set-ud-steps",
      "set-tt-steps",
      "set-ud-qty",
      "set-tt-qty",
      "set-bar-left",
      "set-bar-right",
      "set-j16",
    ].forEach(function (id) {
      document.getElementById(id).addEventListener("change", readSettingsFromForm);
    });
    ["set-fixed", "set-blocked", "set-f8", "set-auto", "set-auto-fill", "set-bar-left-off", "set-bar-right-off"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", readSettingsFromForm);
    });

    document.getElementById("btn-preset-min").onclick = function () {
      state.settings = E.applyPreset(state.settings, "min");
      persist();
    };
    document.getElementById("btn-preset-simple").onclick = function () {
      state.settings = E.applyPreset(state.settings, "simple");
      persist();
    };
    document.getElementById("btn-preset-new").onclick = function () {
      state.settings = E.applyPreset(state.settings, "compoundNew");
      persist();
    };
    document.getElementById("btn-preset-old").onclick = function () {
      state.settings = E.applyPreset(state.settings, "compoundOld");
      persist();
    };
    document.getElementById("account-seg").onclick = function (ev) {
      var btn = ev.target.closest("button");
      if (!btn || !btn.dataset.side) return;
      activateBar(barKey(btn.dataset.side));
    };
    document.getElementById("btn-reset").onclick = function () {
      var id = state.accountId || "1";
      if (!confirm(id + "번 계좌의 업다운·떨사오팔 거래 내역을 모두 지울까요? 원금과 설정은 남습니다.")) return;
      rememberDeleted("ud", state.updownTrades);
      rememberDeleted("tt", state.tteolTrades);
      state.updownTrades = [];
      state.tteolTrades = [];
      state.accounts[id] = {
        settings: state.settings,
        updownTrades: state.updownTrades,
        tteolTrades: state.tteolTrades,
        deletedUd: state.deletedUd || [],
        deletedTt: state.deletedTt || [],
      };
      persist();
      toast(id + "번 계좌 거래 내역을 지웠습니다");
    };
    document.getElementById("btn-sync-start").onclick = createSyncFromHere;
    document.getElementById("btn-sync-join").onclick = joinSyncFromCode;
    document.getElementById("sync-token").addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        createSyncFromHere();
      }
    });
    document.getElementById("btn-sync-copy").onclick = function () {
      var cfg = loadSyncCfg();
      var code = document.getElementById("sync-code").value.trim() || (cfg.token && cfg.gistId ? encodePair(cfg) : "");
      if (!code) {
        toast("먼저 연결을 만들거나 코드를 넣으세요");
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(
          function () {
            toast("연결 코드 복사됨");
          },
          function () {
            toast("복사 실패 · 코드를 길게 눌러 복사하세요");
          }
        );
      } else {
        toast("코드를 길게 눌러 복사하세요");
      }
    };
    var swescUd = document.getElementById("btn-swesc-fill-ud");
    if (swescUd) swescUd.onclick = function () { applyEscapeFill(); };
    document.getElementById("btn-fill-ud").onclick = function () {
      var r = E.applySuggested(state, "ud", suggestOpts());
      maybeAutoTransfer();
      persist();
      toast(r.ok ? "업다운 " + r.trade.type + " 반영 · " + (r.trade.date || "") : r.reason);
    };
    document.getElementById("btn-fill-tt").onclick = function () {
      if (isEscapeView()) {
        toast("탈출 업다운에는 떨이 없습니다");
        return;
      }
      var r = E.applySuggested(state, "tteol", suggestOpts());
      maybeAutoTransfer();
      persist();
      toast(r.ok ? "떨사오팔 " + r.trade.type + " 반영 · " + (r.trade.date || "") : r.reason);
    };
    document.getElementById("btn-transfer").onclick = function () {
      if (isEscapeView()) {
        toast("탈출 업다운에는 떨이 없습니다");
        return;
      }
      var r = E.transferOneRank(state);
      persist();
      toast(r.ok ? "떨 이관 랭크 " + r.rank : r.reason);
    };
    document.getElementById("ud-log").ondblclick = onJournalLogEvent;
    document.getElementById("ud-log").addEventListener("touchend", onJournalLogEvent, { passive: false });
    document.getElementById("tt-log").ondblclick = onJournalLogEvent;
    document.getElementById("tt-log").addEventListener("touchend", onJournalLogEvent, { passive: false });
    document.getElementById("sug-ud").ondblclick = onSugDateEvent;
    document.getElementById("sug-tt").ondblclick = onSugDateEvent;
    document.getElementById("ud-log").onclick = function (ev) {
      var i = ev.target.getAttribute("data-ud");
      if (i == null) return;
      if (isEscapeView()) {
        var esc = loadEscape();
        if (!esc || !esc.trades) return;
        esc.trades.splice(+i, 1);
        saveEscape(esc);
        render();
        return;
      }
      pushLastSnap();
      rememberDeleted("ud", [state.updownTrades[+i]]);
      state.updownTrades.splice(+i, 1);
      persist({ noUndo: true });
    };
    document.getElementById("tt-log").onclick = function (ev) {
      var i = ev.target.getAttribute("data-tt");
      if (i == null) return;
      pushLastSnap();
      rememberDeleted("tt", [state.tteolTrades[+i]]);
      state.tteolTrades.splice(+i, 1);
      persist({ noUndo: true });
    };
    document.querySelectorAll(".num-pick").forEach(function (btn) {
      btn.onclick = function () {
        if (isEscapeView()) {
          if (btn.dataset.key === "tteolLadderCount" || btn.dataset.key === "tteolStepQty") {
            toast("탈출 업다운에는 떨이 없습니다");
            return;
          }
          var esc = loadEscape() || {};
          var cur = btn.dataset.key === "udStepQty" ? esc.stepq : esc.steps;
          openNumPop(btn.dataset.key, btn.dataset.title, cur);
          return;
        }
        if (btn.dataset.hist) {
          openNumPop("hist:" + btn.dataset.hist, btn.dataset.title, histLadderNow()[btn.dataset.hist]);
          return;
        }
        openNumPop(btn.dataset.key, btn.dataset.title, state.settings[btn.dataset.key]);
      };
    });
    document.getElementById("num-pop").onclick = function (ev) {
      if (ev.target.id === "num-pop") closeNumPop();
    };
    document.getElementById("num-pop-grid").onclick = function (ev) {
      var n = ev.target.getAttribute("data-num");
      if (n == null || !numPopKey) return;
      if (numPopKey.indexOf("hist:") === 0) {
        histLadderNow()[numPopKey.slice(5)] = parseInt(n, 10);
        closeNumPop();
        renderOrderHist();
        return;
      }
      if (isEscapeView()) {
        var esc = loadEscape();
        if (!esc) {
          closeNumPop();
          return;
        }
        if (numPopKey === "udStepQty") esc.stepq = parseInt(n, 10);
        else if (numPopKey === "udLadderCount") esc.steps = parseInt(n, 10);
        closeNumPop();
        saveEscape(esc);
        render();
        return;
      }
      state.settings[numPopKey] = parseInt(n, 10);
      if (!state.settings.fieldRev || typeof state.settings.fieldRev !== "object") state.settings.fieldRev = {};
      state.settings.fieldRev[numPopKey] = Date.now();
      state.settingsRev = Date.now();
      closeNumPop();
      persist();
    };

    document.getElementById("btn-add-ud").onclick = addUdManual;
    document.getElementById("btn-add-tt").onclick = addTtManual;
    document.getElementById("btn-liq-ud").onclick = function () {
      liquidateFrom("ud");
    };
    document.getElementById("btn-liq-tt").onclick = function () {
      liquidateFrom("tt");
    };
  }

  var numPopKey = "";

  function openNumPop(key, title, current) {
    numPopKey = key;
    document.getElementById("num-pop-title").textContent = title || "선택";
    var html = "";
    for (var i = 1; i <= 20; i++) {
      html +=
        "<button type='button' data-num='" +
        i +
        "'" +
        (Number(current) === i ? " class='active'" : "") +
        ">" +
        i +
        "</button>";
    }
    document.getElementById("num-pop-grid").innerHTML = html;
    document.getElementById("num-pop").classList.remove("hidden");
  }

  function closeNumPop() {
    numPopKey = "";
    document.getElementById("num-pop").classList.add("hidden");
  }

  function liquidateFrom(which) {
    if (isEscapeView()) return toast("탈출 업다운은 일지에서 지으세요");
    var dateEl = document.getElementById(which === "tt" ? "nt-date" : "nu-date");
    var priceEl = document.getElementById(which === "tt" ? "nt-price" : "nu-price");
    var qtyEl = document.getElementById(which === "tt" ? "nt-qty" : "nu-qty");
    var typeEl = document.getElementById(which === "tt" ? "nt-type" : "nu-type");
    if (typeEl) typeEl.value = "매도";
    var price = parseFloat(priceEl.value);
    var qty = parseInt(qtyEl.value, 10);
    var date = dateEl.value || state.market.closeDate;
    var out = E.compute(state);
    if (!out.C13 && !out.openRanks.length) return toast("청산할 보유가 없습니다");
    if (!price) return toast("청산 단가를 넣으세요");
    var msg =
      "업다운 " +
      (out.C13 || 0) +
      "주와 떨사오팔 랭크 " +
      out.openRanks.length +
      "개를 " +
      price +
      "에 함께 전량 매도합니다. 기록은 남습니다.";
    if (!confirm(msg)) return;
    var r = E.liquidateAll(state, { date: date, price: price, qty: qty });
    persist();
    toast(r.ok ? "전량 청산 · 포트 0" : r.reason);
  }

  function addUdManual() {
    if (isEscapeView()) {
      var type = document.getElementById("nu-type").value;
      var price = parseFloat(document.getElementById("nu-price").value);
      var qty = parseInt(document.getElementById("nu-qty").value, 10);
      var date = document.getElementById("nu-date").value || state.market.closeDate;
      if (!price || !qty) return toast("단가·수량을 넣으세요");
      var esc = loadEscape();
      if (!esc) return toast("탈출에서 먼저 시작하세요");
      var vs = escapeToViewState(esc);
      var out = E.compute(vs);
      var last = out.udLast;
      var prevHold = out.C13 || 0;
      var hold = type === "매도" ? prevHold - qty : prevHold + qty;
      if (hold < 0) hold = 0;
      var avg = type === "매도" ? (last && last.avg) || 0 : hold ? ((last && last.cost ? last.cost : prevHold * ((last && last.avg) || 0)) + price * qty) / hold : 0;
      if (type !== "매도") {
        var prevCost = last && last.cost != null ? Number(last.cost) : prevHold * ((last && last.avg) || 0);
        avg = hold ? (prevCost + price * qty) / hold : 0;
      }
      var pot;
      if (type === "매도") pot = last && last.pot ? last.pot : 0;
      else pot = last && (last.type === "매수" || last.type === "떨") ? last.pot + 1 : last && last.pot ? last.pot : 1;
      esc.trades = esc.trades || [];
      var amount = price * qty;
      esc.trades.push({
        date: date,
        type: type === "매도" ? "매도" : "매수",
        pot: pot,
        price: price,
        qty: qty,
        holdQty: hold,
        avg: avg,
        amount: amount,
        fee: down2(amount * (Number(esc.fee) || 0)),
      });
      saveEscape(esc);
      clearManualForm("ud");
      render();
      toast("행 추가");
      return;
    }
    var type = document.getElementById("nu-type").value;
    var price = parseFloat(document.getElementById("nu-price").value);
    var qty = parseInt(document.getElementById("nu-qty").value, 10);
    var date = document.getElementById("nu-date").value || state.market.closeDate;
    if (!price || !qty) return toast("단가·수량을 넣으세요");
    var out = E.compute(state);
    var last = out.udLast;
    var amount = price * qty;
    var fee = E.excelRoundDown(amount * state.settings.fee, 2);
    var prevHold = out.C13;
    var prevCost = last ? last.cost || 0 : 0;
    var prevAvg = last ? last.avg || 0 : 0;
    var hold = type === "매수" || type === "떨" ? prevHold + qty : prevHold - qty;
    var cost = type === "매수" || type === "떨" ? prevCost + amount : prevAvg * hold;
    var avg = type === "매수" || type === "떨" ? (hold ? cost / hold : 0) : prevAvg;
    var sec = type === "매도" ? Math.max(E.excelRoundDown(amount * E.SEC_RATE, 2), 0.01) : 0;
    var pnl = type === "매도" ? amount - qty * avg - (fee + E.excelRoundUp(avg * qty * state.settings.fee, 2) + sec) : "";
    var pot;
    if (type === "매수" || type === "떨") pot = last && (last.type === "매수" || last.type === "떨") ? last.pot + 1 : last && last.pot ? last.pot : 1;
    else pot = last && (last.type === "매수" || last.type === "떨") ? last.pot : last && last.pot ? last.pot - 1 : 1;
    if (type === "매수" && !last) pot = 1;
    var cycle = prevHold === 0 && (type === "매수" || type === "떨") ? (last ? last.cycle + 1 : 1) : last ? last.cycle : 1;
    state.updownTrades.unshift({
      id: E.newTradeId(), editedAt: Date.now(),
      date: date,
      seq: 1,
      type: type,
      pot: pot,
      price: price,
      qty: qty,
      amount: amount,
      fee: fee,
      holdQty: hold,
      cost: cost,
      avg: avg,
      pnl: pnl,
      cycle: cycle,
    });
    persist();
    clearManualForm("ud");
  }

  function addTtManual() {
    if (isEscapeView()) return toast("탈출 업다운에는 떨이 없습니다");
    var type = document.getElementById("nt-type").value;
    var rank = parseInt(document.getElementById("nt-rank").value, 10);
    var price = parseFloat(document.getElementById("nt-price").value);
    var qty = parseInt(document.getElementById("nt-qty").value, 10);
    var date = document.getElementById("nt-date").value || state.market.closeDate;
    if (!price || !qty || !rank) return toast("랭크·단가·수량을 넣으세요");
    var amount = price * qty;
    var fee = E.excelRoundDown(amount * state.settings.fee, 2);
    var out = E.compute(state);
    var pnl = "";
    if (type === "매도") {
      var pos = out.openRanks.filter(function (r) {
        return r.rank === rank;
      })[0];
      if (pos) {
        var sec = Math.max(E.excelRoundDown(amount * E.SEC_RATE, 2), 0.01);
        pnl = amount - pos.price * pos.qty - ((pos.fee || 0) + fee + sec);
      }
    }
    state.tteolTrades.unshift({
      id: E.newTradeId(), editedAt: Date.now(),
      date: date,
      seq: 1,
      type: type,
      rank: rank,
      price: price,
      qty: qty,
      amount: amount,
      fee: fee,
      pnl: pnl,
      cycle: type === "매도" && pos && pos.cycle != null && pos.cycle !== "" ? pos.cycle : out.B8,
    });
    persist();
    clearManualForm("tt");
  }

  function clearManualForm(which) {
    var ids =
      which === "tt"
        ? ["nt-date", "nt-type", "nt-rank", "nt-price", "nt-qty"]
        : ["nu-date", "nu-type", "nu-price", "nu-qty"];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (!el) continue;
      el.value = el.tagName === "SELECT" ? "매수" : "";
    }
  }

  var quoteBusy = false;

  function rememberClose(m, date, close, settle) {
    if (!date || !isFinite(close) || close <= 0 || !closeIsFinal(date)) return false;
    m.closeHistory = m.closeHistory || [];
    for (var i = 0; i < m.closeHistory.length; i++) {
      if (m.closeHistory[i].date === date) {
        if (near(m.closeHistory[i].close, close, 1e-6)) return false;
        if (!closeRevisionOk(m.closeHistory[i].close, close, settle)) return false;
        var oldClose = Number(m.closeHistory[i].close);
        m.closeHistory[i].close = close;
        if (m === state.market) E.retargetBooks(state, date, oldClose, close);
        return true;
      }
    }
    m.closeHistory.push({ date: date, close: close });
    m.closeHistory.sort(function (a, b) {
      return a.date < b.date ? 1 : -1;
    });
    if (m.closeHistory.length > 2500) m.closeHistory = m.closeHistory.slice(0, 2500);
    return true;
  }

  function recordCloseDb(date, close, settle) {
    if (!date || !isFinite(close) || close <= 0 || !closeIsFinal(date)) return false;
    state.closeDb = state.closeDb || [];
    for (var i = 0; i < state.closeDb.length; i++) {
      if (state.closeDb[i].date === date) {
        if (near(state.closeDb[i].close, close, 1e-6)) return false;
        if (!closeRevisionOk(state.closeDb[i].close, close, settle)) return false;
        var oldClose = Number(state.closeDb[i].close);
        state.closeDb[i].close = close;
        E.retargetBooks(state, date, oldClose, close);
        return true;
      }
    }
    state.closeDb.push({ date: date, close: Number(close) });
    state.closeDb.sort(function (a, b) {
      return a.date < b.date ? 1 : -1;
    });
    return true;
  }

  function closeRevisionOk(oldClose, nextClose, settle) {
    if (settle) return true;
    return Math.abs(Number(oldClose) - Number(nextClose)) <= 0.05;
  }

  function patchCloseRow(list, date, close) {
    if (!list) return false;
    for (var i = 0; i < list.length; i++) {
      if (list[i].date !== date) continue;
      if (near(list[i].close, close, 1e-6)) return false;
      list[i].close = close;
      return true;
    }
    return false;
  }

  function restorePrevClose(sessionDate, lastClose, prevClose) {
    if (!sessionDate || !isFinite(lastClose) || !isFinite(prevClose) || prevClose <= 0) return false;
    if (near(lastClose, prevClose, 1e-4)) return false;
    var prevDate = E.previousTradingDate(sessionDate);
    if (!prevDate) return false;
    var changed = false;
    function restore(list) {
      if (!list) return;
      for (var i = 0; i < list.length; i++) {
        if (list[i].date !== prevDate) continue;
        if (!near(list[i].close, lastClose, 1e-4)) continue;
        list[i].close = prevClose;
        changed = true;
      }
    }
    restore(state.closeDb);
    restore(state.market && state.market.closeHistory);
    if (
      state.market &&
      state.market.prevCloseDate === prevDate &&
      near(state.market.prevClose, lastClose, 1e-4)
    ) {
      state.market.prevClose = prevClose;
      changed = true;
    }
    return changed;
  }

  function repairCopiedClose() {
    var changed = false;
    var by = {};
    (state.closeDb || []).forEach(function (r) {
      if (r && r.date) by[r.date] = r;
    });
    var d28 = by["2026-09-28"];
    var d29 = by["2026-09-29"];
    if (d28 && d29 && near(d28.close, 147, 0.02) && near(d29.close, 147, 0.02)) {
      if (patchCloseRow(state.closeDb, "2026-09-28", 142.29)) changed = true;
      if (state.market && patchCloseRow(state.market.closeHistory, "2026-09-28", 142.29)) changed = true;
      if (state.market && state.market.prevCloseDate === "2026-09-28" && near(state.market.prevClose, 147, 0.02)) {
        state.market.prevClose = 142.29;
        changed = true;
      }
    }
    return changed;
  }

  function closeDayChange(rows, i) {
    var cur = Number(rows[i].close);
    var prev = rows[i + 1] ? Number(rows[i + 1].close) : NaN;
    if (!isFinite(cur) || !isFinite(prev) || prev <= 0) return null;
    return (cur - prev) / prev;
  }

  function signedPct(n) {
    if (n == null || Number.isNaN(n)) return "—";
    var text = (Number(n) * 100).toFixed(2) + "%";
    return n > 0 ? "+" + text : text;
  }

  function renderCloseDb() {
    var rows = state.closeDb || [];
    var latest = rows[0];
    var latestChg = rows.length > 1 ? closeDayChange(rows, 0) : null;
    fillText(
      "v-closedb-latest",
      latest
        ? latest.date + " · " + money(latest.close) + (latestChg == null ? "" : " · " + signedPct(latestChg))
        : "기록 없음"
    );
    var tb = document.getElementById("closedb-body");
    if (!tb) return;
    if (!rows.length) {
      tb.innerHTML = "<tr><td colspan='3'>정규장 마감 후 자동으로 쌓입니다</td></tr>";
      return;
    }
    tb.innerHTML = rows
      .map(function (r, i) {
        var chg = closeDayChange(rows, i);
        var cls = chg > 0 ? "neg" : chg < 0 ? "pos" : "";
        return (
          "<tr><td>" +
          r.date +
          "</td><td>" +
          money(r.close) +
          "</td><td class='" +
          cls +
          "'>" +
          signedPct(chg) +
          "</td></tr>"
        );
      })
      .join("");
  }

  function applyLiveQuote(q) {
    if (!q || !isFinite(q.price) || q.price <= 0) return;
    var quoteDirty = false;
    var closeDirty = false;
    if (!near(state.market.price, q.price, 1e-6)) {
      state.market.price = q.price;
      quoteDirty = true;
    }
    if (q.changePct != null && isFinite(q.changePct) && !near(state.market.changePct, q.changePct, 1e-8)) {
      state.market.changePct = q.changePct;
      quoteDirty = true;
    }
    if (q.phase && q.phase !== state.market.phase) {
      state.market.phase = q.phase;
      quoteDirty = true;
    }
    var curClose = state.market.lastClose;
    var publishClose = false;
    if (q.phase && q.phase !== "REG_MKT" && q.sessionDate && isFinite(q.prevClose) && q.prevClose > 0) {
      var histPrev = E.previousTradingDate(q.sessionDate);
      if (histPrev && rememberClose(state.market, histPrev, q.prevClose)) closeDirty = true;
    }
    var canRollClose =
      q.phase &&
      q.phase !== "REG_MKT" &&
      q.sessionDate &&
      closeIsFinal(q.sessionDate) &&
      isFinite(q.lastClose) &&
      q.lastClose > 0;
    if (canRollClose) {
      if (restorePrevClose(q.sessionDate, q.lastClose, q.prevClose)) closeDirty = true;
      var expectedPrev = E.previousTradingDate(q.sessionDate);
      if (rememberClose(state.market, q.sessionDate, q.lastClose, true)) {
        closeDirty = true;
        publishClose = true;
      }
      if (expectedPrev && isFinite(q.prevClose) && q.prevClose > 0) {
        if (rememberClose(state.market, expectedPrev, q.prevClose)) closeDirty = true;
      }
      var prevDate = state.market.closeDate || "";
      if (q.sessionDate > prevDate) {
        state.market.prevPrevClose = state.market.prevClose;
        if (prevDate === expectedPrev) {
          state.market.prevCloseDate = prevDate;
          if (isFinite(curClose) && curClose > 0) state.market.prevClose = curClose;
          else if (isFinite(q.prevClose) && q.prevClose > 0) state.market.prevClose = q.prevClose;
        } else {
          if (prevDate && isFinite(curClose) && curClose > 0) rememberClose(state.market, prevDate, curClose);
          state.market.prevCloseDate = expectedPrev;
          if (isFinite(q.prevClose) && q.prevClose > 0) state.market.prevClose = q.prevClose;
          else if (isFinite(curClose) && curClose > 0) state.market.prevClose = curClose;
        }
        state.market.lastClose = q.lastClose;
        state.market.closeDate = q.sessionDate;
        state.market.tradeDate = q.sessionDate;
        closeDirty = true;
      } else if (q.sessionDate === prevDate) {
        var echoedPrev = isFinite(q.prevClose) && near(q.lastClose, q.prevClose, 1e-4);
        if (!echoedPrev && expectedPrev && isFinite(q.prevClose) && q.prevClose > 0) {
          if (state.market.prevCloseDate !== expectedPrev || !near(state.market.prevClose, q.prevClose, 1e-6)) {
          state.market.prevPrevClose = state.market.prevClose;
          state.market.prevCloseDate = expectedPrev;
          state.market.prevClose = q.prevClose;
          closeDirty = true;
        }
        }
        if (!echoedPrev && !near(curClose, q.lastClose, 1e-6)) {
            state.market.lastClose = q.lastClose;
            state.market.tradeDate = q.sessionDate;
            closeDirty = true;
          }
        }
      }
    var echoed = isFinite(q.prevClose) && near(q.lastClose, q.prevClose, 1e-4);
    if (q.phase && q.phase !== "REG_MKT" && closeIsFinal(q.sessionDate) && isFinite(q.lastClose) && q.lastClose > 0 && !echoed && !near(state.market.lastClose, q.lastClose, 1e-6)) {
      state.market.lastClose = q.lastClose;
      closeDirty = true;
    }
    if (q.phase && q.phase !== "REG_MKT" && closeIsFinal(q.sessionDate) && isFinite(q.lastClose) && q.lastClose > 0 && !echoed) {
      if (recordCloseDb(q.sessionDate, q.lastClose, true)) {
        closeDirty = true;
        publishClose = true;
      }
    }
    if (closeDirty) persist(publishClose ? { noUndo: true } : { keepRev: true });
    else if (quoteDirty) persist({ sync: false, keepRev: true });
  }

  function cnbcSessionDate(q) {
    var raw = q.reg_last_time || q.last_time || "";
    var m = String(raw).match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : "";
  }

  function parseCnbcQuote(data) {
    var q = data && data.QuickQuoteResult && data.QuickQuoteResult.QuickQuote;
    if (!q) return null;
    if (Object.prototype.toString.call(q) === "[object Array]") q = q[0];
    if (!q) return null;
    var prev = Number(q.previous_day_closing);
    var prevPrev = Number(q.prev_prev_closing);
    var regularLast = Number(q.last);
    var ext = q.ExtendedMktQuote;
    var curStatus = String(q.curmktstatus || "");
    var mainStatus = String(q.mainmktstatus || "");
    var phase = "REG_MKT";
    if (/PRE_MKT/.test(curStatus) || /PRE_MKT/.test(mainStatus)) phase = "PRE_MKT";
    else if (/POST_MKT/.test(curStatus) || /POST_MKT/.test(mainStatus)) phase = "POST_MKT";
    else if (/CLOSED|\bCLOSE\b/.test(curStatus) || /CLOSED|\bCLOSE\b/.test(mainStatus)) phase = "CLOSED";
    var sessionClosed = phase === "POST_MKT";
    var price = regularLast;
    var changePct = isFinite(prev) && prev > 0 ? (regularLast - prev) / prev : Number(q.change_pct) / 100;
    if (phase !== "REG_MKT" && ext && ext.last != null) {
      var extLast = Number(ext.last);
      if (isFinite(extLast) && extLast > 0) {
        price = extLast;
        if (ext.change_pct != null && isFinite(Number(ext.change_pct))) changePct = Number(ext.change_pct) / 100;
        else if (isFinite(prev) && prev > 0) changePct = (price - prev) / prev;
      }
    }
    if (!isFinite(price) || price <= 0) return null;
    var lastClose = phase === "REG_MKT" || !isFinite(regularLast) || regularLast <= 0 ? NaN : regularLast;
    var prevClose = isFinite(prev) && prev > 0 ? prev : NaN;
    if (isFinite(lastClose) && isFinite(prevClose) && Math.abs(prevClose - lastClose) <= 1e-4 && isFinite(prevPrev) && prevPrev > 0) {
      prevClose = prevPrev;
    }
    if (!isFinite(changePct)) changePct = null;
    return {
      price: price,
      changePct: changePct,
      lastClose: lastClose,
      prevClose: prevClose,
      sessionDate: cnbcSessionDate(q),
      sessionClosed: sessionClosed,
      phase: phase,
    };
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("http");
      return r.json();
    });
  }

  function fetchCnbcQuote(symbol) {
    var url =
      "https://quote.cnbc.com/quote-html-webservice/quote.htm?partnerId=2&requestMethod=quick&exthrs=1&noform=1&output=json&symbols=" +
      encodeURIComponent(symbol);
    return fetchJson(url).then(function (data) {
      var q = parseCnbcQuote(data);
      if (!q) throw new Error("parse");
      return q;
    });
  }

  function fetchLocalQuote(symbol) {
    return fetchJson("quote?symbol=" + encodeURIComponent(symbol)).then(function (q) {
      if (!q || !q.price) throw new Error("parse");
      return { price: Number(q.price), changePct: q.changePct == null ? null : Number(q.changePct) };
    });
  }

  function fetchQuote() {
    if (quoteBusy) return;
    quoteBusy = true;
    var symbol = String(state.settings.symbol || "SOXL").toUpperCase();
    fetchCnbcQuote(symbol)
      .catch(function () {
        return fetchLocalQuote(symbol);
      })
      .then(function (q) {
        applyLiveQuote(q);
      }, function () {})
      .then(function () {
        quoteBusy = false;
      });
  }

  var HOME_PNL_KEY = "switch-home-pnl-open";

  function homePnlOpen() {
    try {
      return localStorage.getItem(HOME_PNL_KEY) !== "0";
    } catch (e) {
      return true;
    }
  }

  function applyHomePnlFold() {
    var open = homePnlOpen();
    var row = document.getElementById("home-pnl-row");
    var btn = document.getElementById("home-pnl-toggle");
    if (row) row.hidden = !open;
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  var homePnlToggle = document.getElementById("home-pnl-toggle");
  if (homePnlToggle) {
    homePnlToggle.onclick = function () {
      try {
        localStorage.setItem(HOME_PNL_KEY, homePnlOpen() ? "0" : "1");
      } catch (e) {}
      applyHomePnlFold();
    };
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js?v=45", { updateViaCache: "none" }).catch(function () {});
  }

  function syncNow() {
    fetchQuote();
    pullRemote().catch(function () {});
  }
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) syncNow();
  });
  window.addEventListener("pageshow", function () {
    syncNow();
  });
  window.addEventListener("focus", function () {
    syncNow();
  });
  window.addEventListener("storage", function (ev) {
    if (ev.key === KEY && ev.newValue) {
      try {
        state = attachAccounts(JSON.parse(ev.newValue));
        lastSnap = captureSnap();
        render();
      } catch (e) {}
      return;
    }
    if (ev.key !== ESCAPE_KEY) return;
    if (isEscapeView()) render();
  });

  bind();
  setTab(tabFromUrl());
  window.addEventListener("hashchange", function () {
    setTab(tabFromUrl());
  });
  render();
  lastSnap = captureSnap();
  updateUndoBtn();
  fetchQuote();
  pullRemote().catch(function () {});
  scheduleAutoFill();
  setTimeout(markSyncReady, 8000);
  setInterval(fetchQuote, 15000);
  setInterval(function () {
    pullRemote().catch(function () {});
  }, 20000);
})();
