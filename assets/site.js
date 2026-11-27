// Site behaviour: contour lines that draw themselves, scroll reveals, and the home
// header turning solid on scroll.
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
    var targets = document.querySelectorAll('.project, .about, .post-content > h2, .post-content > .model');
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

  function ready(fn) {
    if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function () { drawContours(); reveals(); smartHeader(); });
})();
