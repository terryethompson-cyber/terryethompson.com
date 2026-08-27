/* ===========================================================================
   site.js — the shared page scripts.

   Every page loads this file. Like site.css, it exists so a fix lands in one
   place and reaches every page. A vehicle guide once shipped without the
   nav-offset function below and its mobile menu sat invisible behind the
   fixed header; nothing else on the page looked wrong, so nobody noticed.

   Every block here checks for the elements it needs and returns quietly if
   the page does not have them, so one file is safe on all pages.
   =========================================================================== */

(function () {
  'use strict';

  /* -------------------------------------------------------------------------
     Publish the header's real height so the page below can clear it.

     .sticky-bar is position:fixed, so it takes up no room in the flow and
     everything after it would slide underneath. Its height is not a constant
     we can hard-code either — it is 113px on a desktop and 109px on a phone,
     where the tagline takes a row of its own, and it changes again if the nav
     ever gains a link.

     So measure it and hand the number to CSS as --header-height.
     /site.css spends it in exactly one place: the padding on .subnav-wrap.
     ------------------------------------------------------------------------- */
  function publishHeaderHeight() {
    var bar = document.querySelector('.sticky-bar');
    if (!bar) return;
    document.documentElement.style.setProperty(
      '--header-height', bar.offsetHeight + 'px'
    );
  }

  window.addEventListener('load', publishHeaderHeight);
  window.addEventListener('resize', publishHeaderHeight);

  /* -------------------------------------------------------------------------
     Carry the pasted vehicle link into the text message.

     Without this the send button is a plain "sms:" link, so whatever the
     customer pasted is dropped and their messaging app opens empty. They
     assume it sent; Terry never hears from them.

     Note the "?&" before body: iOS wants "sms:number&body=", Android wants
     "sms:number?body=". "?&" is the one form both accept.
     ------------------------------------------------------------------------- */
  function wireHookInput() {
    var PHONE = '6098658811';
    var input = document.querySelector('.hook-input');
    var send = document.querySelector('.hook-send');
    if (!input || !send) return;

    function messageFor(link) {
      return "Hi Terry - I'm looking at this vehicle: " + link +
             ' . What does it pencil out to?';
    }

    function updateSendLink() {
      var link = input.value.trim();
      // With nothing pasted, leave the plain link so the app still opens and
      // they can type freely.
      send.href = link
        ? 'sms:' + PHONE + '?&body=' + encodeURIComponent(messageFor(link))
        : 'sms:' + PHONE;
    }

    input.addEventListener('input', updateSendLink);
    input.addEventListener('change', updateSendLink);

    // Enter should send, not just sit there.
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        updateSendLink();
        send.click();
      }
    });

    updateSendLink();
  }

  // This file is loaded with defer, so the document is already parsed.
  wireHookInput();
  publishHeaderHeight();
})();
