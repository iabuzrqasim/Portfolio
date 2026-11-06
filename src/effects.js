// Hero effects. Loaded only when the visitor has not asked for reduced motion.

const hero = document.querySelector('.hero');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

// Name slides up letter by letter, then becomes plain text so the shine can run across it.
const title = document.querySelector('.hero h1');
const name = title.textContent;
title.setAttribute('aria-label', name);
title.textContent = '';
let letterIndex = 0;
name.split(' ').forEach((word, wordIndex, words) => {
  const group = document.createElement('span');
  group.className = 'word';
  group.setAttribute('aria-hidden', 'true');
  for (const letter of word) {
    const span = document.createElement('span');
    span.className = 'letter';
    span.style.setProperty('--i', letterIndex);
    span.textContent = letter;
    group.append(span);
    letterIndex += 1;
  }
  title.append(group, wordIndex < words.length - 1 ? ' ' : '');
});
title.classList.add('is-split');
setTimeout(() => {
  title.textContent = name;
  title.classList.remove('is-split');
  title.classList.add('is-shining');
}, 400 + letterIndex * 45 + 800);

// Photo tilt and parallax follow the mouse with a little lag.
const tilt = document.querySelector('.portrait');
const aim = { x: 0, y: 0 };
const now = { x: 0, y: 0 };

function moveTilt() {
  now.x += (aim.x - now.x) * 0.07;
  now.y += (aim.y - now.y) * 0.07;
  tilt.style.setProperty('--mx', now.x.toFixed(4));
  tilt.style.setProperty('--my', now.y.toFixed(4));
}

if (finePointer) {
  hero.addEventListener('pointermove', (event) => {
    const box = hero.getBoundingClientRect();
    aim.x = ((event.clientX - box.left) / box.width) * 2 - 1;
    aim.y = ((event.clientY - box.top) / box.height) * 2 - 1;
  }, { passive: true });
  hero.addEventListener('pointerleave', () => {
    aim.x = 0;
    aim.y = 0;
  });

  let frame = 0;
  const loop = () => {
    frame = requestAnimationFrame(loop);
    moveTilt();
  };
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !frame) frame = requestAnimationFrame(loop);
    if (!entry.isIntersecting && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  }).observe(hero);
}
