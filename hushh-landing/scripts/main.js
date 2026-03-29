// scripts/main.js — Scroll animations + hero mockup demo

// ─── Scroll reveal ─────────────────────────────────────────────────────────

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
);

document.querySelectorAll('.reveal, .reveal-stagger').forEach(el => {
  revealObserver.observe(el);
});

// ─── Hero mockup: animated blur demo ──────────────────────────────────────
// Loops through a sequence: hover highlight → click → blur appears → follow

const demoInput   = document.getElementById('demoInput');
const demoChat    = document.getElementById('demoChat');
const demoCursor  = document.getElementById('demoCursor');
const blurOverlay = document.getElementById('demoBlurOverlay');
const chatBlur    = document.getElementById('chatBlurWord');

const DEMO_SECRET = 'sk-abc123xyz789';

let demoPhase = 0;
let demoTimer = null;

function runDemoSequence() {
  clearTimeout(demoTimer);
  demoPhase = 0;
  nextDemoStep();
}

function nextDemoStep() {
  switch (demoPhase) {
    case 0:
      // Reset
      if (demoInput)  demoInput.classList.remove('selected');
      if (blurOverlay) blurOverlay.classList.remove('active');
      if (chatBlur)   chatBlur.style.filter = '';
      demoTimer = setTimeout(nextDemoStep, 800);
      break;

    case 1:
      // Hover: dashed outline on input
      if (demoInput) demoInput.classList.add('selected');
      demoTimer = setTimeout(nextDemoStep, 1200);
      break;

    case 2:
      // Click: blur the input
      if (blurOverlay) blurOverlay.classList.add('active');
      demoTimer = setTimeout(nextDemoStep, 700);
      break;

    case 3:
      // Value "follows" to chat — blur the chat word too
      if (chatBlur) chatBlur.style.filter = 'blur(5px)';
      demoTimer = setTimeout(nextDemoStep, 2400);
      break;

    case 4:
      // Loop
      demoPhase = -1; // will become 0 after increment
      demoTimer = setTimeout(nextDemoStep, 600);
      break;
  }
  demoPhase++;
}

// Start demo once hero is visible
const heroObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        runDemoSequence();
      }
    });
  },
  { threshold: 0.3 }
);

const heroBrowserMock = document.querySelector('.hero-visual');
if (heroBrowserMock) heroObserver.observe(heroBrowserMock);

// ─── Smooth-scroll for "See how it works" link ─────────────────────────────

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const id = link.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ─── Recording timer (cosmetic) ────────────────────────────────────────────

const recTime = document.getElementById('recTime');
if (recTime) {
  let seconds = 0;
  setInterval(() => {
    seconds++;
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    recTime.textContent = `${m}:${s}`;
  }, 1000);
}
