/*
 * Generates the Firebot "Custom Widget" build into ../firebot/.
 *
 *   node tools/build-firebot.js              hosted mode (default)
 *   node tools/build-firebot.js --install    hosted mode + copy the emblems
 *                                            into Firebot's overlay-resources
 *   node tools/build-firebot.js --inline     inline mode (data URIs)
 *
 * Firebot serves its overlay from http://localhost:7472, so a page there
 * cannot read file:// paths. Two ways around that:
 *
 *   hosted  Firebot statically serves its user-data "overlay-resources"
 *           folder at /overlay-resources. Drop the emblems in there and the
 *           widget stays a few KB. This is the default.
 *
 *   inline  Every emblem is minified and embedded as a data URI. The widget
 *           becomes ~320 KB to paste but depends on nothing external.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = path.join(__dirname, "..");
const SVG_DIR = path.join(ROOT, "Scalable vector graphic (SVG)");
const OUT_DIR = path.join(ROOT, "firebot");

const ARGS = process.argv.slice(2);
const INLINE = ARGS.includes("--inline");
const INSTALL = ARGS.includes("--install");

// Firebot's user data dir; overlay-resources under it is served statically.
const FIREBOT_RESOURCES = path.join(
  process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
  "Firebot", "v5", "overlay-resources"
);
const INSTALL_SUBDIR = "r6";
const HOSTED_BASE = "http://localhost:7472/overlay-resources/" + INSTALL_SUBDIR + "/";

/* ---------------- roster (mirrors index.html) ---------------- */

const ATTACKERS = [
  ["sledge","Sledge"],["thatcher","Thatcher"],["ash","Ash"],["thermite","Thermite"],
  ["twitch","Twitch"],["montagne","Montagne"],["glaz","Glaz"],["fuze","Fuze"],
  ["blitz","Blitz"],["iq","IQ"],["buck","Buck"],["blackbeard","Blackbeard"],
  ["capitao","Capitão"],["hibana","Hibana"],["jackal","Jackal"],["ying","Ying"],
  ["zofia","Zofia"],["dokkaebi","Dokkaebi"],["lion","Lion"],["finka","Finka"],
  ["maverick","Maverick"],["nomad","Nomad"],["gridlock","Gridlock"],["nokk","Nøkk"],
  ["amaru","Amaru"],["kali","Kali"],["iana","Iana"],["ace","Ace"],
  ["zero","Zero"],["flores","Flores"],["osa","Osa"],["sens","Sens"],
  ["grim","Grim"],["brava","Brava"],["ram","Ram"],["deimos","Deimos"],
  ["striker","Striker"],["rauora","Rauora"]
];

const DEFENDERS = [
  ["smoke","Smoke"],["mute","Mute"],["castle","Castle"],["pulse","Pulse"],
  ["doc","Doc"],["rook","Rook"],["jager","Jäger"],["bandit","Bandit"],
  ["tachanka","Tachanka"],["kapkan","Kapkan"],["frost","Frost"],["valkyrie","Valkyrie"],
  ["caveira","Caveira"],["echo","Echo"],["mira","Mira"],["lesion","Lesion"],
  ["ela","Ela"],["vigil","Vigil"],["alibi","Alibi"],["maestro","Maestro"],
  ["clash","Clash"],["kaid","Kaid"],["mozzie","Mozzie"],["warden","Warden"],
  ["goyo","Goyo"],["wamai","Wamai"],["oryx","Oryx"],["melusi","Melusi"],
  ["aruni","Aruni"],["thunderbird","Thunderbird"],["thorn","Thorn"],["azami","Azami"],
  ["solis","Solis"],["fenrir","Fenrir"],["tubarao","Tubarão"],["sentry","Sentry"],
  ["skopos","Skopós"],["denari","Denari"]
];

/* ---------------- SVG minification ---------------- */

const { minifySvg, toDataUri } = require("./svg-minify");

/* ---------------- roster construction ---------------- */

const stats = { raw: 0, min: 0, count: 0 };

function buildRoster(list) {
  return list.map(function (entry) {
    const file = path.join(SVG_DIR, entry[0] + ".svg");
    if (!fs.existsSync(file)) throw new Error("missing asset: " + file);
    const raw = fs.readFileSync(file, "utf8");
    const min = minifySvg(raw);
    stats.raw += raw.length;
    stats.min += min.length;
    stats.count++;
    // Hosted mode stores just the filename; CONFIG.assetBase supplies the rest.
    return [entry[1], INLINE ? toDataUri(min) : entry[0] + ".svg"];
  });
}

