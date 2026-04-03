// Mintlify auto-injects JS files from the docs directory into all pages.
// This script disables mobile zoom on all browsers.

(function() {
  'use strict';

  var LOCKED_VIEWPORT = 'width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, viewport-fit=cover';

  // Lock all viewport meta tags in the document
  function lockAllViewports() {
    var metas = document.querySelectorAll('meta[name="viewport"]');
    for (var i = 0; i < metas.length; i++) {
      if (metas[i].getAttribute('content') !== LOCKED_VIEWPORT) {
        metas[i].setAttribute('content', LOCKED_VIEWPORT);
      }
    }
  }

  // Initial lock
  lockAllViewports();

  // Observe <head> for any DOM changes (Next.js hydration, etc.) and re-lock
  var head = document.head || document.getElementsByTagName('head')[0];
  if (head && typeof MutationObserver !== 'undefined') {
    new MutationObserver(function() {
      lockAllViewports();
    }).observe(head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['content']
    });
  }

  // Gesture-based zoom prevention
  var preventDefault = function(e) {
    e.preventDefault();
  };

  // iOS Safari gesture events
  document.addEventListener('gesturestart', preventDefault, { passive: false });
  document.addEventListener('gesturechange', preventDefault, { passive: false });
  document.addEventListener('gestureend', preventDefault, { passive: false });

  // Multi-touch pinch zoom
  document.addEventListener('touchmove', function(e) {
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });

  // Double-tap zoom prevention
  var lastTouchEnd = 0;
  document.addEventListener('touchend', function(e) {
    var now = Date.now();
    if (now - lastTouchEnd < 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });

  // Inject CSS to disable touch-action zoom
  var style = document.createElement('style');
  style.id = 'disable-mobile-zoom-css';
  style.textContent =
    'html, body, html * {' +
    '  touch-action: pan-x pan-y !important;' +
    '  -ms-touch-action: pan-x pan-y !important;' +
    '  -webkit-touch-callout: none !important;' +
    '}';

  if (document.head) {
    document.head.appendChild(style);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      document.head.appendChild(style);
    });
  }
})();
