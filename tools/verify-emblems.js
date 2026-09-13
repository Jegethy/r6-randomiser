/*
 * Renders every emblem twice - original vs minified - and pixel-compares them.
 *
 *   node tools/verify-emblems.js
 *
 * Catches SVG minification that silently corrupts path geometry, which is easy
 * to miss by eye: a single mis-parsed coordinate shifts everything after it.
 * Exits non-zero if any emblem differs by more than THRESHOLD.
 *
 * Both sides are fed to the page as data URIs. Chrome taints a canvas when an
 * SVG is loaded over file://, even with --allow-file-access-from-files, which
 * would make getImageData throw.
 */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { minifySvg } = require("./svg-minify");

const ROOT = path.join(__dirname, "..");
const SVG_DIR = path.join(ROOT, "Scalable vector graphic (SVG)");
const SIZE = 96;          // render size for the comparison
const THRESHOLD = 1.0;    // percent mean pixel difference allowed

const CHROME_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium"
];
const CHROME = CHROME_CANDIDATES.find(function (p) { return fs.existsSync(p); });
if (!CHROME) {
  console.error("No Chrome/Edge found; cannot render. Checked:\n  " +
                CHROME_CANDIDATES.join("\n  "));
  process.exit(2);
}

/* ---- collect both versions of every emblem ---- */

const b64 = function (s) { return Buffer.from(s, "utf8").toString("base64"); };

const cases = fs.readdirSync(SVG_DIR)
  .filter(function (f) { return f.endsWith(".svg"); })
  .map(function (f) {
    const original = fs.readFileSync(path.join(SVG_DIR, f), "utf8");
    return {
      name: f.replace(/\.svg$/, ""),
      a: b64(original),
      b: b64(minifySvg(original))
    };
  });

/* ---- build the comparison harness ---- */

const harness = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<script>
var CASES = ${JSON.stringify(cases)};
var S = ${SIZE};
var PREFIX = "data:image/svg+xml;base64,";

function load(b64) {
  return new Promise(function (res) {
    var img = new Image();
    img.onload = function () { res(img); };
    img.onerror = function () { res(null); };
    img.src = PREFIX + b64;
  });
}
function pixels(img) {
  var c = document.createElement("canvas");
  c.width = S; c.height = S;
  var x = c.getContext("2d", { willReadFrequently: true });
  x.clearRect(0, 0, S, S);
  x.drawImage(img, 0, 0, S, S);
  return x.getImageData(0, 0, S, S).data;
}

document.title = "PENDING";
(async function () {
  var out = [];
  try {
    for (var i = 0; i < CASES.length; i++) {
      var c = CASES[i];
      var ia = await load(c.a);
      var ib = await load(c.b);
      if (!ia || !ib) { out.push(c.name + "\\tLOAD_FAIL"); continue; }
      var pa = pixels(ia), pb = pixels(ib), sum = 0;
      for (var j = 0; j < pa.length; j++) sum += Math.abs(pa[j] - pb[j]);
      out.push(c.name + "\\t" + ((sum / pa.length / 255) * 100).toFixed(3));
    }
  } catch (e) {
    document.title = "ERROR " + (e && e.name) + ": " + (e && e.message);
    return;
  }
  document.title = out.join(";");
})();
</script></body></html>`;

const work = fs.mkdtempSync(path.join(os.tmpdir(), "r6-verify-"));
const harnessPath = path.join(work, "verify.html");
fs.writeFileSync(harnessPath, harness, "utf8");

/* ---- render ---- */

let dom;
try {
  dom = execFileSync(CHROME, [
    "--headless", "--disable-gpu", "--no-sandbox",
    "--virtual-time-budget=120000",
    "--dump-dom", "file:///" + harnessPath.replace(/\\/g, "/")
  ], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
} catch (e) {
  fs.rmSync(work, { recursive: true, force: true });
  console.error("Chrome failed to run: " + e.message);
  process.exit(2);
}
fs.rmSync(work, { recursive: true, force: true });

// Read the <title> element: --dump-dom also echoes the script source, so any
// marker written as a literal in the page would match itself.
const m = dom.match(/<title>([\s\S]*?)<\/title>/);
if (!m) {
  console.error("No result from the renderer.");
  process.exit(2);
}
if (m[1].startsWith("ERROR") || m[1] === "PENDING") {
  console.error("Renderer reported: " + m[1]);
  process.exit(2);
}

/* ---- report ---- */

const rows = m[1].split(";").filter(Boolean).map(function (r) {
  const parts = r.split("\t");
  return { name: parts[0], diff: parts[1] === "LOAD_FAIL" ? NaN : parseFloat(parts[1]) };
});
rows.sort(function (a, b) { return (b.diff || 0) - (a.diff || 0); });

const failed = rows.filter(function (r) { return isNaN(r.diff) || r.diff > THRESHOLD; });

console.log("compared " + rows.length + " emblems at " + SIZE + "px, threshold "
            + THRESHOLD + "% mean pixel difference\n");
console.log("worst 8:");
rows.slice(0, 8).forEach(function (r) {
  console.log("  " + r.name.padEnd(14) +
              (isNaN(r.diff) ? "LOAD FAIL" : r.diff.toFixed(3) + " %"));
});

if (failed.length) {
  console.log("\nFAIL: " + failed.length + " emblem(s) over threshold:");
  failed.forEach(function (r) {
    console.log("  " + r.name + "  " + (isNaN(r.diff) ? "LOAD FAIL" : r.diff.toFixed(3) + " %"));
  });
  process.exit(1);
}
console.log("\nPASS: every emblem renders within " + THRESHOLD + "% of the original.");
