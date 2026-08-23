/**
 * TRH vertical SoR — browser-local persistence (POC).
 * Package persist ≠ canonical; canonicalization is an explicit White Move.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'trh.cases.v1';

  function loadAll() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveAll(map) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  }

  global.TrhSor = {
    list: function () {
      const map = loadAll();
      return Object.keys(map).map(function (id) {
        return map[id];
      });
    },
    get: function (caseId) {
      return loadAll()[caseId] || null;
    },
    upsert: function (record) {
      const map = loadAll();
      map[record.case_id] = record;
      saveAll(map);
      return record;
    },
    remove: function (caseId) {
      const map = loadAll();
      delete map[caseId];
      saveAll(map);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
