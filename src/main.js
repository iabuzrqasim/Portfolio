// Header state, mobile menu, screenshot galleries and gentle scroll reveals.
// All content is readable without this file.
const root = document.documentElement;

// Frosted header once the page scrolls, and the progress line at the top.
const header = document.querySelector('.site-header');
const progress = document.querySelector('.progress');
let scrollQueued = false;

function onScroll() {
  scrollQueued = false;
  const distance = root.scrollHeight - innerHeight;
  header.classList.toggle('is-stuck', scrollY > 12);
  progress.style.transform = `scaleX(${distance > 0 ? scrollY / distance : 0})`;
}

addEventListener('scroll', () => {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(onScroll);
}, { passive: true });
addEventListener('resize', onScroll);
onScroll();

// The small header name shows only while the big hero name is out of view.
const brand = document.querySelector('.brand-home');
const bigName = document.querySelector('.hero h1');
if (brand && bigName) {
  new IntersectionObserver(([entry]) => brand.classList.toggle('is-shown', !entry.isIntersecting), {
    rootMargin: `-${header.offsetHeight}px 0px 0px 0px`,
  }).observe(bigName);
}

// Skill chips: one popover open at a time.
const chips = [...document.querySelectorAll('.chip-item > .glass')];
let openChip = null;

function closeChip() {
  if (!openChip) return;
  openChip.setAttribute('aria-expanded', 'false');
  openChip.nextElementSibling.hidden = true;
  openChip.parentElement.classList.remove('is-open');
  openChip = null;
}

for (const chip of chips) {
  chip.addEventListener('click', () => {
    const wasOpen = chip === openChip;
    closeChip();
    if (wasOpen) return;
    chip.setAttribute('aria-expanded', 'true');
    chip.nextElementSibling.hidden = false;
    chip.parentElement.classList.add('is-open');
    openChip = chip;
  });
}

document.addEventListener('click', (event) => {
  if (!openChip) return;
  const link = event.target.closest('.popover a');
  if (link || !event.target.closest('.chip-item')) closeChip();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !openChip) return;
  const chip = openChip;
  closeChip();
  chip.focus();
});

// Mobile menu
const navToggle = document.querySelector('.nav-toggle');
const navLabel = document.querySelector('.nav-toggle-label');
const nav = document.getElementById('site-nav');

function setMenu(open) {
  nav.classList.toggle('is-open', open);
  navToggle.setAttribute('aria-expanded', String(open));
  navLabel.textContent = open ? 'Close' : 'Menu';
}

navToggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
nav.addEventListener('click', (event) => {
  if (event.target.closest('a')) setMenu(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && nav.classList.contains('is-open')) {
    setMenu(false);
    navToggle.focus();
  }
});

// Screenshot galleries
for (const gallery of document.querySelectorAll('.gallery')) {
  const slides = [...gallery.querySelectorAll('.slide')];
  const buttons = [...gallery.querySelectorAll('.thumbs button')];
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => {
      slides.forEach((slide, i) => slide.classList.toggle('is-active', i === index));
      buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === index)));
    });
  });
}

// Blocks fade up the first time they scroll into view.
if (root.classList.contains('can-animate')) {
  const watcher = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      watcher.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach((element) => watcher.observe(element));
}

// Extras load after the page, so they never delay the content.
function loadScript(name) {
  const script = document.createElement('script');
  script.src = `js/${name}.js`;
  script.async = true;
  document.head.append(script);
}

loadScript('field');
if (root.classList.contains('can-animate') && document.querySelector('.portrait-tilt')) loadScript('effects');
