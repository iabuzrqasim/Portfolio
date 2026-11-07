# Abuzar Qasim portfolio

A one-page static site generated from two data files.

## Build and preview

```
npm install
npm run build
```

This writes the website to `dist/` and lists anything still missing. To preview it, run `python -m http.server 4173 --directory dist` and open http://localhost:4173.

`npm run build:drafts` also includes projects marked `"draft": true`.

## Add or edit a project

`data/projects.json` is the only place project content lives. The order in the file is the order on the page.

- Required: `slug`, `title`, `problem`, `approach`, `stack`.
- Optional: `result`, `github`.
- `"draft": true` keeps a project off the site. `"inProgress": true` shows the badge. `"flagship": true` gives it the full-width layout.

## Add screenshots

Put images (PNG, JPG, WebP or AVIF) in `assets/projects/<slug>/`, using the project's `slug` as the folder name, then rebuild. They appear on that card automatically, sorted by file name. A project with no images shows no image area, and its text fills the card.

## Add certificates

Put certificate images (PNG, JPG, WebP or AVIF) or PDFs in `assets/certificates/`, then rebuild. Use lowercase file names with hyphens. Images open in a viewer from the View Certificate button, and PDFs get a View certificate link. A file with `atomcamp` or `clickchain` in its name joins that existing card, and any other file gets its own card titled from the file name. Certificate details and the education entry are in `data/site.json`.

## Other content

Links, the about text and skills are in `data/site.json`. The CV is at `assets/cv/Abuzar-Qasim-CV.pdf`.

## Publish

Every push to `main` builds the site and deploys `dist/` to GitHub Pages, using `.github/workflows/deploy.yml`. `dist/` is generated, so it isn't committed.

Live site: https://iabuzrqasim.github.io/Portfolio/
