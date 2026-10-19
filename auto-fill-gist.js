/**
 * GitHub Actions / Node: gist 장부에 07:00 자동 기입.
 * 브라우저가 닫혀 있어도 동작한다.
 */
"use strict";

var E = require("./engine.js");

var STATE_FILE = "switch-v3-state.json";
var ESCAPE_FILE = "switch-escape-v1.json";
var CNBC =
  "https://quote.cnbc.com/quote-html-webservice/quote.htm?partnerId=2&requestMethod=quick&exthrs=1&noform=1&output=json&symbols=";

function seoulDay(d) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d || new Date());
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

function canonBar(k) {
  if (k === "acc1" || k === "acc2" || k === "escape") return k;
  if (k === "1") return "acc1";
  if (k === "2") return "acc2";
  return "";
}

function attach(root) {
  if (!root || typeof root !== "object") throw new Error("empty state");
  if (!root.market) root.market = E.defaultMarket();
  if (!root.accounts || !root.accounts["1"] || !root.accounts["1"].settings) {
    root.accounts = {
      "1": {
        settings: root.settings || E.defaultSettings(),
        updownTrades: root.updownTrades || [],
        tteolTrades: root.tteolTrades || [],
        deletedUd: root.deletedUd || [],
        deletedTt: root.deletedTt || [],
      },
      "2": root.accounts && root.accounts["2"] && root.accounts["2"].settings
        ? root.accounts["2"]
        : {
            settings: E.defaultSettings(),
            updownTrades: [],
            tteolTrades: [],
            deletedUd: [],
            deletedTt: [],
          },
    };
  }
  root.barLeft = canonBar(root.barLeft) || "acc1";
  root.barRight = canonBar(root.barRight) || "acc2";
  return root;
}

function bookView(state, id) {
  var book = state.accounts[id];
  return {
    settings: book.settings,
    updownTrades: book.updownTrades,
    tteolTrades: book.tteolTrades,
    market: state.market,
    closeDb: state.closeDb || [],
  };
}

function autoTransfer(view) {
  if (!view.settings || !view.settings.autoTransfer) return;
  var guard = 0;
  while (guard < 20) {
    var out = E.compute(view);
    if (out.C54 === "" || out.C54 == null) break;
    var r = E.transferOneRank(view);
    if (!r.ok) break;
    guard += 1;
  }
}

function fillBook(view) {
  var parts = [];
  var guard = 0;
  while (guard++ < 20) {
    var r = E.applySuggested(view, "ud");
    if (!r.ok) break;
    autoTransfer(view);
    parts.push("업다운 " + r.trade.type);
  }
  guard = 0;
  while (guard++ < 20) {
    var r2 = E.applySuggested(view, "tteol");
    if (!r2.ok) break;
    autoTransfer(view);
    parts.push("떨 " + r2.trade.type);
  }
  return parts.length ? parts.join(" · ") : "제안 없음";
}

