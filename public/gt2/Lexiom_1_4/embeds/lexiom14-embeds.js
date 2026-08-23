/**
 * Lexiom 1.4 embed helpers (Phase b).
 * Thin wrappers; primary mount API lives on Lexiom14Sdk.embed.
 */
(function (global) {
  'use strict';

  global.Lexiom14Embeds = {
    /**
     * Apply design tokens as CSS variables on a host element.
     */
    applyTokens: function (el, tokens) {
      if (!el || !tokens) return;
      const colors = tokens.colors || {};
      Object.keys(colors).forEach(function (k) {
        el.style.setProperty('--lexiom14-' + k, colors[k]);
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
