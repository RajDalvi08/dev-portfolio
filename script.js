/**
 * Smooth Scroll-Driven Frame Animation Engine
 * Features:
 * - High-performance HTML5 Canvas rendering
 * - Retina / HiDPI crisp scaling
 * - Aspect-ratio preserving dynamic cover fitting
 * - Linear Interpolation (LERP) for buttery 60fps/120fps scrolling
 * - Full asynchronous preloading with glowing progress indicator
 */

(function () {
  'use strict';

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  const CONFIG = {
    totalFrames: 240,
    lerpFactor: 0.085, // Smooth inertia weight (0.05 = heavier, 0.12 = snappier)
    framePath: (index) => `frames/frame_${String(index + 1).padStart(6, '0')}.jpg`,
    concurrentPreload: 12, // Concurrent image load batch size for optimal throughput
  };

  // ==========================================================================
  // DOM ELEMENTS
  // ==========================================================================
  const canvas = document.getElementById('frame-canvas');
  const ctx = canvas.getContext('2d', { alpha: false }); // Disable alpha for faster render
  const loader = document.getElementById('loader');
  const loaderBar = document.getElementById('loader-bar');
  const loaderPercent = document.getElementById('loader-percent');
  const scrollHint = document.getElementById('scroll-hint');

  // ==========================================================================
  // STATE
  // ==========================================================================
  const images = new Array(CONFIG.totalFrames);
  let loadedCount = 0;
  let targetProgress = 0;
  let currentProgress = 0;
  let currentFrameIndex = -1;
  let isLoaded = false;
  let needsRedraw = true;

  // ==========================================================================
  // CANVAS SIZING & RENDERING
  // ==========================================================================
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2 for performance
    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;

    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = Math.round(displayWidth * dpr);
      canvas.height = Math.round(displayHeight * dpr);
      needsRedraw = true;
    }
  }

  function drawFrame(index) {
    const img = images[index];
    if (!img || !img.complete || !img.naturalWidth) return;

    const canvasW = canvas.width;
    const canvasH = canvas.height;
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;

    // Calculate 'object-fit: cover' centered crop
    const scale = Math.max(canvasW / imgW, canvasH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const drawX = (canvasW - drawW) / 2;
    const drawY = (canvasH - drawH) / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }

  // ==========================================================================
  // SMOOTH SCROLL TRACKING (LERP)
  // ==========================================================================
  function updateScrollTarget() {
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    
    targetProgress = maxScroll > 0 ? Math.min(1, Math.max(0, scrollY / maxScroll)) : 0;

    // Fade out scroll indicator when user starts scrolling
    if (scrollHint) {
      if (targetProgress > 0.015) {
        scrollHint.classList.add('faded');
      } else {
        scrollHint.classList.remove('faded');
      }
    }
  }

  function renderLoop() {
    // Linear interpolation for smooth gliding
    const progressDiff = targetProgress - currentProgress;
    if (Math.abs(progressDiff) > 0.00005) {
      currentProgress += progressDiff * CONFIG.lerpFactor;
    } else {
      currentProgress = targetProgress;
    }

    // Map progress (0.0 to 1.0) to frame index (0 to totalFrames - 1)
    const targetFrame = Math.min(
      CONFIG.totalFrames - 1,
      Math.max(0, Math.round(currentProgress * (CONFIG.totalFrames - 1)))
    );

    // Only redraw when the target frame changes or canvas resized
    if (targetFrame !== currentFrameIndex || needsRedraw) {
      drawFrame(targetFrame);
      currentFrameIndex = targetFrame;
      needsRedraw = false;
    }

    requestAnimationFrame(renderLoop);
  }

  // ==========================================================================
  // PRELOADER & ASSET PIPELINE
  // ==========================================================================
  function updateProgress() {
    const percent = Math.round((loadedCount / CONFIG.totalFrames) * 100);
    loaderBar.style.width = `${percent}%`;
    loaderPercent.textContent = `${percent}%`;

    // Render initial frame as soon as frame 0 is ready
    if (loadedCount === 1 && images[0]?.complete) {
      resizeCanvas();
      drawFrame(0);
      currentFrameIndex = 0;
    }

    // All frames loaded
    if (loadedCount >= CONFIG.totalFrames && !isLoaded) {
      isLoaded = true;
      setTimeout(() => {
        loader.classList.add('loaded');
        resizeCanvas();
        needsRedraw = true;
      }, 300);
    }
  }

  function preloadImages() {
    resizeCanvas();

    // Priority load: frame 0 first for instant display
    const firstImg = new Image();
    firstImg.src = CONFIG.framePath(0);
    firstImg.onload = firstImg.onerror = () => {
      images[0] = firstImg;
      loadedCount++;
      updateProgress();
      loadRemainingFrames();
    };
  }

  function loadRemainingFrames() {
    let currentIndex = 1;

    function loadNext() {
      if (currentIndex >= CONFIG.totalFrames) return;
      const index = currentIndex++;
      const img = new Image();
      img.src = CONFIG.framePath(index);
      
      const onDone = () => {
        images[index] = img;
        loadedCount++;
        updateProgress();
        loadNext();
      };

      img.onload = onDone;
      img.onerror = () => {
        console.warn(`Frame ${index} failed to load, continuing...`);
        onDone();
      };
    }

    // Spin up concurrent worker streams
    const workers = Math.min(CONFIG.concurrentPreload, CONFIG.totalFrames - 1);
    for (let w = 0; w < workers; w++) {
      loadNext();
    }
  }

  // Event listeners
  if (scrollHint) {
    scrollHint.addEventListener('click', () => {
      const aboutSection = document.getElementById('about');
      if (aboutSection) {
        aboutSection.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' });
      }
    });
  }

  // Active navigation link tracking on scroll
  const navLinks = document.querySelectorAll('.nav-pill-link');
  const sectionIds = ['about', 'projects', 'services', 'testimonials', 'contact'];
  const sections = sectionIds.map(id => document.getElementById(id)).filter(Boolean);

  function updateActiveNav() {
    const scrollPos = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (scrollPos < 450) {
      navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === '#about');
      });
      return;
    }

    let currentSectionId = '';
    for (let i = sections.length - 1; i >= 0; i--) {
      const sec = sections[i];
      if (scrollPos >= sec.offsetTop - 250) {
        currentSectionId = sec.id;
        break;
      }
    }

    if (currentSectionId) {
      navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${currentSectionId}`);
      });
    }
  }

  window.addEventListener('scroll', () => {
    updateScrollTarget();
    updateActiveNav();
  }, { passive: true });

  window.addEventListener('resize', () => {
    resizeCanvas();
    needsRedraw = true;
  });

  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      resizeCanvas();
      needsRedraw = true;
    }, 100);
  });

  // Start initialization
  updateScrollTarget();
  preloadImages();
  requestAnimationFrame(renderLoop);

})();
