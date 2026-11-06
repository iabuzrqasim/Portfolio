// Static site generator. Run `npm install` once, then `npm run build`.
// Reads data/*.json, bundles src/, and writes the finished website to dist/.
// Screenshots in assets/projects/<slug>/ appear on that project's card automatically.
// Images and PDFs in assets/certificates/ appear in the Education section automatically.
// `node build.mjs --drafts` also includes projects marked "draft": true.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const CV_PATH = 'assets/cv/Abuzar-Qasim-CV.pdf';
const CERT_DIR = 'assets/certificates';
const NAV_ITEMS = [['Work', '#work'], ['Skills', '#skills'], ['About', '#about'], ['Education', '#education'], ['Contact', '#contact']];
const readJson = (file) => JSON.parse(readFileSync(join(ROOT, file), 'utf8'));

const site = readJson('data/site.json');
const allProjects = readJson('data/projects.json');
const includeDrafts = process.argv.includes('--drafts');

const esc = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function projectImages(slug) {
  const folder = join(ROOT, 'assets/projects', slug);
  if (!existsSync(folder)) return [];
  return readdirSync(folder)
    .filter((file) => /\.(png|jpe?g|webp|avif)$/i.test(file))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((file) => `assets/projects/${slug}/${encodeURIComponent(file)}`);
}

function validate(projects) {
  const slugs = new Set();
  for (const p of projects) {
    if (!p.slug || slugs.has(p.slug)) throw new Error(`Missing or duplicate slug: "${p.slug}"`);
    slugs.add(p.slug);
    if (p.draft) continue;
    for (const field of p.summary ? ['title'] : ['title', 'problem', 'approach']) {
      if (!p[field]) throw new Error(`${p.slug}: "${field}" is required unless the project is marked "draft": true`);
    }
  }
}

validate(allProjects);
if (!existsSync(join(ROOT, CV_PATH))) throw new Error(`Missing ${CV_PATH}: the Download CV buttons need it`);
const projects = allProjects.filter((p) => includeDrafts || !p.draft);

// ---------- project cards ----------

function gallery(project) {
  const images = projectImages(project.slug);
  if (!images.length) return '';
  const thumbs = images.length > 1
    ? `<div class="thumbs" role="group" aria-label="${esc(`${project.title} screenshots`)}">${images.map((src, i) => `
        <button type="button" aria-pressed="${i === 0}" aria-label="${esc(`Show screenshot ${i + 1}`)}"><img src="${src}" alt="" loading="lazy" decoding="async"></button>`).join('')}</div>`
    : '';
  return `
      <div class="gallery">
        <div class="stage">
          ${images.map((src, i) => `<div class="slide${i === 0 ? ' is-active' : ''}"><img src="${src}" alt="${esc(`${project.title}, screenshot ${i + 1}`)}" loading="lazy" decoding="async"></div>`).join('')}
        </div>
        ${thumbs}
      </div>`;
}

