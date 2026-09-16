(function () {
  "use strict";

  var E = window.SwitchEngine;
  var S = window.SwitchSeed;
  var KEY = "switch-v3-state";
  var SYNC_KEY = "switch-v3-sync";
  var state = loadState();
  var tab = "home";
  var statsMode = "month";
  var statsYear = 2026;
  var pushTimer = null;
  var syncing = false;

  function loadState() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.settings && parsed.updownTrades) return parsed;
      }
    } catch (e) {}
    return S.sheetSnapshot();
  }

  function saveState() {
    localStorage.setItem(KEY, JSON.stringify(state));
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
    return {
      description: "Switch SOXL device sync",
      public: false,
      files: {
        "switch-v3-state.json": { content: JSON.stringify(state) },
      },
    };
  }

  function applyRemoteState(remote) {
    if (!remote || !remote.settings || !remote.updownTrades) return false;
    var live = state.market || {};
    state = remote;
    if (!state.market) state.market = {};
    if (live.price) state.market.price = live.price;
    if (live.changePct != null) state.market.changePct = live.changePct;
    if (live.phase) state.market.phase = live.phase;
    saveState();
    return true;
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

  function pullRemote() {
    var cfg = loadSyncCfg();
    if (!cfg.token || !cfg.gistId || syncing) return Promise.resolve(false);
    syncing = true;
    return fetch("https://api.github.com/gists/" + cfg.gistId, { headers: gistHeaders(cfg.token) }).then(readGistResponse)
      .then(function (gist) {
        var file = gist.files && gist.files["switch-v3-state.json"];
        if (!file || !file.content) return false;
        var remote = JSON.parse(file.content);
        var remoteRev = Number(remote.rev) || 0;
        var localRev = Number(state.rev) || 0;
        if (remoteRev <= localRev) return false;
        return applyRemoteState(remote);
      })
      .then(function (changed) {
        syncing = false;
        if (changed) render();
        return changed;
      })
      .catch(function (err) {
        syncing = false;
        throw err;
      });
  }

  function pushRemote() {
    var cfg = loadSyncCfg();
    if (!cfg.token || !cfg.gistId || syncing) return Promise.resolve();
    syncing = true;
    return fetch("https://api.github.com/gists/" + cfg.gistId, {
      method: "PATCH",
      headers: gistHeaders(cfg.token),
      body: JSON.stringify(gistBody()),
    })
      .then(readGistResponse)
      .then(function () {
        syncing = false;
      })
      .catch(function (err) {
        syncing = false;
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
          if (!changed) schedulePush();
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

  function pct(n) {
    if (n === "" || n == null || Number.isNaN(n)) return "";
    return (Number(n) * 100).toFixed(2) + "%";
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

  var TABS = { home: 1, orders: 1, journal: 1, stats: 1, settings: 1 };

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
    if (!(opts && opts.keepRev)) state.rev = Date.now();
    saveState();
    render();
    if (!(opts && opts.sync === false)) schedulePush();
  }

  function render() {
    var out = E.compute(state);
    if (out.repairedTt) saveState();
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
    var pnl = document.getElementById("home-pnl");
    if (pnl) {
      pnl.textContent = (out.K3 >= 0 ? "+" : "") + money(out.K3);
      pnl.className = "hero-pnl " + (out.K3 >= 0 ? "pos" : "neg");
    }
    var sym = document.getElementById("set-symbol-label");
    if (sym) sym.textContent = s.symbol;

    document.getElementById("hero-ud-buy-px").textContent = money(out.C19);
    document.getElementById("hero-ud-buy-qty").textContent = out.B19;
    document.getElementById("hero-ud-sell-px").textContent = out.F19 === "" ? "없음" : money(out.F19);
    document.getElementById("hero-ud-sell-qty").textContent = out.E19 === "" ? "" : out.E19;
    document.getElementById("hero-tt-buy-px").textContent = out.I19 === "" ? "없음" : money(out.I19);
    document.getElementById("hero-tt-buy-qty").textContent = out.H19 === "" ? "" : out.H19;
    document.getElementById("hero-tt-sell").textContent = out.openRanks.length
      ? out.openRanks
          .map(function (r) {
            return "#" + r.rank + " " + money(r.sellPrice);
          })
          .join(" · ")
      : "보유 랭크 없음";

    document.getElementById("hero-ud-buy-px").className = "v buy";
    document.getElementById("hero-ud-sell-px").className = out.F19 === "" ? "v empty" : "v sell";
    document.getElementById("hero-tt-buy-px").className = out.I19 === "" ? "v empty" : "v buy";

    document.getElementById("set-symbol").value = s.symbol;
    document.getElementById("set-capital").value = s.capital;
    document.getElementById("set-fee").value = s.fee;
    document.getElementById("set-seed").value = s.seedSplit;
    document.getElementById("set-rank").value = s.rankSplit;
    document.getElementById("set-inc").value = s.splitIncrease;
    document.getElementById("set-hold").value = s.rankHoldDays;
    document.getElementById("set-reinvest").value = s.reinvest;
    document.getElementById("set-fixed").checked = !!s.seedSplitFixed;
    document.getElementById("set-blocked").checked = !!s.buyBlocked;
    document.getElementById("set-f8").checked = !!s.applySheetF8Limit;
    document.getElementById("set-auto").checked = !!s.autoTransfer;
    document.getElementById("set-ud-steps").value = s.udLadderCount;
    document.getElementById("set-tt-steps").value = s.tteolLadderCount;
    document.getElementById("set-ud-qty").value = s.udStepQty;
    document.getElementById("set-tt-qty").value = s.tteolStepQty;
    fillText("v-ud-orders", s.udLadderCount);
    fillText("v-ud-step", s.udStepQty);
    fillText("v-tt-orders", s.tteolLadderCount);
    fillText("v-tt-step", s.tteolStepQty);

    fillText("live-price", money(m.price));
    var chgEl = document.getElementById("live-chg");
    if (chgEl) {
      chgEl.textContent = pct(m.changePct);
      chgEl.className = "hero-quote " + (m.changePct > 0 ? "pos" : m.changePct < 0 ? "neg" : "");
    }
    fillText("v-I3", money(out.I3));
    fillText("v-J3", out.J3);
    fillText("v-K3", money(out.K3));
    fillText("v-L3", pct(out.L3));
    fillText("v-B8", out.B8);
    fillText("v-C8", money(out.C8));
    fillText("v-D8", money(out.D8));
    fillText("v-E8", pct(out.E8));
    fillText("v-F8", out.F8);
    fillText("v-G8", out.G8);
    fillText("v-H8", money(out.H8));
    fillText("v-I8", pct(out.I8));
    fillText("v-B13", out.B13);
    fillText("v-C13", out.C13);
    fillText("v-D13", money(out.D13));
    fillText("v-E13", money(out.E13));
    fillText("v-F13", pct(out.F13));
    fillText("v-H13", out.H13);
    fillText("v-I13", out.I13);
    fillText("v-J13", money(out.J13));
    fillText("v-K13", money(out.K13));
    fillText("v-L13", pct(out.L13));
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
    renderSyncUi();

    renderLadder("ud-ladder", out.udLadder, "ud", out);
    renderLadder("tt-ladder", out.ttLadder, "tt", out);
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

  function renderStats(out) {
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
    if (pp) {
      pp.textContent = (periodPnl >= 0 ? "+" : "") + money(periodPnl);
      pp.className = "hero-quote " + (periodPnl > 0 ? "pos" : periodPnl < 0 ? "neg" : "");
    }
    fillText("st-period-ret", "수익률 " + pct(cap ? periodPnl / cap : 0));

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
        var cls = it.pnl > 0 ? "buy" : it.pnl < 0 ? "sell" : "empty";
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
      (label === "매도" ? "sell" : label === "매수" ? "buy" : "step") +
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
    } else {
      var ttSell = out.openRanks.length
        ? out.openRanks
            .map(function (r) {
              return "#" + r.rank + " " + money(r.sellPrice);
            })
            .join(" · ")
        : "";
      html += ladderRow("매도", "sell", ttSell, ttSell ? "sell" : "empty", "", "", "");
    }
    tb.innerHTML = html;
  }

  function renderSuggested(out) {
    var ud = out.suggestedUd || {};
    var tt = out.suggestedTt || {};
    var date = state.market.closeDate;
    document.getElementById("btn-fill-ud").disabled = !ud.type;
    document.getElementById("btn-fill-tt").disabled = !tt.type;
    document.getElementById("sug-ud").innerHTML = sugHtml("업다운", ud, ud.date || date);
    document.getElementById("sug-tt").innerHTML = sugHtml("떨사오팔", tt, tt.date || date);
    var canMove = out.C54 !== "" && out.C54 != null;
    document.getElementById("v-C54").textContent = canMove ? "랭크 " + out.C54 : "";
    document.getElementById("v-B54").textContent = canMove ? state.market.closeDate : "";
    document.getElementById("btn-transfer").disabled = !canMove;
  }

  function sugHtml(title, sug, date) {
    if (!sug.type) {
      return "<div class='note'>" + title + " 제안 없음. " + (sug.reason || "") + "</div>";
    }
    var who = sug.pot != null ? "포트 " + sug.pot : "랭크 " + sug.rank;
    return (
      "<div class='loc-data'>" +
      "<div class='loc-data-top'><strong>" +
      sug.type +
      "</strong><span>" +
      date +
      "</span></div>" +
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
    var html = "";
    for (var i = 1; i <= 20; i++) {
      var r = out.openRanks.filter(function (x) {
        return x.rank === i;
      })[0];
      html +=
        "<tr><td>" +
        i +
        "</td><td>" +
        (r ? r.buyDate : "") +
        "</td><td>" +
        (r ? r.holdDays : "") +
        "</td><td>" +
        (r ? money(r.price) : "") +
        "</td><td>" +
        (r ? r.qty : "") +
        "</td><td class='sell'>" +
        (r ? money(r.sellPrice) : "") +
        "</td></tr>";
    }
    document.getElementById("rank-body").innerHTML = html;
  }

  function logPnlView(t) {
    var n = Number(t.pnl);
    var hasPnl = t.type === "매도" && t.pnl !== "" && t.pnl != null && Number.isFinite(n);
    if (hasPnl) {
      return {
        kind: "손익",
        text: (n >= 0 ? "+" : "") + money(n),
        cls: n >= 0 ? "pos" : "neg",
      };
    }
    return { kind: "금액", text: money(t.amount), cls: "" };
  }

  function renderUdLog() {
    var html = state.updownTrades
      .map(function (t, idx) {
        var view = logPnlView(t);
        return (
          "<article class='log-card'><header><div><strong>SOXL</strong> <span class='pill " +
          (t.type === "매도" ? "sell" : t.type === "떨" ? "tteol" : "") +
          "'>" +
          t.type +
          "</span></div><button class='btn ghost' data-ud='" +
          idx +
          "'>삭제</button></header><div class='k'>" +
          view.kind +
          "</div><div class='log-amt " +
          view.cls +
          "'>" +
          view.text +
          "</div><div class='log-meta'>" +
          t.date +
          " · 포트 " +
          t.pot +
          " · " +
          money(t.price) +
          " × " +
          t.qty +
          " · 보유 " +
          t.holdQty +
          " · C" +
          t.cycle +
          "</div></article>"
        );
      })
      .join("");
    document.getElementById("ud-log").innerHTML = html;
  }

  function renderTtLog() {
    var html = state.tteolTrades
      .map(function (t, idx) {
        var view = logPnlView(t);
        return (
          "<article class='log-card'><header><div><strong>SOXL 랭크 " +
          t.rank +
          "</strong> <span class='pill " +
          (t.type === "매도" ? "sell" : "") +
          "'>" +
          t.type +
          "</span></div><button class='btn ghost' data-tt='" +
          idx +
          "'>삭제</button></header><div class='k'>" +
          view.kind +
          "</div><div class='log-amt " +
          view.cls +
          "'>" +
          view.text +
          "</div><div class='log-meta'>" +
          t.date +
          " · " +
          money(t.price) +
          " × " +
          t.qty +
          " · C" +
          t.cycle +
          "</div></article>"
        );
      })
      .join("");
    document.getElementById("tt-log").innerHTML = html;
  }

  function readSettingsFromForm() {
    var s = state.settings;
    s.symbol = document.getElementById("set-symbol").value.trim() || "SOXL";
    s.capital = parseFloat(document.getElementById("set-capital").value) || 0;
    s.fee = parseFloat(document.getElementById("set-fee").value) || 0;
    s.seedSplit = parseFloat(document.getElementById("set-seed").value) || 0;
    s.rankSplit = parseFloat(document.getElementById("set-rank").value) || 0;
    s.splitIncrease = parseFloat(document.getElementById("set-inc").value) || 0;
    s.rankHoldDays = parseFloat(document.getElementById("set-hold").value) || 0;
    s.reinvest = parseFloat(document.getElementById("set-reinvest").value) || 0;
    s.seedSplitFixed = document.getElementById("set-fixed").checked;
    s.buyBlocked = document.getElementById("set-blocked").checked;
    s.applySheetF8Limit = document.getElementById("set-f8").checked;
    s.autoTransfer = document.getElementById("set-auto").checked;
    s.udLadderCount = parseInt(document.getElementById("set-ud-steps").value, 10) || 0;
    s.tteolLadderCount = parseInt(document.getElementById("set-tt-steps").value, 10) || 0;
    s.udStepQty = parseInt(document.getElementById("set-ud-qty").value, 10) || 0;
    s.tteolStepQty = parseInt(document.getElementById("set-tt-qty").value, 10) || 0;
    persist();
  }

  function maybeAutoTransfer() {
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
    document.querySelectorAll(".nav-item").forEach(function (b) {
      b.onclick = function () {
        setTab(b.dataset.tab);
      };
    });
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
    document.querySelectorAll("#page-journal .seg button").forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll("#page-journal .seg button").forEach(function (x) {
          x.classList.toggle("active", x === b);
        });
        document.getElementById("log-ud").classList.toggle("hidden", b.dataset.log !== "ud");
        document.getElementById("log-tt").classList.toggle("hidden", b.dataset.log !== "tt");
      };
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
    ].forEach(function (id) {
      document.getElementById(id).addEventListener("change", readSettingsFromForm);
    });
    ["set-fixed", "set-blocked", "set-f8", "set-auto"].forEach(function (id) {
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
    document.getElementById("btn-reset").onclick = function () {
      if (confirm("시트 스냅샷(2026-09-11)으로 되돌릴까요? 로컬 변경이 사라집니다.")) {
        state = S.sheetSnapshot();
        persist();
        toast("시트 시드로 복원");
      }
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
    document.getElementById("btn-fill-ud").onclick = function () {
      var r = E.applySuggested(state, "ud");
      maybeAutoTransfer();
      persist();
      toast(r.ok ? "업다운 " + r.trade.type + " 반영 · " + (r.trade.date || "") : r.reason);
    };
    document.getElementById("btn-fill-tt").onclick = function () {
      var r = E.applySuggested(state, "tteol");
      maybeAutoTransfer();
      persist();
      toast(r.ok ? "떨사오팔 " + r.trade.type + " 반영 · " + (r.trade.date || "") : r.reason);
    };
    document.getElementById("btn-transfer").onclick = function () {
      var r = E.transferOneRank(state);
      persist();
      toast(r.ok ? "떨 이관 랭크 " + r.rank : r.reason);
    };
    document.getElementById("ud-log").onclick = function (ev) {
      var i = ev.target.getAttribute("data-ud");
      if (i == null) return;
      state.updownTrades.splice(+i, 1);
      persist();
    };
    document.getElementById("tt-log").onclick = function (ev) {
      var i = ev.target.getAttribute("data-tt");
      if (i == null) return;
      state.tteolTrades.splice(+i, 1);
      persist();
    };
    document.querySelectorAll(".num-pick").forEach(function (btn) {
      btn.onclick = function () {
        openNumPop(btn.dataset.key, btn.dataset.title, state.settings[btn.dataset.key]);
      };
    });
    document.getElementById("num-pop").onclick = function (ev) {
      if (ev.target.id === "num-pop") closeNumPop();
    };
    document.getElementById("num-pop-grid").onclick = function (ev) {
      var n = ev.target.getAttribute("data-num");
      if (n == null || !numPopKey) return;
      state.settings[numPopKey] = parseInt(n, 10);
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
      "주 · 랭크 " +
      out.openRanks.length +
      "개를 " +
      price +
      "에 전량 매도합니다. 기록은 남습니다.";
    if (!confirm(msg)) return;
    var r = E.liquidateAll(state, { date: date, price: price, qty: qty });
    persist();
    toast(r.ok ? "전량 청산 · 포트 0" : r.reason);
  }

  function addUdManual() {
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
  }

  function addTtManual() {
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
      date: date,
      seq: 1,
      type: type,
      rank: rank,
      price: price,
      qty: qty,
      amount: amount,
      fee: fee,
      pnl: pnl,
      cycle: out.ttLast && out.ttLast.cycle ? out.ttLast.cycle : out.B8,
    });
    persist();
  }

  var quoteBusy = false;

  function rememberClose(m, date, close) {
    if (!date || !isFinite(close) || close <= 0) return false;
    m.closeHistory = m.closeHistory || [];
    for (var i = 0; i < m.closeHistory.length; i++) {
      if (m.closeHistory[i].date === date) {
        if (near(m.closeHistory[i].close, close, 1e-6)) return false;
        m.closeHistory[i].close = close;
        return true;
      }
    }
    m.closeHistory.push({ date: date, close: close });
    m.closeHistory.sort(function (a, b) {
      return a.date < b.date ? 1 : -1;
    });
    if (m.closeHistory.length > 12) m.closeHistory = m.closeHistory.slice(0, 12);
    return true;
  }

  function applyLiveQuote(q) {
    if (!q || !isFinite(q.price) || q.price <= 0) return;
    var changed = false;
    if (!near(state.market.price, q.price, 1e-6)) {
      state.market.price = q.price;
      changed = true;
    }
    if (q.changePct != null && isFinite(q.changePct) && !near(state.market.changePct, q.changePct, 1e-8)) {
      state.market.changePct = q.changePct;
      changed = true;
    }
    if (q.phase && q.phase !== state.market.phase) {
      state.market.phase = q.phase;
      changed = true;
    }
    var curClose = state.market.lastClose;
    if (q.phase && q.phase !== "REG_MKT" && q.sessionDate && isFinite(q.prevClose) && q.prevClose > 0) {
      var histPrev = E.previousTradingDate(q.sessionDate);
      if (histPrev && rememberClose(state.market, histPrev, q.prevClose)) changed = true;
    }
    var canRollClose =
      q.phase &&
      q.phase !== "REG_MKT" &&
      q.sessionDate &&
      isFinite(q.lastClose) &&
      q.lastClose > 0;
    if (canRollClose) {
      var expectedPrev = E.previousTradingDate(q.sessionDate);
      if (rememberClose(state.market, q.sessionDate, q.lastClose)) changed = true;
      if (expectedPrev && isFinite(q.prevClose) && q.prevClose > 0) {
        if (rememberClose(state.market, expectedPrev, q.prevClose)) changed = true;
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
        changed = true;
      } else if (q.sessionDate === prevDate) {
        if (expectedPrev && state.market.prevCloseDate !== expectedPrev && isFinite(q.prevClose) && q.prevClose > 0) {
          state.market.prevPrevClose = state.market.prevClose;
          state.market.prevCloseDate = expectedPrev;
          state.market.prevClose = q.prevClose;
          changed = true;
        }
        if (!near(curClose, q.lastClose, 1e-6)) {
          var collapseToPrev = isFinite(q.prevClose) && near(q.lastClose, q.prevClose, 1e-4);
          var rollingBack = q.lastClose < curClose;
          if (!(collapseToPrev && rollingBack)) {
            if (isFinite(curClose) && curClose > q.lastClose) state.market.prevClose = curClose;
            else if (isFinite(q.prevClose) && q.prevClose > 0) state.market.prevClose = q.prevClose;
            state.market.lastClose = q.lastClose;
            state.market.tradeDate = q.sessionDate;
            changed = true;
          }
        }
      }
    }
    if (q.phase && q.phase !== "REG_MKT" && isFinite(q.lastClose) && q.lastClose > 0 && !near(state.market.lastClose, q.lastClose, 1e-6)) {
      state.market.lastClose = q.lastClose;
      changed = true;
    }
    if (changed) persist({ sync: false, keepRev: true });
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
    var status =
      String(q.curmktstatus || "") +
      " " +
      String(q.mainmktstatus || "") +
      " " +
      String((ext && ext.type) || "");
    var phase = "REG_MKT";
    if (/PRE_MKT/.test(status)) phase = "PRE_MKT";
    else if (/POST_MKT/.test(status)) phase = "POST_MKT";
    else if (/CLOSED|\bCLOSE\b/.test(status)) phase = "CLOSED";
    var sessionClosed = phase === "POST_MKT";
    var price = regularLast;
    if (ext && /PRE_MKT|POST_MKT|EXTENDED/.test(status) && ext.last != null) {
      var extLast = Number(ext.last);
      if (isFinite(extLast) && extLast > 0) price = extLast;
    }
    if (!isFinite(price) || price <= 0) return null;
    var lastClose = phase === "REG_MKT" || !isFinite(regularLast) || regularLast <= 0 ? NaN : regularLast;
    var prevClose = isFinite(prev) && prev > 0 ? prev : NaN;
    if (isFinite(lastClose) && isFinite(prevClose) && Math.abs(prevClose - lastClose) <= 1e-4 && isFinite(prevPrev) && prevPrev > 0) {
      prevClose = prevPrev;
    }
    var changePct = isFinite(prev) && prev > 0 ? (price - prev) / prev : Number(q.change_pct) / 100;
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
    if (quoteBusy || document.hidden) return;
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

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js?v=3").catch(function () {});
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      fetchQuote();
      pullRemote().catch(function () {});
    }
  });

  bind();
  setTab(tabFromUrl());
  window.addEventListener("hashchange", function () {
    setTab(tabFromUrl());
  });
  render();
  fetchQuote();
  pullRemote().catch(function () {});
  setInterval(fetchQuote, 15000);
  setInterval(function () {
    pullRemote().catch(function () {});
  }, 20000);
})();
