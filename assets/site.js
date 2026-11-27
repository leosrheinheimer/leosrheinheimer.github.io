// Site behaviour: contour lines that draw themselves, scroll reveals, the home
// header turning solid on scroll, and the interactive load-torque chart on HOLD.
// Everything here is progressive: without JavaScript the page still works, and
// with "reduce motion" switched on nothing animates.

(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  // ---- Contour lines draw on load ------------------------------------------
  function drawContours() {
    var hosts = document.querySelectorAll('.hero__contours, .page-head__contours');
    if (!hosts.length || reduceMotion || !window.fetch) return;
    fetch(root.dataset.contours).then(function (r) { return r.text(); }).then(function (text) {
      var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      var src = doc.documentElement;
      hosts.forEach(function (host) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', src.getAttribute('viewBox'));
        svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
        svg.setAttribute('class', 'contours-svg');
        svg.setAttribute('aria-hidden', 'true');
        var g = document.createElementNS(svg.namespaceURI, 'g');
        g.setAttribute('fill', 'none');
        g.setAttribute('stroke', '#000');
        g.setAttribute('stroke-linejoin', 'round');
        g.setAttribute('stroke-linecap', 'round');
        svg.appendChild(g);
        // Each source path holds many contours; split them so each one draws on its own.
        src.querySelectorAll('path').forEach(function (p) {
          var d = p.getAttribute('d').split('M').filter(Boolean);
          d.forEach(function (seg) {
            var path = document.createElementNS(svg.namespaceURI, 'path');
            path.setAttribute('d', 'M' + seg);
            path.setAttribute('stroke-opacity', p.getAttribute('stroke-opacity'));
            path.setAttribute('stroke-width', p.getAttribute('stroke-width'));
            g.appendChild(path);
          });
        });
        host.insertBefore(svg, host.firstChild);
        host.classList.add('is-live');
        var paths = g.querySelectorAll('path');
        paths.forEach(function (path) {
          var len = path.getTotalLength();
          path.style.strokeDasharray = len;
          path.style.strokeDashoffset = len;
        });
        // Next frame: start the draw, longest contours first so the field fills evenly.
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            paths.forEach(function (path, i) {
              var delay = (i % 12) * 0.06 + Math.random() * 0.35;
              path.style.transition = 'stroke-dashoffset 1.8s cubic-bezier(.4,0,.2,1) ' + delay + 's';
              path.style.strokeDashoffset = 0;
            });
          });
        });
      });
    }).catch(function () { /* keep the static background */ });
  }

  // ---- Scroll reveals --------------------------------------------------------
  function reveals() {
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    var targets = document.querySelectorAll('.project, .about, .post-content > h2, .post-content > .model, .post-content > .chart');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    targets.forEach(function (t) {
      // Anything already on screen at load shows immediately.
      if (t.getBoundingClientRect().top < window.innerHeight * 0.92) return;
      t.classList.add('reveal');
      io.observe(t);
    });
  }

  // ---- Home header turns solid once the hero scrolls away -------------------
  function smartHeader() {
    var header = document.querySelector('.site-header--overlay');
    if (!header) return;
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 24); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ---- Interactive load-torque chart (HOLD) ---------------------------------
  function torqueChart() {
    var img = document.querySelector('.post-content img[src$="loadTorque.png"]');
    if (!img) return;

    var angles = [0, 15, 30, 45, 60, 75];
    var lift25 = [290.6, 325.5, 244.1, 188.3, 167.4, 61.6];
    var drop25 = [67.4, 72.1, 79.0, 76.7, 34.9, 39.5];
    var lift21 = [179.6, 260.9, 213.4, 175.8, 131.1, 67.0];
    var drop21 = [89.3, 61.4, 80.9, 64.2, 67.0, 15.3];
    var geo25 = [140.0, 153.2, 138.9, 120.2, 76.4, 49.3];
    var PRED = 127.8, FIT = 154.8;  // mN·m at horizontal: locked prediction, cos fit to √(lift × drop)
    var cos = function (deg) { return Math.cos(deg * Math.PI / 180); };

    var W, H, m = { t: 20, r: 16, b: 46, l: 52 };
    var X = function (a) { return m.l + (a / 75) * (W - m.l - m.r); };
    var Y = function (v) { return H - m.b - (v / 350) * (H - m.t - m.b); };
    var NS = 'http://www.w3.org/2000/svg';
    var el = function (tag, attrs, parent) {
      var n = document.createElementNS(NS, tag);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      if (parent) parent.appendChild(n);
      return n;
    };
    var line = function (xs, ys) {
      return xs.map(function (x, i) { return (i ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(ys[i]).toFixed(1); }).join('');
    };
    var smooth = function (k) {
      var xs = [], ys = [];
      for (var a = 0; a <= 75; a += 1) { xs.push(a); ys.push(k * cos(a)); }
      return line(xs, ys);
    };

    var wrap = document.createElement('figure');
    wrap.className = 'chart';
    var p = img.closest('p');
    p.parentNode.replaceChild(wrap, p);
    var tip = document.createElement('div');
    tip.className = 'chart__tip';

    function render() {
    wrap.innerHTML = '';
    W = Math.round(wrap.clientWidth - 24);
    H = Math.round(W < 520 ? W * 0.9 : W * 0.6);
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img',
      'aria-label': 'Load torque against arm angle: the prediction runs through the band between the drop and lift measurements on both test days.' });
    wrap.appendChild(svg);

    // Grid and axes
    var grid = el('g', { class: 'chart__grid' }, svg);
    for (var v = 0; v <= 350; v += 50) {
      el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }, grid);
      el('text', { x: m.l - 10, y: Y(v) + 4, 'text-anchor': 'end' }, grid).textContent = v;
    }
    angles.forEach(function (a) {
      el('text', { x: X(a), y: H - m.b + 20, 'text-anchor': 'middle' }, grid).textContent = a + '°';
    });
    el('text', { x: (m.l + W - m.r) / 2, y: H - 6, 'text-anchor': 'middle', class: 'chart__axis' }, grid).textContent = 'Arm angle above horizontal';
    el('text', { x: 14, y: (m.t + H - m.b) / 2, 'text-anchor': 'middle', class: 'chart__axis',
      transform: 'rotate(-90 14 ' + (m.t + H - m.b) / 2 + ')' }, grid).textContent = 'Load torque (mN·m)';

    // Data
    var band = line(angles, lift25) + line(angles.slice().reverse(), drop25.slice().reverse()).replace('M', 'L') + 'Z';
    el('path', { d: band, class: 'chart__band' }, svg);
    el('path', { d: line(angles, lift25), class: 'chart__edge' }, svg);
    el('path', { d: line(angles, drop25), class: 'chart__edge' }, svg);
    el('path', { d: line(angles, lift21), class: 'chart__old' }, svg);
    el('path', { d: line(angles, drop21), class: 'chart__old' }, svg);
    el('path', { d: smooth(FIT), class: 'chart__fit' }, svg);
    el('path', { d: smooth(PRED), class: 'chart__pred' }, svg);
    angles.forEach(function (a, i) {
      el('circle', { cx: X(a), cy: Y(geo25[i]), r: 4.5, class: 'chart__dot' + (a === 75 ? ' chart__dot--weak' : '') }, svg);
    });

    // Hover readout
    var cursor = el('line', { class: 'chart__cursor', y1: m.t, y2: H - m.b, x1: -10, x2: -10 }, svg);
    wrap.appendChild(tip);
    var hit = el('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent' }, svg);
    var fmt = function (n) { return n.toFixed(1); };
    var show = function (evt) {
      var box = svg.getBoundingClientRect();
      var px = (evt.clientX - box.left) * (W / box.width);
      var i = Math.round(((px - m.l) / (W - m.l - m.r)) * 5);
      i = Math.max(0, Math.min(5, i));
      var a = angles[i];
      cursor.setAttribute('x1', X(a)); cursor.setAttribute('x2', X(a));
      tip.innerHTML =
        '<strong>' + a + '°' + (a === 75 ? ' <span>(noise-limited)</span>' : '') + '</strong>' +
        '<dl>' +
        '<dt><i class="k k--pred"></i>Predicted</dt><dd>' + fmt(PRED * cos(a)) + '</dd>' +
        '<dt><i class="k k--band"></i>Lift, Nov 25</dt><dd>' + fmt(lift25[i]) + '</dd>' +
        '<dt><i class="k k--band"></i>Drop, Nov 25</dt><dd>' + fmt(drop25[i]) + '</dd>' +
        '<dt><i class="k k--dot"></i>√(lift × drop)</dt><dd>' + fmt(geo25[i]) + '</dd>' +
        '<dt><i class="k k--old"></i>Lift / drop, Nov 21</dt><dd>' + fmt(lift21[i]) + ' / ' + fmt(drop21[i]) + '</dd>' +
        '</dl>';
      tip.classList.add('is-on');
      if (window.matchMedia('(max-width: 760px)').matches) return;
      var left = (X(a) / W) * box.width;
      var tw = tip.offsetWidth;
      tip.style.left = Math.min(Math.max(left - tw / 2, 0), box.width - tw) + 'px';
    };
    hit.addEventListener('pointermove', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', function () {
      tip.classList.remove('is-on');
      cursor.setAttribute('x1', -10); cursor.setAttribute('x2', -10);
    });

    // Legend
    var legend = document.createElement('ul');
    legend.className = 'chart__legend';
    legend.innerHTML =
      '<li><i class="k k--pred"></i>Locked prediction</li>' +
      '<li><i class="k k--band"></i>Drop to lift, Nov 25 (interleaved)</li>' +
      '<li><i class="k k--old"></i>Drop and lift, Nov 21 (locked test)</li>' +
      '<li><i class="k k--dot"></i>√(lift × drop), Nov 25</li>' +
      '<li><i class="k k--fit"></i>Cosine fit to √(lift × drop), +22%</li>';
    wrap.appendChild(legend);
    }

    render();
    var lastW = wrap.clientWidth, t;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () { if (wrap.clientWidth !== lastW) { lastW = wrap.clientWidth; render(); } }, 150);
    });
  }

  function ready(fn) {
    if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function () { torqueChart(); drawContours(); reveals(); smartHeader(); });
})();
