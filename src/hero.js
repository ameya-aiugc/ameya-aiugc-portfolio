/**
 * AMEYA PORTFOLIO — Hero scroll-driven frame animation
 * Stage 1: Hero + Navigation
 *
 * Implementation:
 *  - .hero section is 500vh tall; .hero-sticky is position:sticky top:0 100vh.
 *  - As the user scrolls through the 500vh, we map scroll progress (0..1)
 *    to frame index (0..239) and drawImage() onto the canvas each rAF tick.
 *  - First 12 frames are loaded eagerly so the canvas is never blank.
 *  - Remaining frames are loaded in background batches (20 at a time).
 *  - Canvas is sized to the actual display px dimensions (respects dpr, capped at 2x).
 *  - drawImage uses cover-fit math to handle any aspect ratio viewport.
 *  - prefers-reduced-motion: canvas hidden via CSS, static <img> shown.
 */
(function () {
  'use strict';

  /* ─── Constants ──────────────────────────────────────────── */
  const TOTAL_FRAMES  = 240;
  const FRAME_DIR     = 'assets/hero/hero-scroll-frames/';
  const EAGER_COUNT   = 12;   /* frames loaded before first paint */
  const BATCH_SIZE    = 24;   /* background batch size */
  const BATCH_DELAY   = 60;   /* ms between batches */
  /* Hero section is 500vh — scroll from 0 to (500 * innerHeight) drives frames */
  const HERO_VH       = 500;

  /* ─── Reduced-motion bail-out ────────────────────────────── */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ─── DOM refs ───────────────────────────────────────────── */
  const canvas     = document.getElementById('hero-canvas');
  const ctx        = canvas.getContext('2d');
  const nav        = document.getElementById('site-nav');
  const scrollHint = document.getElementById('hero-scroll-hint');
  const heroEl     = document.querySelector('.hero');

  /* ─── State ──────────────────────────────────────────────── */
  const images     = new Array(TOTAL_FRAMES).fill(null);
  let   drawnFrame = -1;   /* last frame actually painted */
  let   wantFrame  = 0;    /* frame we want to show */
  let   rafId      = null;

  /* ─── Path helper ────────────────────────────────────────── */
  function frameSrc(i) {
    return FRAME_DIR + 'frame_' + String(i).padStart(4, '0') + '.png';
  }

  /* ─── Load one frame ─────────────────────────────────────── */
  function loadFrame(i) {
    return new Promise(resolve => {
      if (images[i]) { resolve(images[i]); return; }
      const img = new Image();
      img.onload  = () => { images[i] = img; resolve(img); };
      img.onerror = () => resolve(null);
      img.src     = frameSrc(i);
    });
  }

  /* ─── Cover-fit paint ────────────────────────────────────── */
  function paintFrame(index) {
    const img = images[index];
    if (!img) return false;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth  || 1920;
    const ih = img.naturalHeight || 1080;

    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    /* Center horizontally; on mobile shift left slightly to show subject */
    const subjectOffsetX = (cw < 600) ? 0.12 : 0; /* nudge toward subject */
    const dx = (cw - dw) / 2 + dw * subjectOffsetX;
    const dy = (ch - dh) / 2;

    ctx.drawImage(img, dx, dy, dw, dh);
    drawnFrame = index;
    return true;
  }

  /* ─── Canvas sizing ──────────────────────────────────────── */
  function sizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr  = Math.min(window.devicePixelRatio || 1, 2);
    const w    = Math.round(rect.width  * dpr);
    const h    = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width  = w;
      canvas.height = h;
      drawnFrame = -1; /* force repaint */
    }
  }

  /* ─── Map scroll → frame index ───────────────────────────── */
  function scrollToFrame() {
    const scrollY = window.scrollY || window.pageYOffset;
    const heroH   = HERO_VH * window.innerHeight;
    const t       = Math.max(0, Math.min(1, scrollY / heroH));
    return Math.round(t * (TOTAL_FRAMES - 1));
  }

  /* ─── rAF render loop ────────────────────────────────────── */
  function renderLoop() {
    rafId = requestAnimationFrame(renderLoop);

    if (wantFrame === drawnFrame) return; /* nothing to do */

    /* Try to paint the exact wanted frame */
    if (images[wantFrame]) {
      paintFrame(wantFrame);
      return;
    }

    /* Fallback: find nearest loaded frame below wantFrame */
    let fallback = wantFrame - 1;
    while (fallback >= 0 && !images[fallback]) fallback--;
    if (fallback >= 0 && images[fallback]) {
      paintFrame(fallback);
    }
  }

  /* ─── Scroll handler ─────────────────────────────────────── */
  function onScroll() {
    const scrollY = window.scrollY || window.pageYOffset;

    wantFrame = scrollToFrame();

    /* Nav background */
    nav.classList.toggle('is-scrolled', scrollY > 10);

    /* Scroll hint */
    if (scrollHint) {
      scrollHint.classList.toggle('is-hidden', scrollY > window.innerHeight * 0.12);
    }
  }

  /* ─── Background batch loader ────────────────────────────── */
  function loadBatch(start) {
    const end = Math.min(start + BATCH_SIZE, TOTAL_FRAMES);
    const pending = [];
    for (let i = start; i < end; i++) {
      if (!images[i]) pending.push(loadFrame(i));
    }
    Promise.all(pending).then(() => {
      if (end < TOTAL_FRAMES) {
        setTimeout(() => loadBatch(end), BATCH_DELAY);
      }
    });
  }

  /* ─── Mobile nav toggle ──────────────────────────────────── */
  function setupMobileNav() {
    const toggle = document.querySelector('.nav-toggle');
    const menu   = document.getElementById('nav-mobile-menu');
    if (!toggle || !menu) return;

    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      menu.setAttribute('aria-hidden', String(open));
      menu.classList.toggle('is-open', !open);
    });

    menu.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        toggle.setAttribute('aria-expanded', 'false');
        menu.setAttribute('aria-hidden', 'true');
        menu.classList.remove('is-open');
      });
    });
  }

  /* ─── Smooth anchor scroll ───────────────────────────────── */
  function setupAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const id  = a.getAttribute('href').slice(1);
        const el  = document.getElementById(id);
        if (!el) return;
        e.preventDefault();
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /* ─── Init ───────────────────────────────────────────────── */
  async function init() {
    sizeCanvas();
    window.addEventListener('resize', sizeCanvas, { passive: true });

    /* Eagerly load the first N frames */
    const eager = [];
    for (let i = 0; i < Math.min(EAGER_COUNT, TOTAL_FRAMES); i++) {
      eager.push(loadFrame(i));
    }
    await Promise.all(eager);

    /* First paint */
    paintFrame(0);

    /* Start render loop */
    renderLoop();

    /* Wire up scroll */
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); /* sync to current position */

    /* Background load the rest */
    loadBatch(EAGER_COUNT);

    /* UI setup */
    setupMobileNav();
    setupAnchors();
  }

  /* Boot */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