const attackers = buildRoster(ATTACKERS);
const defenders = buildRoster(DEFENDERS);

function rosterLiteral(rows) {
  return "[\n" + rows.map(function (r) {
    return "  [" + JSON.stringify(r[0]) + "," + JSON.stringify(r[1]) + "]";
  }).join(",\n") + "\n]";
}

/* ---------------- widget: HTML field ---------------- */

const HTML_FIELD = `<style>
/* R6 Operator Randomiser - Firebot Custom Widget
   Scoped to .r6 so it cannot leak into other overlay widgets. */
.r6 {
  --scale: 1;
  --tile-h: calc(238px * var(--scale));
  --emblem: calc(158px * var(--scale));
  --stage-w: calc(400px * var(--scale));
  --attack: #0dd1cb;
  --defend: #ff9124;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: transparent;
  font-family: "Segoe UI", "Inter", "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  user-select: none;
}
.r6 canvas.r6-confetti {
  position: absolute; inset: 0; width: 100%; height: 100%;
  pointer-events: none; z-index: 50;
}
.r6-stage { width: var(--stage-w); display: flex; flex-direction: column; align-items: stretch; }
.r6-panel { display: flex; flex-direction: column; align-items: center; --accent: var(--attack); }
.r6-panel[data-side="defend"] { --accent: var(--defend); }
.r6-role {
  font-size: calc(19px * var(--scale)); font-weight: 700;
  letter-spacing: calc(4.5px * var(--scale)); text-transform: uppercase;
  color: var(--accent); margin: calc(8px * var(--scale)) 0;
  text-shadow: 0 0 calc(9px * var(--scale)) rgba(0,0,0,.95),
               0 calc(2px * var(--scale)) calc(4px * var(--scale)) rgba(0,0,0,.9);
}
/* Fade tiles out at the window edges instead of letting overflow:hidden slice
   them at a hard line, so a spinning reel reads as passing behind the edge.
   Lifted on lock by scaling the same gradient (mask-size transitions, a
   swapped gradient does not), keeping the winning emblem and glow crisp. */
.r6-window {
  width: 100%; height: var(--tile-h); overflow: hidden; position: relative;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, #000 20%, #000 80%, transparent 100%);
          mask-image: linear-gradient(to bottom, transparent 0%, #000 20%, #000 80%, transparent 100%);
  -webkit-mask-repeat: no-repeat;  mask-repeat: no-repeat;
  -webkit-mask-position: center;   mask-position: center;
  -webkit-mask-size: 100% 100%;    mask-size: 100% 100%;
  transition: -webkit-mask-size .55s ease-out, mask-size .55s ease-out;
}
.r6-strip { will-change: transform; transform: translate3d(0,0,0); }
.r6-strip.blurred { filter: blur(calc(2.4px * var(--scale))); }
.r6-strip.unblur  { filter: blur(0); transition: filter .45s ease-out; }
.r6-tile {
  height: var(--tile-h); display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: calc(12px * var(--scale));
}
.r6-emblem { width: var(--emblem); height: var(--emblem); display: flex; align-items: center; justify-content: center; }
.r6-emblem img {
  width: 100%; height: 100%; object-fit: contain; -webkit-user-drag: none;
  filter: drop-shadow(0 calc(3px * var(--scale)) calc(9px * var(--scale)) rgba(0,0,0,.85));
}
.r6-name {
  font-size: calc(38px * var(--scale)); font-weight: 800;
  letter-spacing: calc(2px * var(--scale)); text-transform: uppercase;
  color: #fff; text-align: center; line-height: 1.05;
  text-shadow: 0 0 calc(10px * var(--scale)) rgba(0,0,0,.95),
               0 calc(2px * var(--scale)) calc(5px * var(--scale)) rgba(0,0,0,.9);
}
.r6-divider { width: 100%; margin: calc(6px * var(--scale)) 0; line-height: 0; }
.r6-divider svg {
  width: 100%; height: calc(16px * var(--scale)); display: block;
  filter: drop-shadow(0 calc(2px * var(--scale)) calc(3px * var(--scale)) rgba(0,0,0,.9));
}
.r6-divider path { fill: none; stroke: rgba(255,255,255,.9); stroke-width: 2.2; stroke-linecap: round; }

/* reveal flourish */
.r6-panel.locked .r6-window {
  animation: r6shake .5s cubic-bezier(.36,.07,.19,.97) both;
  -webkit-mask-size: 100% 460%;
          mask-size: 100% 460%;
}
@keyframes r6shake {
  10%,90% { transform: translate3d(calc(-2px * var(--scale)),0,0); }
  20%,80% { transform: translate3d(calc(4px * var(--scale)),0,0); }
  30%,50%,70% { transform: translate3d(calc(-8px * var(--scale)),0,0); }
  40%,60% { transform: translate3d(calc(8px * var(--scale)),0,0); }
}
.r6-panel.locked .r6-window::after {
  content: ""; position: absolute; inset: 0; pointer-events: none; opacity: 0;
  background: radial-gradient(ellipse at center, var(--accent) 0%, transparent 70%);
  animation: r6flash .55s ease-out both;
}
@keyframes r6flash {
  0% { opacity: .55; transform: scale(.85); }
  100% { opacity: 0; transform: scale(1.25); }
}
.r6-panel.locked .r6-tile.is-winner .r6-emblem { animation: r6pulse 1.9s ease-in-out infinite; }
.r6-panel.locked .r6-tile.is-winner .r6-name   { animation: r6glow 1.9s ease-in-out infinite; }
.r6-panel.locked .r6-role { animation: r6fade 1.9s ease-in-out infinite; }
@keyframes r6pulse {
  0%,100% { transform: scale(1);    filter: drop-shadow(0 0 calc(4px * var(--scale)) var(--accent)); }
  50%     { transform: scale(1.06); filter: drop-shadow(0 0 calc(22px * var(--scale)) var(--accent)); }
}
@keyframes r6glow {
  0%,100% { text-shadow: 0 0 calc(10px * var(--scale)) rgba(0,0,0,.95), 0 calc(2px * var(--scale)) calc(5px * var(--scale)) rgba(0,0,0,.9); }
  50%     { text-shadow: 0 0 calc(10px * var(--scale)) rgba(0,0,0,.95), 0 0 calc(20px * var(--scale)) var(--accent); }
}
@keyframes r6fade { 0%,100% { opacity: .82; } 50% { opacity: 1; } }
</style>

<div class="r6">
  <canvas class="r6-confetti"></canvas>
  <div class="r6-stage">

    <div class="r6-panel" data-side="defend">
      <div class="r6-window"><div class="r6-strip" data-reel="defend"></div></div>
      <div class="r6-role">Defense</div>
    </div>

    <div class="r6-divider">
      <svg viewBox="0 0 300 16" preserveAspectRatio="none">
        <path d="M0,8 Q7.5,1 15,8 T30,8 T45,8 T60,8 T75,8 T90,8 T105,8 T120,8 T135,8 T150,8 T165,8 T180,8 T195,8 T210,8 T225,8 T240,8 T255,8 T270,8 T285,8 T300,8"/>
      </svg>
    </div>

    <div class="r6-panel" data-side="attack">
      <div class="r6-role">Attack</div>
      <div class="r6-window"><div class="r6-strip" data-reel="attack"></div></div>
    </div>

  </div>
</div>
`;

