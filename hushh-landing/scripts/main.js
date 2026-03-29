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
      if (demoInput)  demoInput.classList.remove('selected');
      if (blurOverlay) blurOverlay.classList.remove('active');
      if (chatBlur)   chatBlur.style.filter = '';
      demoTimer = setTimeout(nextDemoStep, 800);
      break;

    case 1:
      if (demoInput) demoInput.classList.add('selected');
      demoTimer = setTimeout(nextDemoStep, 1200);
      break;

    case 2:
      if (blurOverlay) blurOverlay.classList.add('active');
      demoTimer = setTimeout(nextDemoStep, 700);
      break;

    case 3:
      if (chatBlur) chatBlur.style.filter = 'blur(5px)';
      demoTimer = setTimeout(nextDemoStep, 2400);
      break;

    case 4:
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


const qbNavDash   = document.getElementById('qbNavDash');
const qbNavTxn    = document.getElementById('qbNavTxn');
const qbScreenDash = document.getElementById('qbScreenDash');
const qbScreenTxn  = document.getElementById('qbScreenTxn');
const qbBalance1  = document.getElementById('qbBalance1');
const qbCursor    = document.getElementById('qbCursor');
const qbTip       = document.getElementById('qbTip');
const hushhFollowed = document.getElementById('hushhFollowed');
const qbContent   = document.getElementById('qbContent');

let qbTimer = null;

function resetQB() {
  clearTimeout(qbTimer);
  qbScreenDash?.classList.remove('qb-screen-off');
  qbScreenTxn?.classList.add('qb-screen-off');
  qbNavDash?.classList.add('qb-nav-active');
  qbNavTxn?.classList.remove('qb-nav-active', 'qb-nav-txn-active');
  qbBalance1?.classList.remove('qb-hovered', 'qb-blurred');
  qbCursor?.classList.remove('visible', 'click');
  qbTip?.classList.remove('visible');
  hushhFollowed?.classList.remove('visible');
}

function runQBSequence() {
  resetQB();
  qbTimer = setTimeout(() => {
    if (qbCursor && qbBalance1 && qbContent) {
      const balRect = qbBalance1.getBoundingClientRect();
      const conRect = qbContent.getBoundingClientRect();
      const cx = balRect.left - conRect.left + balRect.width * 0.4;
      const cy = balRect.top  - conRect.top  + balRect.height * 0.5;
      qbCursor.style.left = cx + 'px';
      qbCursor.style.top  = cy + 'px';
      qbCursor.classList.add('visible');
    }
    qbBalance1?.classList.add('qb-hovered');

    qbTimer = setTimeout(() => {
      if (qbCursor && qbTip && qbContent) {
        const cx = parseFloat(qbCursor.style.left);
        const cy = parseFloat(qbCursor.style.top);
        qbTip.style.left = (cx + 16) + 'px';
        qbTip.style.top  = (cy - 22) + 'px';
      }
      qbTip?.classList.add('visible');


      qbTimer = setTimeout(() => {
        qbTip?.classList.remove('visible');
        qbCursor?.classList.add('click');
        qbBalance1?.classList.remove('qb-hovered');

        qbTimer = setTimeout(() => {
          qbBalance1?.classList.add('qb-blurred');
          qbCursor?.classList.remove('visible', 'click');

          qbTimer = setTimeout(() => {
            qbNavDash?.classList.remove('qb-nav-active');
            qbNavTxn?.classList.add('qb-nav-txn-active');

            qbTimer = setTimeout(() => {
              qbScreenDash?.classList.add('qb-screen-off');
              qbScreenTxn?.classList.remove('qb-screen-off');

              qbTimer = setTimeout(() => {
                hushhFollowed?.classList.add('visible');

                qbTimer = setTimeout(runQBSequence, 3200);
              }, 700);
            }, 400);
          }, 1000);
        }, 300);
      }, 900);
    }, 500);
  }, 1000);
}

const qbSection = document.querySelector('.screen-recording-frame');
if (qbSection) {
  const qbObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          runQBSequence();
          qbObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 }
  );
  qbObserver.observe(qbSection);
}

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

const recTime = document.getElementById('recTime');
if (recTime) {
  let seconds = 0;
  setInterval(() => {
    seconds = (seconds + 1) % 600;
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    recTime.textContent = `${m}:${s}`;
  }, 1000);
}
