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

  // Decline a quote. Same edge function as acceptQuote, but with { decline:true }.
  // Returns { ok, status:'declined' } on success — same fetch/return shape.
  function declineQuote(token) {
    return fetch(BASE + '/functions/v1/accept-quote', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ token: token, decline: true })
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
      return new Intl.NumberFormat('en-US', {
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

  // Stripe platform publishable key (Stripe ▸ Developers ▸ API keys). Used by the
  // invoice page to confirm a card / Apple Pay payment via Stripe.js. Safe to ship
  // publicly. Leave as-is until you paste your real pk_… key.
  var STRIPE_PK = 'pk_test_51TbjtC14nvKH18XdpLlOQlGcpk8gxFPbBnTYvRg6rHexGS6tfU81JNxQuQ2J8jFukUwsnVmgmEbyokKuBaIYrbyB00euIBhqlP';

  // Ask the backend to create a PaymentIntent for an invoice/quote balance.
  function createPaymentIntent(kind, token, amount_cents) {
    return fetch(BASE + '/functions/v1/create-payment-intent', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ kind: kind, token: token, amount_cents: amount_cents })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { status: res.status, ok: res.ok, data: data };
      });
    });
  }

  // ---- celebration ----
  // One-second cash-green confetti burst for terminal states (Paid / Accepted).
  // Dependency-free canvas. No-ops when the user prefers reduced motion.
  function fireConfetti() {
    try {
      if (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    } catch (e) {}
    var doc = global.document;
    if (!doc || !doc.body) return;

    var canvas = doc.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;' +
      'pointer-events:none;z-index:9998';
    var dpr = global.devicePixelRatio || 1;
    var W = global.innerWidth, H = global.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    doc.body.appendChild(canvas);
    var cx = canvas.getContext('2d');
    cx.scale(dpr, dpr);

    // Cash-green palette (light + dark variants) with a couple of brighter sparks.
    var colors = ['#1e7f4f', '#34c779', '#2faa64', '#7bdca3', '#0f6b40'];
    var N = 90;
    var parts = [];
    for (var i = 0; i < N; i++) {
      parts.push({
        x: W / 2 + (Math.random() - 0.5) * W * 0.4,
        y: H * 0.32 + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 9,
        vy: Math.random() * -11 - 4,
        size: 5 + Math.random() * 6,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.4,
        color: colors[(Math.random() * colors.length) | 0]
      });
    }

    var start = (global.performance && global.performance.now) ? global.performance.now() : Date.now();
    var DURATION = 1000;
    var grav = 0.32;

    function frame(now) {
      var t = (typeof now === 'number' ? now : Date.now()) - start;
      cx.clearRect(0, 0, W, H);
      var alpha = t > DURATION ? Math.max(0, 1 - (t - DURATION) / 250) : 1;
      for (var j = 0; j < parts.length; j++) {
        var p = parts[j];
        p.vy += grav;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        cx.save();
        cx.globalAlpha = alpha;
        cx.translate(p.x, p.y);
        cx.rotate(p.rot);
        cx.fillStyle = p.color;
        cx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        cx.restore();
      }
      if (t < DURATION + 250) {
        global.requestAnimationFrame(frame);
      } else if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    }
    global.requestAnimationFrame(frame);
  }

  global.Foreman = {
    BASE: BASE,
    STRIPE_PK: STRIPE_PK,
    getToken: getToken,
    fetchDocument: fetchDocument,
    acceptQuote: acceptQuote,
    declineQuote: declineQuote,
    createPaymentIntent: createPaymentIntent,
    money: money,
    formatDate: formatDate,
    escapeHtml: escapeHtml,
    initials: initials,
    lineQty: lineQty,
    fireConfetti: fireConfetti
  };
})(window);
