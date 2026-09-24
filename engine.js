/**
 * Switch V3 계산 엔진.
 * 구글 시트 Switch / UpDown / 떨사오팔 서식을 그대로 옮긴다.
 * ROUND / ROUNDDOWN / ROUNDUP 은 Excel 규칙(0 방향 내림, 반올림은 0에서 멀어짐).
 */
(function (root) {
  "use strict";

  var SEC_RATE = 0.0000229; // 0.00229%
  var SEC_MIN = 0.01;

  function isFiniteNumber(n) {
    return typeof n === "number" && Number.isFinite(n);
  }

  function excelRound(value, digits) {
    if (!isFiniteNumber(value)) return value;
    var sign = value < 0 ? -1 : 1;
    var m = Math.pow(10, digits);
    var x = Math.abs(value) * m;
    var n = Math.floor(x + 1e-12);
    var rounded = x - n >= 0.5 - 1e-12 ? n + 1 : n;
    return (sign * rounded) / m;
  }

  function excelRoundDown(value, digits) {
    if (!isFiniteNumber(value)) return value;
    var sign = value < 0 ? -1 : 1;
    var m = Math.pow(10, digits);
    var x = Math.abs(value) * m;
    var n = Math.floor(x + 1e-10);
    return (sign * n) / m;
  }

  function excelRoundUp(value, digits) {
    if (!isFiniteNumber(value)) return value;
    var sign = value < 0 ? -1 : 1;
    var m = Math.pow(10, digits);
    var x = Math.abs(value) * m;
    var n = Math.ceil(x - 1e-10);
    return (sign * n) / m;
  }

  function quotient(a, b) {
    if (!b) return 0;
    return a >= 0 ? Math.floor(a / b + 1e-12) : Math.ceil(a / b - 1e-12);
  }

  function parseISO(iso) {
    var p = String(iso || "").split("-");
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  }

  function toISO(d) {
    return d.toISOString().slice(0, 10);
  }

  function excelSerialToISO(serial) {
    var d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    return toISO(d);
  }

  function isoToExcelSerial(iso) {
    var d = parseISO(iso);
    return Math.round((d - Date.UTC(1899, 11, 30)) / 86400000);
  }

  function dayOfMonth(iso) {
    return parseISO(iso).getUTCDate();
  }

  function networkDays(startISO, endISO) {
    if (!startISO || !endISO) return 0;
    var start = parseISO(startISO);
    var end = parseISO(endISO);
    if (end < start) return 0;
    var n = 0;
    var d = new Date(start);
    while (d <= end) {
      var day = d.getUTCDay();
      if (day !== 0 && day !== 6) n += 1;
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return n;
  }

  function sum(arr, pick) {
    var t = 0;
    for (var i = 0; i < arr.length; i++) t += pick ? pick(arr[i]) : arr[i];
    return t;
  }

  function lastOf(arr) {
    return arr.length ? arr[0] : null;
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function defaultSettings() {
    return {
      symbol: "SOXL",
      capital: 500000,
      fee: 0.00044,
      seedSplit: 20,
      rankSplit: 10,
      splitIncrease: 0.05,
      rankHoldDays: 0,
      reinvest: 1,
      seedSplitFixed: false,
      udLadderCount: 20,
      tteolLadderCount: 15,
      buyBlocked: false,
      udStepQty: 3,
      tteolStepQty: 3,
      applySheetF8Limit: false,
      autoTransfer: false,
    };
  }

  function defaultMarket() {
    return {
      price: 121.82,
      changePct: 0.0523,
      rsi: null,
      lastClose: 121.82,
      prevClose: 115.76,
      closeDate: "2026-09-11",
      tradeDate: "2026-09-11",
    };
  }

  function sortNewestFirst(trades) {
    return trades.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.seq || 0) - (a.seq || 0);
    });
  }

  function rebuildTteolRanks(tteolTrades) {
    var byRank = {};
    var oldestFirst = tteolTrades.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.seq || 0) - (b.seq || 0);
    });
    for (var i = 0; i < oldestFirst.length; i++) {
      var t = oldestFirst[i];
      if (t.type === "매수") {
        byRank[t.rank] = {
          rank: t.rank,
          buyDate: t.date,
          price: t.price,
          qty: t.qty,
          amount: t.amount,
          fee: t.fee,
          cycle: t.cycle,
        };
      } else if (t.type === "매도") {
        delete byRank[t.rank];
      }
    }
    var open = [];
    Object.keys(byRank)
      .map(Number)
      .sort(function (a, b) {
        return a - b;
      })
      .forEach(function (k) {
        open.push(byRank[k]);
      });
    return open;
  }

  function firstEmptyRank(openRanks) {
    var used = {};
    openRanks.forEach(function (r) {
      used[r.rank] = true;
    });
    for (var i = 1; i <= 40; i++) if (!used[i]) return i;
    return 41;
  }

  function buildLadder(baseQty, oneShot, stepQty, steps, basePrice) {
    var rows = [];
    if (!steps || !stepQty || !baseQty || !oneShot || !basePrice) return rows;
    var running = baseQty;
    for (var i = 0; i < steps; i++) {
      running += stepQty;
      var price = excelRoundDown(oneShot / running, 2);
      rows.push({
        qty: stepQty,
        cumQty: running,
        price: price,
        drop: price / basePrice - 1,
      });
    }
    return rows;
  }

  function seedUsedUpdown(trades, cycle) {
    return sum(trades, function (t) {
      if (t.cycle !== cycle) return 0;
      var fee = t.fee || 0;
      if (t.type === "매수" || t.type === "떨") return (t.amount || 0) + fee;
      if (t.type === "매도") return -(t.amount || 0) + fee;
      return fee;
    });
  }

  function seedUsedTteol(trades, cycle) {
    return sum(trades, function (t) {
      if (t.cycle !== cycle) return 0;
      var fee = t.fee || 0;
      if (t.type === "매수") return (t.amount || 0) + fee;
      if (t.type === "매도") return -(t.amount || 0) + fee;
      return fee;
    });
  }

  function computeLp(state, derived) {
    var m = state.market;
    var last = derived.udLast;
    if (derived.B13 === 0 || state.settings.buyBlocked) return m.lastClose;
    if (!last) return m.lastClose;
    if (last.type === "떨") {
      var found = null;
      for (var i = 0; i < state.updownTrades.length; i++) {
        var t = state.updownTrades[i];
        if (t.cycle === last.cycle && t.type !== "떨") {
          found = t;
          break;
        }
      }
      if (found) return found.price;
      return last.date < m.closeDate ? m.prevClose : m.lastClose;
    }
    return last.price;
  }

  function buyFee(price, ordered, extra, stepQty, feeRate) {
    var base = excelRoundDown(price * ordered * feeRate, 2);
    if (!extra || !stepQty) return base;
    var perStep = excelRoundDown(price * stepQty * feeRate, 2);
    return base + (extra / stepQty) * perStep;
  }

  function sellFee(amount, feeRate) {
    return excelRoundDown(amount * feeRate, 2);
  }

  function secFee(amount) {
    return Math.max(excelRoundDown(amount * SEC_RATE, 2), SEC_MIN);
  }

  function pnlNumber(t) {
    var n = Number(t && t.pnl);
    return t && t.pnl != null && t.pnl !== "" && isFiniteNumber(n) ? n : 0;
  }

  function tteolBuyCost(buy) {
    if (!buy) return 0;
    if (buy.amount != null && buy.amount !== "" && isFiniteNumber(Number(buy.amount))) return Number(buy.amount);
    return (Number(buy.price) || 0) * (Number(buy.qty) || 0);
  }

  function repairTteolPnls(trades) {
    var repaired = false;
    var byRank = {};
    var oldestFirst = (trades || []).slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.seq || 0) - (b.seq || 0);
    });
    for (var i = 0; i < oldestFirst.length; i++) {
      var t = oldestFirst[i];
      if (t.type === "매수") {
        byRank[t.rank] = t;
      } else if (t.type === "매도") {
        if (!(t.pnl != null && t.pnl !== "" && isFiniteNumber(Number(t.pnl)))) {
          var buy = byRank[t.rank];
          if (buy) {
            var amount = t.amount != null && t.amount !== "" ? Number(t.amount) : Number(t.price) * Number(t.qty);
            var fee = Number(t.fee) || 0;
            t.pnl = amount - tteolBuyCost(buy) - ((Number(buy.fee) || 0) + fee + secFee(amount));
            repaired = true;
          }
        }
        delete byRank[t.rank];
      }
    }
    return repaired;
  }

  function compute(state, opts) {
    var s = state.settings;
    var m = state.market;
    var ud = sortNewestFirst(state.updownTrades || []);
    var tt = sortNewestFirst(state.tteolTrades || []);
    var repairedTt = repairTteolPnls(tt);
    state.updownTrades = ud;
    state.tteolTrades = tt;

    var openRanks = rebuildTteolRanks(tt);
    var udLast = lastOf(ud);
    var ttLast = lastOf(tt);

    var B13 =
      !udLast || udLast.pot == null || udLast.pot === ""
        ? 0
        : udLast.type === "매수" || udLast.type === "떨"
          ? udLast.pot
          : udLast.pot - 1;
    var C13 = !udLast || udLast.holdQty == null || udLast.holdQty === "" ? 0 : udLast.holdQty;
    var H13 = openRanks.length;
    var I13 = sum(openRanks, function (r) {
      return r.qty || 0;
    });
    var F8 = B13 + H13;

    var udCycle = udLast && udLast.cycle != null ? udLast.cycle : 0;
    var ttCycle = ttLast && ttLast.cycle != null ? ttLast.cycle : 0;
    var B8 = F8 === 0 ? Math.max(udCycle, ttCycle) + 1 : Math.max(udCycle, ttCycle);

    var D13 = sum(ud, function (t) {
      return t.cycle === B8 ? pnlNumber(t) : 0;
    });
    var J13 = sum(tt, function (t) {
      return t.cycle === B8 ? pnlNumber(t) : 0;
    });
    var K13 = 0 + J13;

    var K3 =
      sum(ud, function (t) {
        return pnlNumber(t);
      }) +
      sum(tt, function (t) {
        return pnlNumber(t);
      });
    var L3 = s.capital ? K3 / s.capital : 0;
    var I3 = (B13 === 0 ? K3 : K3 - D13 - J13) * s.reinvest;

    var J3;
    if (s.seedSplitFixed || !s.splitIncrease) {
      J3 = s.seedSplit;
    } else {
      var splitAdd = !s.capital ? 0 : excelRoundDown(I3 / s.capital / s.splitIncrease, 0) / 10;
      var split = s.seedSplit + splitAdd;
      J3 = split <= s.seedSplit + 5 ? split : s.seedSplit + 5;
    }

    var C8 = s.capital + I3;
    var E16 = seedUsedUpdown(ud, B8);
    var K16 = seedUsedTteol(tt, B8);
    var D8 = C8 - E16 - K16;
    var E8 = C8 ? 1 - D8 / C8 : 0;
    var G8 = C13 + I13;
    var H8 = D13 + J13;
    var I8 = C8 ? H8 / C8 : 0;

    var avg = udLast && udLast.avg != null ? udLast.avg : 0;
    var E13 = (m.price - avg) * C13 + D13;
    var F13 = C8 ? E13 / C8 : 0;
    var L13 = C8 ? K13 / C8 : 0;

    var I16;
    if (!s.splitIncrease) I16 = s.rankSplit;
    else if (s.rankSplit === true) I16 = 0;
    else {
      var rAdd = !s.capital ? 0 : excelRoundDown(I3 / s.capital / s.splitIncrease, 0) / 10;
      var rSplit = s.rankSplit + rAdd;
      I16 = rSplit <= s.rankSplit + 5 ? rSplit : s.rankSplit + 5;
    }

    var D16 = excelRoundDown(J3 ? C8 / J3 : 0, 2);
    var profitForReinvest = E13 + K13 < 0 ? 0 : E13 + K13;
    var J16raw = !I16 ? D16 : D16 + (profitForReinvest * s.reinvest) / I16;
    var J16 = Math.min(J16raw, D8 - D16);
    var F16 = E16 + K16 ? E16 / (E16 + K16) : 0;
    var L16 = E16 + K16 ? K16 / (E16 + K16) : 0;

    var derived = { B13: B13, C13: C13, H13: H13, F8: F8, udLast: udLast, openRanks: openRanks };
    var D19 = computeLp(state, derived);

    var C19 = F8 === 0 ? excelRound(D19 * 1.1, 2) : excelRound(D19 * (1 - 0.002 * (20 / J3) * F8), 2);
    var B19 = C19 ? excelRoundDown(D16 / C19, 0) : 0;
    var E19 = B13 ? excelRoundDown(C13 / B13, 0) : "";
    var F19 = C13 === 0 ? "" : D19;

    var sheetF8Blocks = s.applySheetF8Limit && F8 >= J3 - 1;
    var I19 = sheetF8Blocks ? "" : excelRound(m.lastClose - 0.01, 2);
    var H19 = I19 === "" ? "" : excelRoundDown(J16 / I19, 0);

    var udLadder = buildLadder(B19, D16, s.udStepQty, s.udLadderCount, C19);
    var ttLadder = I19 === "" ? [] : buildLadder(H19, J16, s.tteolStepQty, s.tteolLadderCount, I19);

    var ttCost = 0;
    for (var ti = 0; ti < openRanks.length; ti++) {
      var tr = openRanks[ti];
      ttCost += tr.amount != null && tr.amount !== "" ? Number(tr.amount) : Number(tr.price) * Number(tr.qty);
    }
    var udCost = (avg || 0) * (C13 || 0);
    var holdQty = (C13 || 0) + (I13 || 0);
    var combAvg = holdQty ? (udCost + ttCost) / holdQty : 0;
    var mark = Number(m.price);
    var udEval = C13 ? (mark - avg) * C13 : 0;
    var udEvalPct = avg && C13 ? mark / avg - 1 : "";
    var ttAvg = I13 ? ttCost / I13 : 0;
    var ttEval = I13 ? (mark - ttAvg) * I13 : 0;
    var ttEvalPct = ttAvg ? mark / ttAvg - 1 : "";

    var sellTargets = openRanks
      .map(function (r) {
        var sellPrice = excelRound(r.price * (1 + (r.sellRate || 0)), 2);
        return {
          rank: r.rank,
          buyDate: r.buyDate,
          holdDays: networkDays(r.buyDate, m.tradeDate || m.closeDate),
          price: r.price,
          qty: r.qty,
          sellPrice: sellPrice,
        };
      })
      .filter(function (r) {
        return r.sellPrice != null;
      })
      .sort(function (a, b) {
        return a.sellPrice - b.sellPrice;
      });

    var remainRank = "";
    if (B13 === 0 || B8 !== (ttLast && ttLast.cycle)) {
      if (openRanks.length) remainRank = openRanks[0].rank;
    }
    var overRank = "";
    if (s.rankHoldDays) {
      for (var ri = 0; ri < openRanks.length; ri++) {
        var hd = networkDays(openRanks[ri].buyDate, m.tradeDate || m.closeDate);
        if (hd > s.rankHoldDays) {
          overRank = openRanks[ri].rank;
          break;
        }
      }
    }
    var C54 = "";
    if (remainRank === "" && overRank === "") C54 = "";
    else if (overRank === "") C54 = remainRank;
    else if (remainRank === "") C54 = overRank;
    else C54 = Math.min(remainRank, overRank);

    var suggestedUd = { type: "" };
    var suggestedTt = { type: "" };
    if (!(opts && opts.skipSuggest)) {
      suggestedUd = suggestFromPending(state, "ud");
      suggestedTt = suggestFromPending(state, "tteol");
    }

    return {
      I3: I3,
      J3: J3,
      K3: K3,
      L3: L3,
      B8: B8,
      C8: C8,
      D8: D8,
      E8: E8,
      F8: F8,
      G8: G8,
      H8: H8,
      I8: I8,
      B13: B13,
      C13: C13,
      D13: D13,
      E13: E13,
      F13: F13,
      H13: H13,
      I13: I13,
      J13: J13,
      K13: K13,
      L13: L13,
      D16: D16,
      E16: E16,
      F16: F16,
      I16: I16,
      J16: J16,
      K16: K16,
      L16: L16,
      B19: B19,
      C19: C19,
      D19: D19,
      E19: E19,
      F19: F19,
      H19: H19,
      I19: I19,
      avg: avg,
      combAvg: combAvg,
      holdQty: holdQty,
      udEval: udEval,
      udEvalPct: udEvalPct,
      ttAvg: ttAvg,
      ttEval: ttEval,
      ttEvalPct: ttEvalPct,
      udLadder: udLadder,
      ttLadder: ttLadder,
      openRanks: openRanks.map(function (r) {
        return {
          rank: r.rank,
          buyDate: r.buyDate,
          holdDays: networkDays(r.buyDate, m.tradeDate || m.closeDate),
          price: r.price,
          qty: r.qty,
          amount: r.amount,
          fee: r.fee,
          sellPrice: excelRound(r.price * (1 + (r.sellRate || 0)), 2),
          sellRate: r.sellRate || 0,
        };
      }),
      C54: C54,
      sellTargets: sellTargets,
      suggestedUd: suggestedUd,
      suggestedTt: suggestedTt,
      udLast: udLast,
      ttLast: ttLast,
      repairedTt: repairedTt,
    };
  }

  function hasTradeOn(trades, date) {
    return (trades || []).some(function (t) {
      return t.date === date;
    });
  }

  function previousTradingDate(iso) {
    if (!iso) return "";
    var d = parseISO(iso);
    d.setUTCDate(d.getUTCDate() - 1);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
      d.setUTCDate(d.getUTCDate() - 1);
    }
    return toISO(d);
  }

  function nextTradingDate(iso) {
    if (!iso) return "";
    var d = parseISO(iso);
    d.setUTCDate(d.getUTCDate() + 1);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return toISO(d);
  }

  function closePriceMap(m) {
    var map = {};
    function put(date, px) {
      px = Number(px);
      if (date && isFiniteNumber(px) && px > 0) map[date] = px;
    }
    (m.closeHistory || []).forEach(function (h) {
      put(h.date, h.close);
    });
    put(m.closeDate, m.lastClose);
    var prevDate = m.prevCloseDate || (m.closeDate ? previousTradingDate(m.closeDate) : "");
    put(prevDate, m.prevClose);
    return map;
  }

  function pendingFillSession(state, which, afterDate) {
    var m = state.market || {};
    var trades = which === "tteol" ? state.tteolTrades : state.updownTrades;
    var last = lastOf(sortNewestFirst(trades || []));
    var closeDate = m.closeDate || "";
    if (!closeDate) return null;
    var prices = closePriceMap(m);
    var cursor = afterDate
      ? nextTradingDate(afterDate)
      : last && last.date
        ? nextTradingDate(last.date)
        : closeDate;
    if (!cursor || cursor > closeDate) return null;
    var guard = 0;
    while (cursor && cursor <= closeDate && guard++ < 40) {
      if (!hasTradeOn(trades, cursor) && prices[cursor]) {
        var prevD = previousTradingDate(cursor);
        var prevPx = prices[prevD];
        if (!(isFiniteNumber(prevPx) && prevPx > 0)) {
          if (cursor === closeDate) prevPx = Number(m.prevClose);
          else if (last && last.date === prevD && last.price) prevPx = Number(last.price);
          else prevPx = Number(m.prevPrevClose);
        }
        if (!(isFiniteNumber(prevPx) && prevPx > 0) && isFiniteNumber(Number(m.prevClose)) && Number(m.prevClose) > 0) {
          prevPx = Number(m.prevClose);
        }
        if (!(isFiniteNumber(prevPx) && prevPx > 0)) prevPx = prices[cursor];
        return {
          date: cursor,
          lastClose: prices[cursor],
          prevClose: prevPx,
          isPast: cursor !== closeDate,
        };
      }
      cursor = nextTradingDate(cursor);
    }
    return null;
  }

  function suggestFromPending(state, which) {
    var after = "";
    var lastEmpty = null;
    for (var n = 0; n < 40; n++) {
      var session = pendingFillSession(state, which, after);
      if (!session) break;
      if (!session.isPast && state.market.phase === "REG_MKT") {
        return { type: "", reason: "정규장 마감 전" };
      }
      var virt = clone(state);
      virt.market = Object.assign({}, state.market, {
        closeDate: session.date,
        tradeDate: session.date,
        lastClose: session.lastClose,
        prevClose: session.prevClose,
        phase: "POST_MKT",
      });
      if (which === "tteol") {
        virt.updownTrades = (virt.updownTrades || []).filter(function (t) {
          return t.date !== session.date;
        });
      }
      var d = compute(virt, { skipSuggest: true });
      var sug = which === "tteol" ? suggestTteol(virt, d) : suggestUpdown(virt, d);
      if (sug && sug.type) {
        sug.date = session.date;
        return sug;
      }
      lastEmpty = sug;
      after = session.date;
    }
    if (lastEmpty) return lastEmpty;
    var trades = which === "tteol" ? state.tteolTrades : state.updownTrades;
    var last = lastOf(sortNewestFirst(trades || []));
    if (last && last.date === (state.market && state.market.closeDate)) {
      return { type: "", reason: which === "tteol" ? "당일 떨 체결 있음" : "당일 업다운 체결 있음" };
    }
    return { type: "", reason: "체결 없음" };
  }

  function suggestUpdown(state, d) {
    var m = state.market;
    var s = state.settings;
    if (d.udLast && d.udLast.date === m.closeDate) {
      return { type: "", reason: "당일 업다운 체결 있음" };
    }
    var type = "";
    if (d.B13 === 0) {
      if (m.lastClose <= m.prevClose * 1.1) type = "매수";
    } else if (s.buyBlocked) {
      if (m.lastClose >= (d.F19 || m.lastClose)) type = "매도";
    } else {
      if (m.lastClose <= d.C19) type = "매수";
      else if (d.F19 !== "" && m.lastClose >= d.F19) type = "매도";
    }
    if (!type) return { type: "", reason: "밴드 밖 (미체결)" };

    var pot;
    if (type === "매수") {
      if (!d.udLast) pot = 1;
      else if (d.udLast.type === "매수" || d.udLast.type === "떨") pot = d.udLast.pot + 1;
      else pot = d.udLast.pot;
    } else {
      if (d.udLast.type === "매수" || d.udLast.type === "떨") pot = d.udLast.pot;
      else pot = d.udLast.pot - 1;
    }

    var fill = m.lastClose;
    var qty;
    var ordered;
    if (type === "매도") {
      qty = d.E19 || 0;
      ordered = qty;
    } else {
      var available = excelRoundDown(d.D16 / fill, 0);
      if (d.B13 === 0) ordered = excelRoundDown(d.D16 / (m.prevClose * 1.1), 0);
      else if (s.buyBlocked) ordered = excelRoundDown(d.D16 / m.prevClose, 0);
      else ordered = d.B19;
      qty = ordered + s.udStepQty * Math.min(quotient(available - ordered, s.udStepQty), s.udLadderCount);
    }

    var amount = fill * qty;
    var fee =
      type === "매도"
        ? sellFee(amount, s.fee)
        : buyFee(fill, ordered, qty - ordered, s.udStepQty, s.fee);
    var prevHold = d.C13;
    var prevCost = d.udLast ? d.udLast.cost || 0 : 0;
    var prevAvg = d.udLast ? d.udLast.avg || 0 : 0;
    var hold = type === "매수" ? prevHold + qty : prevHold - qty;
    var cost = type === "매수" ? prevCost + amount : prevAvg * hold;
    var avg = type === "매수" ? (hold ? cost / hold : 0) : prevAvg;
    var sec = type === "매도" ? secFee(amount) : 0;
    var buySideFee = type === "매도" ? excelRoundUp(prevAvg * qty * s.fee, 2) : 0;
    var pnl = type === "매수" ? "" : amount - qty * avg - (fee + buySideFee + sec);
    var cycle = prevHold === 0 && type === "매수" ? (d.udLast ? d.udLast.cycle + 1 : 1) : d.udLast ? d.udLast.cycle : 1;
    if (type === "매수" && prevHold === 0 && d.udLast && d.udLast.holdQty === 0) {
      cycle = d.udLast.cycle + 1;
    }

    return {
      type: type,
      pot: pot,
      price: fill,
      qty: qty,
      ordered: ordered,
      stepShares: type === "매수" ? Math.max(0, qty - ordered) : 0,
      amount: amount,
      fee: fee,
      holdQty: hold,
      cost: cost,
      avg: avg,
      pnl: pnl,
      cycle: cycle,
      sec: sec,
    };
  }

  function suggestTteol(state, d) {
    var m = state.market;
    var s = state.settings;
    if (s.buyBlocked) return { type: "", reason: "C16 매수 불가" };
    if (d.ttLast && d.ttLast.date === m.closeDate && d.ttLast.type === "매수") {
      /* 당일 매수 있으면 같은 날 그 랭크 매도만 금지. 다른 랭크 매도는 가능 */
    }

    var type = "";
    var rank = "";
    if (m.lastClose <= m.prevClose - 0.01) {
      if (d.ttLast && d.ttLast.date === m.closeDate) {
        return { type: "", reason: "당일 떨 체결 있음" };
      }
      if (s.applySheetF8Limit && d.F8 >= d.J3 - 1) {
        if (!(d.udLast && d.udLast.date === m.closeDate)) {
          return { type: "", reason: "시트 F8≥J3−1 제한" };
        }
      }
      type = "매수";
      rank = firstEmptyRank(d.openRanks);
    } else {
      var hit = null;
      for (var i = 0; i < d.sellTargets.length; i++) {
        if (d.sellTargets[i].sellPrice <= m.lastClose) {
          hit = d.sellTargets[i];
          break;
        }
      }
      if (!hit) return { type: "", reason: "하락 아님 · 매도 지정 미도달" };
      if (dayOfMonth(hit.buyDate) === dayOfMonth(m.closeDate)) {
        return { type: "", reason: "당일 매수 랭크는 당일 매도 없음" };
      }
      type = "매도";
      rank = hit.rank;
    }

    var fill = m.lastClose;
    var qty;
    var ordered;
    var amount;
    var fee;
    if (type === "매도") {
      var pos = d.openRanks.filter(function (r) {
        return r.rank === rank;
      })[0];
      qty = pos.qty;
      amount = fill * qty;
      fee = sellFee(amount, s.fee);
      var sec = secFee(amount);
      var buyCost =
        pos.amount != null && pos.amount !== "" && isFiniteNumber(Number(pos.amount))
          ? Number(pos.amount)
          : Number(pos.price) * Number(pos.qty);
      var posBuyFee = Number(pos.fee) || 0;
      var pnl = amount - buyCost - (posBuyFee + fee + sec);
      var cycle = ttLastCycle(d);
      return {
        type: type,
        rank: rank,
        price: fill,
        qty: qty,
        ordered: qty,
        stepShares: 0,
        amount: amount,
        fee: fee,
        pnl: pnl,
        cycle: cycle,
        sec: sec,
      };
    }

    var available = excelRoundDown(d.J16 / fill, 0);
    ordered = excelRoundDown(d.J16 / (m.prevClose - 0.01), 0);
    qty = ordered + s.tteolStepQty * Math.min(quotient(available - ordered, s.tteolStepQty), s.tteolLadderCount);
    amount = fill * qty;
    fee = buyFee(fill, ordered, qty - ordered, s.tteolStepQty, s.fee);
    return {
      type: type,
      rank: rank,
      price: fill,
      qty: qty,
      ordered: ordered,
      stepShares: Math.max(0, qty - ordered),
      amount: amount,
      fee: fee,
      pnl: "",
      cycle: ttNewCycleOnBuy(d),
      sec: 0,
    };
  }

  function ttLastCycle(d) {
    return d.ttLast && d.ttLast.cycle != null ? d.ttLast.cycle : d.B8 || 1;
  }

  function ttNewCycleOnBuy(d) {
    if (!d.openRanks.length) {
      if (d.B13 === 0) return (d.ttLast && d.ttLast.cycle ? d.ttLast.cycle : 0) + 1;
      if (d.ttLast && d.ttLast.cycle === d.B8) return d.ttLast.cycle;
      return d.B8;
    }
    return d.ttLast && d.ttLast.cycle != null ? d.ttLast.cycle : d.B8;
  }

  function nextSeq(trades, date) {
    var max = 0;
    trades.forEach(function (t) {
      if (t.date === date && (t.seq || 0) > max) max = t.seq;
    });
    return max + 1;
  }

  function applySuggested(state, which) {
    var out = compute(state);
    var sug = which === "tteol" ? out.suggestedTt : out.suggestedUd;
    if (!sug || !sug.type) return { ok: false, reason: sug && sug.reason ? sug.reason : "체결 없음" };

    var fillDate = sug.date || state.market.closeDate;
    if (which === "tteol") {
      state.tteolTrades.unshift({
        date: fillDate,
        seq: nextSeq(state.tteolTrades, fillDate),
        type: sug.type,
        rank: sug.rank,
        price: sug.price,
        qty: sug.qty,
        amount: sug.amount,
        fee: sug.fee,
        pnl: sug.pnl,
        cycle: sug.cycle,
      });
    } else {
      state.updownTrades.unshift({
        date: fillDate,
        seq: nextSeq(state.updownTrades, fillDate),
        type: sug.type,
        pot: sug.pot,
        price: sug.price,
        qty: sug.qty,
        amount: sug.amount,
        fee: sug.fee,
        holdQty: sug.holdQty,
        cost: sug.cost,
        avg: sug.avg,
        pnl: sug.pnl,
        cycle: sug.cycle,
      });
    }
    return { ok: true, trade: sug };
  }

  function transferOneRank(state) {
    var out = compute(state);
    if (out.C54 === "" || out.C54 == null) return { ok: false, reason: "이관할 랭크 없음" };
    var rank = out.C54;
    var pos = out.openRanks.filter(function (r) {
      return r.rank === rank;
    })[0];
    if (!pos) return { ok: false, reason: "랭크 포지션 없음" };

    var date = state.market.closeDate;
    var udLast = out.udLast;
    var prevHold = out.C13;
    var newCycle = prevHold === 0 ? (udLast ? udLast.cycle + 1 : 1) : udLast.cycle;
    var pot = 1;
    var hold = pos.qty;
    var cost = pos.price * pos.qty;
    var avg = pos.price;

    state.updownTrades.unshift({
      date: date,
      seq: nextSeq(state.updownTrades, date),
      type: "떨",
      pot: pot,
      price: pos.price,
      qty: pos.qty,
      amount: cost,
      fee: pos.fee || excelRoundDown(cost * state.settings.fee, 2),
      holdQty: hold,
      cost: cost,
      avg: avg,
      pnl: "",
      cycle: newCycle,
    });

    state.tteolTrades.unshift({
      date: date,
      seq: nextSeq(state.tteolTrades, date),
      type: "매도",
      rank: rank,
      price: pos.price,
      qty: pos.qty,
      amount: cost,
      fee: -(pos.fee || excelRoundDown(cost * state.settings.fee, 2)),
      pnl: "",
      cycle: pos.cycle || (out.ttLast && out.ttLast.cycle) || newCycle,
    });

    return { ok: true, rank: rank };
  }

  function liquidateAll(state, input) {
    var date = input && input.date ? input.date : state.market.closeDate;
    var price = input && input.price != null ? Number(input.price) : 0;
    if (!price || price <= 0) return { ok: false, reason: "청산 단가를 넣으세요" };

    var out = compute(state);
    var openRanks = out.openRanks || [];
    if (!out.C13 && !openRanks.length) return { ok: false, reason: "청산할 보유가 없습니다" };

    var s = state.settings;
    var cycle = out.udLast && out.udLast.cycle ? out.udLast.cycle : out.B8 || 1;
    var avg = out.udLast && out.udLast.avg ? out.udLast.avg : 0;
    var closedRanks = 0;
    var rankQty = 0;

    openRanks.forEach(function (pos) {
      var qty = pos.qty;
      rankQty += qty;
      var amount = price * qty;
      var fee = sellFee(amount, s.fee);
      var sec = secFee(amount);
      var pnl = amount - pos.price * qty - ((pos.fee || 0) + fee + sec);
      state.tteolTrades.unshift({
        date: date,
        seq: nextSeq(state.tteolTrades, date),
        type: "매도",
        rank: pos.rank,
        price: price,
        qty: qty,
        amount: amount,
        fee: fee,
        pnl: pnl,
        cycle: pos.cycle || (out.ttLast && out.ttLast.cycle) || cycle,
      });
      closedRanks += 1;
    });

    var udQty = out.C13;
    if (!udQty) udQty = input && input.qty ? input.qty : rankQty;
    var amount = price * udQty;
    var fee = sellFee(amount, s.fee);
    var pnl = "";
    if (out.C13) {
      var soldAmount = price * out.C13;
      var soldFee = sellFee(soldAmount, s.fee);
      var soldSec = secFee(soldAmount);
      var buySideFee = excelRoundUp(avg * out.C13 * s.fee, 2);
      pnl = soldAmount - out.C13 * avg - (soldFee + buySideFee + soldSec);
      udQty = out.C13;
      amount = soldAmount;
      fee = soldFee;
    }

    state.updownTrades.unshift({
      date: date,
      seq: nextSeq(state.updownTrades, date),
      type: "매도",
      pot: 1,
      price: price,
      qty: udQty,
      amount: amount,
      fee: fee,
      holdQty: 0,
      cost: 0,
      avg: avg,
      pnl: pnl,
      cycle: cycle,
    });

    return { ok: true, qty: udQty, ranks: closedRanks };
  }

  function applyPreset(settings, name) {
    var next = Object.assign({}, settings);
    if (name === "simple") {
      next.seedSplit = 15;
      next.rankSplit = 0;
      next.splitIncrease = 0;
      next.reinvest = 0;
      next.seedSplitFixed = true;
    } else if (name === "compoundNew") {
      next.seedSplit = 15;
      next.rankSplit = 8;
      next.splitIncrease = 0;
      next.reinvest = 1;
      next.seedSplitFixed = true;
    } else if (name === "compoundOld") {
      next.seedSplit = 15;
      next.rankSplit = 8;
      next.splitIncrease = 0.05;
      next.reinvest = 1;
      next.seedSplitFixed = false;
    } else if (name === "min") {
      next.seedSplit = 20;
      next.rankSplit = 10;
      next.splitIncrease = 0.05;
      next.reinvest = 1;
      next.seedSplitFixed = false;
    }
    return next;
  }

  var api = {
    SEC_RATE: SEC_RATE,
    excelRound: excelRound,
    excelRoundDown: excelRoundDown,
    excelRoundUp: excelRoundUp,
    excelSerialToISO: excelSerialToISO,
    isoToExcelSerial: isoToExcelSerial,
    networkDays: networkDays,
    defaultSettings: defaultSettings,
    defaultMarket: defaultMarket,
    compute: compute,
    previousTradingDate: previousTradingDate,
    nextTradingDate: nextTradingDate,
    applySuggested: applySuggested,
    transferOneRank: transferOneRank,
    liquidateAll: liquidateAll,
    applyPreset: applyPreset,
    rebuildTteolRanks: rebuildTteolRanks,
    clone: clone,
    seedUsedUpdown: seedUsedUpdown,
    seedUsedTteol: seedUsedTteol,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SwitchEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