function projectCard(project) {
  const badges = [
    project.flagship ? '<span class="badge">Flagship</span>' : '',
    project.inProgress ? '<span class="badge badge-live">In progress</span>' : '',
    project.status ? `<span class="badge badge-live">${esc(project.status)}</span>` : '',
  ].join('');
  const rows = [
    ['Problem', project.problem],
    ['Approach', project.approach],
    ['Result', project.result],
  ].filter(([, text]) => text);
  const hasImages = projectImages(project.slug).length > 0;
  const body = `
      <div class="project-body">
        ${badges ? `<p class="badges">${badges}</p>` : ''}
        <h3>${esc(project.title)}</h3>
        ${project.subtitle ? `<p class="project-sub">${esc(project.subtitle)}</p>` : ''}
        ${project.summary ? `<p class="project-summary">${esc(project.summary)}</p>` : ''}
        ${rows.length ? `<dl class="par">
          ${rows.map(([label, text]) => `<div><dt>${label}</dt><dd>${esc(text)}</dd></div>`).join('')}
        </dl>` : ''}
        ${project.stack?.length ? `<ul class="chips">${project.stack.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        ${project.page ? `<a class="project-link" href="${esc(project.page)}">View project <span aria-hidden="true">→</span></a>` : ''}
        ${project.github ? `<a class="project-link" href="${esc(project.github)}" rel="noopener">GitHub<span class="sr-only">: ${esc(project.title)}</span> <span aria-hidden="true">↗</span></a>` : ''}
      </div>`;
  if (project.page) {
    return `
    <article class="project project-app reveal" id="${esc(project.slug)}">${body}
      <div class="phones" aria-hidden="true">
        ${['language', 'home', 'worker-home'].map((name) => `<img src="assets/maharat/${name}.jpg" alt="" width="529" height="1143" loading="lazy" decoding="async">`).join('')}
      </div>
    </article>`;
  }
  return `
    <article class="project reveal" id="${esc(project.slug)}">
      ${hasImages ? `<div class="project-media">${gallery(project)}</div>` : ''}${body}
    </article>`;
}

// ---------- education and certificates ----------

const isImage = (file) => /\.(png|jpe?g|webp|avif)$/i.test(file);
const isCertFile = (file) => isImage(file) || /\.pdf$/i.test(file);
const squash = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

// Pairs each file in assets/certificates/ with its entry in site.json by the entry's "match" word.
// A file that matches no entry gets its own card, titled from the file name.
function certificates() {
  const folder = join(ROOT, CERT_DIR);
  const files = existsSync(folder)
    ? readdirSync(folder)
      .filter(isCertFile)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    : [];
  const listed = (site.certificates ?? []).map((cert) => {
    const index = cert.match ? files.findIndex((file) => squash(file).includes(squash(cert.match))) : -1;
    return index < 0 ? cert : { ...cert, file: files.splice(index, 1)[0] };
  });
  const extras = files.map((file) => ({
    title: file.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim(),
    file,
  }));
  return [...listed, ...extras];
}

function certCard(cert) {
  const href = cert.file ? `${CERT_DIR}/${encodeURIComponent(cert.file)}` : '';
  const showImage = cert.file && isImage(cert.file);
  const meta = [cert.issuer, cert.date].filter(Boolean).join(' · ');
  return `
        <article class="cred reveal">
          ${showImage ? `<a class="cred-media" href="${href}" target="_blank" rel="noopener"><img src="${href}" alt="${esc(cert.alt ?? `${cert.title} certificate`)}" loading="lazy" decoding="async"><span class="sr-only"> (opens full size)</span></a>` : ''}
          <div class="cred-body">
            <p class="cred-kind">Certificate</p>
            <h3>${esc(cert.title)}</h3>
            ${cert.detail ? `<p class="cred-sub">${esc(cert.detail)}</p>` : ''}
            ${meta ? `<p class="cred-meta">${esc(meta)}</p>` : ''}
            ${href || cert.verify ? `<p class="cred-links">
              ${href ? `<a class="project-link" href="${href}" target="_blank" rel="noopener">View certificate<span class="sr-only">: ${esc(cert.title)}</span> <span aria-hidden="true">↗</span></a>` : ''}
              ${cert.verify ? `<a class="project-link" href="${esc(cert.verify)}" target="_blank" rel="noopener">Verify credential<span class="sr-only">: ${esc(cert.title)}</span> <span aria-hidden="true">↗</span></a>` : ''}
            </p>` : ''}
          </div>
        </article>`;
}

const educationCard = (entry) => `
        <article class="cred cred-wide reveal">
          <div class="cred-body">
            <p class="cred-kind">Education</p>
            <h3>${esc(entry.degree)}</h3>
            <p class="cred-sub">${esc(entry.institution)}</p>
            <p class="cred-meta">${esc(entry.years)}</p>
          </div>
        </article>`;

// Skill chips around the hero photo. Each opens a small list of tools.
const HERO_SKILLS = [
  ['sql', 'SQL', '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>', ['MySQL', 'MySQL Workbench', 'Joins & Aggregations', 'Schema Design']],
  ['python', 'Python', '<path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 5l-4 14"/>', ['Pandas', 'NumPy', 'Matplotlib', 'Seaborn', 'SQLAlchemy', 'Jupyter Notebook']],
  ['bi', 'Power BI', '<path d="M5 21v-7M12 21V4M19 21v-11"/>', ['DAX', 'Power Query', 'Data Modeling', 'Interactive Dashboards']],
  ['excel', 'Excel', '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M10 4v16"/>', ['Pivot Tables', 'Charts', 'Dashboards', 'Hypothesis Testing']],
  ['ml', 'Machine Learning', '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="10" cy="18" r="2.5"/><path d="m8.4 6.5 7.2 1.1M7 8.3l2 7.4M16.5 10l-5 6"/>', ['Predictive Modeling', 'Classification']],
  ['viz', 'Data Visualization', '<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M16 3.6A9 9 0 0 1 20.4 8H16z"/>', ['Power BI', 'Matplotlib', 'Seaborn', 'Excel Charts']],
];

const skillChips = () => `<ul class="skill-chips">
          ${HERO_SKILLS.map(([id, label, icon, tools]) => `<li class="chip-item chip-${id}">
            <button class="glass" type="button" aria-expanded="false" aria-controls="skill-${id}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icon}</svg>${esc(label)}</button>
            <div class="popover" id="skill-${id}" hidden>
              <ul>${tools.map((tool) => `<li>${esc(tool)}</li>`).join('')}</ul>
              <a href="#work">See projects <span aria-hidden="true">→</span></a>
            </div>
          </li>`).join('\n          ')}
        </ul>`;

// ---------- page ----------

function page() {
  const title = `${site.name} — ${site.role}`;
  const description = `${site.name} is a ${site.role} based in ${site.location}. ${site.tagline}`;
  const base = site.siteUrl.replace(/\/$/, '');
  const ogImage = `${base}/assets/images/og-image.png`;
  const cvLink = (extra) => `<a${extra ? ` class="${extra}"` : ''} href="${CV_PATH}" download="Abuzar-Qasim-CV.pdf">Download CV</a>`;


  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="author" content="${esc(site.name)}">
<link rel="canonical" href="${esc(base)}/">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(base)}/">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(ogImage)}">
<meta name="theme-color" content="#0F0B14">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<script>document.documentElement.classList.add('js');if (!matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('can-animate');</script>
<link rel="preload" href="fonts/geist.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="styles.css">
<script src="js/main.js" defer></script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="progress" aria-hidden="true"></div>
<canvas class="field" aria-hidden="true"></canvas>
<header class="site-header">
  <div class="container header-row">
    <a class="brand brand-home" href="#top">${esc(site.name)}</a>
    <nav id="site-nav" class="site-nav" aria-label="Main">
      ${NAV_ITEMS.map(([label, href]) => `<a href="${href}">${label}</a>`).join('')}
    </nav>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav"><span class="nav-toggle-label">Menu</span></button>
  </div>
</header>
<main id="main" tabindex="-1">
  <section class="hero" id="top" tabindex="-1">
    <div class="container hero-grid">
      <div class="hero-copy">
        <p class="hero-role">${esc(site.role)}</p>
        <h1>${esc(site.name)}</h1>
        <p class="hero-tagline">${esc(site.tagline)}</p>
        <div class="actions">
          <a class="btn btn-sweep" href="#work">View Projects</a>
          ${cvLink('btn btn-ghost')}
        </div>
        <ul class="hero-links">
          <li><a href="${esc(site.github)}" rel="noopener">GitHub</a></li>
          <li><a href="${esc(site.linkedin)}" rel="noopener">LinkedIn</a></li>
          <li>${esc(site.location)}</li>
        </ul>
      </div>
      <figure class="portrait">
        <div class="portrait-tilt">
          <div class="portrait-float">
            <div class="portrait-glow"></div>
            <svg class="portrait-ring" viewBox="0 0 200 200" aria-hidden="true" focusable="false"><defs><linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8B5CF6"/><stop offset="1" stop-color="#F5A524"/></linearGradient></defs><circle class="ring-a" cx="100" cy="100" r="97" stroke="url(#ring-grad)"/><circle class="ring-b" cx="100" cy="100" r="88" stroke="url(#ring-grad)"/></svg>
            <img class="portrait-photo" src="assets/photo-cutout.png" alt="Portrait of ${esc(site.name)}" decoding="async" fetchpriority="high">
          </div>
          
        </div>
        ${skillChips()}
      </figure>
    </div>
    <div class="scroll-cue" aria-hidden="true">Scroll<i></i></div>
  </section>

  <section class="section section-tint" id="work" tabindex="-1">
    <div class="container">
      <header class="section-head reveal">
        <p class="eyebrow">Selected Work</p>
        <h2>Projects</h2>
      </header>
      <div class="projects">${projects.map(projectCard).join('')}</div>
    </div>
  </section>

  <section class="section" id="skills" tabindex="-1">
    <div class="container">
      <header class="section-head reveal">
        <p class="eyebrow">Skills</p>
        <h2>Toolkit</h2>
      </header>
      <div class="skills">
        ${site.skills.map((skill) => `
        <div class="skill reveal">
          <h3>${esc(skill.group)}</h3>
          <ul class="chips">${skill.items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
        </div>`).join('')}
      </div>
    </div>
  </section>

  <section class="section section-tint" id="about" tabindex="-1">
    <div class="container about-grid">
      <header class="section-head reveal">
        <p class="eyebrow">About</p>
        <h2>${esc(site.name)}</h2>
      </header>
      <p class="about-text reveal">${esc(site.about)}</p>
    </div>
  </section>

  <section class="section" id="education" tabindex="-1">
    <div class="container">
      <header class="section-head reveal">
        <p class="eyebrow">Education</p>
        <h2>Education &amp; Certificates</h2>
      </header>
      <div class="creds">${(site.education ?? []).map(educationCard).join('')}${certificates().map(certCard).join('')}
      </div>
    </div>
  </section>

  <section class="section section-tint" id="contact" tabindex="-1">
    <div class="container">
      <div class="contact-panel reveal">
        <p class="eyebrow">Contact</p>
        <h2>Let's work together</h2>
        <a class="contact-email" href="mailto:${esc(site.email)}">${esc(site.email)}</a>
        <div class="actions">
          <a class="btn" href="${esc(site.linkedin)}" rel="noopener">LinkedIn</a>
          <a class="btn btn-ghost" href="${esc(site.github)}" rel="noopener">GitHub</a>
        </div>
      </div>
    </div>
  </section>
</main>
<footer class="site-footer">
  <div class="container footer-row">
    <p>${esc(site.name)}, ${esc(site.location)}</p>
    <p>© ${esc(site.year)}</p>
  </div>
</footer>
</body>
</html>
`;
}

// ---------- Maharat page ----------

const MAHARAT_SCREENS = [
  ['language', 'Choose a language', 'Language selection screen with Urdu, Roman Urdu and English'],
  ['home', 'Customer home', 'Customer home screen with job request and trade categories'],
  ['request', 'Request a job', 'Job request form with problem details and location'],
  ['responses', 'Worker responses', 'List of workers responding to a job request'],
  ['verify', 'Worker verification', 'Worker identity verification screen'],
  ['worker-home', 'Worker dashboard', 'Worker dashboard with nearby job requests'],
];

function maharatPage(home) {
  const project = allProjects.find((p) => p.slug === 'maharat');
  const base = site.siteUrl.replace(/\/$/, '');
  const title = `${project.title} — ${site.name}`;
  const head = home.slice(0, home.indexOf('<body>'))
    .replaceAll(esc(`${site.name} — ${site.role}`), esc(title))
    .replaceAll(esc(`${site.name} is a ${site.role} based in ${site.location}. ${site.tagline}`), esc(project.summary))
    .replaceAll(`${esc(base)}/"`, `${esc(base)}/maharat.html"`);
  return `${head}<body data-field-stage="2">
<a class="skip" href="#main">Skip to content</a>
<div class="progress" aria-hidden="true"></div>
<canvas class="field" aria-hidden="true"></canvas>
<header class="site-header">
  <div class="container header-row">
    <a class="brand" href="index.html">${esc(site.name)}</a>
    <nav id="site-nav" class="site-nav" aria-label="Main">
      ${NAV_ITEMS.map(([label, href]) => `<a href="index.html${href}">${label}</a>`).join('')}
    </nav>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav"><span class="nav-toggle-label">Menu</span></button>
  </div>
</header>
<main id="main" tabindex="-1">
  <section class="page-hero">
    <div class="container">
      <a class="back-link" href="index.html#work"><span aria-hidden="true">←</span> All projects</a>
      <p class="badges"><span class="badge badge-live">${esc(project.status)}</span></p>
      <h1>${esc(project.title)}</h1>
      <p class="page-sub">${esc(project.subtitle)}</p>
      <p class="page-summary">${esc(project.summary)}</p>
    </div>
  </section>
  <section class="section">
    <div class="container">
      <div class="screens">
        ${MAHARAT_SCREENS.map(([file, caption, alt]) => `
        <figure class="screen reveal"><img src="assets/maharat/${file}.jpg" alt="${esc(alt)}" width="529" height="1143" loading="lazy" decoding="async"><figcaption>${esc(caption)}</figcaption></figure>`).join('')}
      </div>
      <p class="screens-note">Design screens with sample names and figures.</p>
    </div>
  </section>
</main>
<footer class="site-footer">
  <div class="container footer-row">
    <p>${esc(site.name)}, ${esc(site.location)}</p>
    <p>© ${esc(site.year)}</p>
  </div>
</footer>
</body>
</html>
`;
}

// ---------- build ----------

rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'fonts'), { recursive: true });

const bundles = ['main', 'effects', 'field'];
await build({
  entryPoints: bundles.map((name) => join(ROOT, `src/${name}.js`)),
  outdir: join(DIST, 'js'),
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  legalComments: 'none',
  logLevel: 'error',
});
await build({
  entryPoints: [join(ROOT, 'src/styles.css')],
  outfile: join(DIST, 'styles.css'),
  minify: true,
  logLevel: 'error',
});

const fonts = join(ROOT, 'node_modules/@fontsource-variable');
cpSync(join(fonts, 'geist/files/geist-latin-wght-normal.woff2'), join(DIST, 'fonts/geist.woff2'));
cpSync(join(ROOT, 'assets'), join(DIST, 'assets'), { recursive: true });
const home = page();
writeFileSync(join(DIST, 'index.html'), home);
writeFileSync(join(DIST, 'maharat.html'), maharatPage(home));

const kb = (name) => Math.round(gzipSync(readFileSync(join(DIST, `js/${name}.js`))).length / 1024);
console.log(`Built ${projects.length} projects into dist/`);
console.log(`JS gzipped: ${bundles.map((name) => `${name} ${kb(name)}KB`).join(', ')}`);
