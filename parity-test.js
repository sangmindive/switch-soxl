var fs = require("fs");
var path = require("path");
var vm = require("vm");

var ctx = { console: console, module: { exports: {} }, globalThis: {} };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "engine.js"), "utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "seed.js"), "utf8"), ctx);

var E = ctx.SwitchEngine;
var S = ctx.SwitchSeed;
var state = S.sheetSnapshot();
var out = E.compute(state);
var exp = S.expectedSheet;

function near(a, b, eps) {
  if (b === "" || b == null) return a === b;
  return Math.abs(Number(a) - Number(b)) <= (eps == null ? 1e-6 : eps);
}

var checks = [
  ["I3", out.I3, exp.I3, 0.01],
  ["J3", out.J3, exp.J3, 1e-9],
  ["K3", out.K3, exp.K3, 1e-6],
  ["C8", out.C8, exp.C8, 0.01],
  ["D8", out.D8, exp.D8, 0.02],
  ["F8", out.F8, exp.F8],
  ["G8", out.G8, exp.G8],
  ["H8", out.H8, exp.H8, 1e-6],
  ["B8", out.B8, exp.B8],
  ["B13", out.B13, exp.B13],
  ["C13", out.C13, exp.C13],
  ["D13", out.D13, exp.D13, 1e-6],
  ["E13", out.E13, exp.E13, 0.02],
  ["H13", out.H13, exp.H13],
  ["I13", out.I13, exp.I13],
  ["J13", out.J13, exp.J13, 1e-6],
  ["D16", out.D16, exp.D16, 1e-9],
  ["E16", out.E16, exp.E16, 0.02],
  ["J16", out.J16, exp.J16, 0.01],
  ["K16", out.K16, exp.K16, 0.02],
  ["B19", out.B19, exp.B19],
  ["C19", out.C19, exp.C19, 1e-9],
  ["D19", out.D19, exp.D19, 1e-9],
  ["E19", out.E19, exp.E19],
  ["F19", out.F19, exp.F19, 1e-9],
  ["H19", out.H19, exp.H19],
  ["I19", out.I19, exp.I19, 1e-9],
  ["ladder0", out.udLadder[0] && out.udLadder[0].price, exp.ladder0, 1e-9],
  ["ladder1", out.udLadder[1] && out.udLadder[1].price, exp.ladder1, 1e-9],
  ["ladder2", out.udLadder[2] && out.udLadder[2].price, exp.ladder2, 1e-9],
  ["ladderDrop0", out.udLadder[0] && out.udLadder[0].drop, exp.ladderDrop0, 1e-8],
];

var fail = 0;
checks.forEach(function (c) {
  var ok = near(c[1], c[2], c[3]);
  if (!ok) {
    fail += 1;
    console.log("FAIL", c[0], "got", c[1], "expected", c[2]);
  }
});

if (fail) {
  console.log("failed", fail, "/", checks.length);
  process.exit(1);
}
console.log("OK", checks.length, "sheet parity checks");
console.log("C19", out.C19, "B19", out.B19, "F19", out.F19, "E19", out.E19);
console.log("D16", out.D16, "J16", out.J16, "I19", out.I19, "H19", out.H19);