/* ---------------- widget: onShow JS ---------------- */

const ON_SHOW = `/* =====================================================================
   R6 Operator Randomiser - Firebot Custom Widget : onShow JS
   Generated by tools/build-firebot.js (${INLINE ? "inline" : "hosted"} mode).

   Runs when the widget is shown: defines the roller, then rolls once.
   Re-roll later with the "Send Message to Custom Widget" effect.
   ===================================================================== */

var CONFIG = {
  scale:     1,      // overall size multiplier
  spin:      4200,   // defender reel duration, ms
  stagger:   900,    // attacker lands this much later, ms
  confetti:  true,
  assetBase: ${JSON.stringify(INLINE ? "" : HOSTED_BASE)}
};

var ATTACKERS = ${rosterLiteral(attackers)};

var DEFENDERS = ${rosterLiteral(defenders)};

(function () {
  var root = containerElement.querySelector(".r6");
  if (!root) { return; }
  root.style.setProperty("--scale", CONFIG.scale);

  function srcFor(op) { return CONFIG.assetBase + op[1]; }

  /* ---- randomness: CSPRNG + rejection sampling, no seed, no state ---- */
  function randomInt(max) {
    if (max <= 1) return 0;
    if (window.crypto && window.crypto.getRandomValues) {
      var limit = Math.floor(4294967296 / max) * max;
      var buf = new Uint32Array(1), v;
      do { window.crypto.getRandomValues(buf); v = buf[0]; } while (v >= limit);
      return v % max;
    }
    return Math.floor(Math.random() * max);
  }
  function pick(a) { return a[randomInt(a.length)]; }
  function shuffled(a) {
    var out = a.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = randomInt(i + 1), t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  /* ---- confetti ---- */
  var canvas = root.querySelector("canvas.r6-confetti");
  var ctx = canvas.getContext("2d");
  var parts = [], raf = null;

  function sizeCanvas() {
    var dpr = window.devicePixelRatio || 1;
    var r = root.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(r.width * dpr));
    canvas.height = Math.max(1, Math.floor(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function tick() {
    var r = root.getBoundingClientRect();
    ctx.clearRect(0, 0, r.width, r.height);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.vy += 0.34; p.vx *= 0.992;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 0.0075;
      if (p.life <= 0 || p.y - 40 > r.height) { parts.splice(i, 1); continue; }
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    raf = parts.length ? requestAnimationFrame(tick) : null;
    if (!raf) ctx.clearRect(0, 0, r.width, r.height);
  }
  function burst(x, y, colors) {
    for (var i = 0; i < 70; i++) {
      var ang = (-Math.PI / 2) + (Math.random() - 0.5) * 1.9;
      var spd = 7 + Math.random() * 11;
      parts.push({
        x: x, y: y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        w: 5 + Math.random() * 6, h: 8 + Math.random() * 8,
        rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.32,
        color: colors[Math.floor(Math.random() * colors.length)], life: 1
      });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function celebrate() {
    if (!CONFIG.confetti) return;
    sizeCanvas();
    var base = root.getBoundingClientRect();
    var panels = root.querySelectorAll(".r6-panel");
    for (var i = 0; i < panels.length; i++) {
      var w = panels[i].querySelector(".r6-window").getBoundingClientRect();
      var colors = panels[i].getAttribute("data-side") === "attack"
        ? ["#0dd1cb", "#7fe8e5", "#ffffff", "#089b96"]
        : ["#ff9124", "#ffc97a", "#ffffff", "#e0620a"];
      // The canvas lives inside the widget, so use container-relative coords.
      burst(w.left - base.left + w.width / 2,
            w.top - base.top + w.height * 0.62, colors);
    }
  }

  /* ---- reel ---- */
  var LOOPS = 5;
  function tileHtml(op) {
    return '<div class="r6-tile"><div class="r6-emblem"><img src="' + srcFor(op) +
           '" alt="" draggable="false"></div><div class="r6-name">' + op[0] + '</div></div>';
  }
  function makeReel(side, pool) {
    var strip = root.querySelector('[data-reel="' + side + '"]');
    var win = strip.parentElement;
    var panel = win.closest(".r6-panel");
    return function (duration, done) {
      var winner = pick(pool);
      var tiles = [];
      for (var i = 0; i < LOOPS; i++) tiles = tiles.concat(shuffled(pool));
      var idx = tiles.length;
      tiles.push(winner);
      tiles = tiles.concat(shuffled(pool).slice(0, 4));

      panel.classList.remove("locked");
      strip.classList.remove("unblur");
      strip.style.transition = "none";
      strip.style.transform = "translate3d(0,0,0)";
      strip.innerHTML = tiles.map(tileHtml).join("");

      var tileH = win.getBoundingClientRect().height;
      void strip.offsetHeight;

      strip.classList.add("blurred");
      strip.style.transition = "transform " + duration + "ms cubic-bezier(.16,.86,.2,1)";
      strip.style.transform = "translate3d(0," + (-idx * tileH) + "px,0)";

      setTimeout(function () {
        strip.classList.remove("blurred");
        strip.classList.add("unblur");
      }, Math.max(0, duration - 1100));

      var settled = false;
      function settle(e) {
        if (e && e.propertyName !== "transform") return;
        if (settled) return;
        settled = true;
        strip.removeEventListener("transitionend", settle);
        var landed = strip.children[idx];
        if (landed) landed.classList.add("is-winner");
        panel.classList.add("locked");
        done();
      }
      strip.addEventListener("transitionend", settle);
      setTimeout(settle, duration + 250);
    };
  }

  var spinDefend = makeReel("defend", DEFENDERS);
  var spinAttack = makeReel("attack", ATTACKERS);
  var spinning = false;

  function roll() {
    if (spinning) return;
    spinning = true;
    parts = [];
    var panels = root.querySelectorAll(".r6-panel");
    for (var i = 0; i < panels.length; i++) panels[i].classList.remove("locked");
    var left = 2;
    function done() { if (--left === 0) { spinning = false; celebrate(); } }
    spinDefend(CONFIG.spin, done);
    spinAttack(CONFIG.spin + CONFIG.stagger, done);
  }

  // Keyed by widget id so onMessage can find it, and so two copies of the
  // widget on one overlay do not fight over the same global.
  window.__r6 = window.__r6 || {};
  window.__r6[widgetId] = { roll: roll };
  window.__r6.last = { roll: roll };

  sizeCanvas();

  // Warm the image cache, then roll. Never block longer than 2s.
  var all = ATTACKERS.concat(DEFENDERS), left = all.length, started = false;
  function go() { if (!started) { started = true; roll(); } }
  all.forEach(function (op) {
    var img = new Image();
    img.onload = img.onerror = function () { if (--left <= 0) go(); };
    img.src = srcFor(op);
  });
  setTimeout(go, 2000);
})();
`;

