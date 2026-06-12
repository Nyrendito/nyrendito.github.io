/* Foreman shared client helpers for the hosted quote/invoice pages.
   No dependencies. Loaded by /q/ and /i/. */
(function (global) {
  'use strict';

  // Public, token-gated edge functions. The share token is the capability.
  var BASE = 'https://whsewdldetjddcvxqifo.supabase.co';
  var ANON =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indoc2V3ZGxkZXRqZGRjdnhxaWZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjQ0MTYsImV4cCI6MjA5NjcwMDQxNn0.szFK4HxjjBR4gmx772s5aP6at6RpqT_6ZOiklte6wiE';

  function headers() {
    return {
      'apikey': ANON,
      'Authorization': 'Bearer ' + ANON,
      'content-type': 'application/json'
    };
  }

  // Read ?token= (also tolerate a bare ?TOKEN or last path segment fallback).
  function getToken() {
    var p = new URLSearchParams(global.location.search);
    var t = p.get('token');
    if (t) return t.trim();
    // tolerate ?<token> with no key
    if (global.location.search.length > 1 && !global.location.search.includes('=')) {
      return decodeURIComponent(global.location.search.slice(1)).trim();
    }
    return '';
  }

  function fetchDocument(kind, token) {
    return fetch(BASE + '/functions/v1/get-shared-document', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ kind: kind, token: token })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { status: res.status, ok: res.ok, data: data };
      });
    });
  }

  function acceptQuote(payload) {
    return fetch(BASE + '/functions/v1/accept-quote', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { status: res.status, ok: res.ok, data: data };
      });
    });
  }

  // ---- formatting ----
  function money(n, currency) {
    var v = Number(n || 0);
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency || 'USD',
        minimumFractionDigits: v % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2
      }).format(v);
    } catch (e) {
      return '$' + v.toFixed(v % 1 === 0 ? 0 : 2);
    }
  }

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Two-letter monogram for the logo badge fallback.
  function initials(name) {
    if (!name) return 'F';
    var parts = String(name).trim().split(/\s+/).slice(0, 2);
    return parts.map(function (p) { return p.charAt(0).toUpperCase(); }).join('') || 'F';
  }

  // Build "qty × unit_price" subtitle when meaningful.
  function lineQty(line) {
    var qty = Number(line.quantity);
    var unit = (line.unit || '').trim();
    var price = line.unit_price;
    var hasQty = isFinite(qty) && qty !== 0;
    var bits = [];
    if (hasQty) {
      var q = qty % 1 === 0 ? String(qty) : String(qty);
      bits.push(unit ? q + ' ' + unit : q);
    } else if (unit) {
      bits.push(unit);
    }
    if (price != null && isFinite(Number(price)) && hasQty) {
      bits.push('× ' + money(price));
    }
    return bits.join(' ');
  }

  global.Foreman = {
    BASE: BASE,
    getToken: getToken,
    fetchDocument: fetchDocument,
    acceptQuote: acceptQuote,
    money: money,
    formatDate: formatDate,
    escapeHtml: escapeHtml,
    initials: initials,
    lineQty: lineQty
  };
})(window);
