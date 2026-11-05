/**
 * 평일 19:25 KST 이후. gist에 19:05 시작 기록이 없으면 텔레그램.
 * PC가 꺼져 있어도 이 작업은 GitHub에서 돈다.
 */
"use strict";

var FILE_NAME = "switch-auto-heartbeat.json";
var APPS = [
  { key: "meritz", label: "메리츠" },
  { key: "eugene", label: "유진" },
];

function gistHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: "Bearer " + token,
    "User-Agent": "switch-soxl-auto-miss",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function seoulNow(d) {
  var parts = {};
  new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(d || new Date())
    .forEach(function (p) {
      if (p.type !== "literal") parts[p.type] = p.value;
    });
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    h: Number(parts.hour),
    min: Number(parts.minute),
  };
}

function ymd(y, m, d) {
  return y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}

function prevDay(y, m, d) {
  var dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
}

function weekdayMon0(y, m, d) {
  var w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 ? 6 : w - 1;
}

function dueDay(now) {
  var s = seoulNow(now);
  var y = s.y;
  var m = s.m;
  var d = s.d;
  for (var i = 0; i < 10; i++) {
    if (weekdayMon0(y, m, d) < 5) {
      var minutes = y === s.y && m === s.m && d === s.d ? s.h * 60 + s.min : 24 * 60;
      if (minutes >= 19 * 60 + 5 + 14) return ymd(y, m, d);
    }
    var prev = prevDay(y, m, d);
    y = prev[0];
    m = prev[1];
    d = prev[2];
  }
  return "";
}

async function sendTelegram(text) {
  var bot = process.env.TELEGRAM_BOT_TOKEN || "";
  var chat = process.env.TELEGRAM_CHAT_ID || "";
  if (!bot || !chat) throw new Error("telegram secrets missing");
  var r = await fetch("https://api.telegram.org/bot" + bot + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: text }),
  });
  if (!r.ok) throw new Error("telegram fail " + r.status);
  console.log("telegram sent");
}

async function main() {
  var day = dueDay(new Date());
  if (!day) {
    console.log("auto miss none");
    return;
  }
  var token = process.env.GIST_TOKEN || process.env.GH_TOKEN || "";
  var gistId = process.env.GIST_ID || "bd19f426b2bf612bda5de2bb35d97539";
  if (!token) throw new Error("GIST_TOKEN missing");
  var res = await fetch("https://api.github.com/gists/" + gistId, { headers: gistHeaders(token) });
  if (!res.ok) throw new Error("gist get " + res.status);
  var gist = await res.json();
  var file = gist.files && gist.files[FILE_NAME];
  if (!file || !file.content) {
    console.log("heartbeat missing");
    return;
  }
  var state = JSON.parse(file.content);
  var lines = [];
  var hit = [];
  APPS.forEach(function (app) {
    var row = state[app.key] || {};
    if (!row.armed) return;
    if (String(row.ok || "") >= day || String(row.missSent || "") >= day) return;
    hit.push(app.key);
    lines.push(
      app.label +
        " 자동매매가 실행되지 않았습니다.\n예정: " +
        day +
        " 19:05 (평일 19:05)\nPC가 꺼져 있었거나 예약 작업이 시작되지 않았습니다."
    );
  });
  if (!lines.length) {
    console.log("auto miss none · " + day);
    return;
  }
  await sendTelegram(lines.join("\n\n"));
  hit.forEach(function (key) {
    if (!state[key]) state[key] = {};
    state[key].missSent = day;
  });
  var patch = await fetch("https://api.github.com/gists/" + gistId, {
    method: "PATCH",
    headers: Object.assign({ "Content-Type": "application/json" }, gistHeaders(token)),
    body: JSON.stringify({ files: { [FILE_NAME]: { content: JSON.stringify(state) } } }),
  });
  if (!patch.ok) throw new Error("gist patch " + patch.status);
  console.log("auto miss sent " + hit.join(","));
}

main().catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