/* ---------------- widget: onMessage JS ---------------- */

const ON_MESSAGE = `/* =====================================================================
   R6 Operator Randomiser - Firebot Custom Widget : onMessage JS

   Runs when a "Send Message to Custom Widget" effect targets this widget.
   Any message re-rolls, so the message name does not matter - point your
   channel point redemption at that effect and you are done.
   ===================================================================== */

var api = (window.__r6 && (window.__r6[widgetId] || window.__r6.last)) || null;
if (api) {
  api.roll();
}
`;

/* ---------------- write ---------------- */

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "1-html.html"), HTML_FIELD, "utf8");
fs.writeFileSync(path.join(OUT_DIR, "2-onShow.js"), ON_SHOW, "utf8");
fs.writeFileSync(path.join(OUT_DIR, "3-onMessage.js"), ON_MESSAGE, "utf8");

console.log("mode              : " + (INLINE ? "inline (data URIs)" : "hosted (overlay-resources)"));
console.log("operators         : " + stats.count +
            " (" + attackers.length + " attack / " + defenders.length + " defend)");
console.log("");
console.log("1-html.html       : " + (HTML_FIELD.length / 1024).toFixed(1) + " KB");
console.log("2-onShow.js       : " + (ON_SHOW.length / 1024).toFixed(1) + " KB");
console.log("3-onMessage.js    : " + (ON_MESSAGE.length / 1024).toFixed(1) + " KB");

if (INSTALL) {
  if (INLINE) {
    console.log("\n--install ignored: inline mode embeds the emblems already.");
  } else {
    const dest = path.join(FIREBOT_RESOURCES, INSTALL_SUBDIR);
    if (!fs.existsSync(FIREBOT_RESOURCES)) {
      console.error("\nERROR: Firebot overlay-resources not found at\n  " + FIREBOT_RESOURCES +
                    "\nIs Firebot installed? Copy the emblems there manually instead.");
      process.exit(1);
    }
    fs.mkdirSync(dest, { recursive: true });
    // Copy verbatim. These are served over localhost where size is
    // irrelevant, and a file that is never transformed cannot be corrupted.
    let written = 0, bytes = 0;
    ATTACKERS.concat(DEFENDERS).forEach(function (entry) {
      const src = path.join(SVG_DIR, entry[0] + ".svg");
      const buf = fs.readFileSync(src);
      fs.writeFileSync(path.join(dest, entry[0] + ".svg"), buf);
      written++; bytes += buf.length;
    });
    console.log("\ninstalled         : " + written + " emblems (" +
                (bytes / 1024).toFixed(0) + " KB)");
    console.log("to                : " + dest);
    console.log("served at         : " + HOSTED_BASE);
  }
}
