// scripts/main.js — Scroll animations + hero mockup demo + problem animation

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

const demoInput   = document.getElementById('demoInput');
const blurOverlay = document.getElementById('demoBlurOverlay');
const chatBlur    = document.getElementById('chatBlurWord');

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
      demoPhase = -1;
      demoTimer = setTimeout(nextDemoStep, 600);
      break;
  }
  demoPhase++;
}

const heroBrowserMock = document.querySelector('.hero-visual');
if (heroBrowserMock) {
  const heroObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) runDemoSequence();
      });
    },
    { threshold: 0.3 }
  );
  heroObserver.observe(heroBrowserMock);
}

// ─── Problem section: animated chat sequence ───────────────────────────────

const probMsg1    = document.getElementById('probMsg1');
const probMsg2    = document.getElementById('probMsg2');
const probTyping  = document.getElementById('probTyping');
const probSecret  = document.getElementById('probSecret');
const probWarning = document.getElementById('probWarning');

let probTimer = null;

function resetProbAnim() {
  probMsg1?.classList.remove('visible');
  probMsg2?.classList.remove('visible');
  probTyping?.classList.remove('visible');
  probWarning?.classList.remove('visible');
  probSecret?.classList.remove('exposed');
}

function runProbSequence() {
  clearTimeout(probTimer);
  resetProbAnim();

  // Step 1: Sarah's message fades in
  probTimer = setTimeout(() => {
    probMsg1?.classList.add('visible');

    // Step 2: typing indicator
    probTimer = setTimeout(() => {
      probTyping?.classList.add('visible');

      // Step 3: user reply with secret
      probTimer = setTimeout(() => {
        probTyping?.classList.remove('visible');
        probMsg2?.classList.add('visible');

        // Step 4: highlight the secret as exposed
        probTimer = setTimeout(() => {
          probSecret?.classList.add('exposed');

          // Step 5: warning appears
          probTimer = setTimeout(() => {
            probWarning?.classList.add('visible');

            // Step 6: loop
            probTimer = setTimeout(runProbSequence, 2800);
          }, 600);
        }, 800);
      }, 1400);
    }, 1000);
  }, 400);
}

const probSection = document.querySelector('.screen-recording-frame');
if (probSection) {
  const probObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          runProbSequence();
          probObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );
  probObserver.observe(probSection);
}

// ─── Smooth-scroll for anchor links ────────────────────────────────────────

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