function replayEscape(d) {
  var live = { qty: 0, avg: 0, cost: 0, port: 0, last: 0, started: false, lastDate: "" };
  var trades = (d && d.trades) || [];
  for (var i = 0; i < trades.length; i++) {
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

function escapeCalc(esc, market) {
  var live = replayEscape(esc || {});
  var split = (esc && Number(esc.split)) || 15;
  var cap = ((esc && Number(esc.old)) || 0) + ((esc && Number(esc.add)) || 0);
  var shot = split ? round2(cap / split) : 0;
  var closePx = Number(esc && esc.close);
  if (!closePx) closePx = Number((market || {}).lastClose) || Number((market || {}).price) || 0;
  if (market && Number(market.lastClose)) closePx = Number(market.lastClose);
  if (!live.started) {
    return { started: false, qty: 0, port: 0, closePx: closePx, buy: "", sell: "", buyQty: 0, sellQty: 0, lastDate: "", avg: 0, cost: 0, lp: 0 };
  }
  var lp = live.last;
  var buy = live.port ? round2(lp * (1 - 0.002 * (20 / split) * live.port)) : round2(lp * 1.1);
  var sell = live.qty ? lp : "";
  return {
    started: true,
    qty: live.qty,
    avg: live.avg,
    cost: live.cost,
    port: live.port,
    closePx: closePx,
    lp: lp,
    buy: buy,
    sell: sell,
    buyQty: buy ? down0(shot / buy) : 0,
    sellQty: live.port ? down0(live.qty / live.port) : 0,
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

function fillEscape(esc, market) {
  if (!esc || !(esc.trades || []).length) return "탈출 없음";
  var c = escapeCalc(esc, market);
  var date = (market && market.closeDate) || esc.date;
  var type = escapeFillType(esc, c, date);
  if (!type) return "제안 없음";
  var closePx = c.closePx;
  if (type === "매수") {
    if (!c.buyQty) return "수량 0";
    var hold = c.qty + c.buyQty;
    var cost = c.cost + closePx * c.buyQty;
    var avg = hold ? cost / hold : 0;
    var pot = c.port ? c.port + 1 : 1;
    var buyAmt = closePx * c.buyQty;
    esc.trades.push({
      date: date,
      type: "매수",
      pot: pot,
      price: closePx,
      qty: c.buyQty,
      holdQty: hold,
      avg: avg,
      cost: round2(cost),
      amount: buyAmt,
      fee: down2(buyAmt * (Number(esc.fee) || 0)),
    });
  } else {
    if (!c.sellQty) return "수량 0";
    var hold2 = c.qty - c.sellQty;
    if (hold2 < 0) hold2 = 0;
    var sellAmt = closePx * c.sellQty;
    esc.trades.push({
      date: date,
      type: "매도",
      pot: c.port,
      price: closePx,
      qty: c.sellQty,
      holdQty: hold2,
      avg: c.avg,
      amount: sellAmt,
      fee: down2(sellAmt * (Number(esc.fee) || 0)),
    });
  }
  esc.close = closePx;
  esc.rev = Date.now();
  return "업다운 " + type;
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
    phase: phase,
  };
}

function applyQuote(state, q) {
  if (!q) return;
  if (!state.market) state.market = E.defaultMarket();
  if (q.price) state.market.price = q.price;
  if (q.changePct != null) state.market.changePct = q.changePct;
  if (q.phase) state.market.phase = q.phase;
  var lastClose = isFinite(q.lastClose) && q.lastClose > 0 ? q.lastClose : q.price;
  var sessionDate = q.sessionDate || state.market.closeDate;
  if (lastClose && sessionDate) {
    state.market.lastClose = lastClose;
    state.market.closeDate = sessionDate;
    state.market.tradeDate = sessionDate;
  }
  if (isFinite(q.prevClose) && q.prevClose > 0) state.market.prevClose = q.prevClose;
}

function gistHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: "Bearer " + token,
    "User-Agent": "switch-soxl-auto-fill",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function readFile(gist, name) {
  var f = gist.files && gist.files[name];
  if (!f || !f.content) return null;
  try {
    return JSON.parse(f.content);
  } catch (e) {
    throw new Error("bad json " + name);
  }
}

async function fetchQuote(symbol) {
  var r = await fetch(CNBC + encodeURIComponent(symbol), { cache: "no-store" });
  if (!r.ok) throw new Error("quote http " + r.status);
  return parseCnbcQuote(await r.json());
}

async function main() {
  var token = process.env.GIST_TOKEN || process.env.GH_TOKEN || "";
  var gistId = process.env.GIST_ID || "bd19f426b2bf612bda5de2bb35d97539";
  if (!token) throw new Error("GIST_TOKEN missing");
  if (!gistId) throw new Error("GIST_ID missing");

  var day = seoulDay();
  var res = await fetch("https://api.github.com/gists/" + gistId, { headers: gistHeaders(token) });
  if (!res.ok) throw new Error("gist get " + res.status + " " + (await res.text()));
  var gist = await res.json();
  var state = attach(readFile(gist, STATE_FILE) || {});
  var esc = readFile(gist, ESCAPE_FILE);

  if (!state.autoFill) {
    console.log("autoFill off · skip");
    return;
  }
  if (state.autoFillLast === day) {
    console.log("already filled " + day);
    return;
  }

  var symbol = "SOXL";
  if (state.accounts["1"] && state.accounts["1"].settings && state.accounts["1"].settings.symbol) {
    symbol = String(state.accounts["1"].settings.symbol).toUpperCase();
  }
  try {
    applyQuote(state, await fetchQuote(symbol));
  } catch (err) {
    console.log("quote fail · " + err.message);
  }

  var keys = [];
  function addKey(k, off) {
    if (off) return;
    k = canonBar(k);
    if (k && keys.indexOf(k) < 0) keys.push(k);
  }
  addKey(state.barLeft, state.barLeftOff);
  addKey(state.barRight, state.barRightOff);

  var notes = [];
  var escDirty = false;
  if (!keys.length) notes.push("미사용");
  keys.forEach(function (key) {
    if (key === "escape") {
      if (!esc) {
        notes.push("탈출 업다운 탈출 없음");
        return;
      }
      notes.push("탈출 업다운 " + fillEscape(esc, state.market));
      escDirty = true;
      return;
    }
    var id = key === "acc2" ? "2" : "1";
    notes.push((id === "2" ? "2번 계좌" : "1번 계좌") + " " + fillBook(bookView(state, id)));
  });

  state.autoFillLast = day;
  state.rev = Date.now();
  state.barRev = Date.now();
  if (state.accounts[state.accountId || "1"]) {
    var cur = state.accounts[state.accountId || "1"];
    state.settings = cur.settings;
    state.updownTrades = cur.updownTrades;
    state.tteolTrades = cur.tteolTrades;
  }

  var files = {};
  files[STATE_FILE] = { content: JSON.stringify(state) };
  if (escDirty && esc) files[ESCAPE_FILE] = { content: JSON.stringify(esc) };

  var patch = await fetch("https://api.github.com/gists/" + gistId, {
    method: "PATCH",
    headers: Object.assign({ "Content-Type": "application/json" }, gistHeaders(token)),
    body: JSON.stringify({ files: files }),
  });
  if (!patch.ok) throw new Error("gist patch " + patch.status + " " + (await patch.text()));
  console.log("자동 기입 · " + notes.join(" / "));
}

main().catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
