/* =====================================================================
   R6 Operator Randomiser - Firebot Custom Widget : onMessage JS

   Runs when a "Send Message to Custom Widget" effect targets this widget.
   Any message re-rolls, so the message name does not matter - point your
   channel point redemption at that effect and you are done.
   ===================================================================== */

var api = (window.__r6 && (window.__r6[widgetId] || window.__r6.last)) || null;
if (api) {
  api.roll();
}
