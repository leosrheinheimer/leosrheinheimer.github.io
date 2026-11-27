// Site behaviour: contour lines that draw themselves, scroll reveals, the home
// header turning solid on scroll, a contents rail beside long write-ups, and a
// click-to-zoom lightbox for photos and plots.
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

  // ---- Contents rail: the inline contents list follows the reader ---------
  function tocRail() {
    var toc = document.querySelector('.post-content .toc');
    if (!toc) return;
    var items = [];
    toc.querySelectorAll('a[href^="#"]').forEach(function (a) {
      var target = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
      if (target) items.push({ label: a.textContent, target: target });
    });
    if (items.length < 3) return;

    var rail = document.createElement('nav');
    rail.className = 'toc-rail';
    rail.setAttribute('aria-label', 'Contents');
    var ol = document.createElement('ol');
    items.forEach(function (item, i) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + item.target.id;
      var n = document.createElement('span');
      n.className = 'toc-rail__n';
      n.textContent = (i < 9 ? '0' : '') + (i + 1);
      var t = document.createElement('span');
      t.textContent = item.label;
      a.appendChild(n); a.appendChild(t);
      li.appendChild(a); ol.appendChild(li);
      item.link = a;
    });
    rail.appendChild(ol);
    document.body.appendChild(rail);

    var footer = document.querySelector('.site-footer');
    var ticking = false;
    function update() {
      ticking = false;
      var pastToc = toc.getBoundingClientRect().bottom < 0;
      var railBottom = rail.getBoundingClientRect().top + ol.offsetHeight + 24;
      var beforeFooter = !footer || footer.getBoundingClientRect().top > railBottom;
      rail.classList.toggle('is-shown', pastToc && beforeFooter);
      var line = window.innerHeight * 0.3, active = null;
      items.forEach(function (item) { if (item.target.getBoundingClientRect().top < line) active = item; });
      items.forEach(function (item) { item.link.classList.toggle('is-active', item === active); });
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  // ---- Lightbox: click a photo or plot to see it full size ----------------
  function lightbox() {
    if (!window.HTMLDialogElement) return;
    var imgs = document.querySelectorAll('.post-content img');
    if (!imgs.length) return;

    var dlg = document.createElement('dialog');
    dlg.className = 'lightbox';
    dlg.setAttribute('aria-label', 'Enlarged image');
    var close = document.createElement('button');
    close.className = 'lightbox__close';
    close.type = 'button';
    close.textContent = 'CLOSE ✕';
    var big = document.createElement('img');
    var cap = document.createElement('p');
    dlg.appendChild(close); dlg.appendChild(big); dlg.appendChild(cap);
    document.body.appendChild(dlg);

    dlg.addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('close', function () { root.style.overflow = ''; big.removeAttribute('src'); });

    function captionFor(img) {
      // The caption is the italic-only paragraph right after the image's paragraph.
      var block = img.closest('p') || img;
      var next = block.nextElementSibling;
      if (next && next.tagName === 'P' && next.children.length === 1 && next.firstElementChild.tagName === 'EM') {
        return next.textContent.trim();
      }
      return img.alt || '';
    }

    function open(img) {
      big.src = img.currentSrc || img.src;
      big.alt = img.alt;
      cap.textContent = captionFor(img);
      cap.hidden = !cap.textContent;
      root.style.overflow = 'hidden';
      dlg.showModal();
    }

    imgs.forEach(function (img) {
      if (img.closest('a')) return;
      img.classList.add('zoomable');
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', 'Enlarge image: ' + (img.alt || 'image'));
      img.addEventListener('click', function () { open(img); });
      img.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(img); }
      });
    });
  }

  function ready(fn) {
    if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function () { drawContours(); reveals(); smartHeader(); tocRail(); lightbox(); });
})();
