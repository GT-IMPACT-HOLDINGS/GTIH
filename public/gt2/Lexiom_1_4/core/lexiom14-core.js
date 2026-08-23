/**
 * Shared Lexiom 1.4 client core helpers (Phase b).
 */
(function (global) {
  'use strict';

  global.Lexiom14Core = {
    waitForEvent: function (subscribe, predicate, timeoutMs) {
      return new Promise(function (resolve, reject) {
        const t = setTimeout(function () {
          unsub();
          reject(new Error('timeout'));
        }, timeoutMs || 30000);
        const unsub = subscribe(function (ev) {
          if (predicate(ev)) {
            clearTimeout(t);
            unsub();
            resolve(ev);
          }
        });
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
