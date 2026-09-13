# Firebot setup

Two ways to drive the randomiser from a channel point redemption. Pick one.

- **[Route A — Custom Widget](#route-a--custom-widget)** runs the overlay inside
  Firebot. No OBS coupling at all, and the redemption re-rolls it directly.
  Recommended.
- **[Route B — keep the OBS browser source](#route-b--keep-the-obs-browser-source)**
  keeps `index.html` where it is and has Firebot poke OBS into reloading it.

---

## Route A — Custom Widget

### 1. Install the emblems

Firebot's overlay is served from `http://localhost:7472`, so it cannot read
`file://` paths. Firebot does statically serve its own `overlay-resources`
folder, so the emblems go there:

```
node tools/build-firebot.js --install
```

That minifies all 76 emblems and copies them to

```
%APPDATA%\Firebot\v5\overlay-resources\r6\
```

where Firebot serves them at `http://localhost:7472/overlay-resources/r6/`.

The emblems are copied **verbatim**. See
[Why the emblems are not optimised](#why-the-emblems-are-not-optimised).

> Prefer zero external files? `node tools/build-firebot.js --inline` embeds every
> emblem as a data URI instead. Self-contained, but `2-onShow.js` grows from
> ~9 KB to ~400 KB, which is an unpleasant paste.

### 2. Create the widget

In Firebot: **Overlay Widgets → + → Custom Widget**, then paste each generated
file into the matching field:

| File | Field |
| --- | --- |
| `firebot/1-html.html` | **HTML** |
| `firebot/2-onShow.js` | **onShow JS** |
| `firebot/3-onMessage.js` | **onMessage JS** |

Leave **onStateUpdate JS** empty. Size the widget at roughly **460 × 700** and
position it where you want it on the overlay.

The widget rolls once as soon as it is shown.

> **After reinstalling emblems, clear the cache.** The OBS browser source
> showing the Firebot overlay caches them by URL, so replaced files keep
> rendering from cache. Hit **Refresh cache of current page** in the browser
> source properties (or restart OBS).

### 3. Wire up the redemption

**Channel Rewards → your reward → Effects → + → Send Message to Custom Widget**,
and target this widget. Any message re-rolls it — the message name is ignored,
so you can leave it as anything.

If you would rather have the overlay appear only for the roll, hide the widget
by default and have the redemption show it (which fires `onShow`, rolling
automatically), then hide it again after a delay.

### Tuning

Edit the `CONFIG` block at the top of the **onShow JS** field:

```js
var CONFIG = {
  scale:     1,      // overall size multiplier
  spin:      4200,   // defender reel duration, ms
  stagger:   900,    // attacker lands this much later, ms
  confetti:  true,
  assetBase: "http://localhost:7472/overlay-resources/r6/"
};
```

Change `assetBase` if you run Firebot on a non-default port.

---

## Route B — keep the OBS browser source

Toggling a source's visibility does **not** reload a browser source, which is
why the redemption appeared to do nothing. Have Firebot press the source's
*Refresh* button over obs-websocket instead — that genuinely reloads the page,
and `index.html` rolls on load.

Add this to the redemption:

**Effects → + → Send Raw OBS WebSocket Request**

- Request Type: `PressInputPropertiesButton`
- Request Data:

```json
{
  "inputName": "Browser",
  "propertyName": "refreshnocache"
}
```

Set `inputName` to whatever your browser source is actually called in OBS — the
name in the Sources list, `Browser` in the screenshot from setup.

`index.html` also listens for OBS's `obsSourceVisibleChanged` and
`obsSourceActiveChanged` events, so a visibility toggle re-rolls it too *if*
your OBS build dispatches them. The refresh request above does not depend on
that, which is why it is the reliable option.

---

## Why the emblems are not optimised

An earlier version rounded SVG path coordinates to one decimal, on the reasoning
that one viewBox unit is under half a pixel at render size. That was wrong, and
it visibly corrupted emblems in the overlay — Ela, Thorn and Hibana among them.
These emblems have fine interlocking geometry, and nudging a coordinate can flip
which side of a fill boundary a region lands on. Rounding also merges numbers:
SVG path data lets them run together, so `11.043.889` is *two* numbers, and
rounding the first to `11` glues it to the next.

Measured across all 81 emblems, rounding to one decimal corrupted 42 of them —
maverick 19%, azami 16%, ela 10% mean pixel difference — and two decimals still
corrupted maverick by 17%. The structural cleanups that remain (dropping
Illustrator's `<foreignObject>`, collapsing whitespace between tags) are
verified lossless.

To check this yourself after any change to `tools/svg-minify.js`:

```
node tools/verify-emblems.js
```

It renders every emblem twice, original against processed, and fails if any
differs by more than 1% mean pixel difference. Current result: all 81 at
**0.000%**.

## Regenerating

The widget files are generated — do not hand-edit them, or the next build wipes
your changes. Edit `tools/build-firebot.js` and re-run:

```
node tools/build-firebot.js --install
```

Note that the widget carries its own copy of the roster and the reel engine,
separate from `index.html`. A roster change needs making in both places.
