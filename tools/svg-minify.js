/*
 * SVG minification shared by build-firebot.js and verify-emblems.js.
 *
 * Only used for the widget's --inline mode. Hosted mode copies the original
 * files untouched, because over localhost their size does not matter and a
 * file that is never transformed cannot be corrupted.
 *
 * DO NOT round path coordinates here. It looks like free savings - one
 * viewBox unit is under half a pixel at render size - but these emblems have
 * fine interlocking geometry, and nudging a coordinate can flip which side of
 * a fill boundary a region lands on. Measured with tools/verify-emblems.js,
 * rounding to one decimal corrupted 42 of 81 emblems, several beyond
 * recognition (maverick 19%, azami 16%, ela 10% mean pixel difference), and
 * two decimals still corrupted maverick by 17%. The transforms kept below are
 * verified lossless: every emblem renders at 0.000% difference.
 */

"use strict";

function minifySvg(svg) {
  return svg
    // Illustrator wraps the art in <switch><foreignObject/><g>...</g></switch>.
    // The foreignObject is an editor artefact that never renders: <switch>
    // draws the first child whose requiredExtensions pass, which is the <g>.
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/g, "")
    .replace(/<foreignObject[^>]*\/>/g, "")
    .replace(/<\?xml[^>]*\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+xml:space="preserve"/g, "")
    // Whitespace only between tags and in runs; path data keeps its separators.
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function toDataUri(svg) {
  // Compare both encodings and keep whichever is smaller. SVG text is
  // punctuation-heavy, so percent-encoding is not always the winner.
  const b64 = "data:image/svg+xml;base64," + Buffer.from(svg, "utf8").toString("base64");
  const pct = "data:image/svg+xml," + encodeURIComponent(svg)
    .replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29");
  return pct.length <= b64.length ? pct : b64;
}

module.exports = { minifySvg, toDataUri };
