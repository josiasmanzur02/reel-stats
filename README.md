# Fish Catch Tracker (PWA)
Offline‑first, installable (iOS/Android/desktop) web app for logging fish catches. All data stays on-device in IndexedDB; no server needed.

## Features
- Add/Edit/Delete catches with photos, notes, weight/length units, and geo coords.
- Automatic Personal Best flags per species for weight and length (newest wins ties).
- Gallery with search, filters (species, PB-only, date range) and sorting (new/old/heaviest/longest).
- Detail view with photo carousel, PB badges, edit/delete.
- Map with Leaflet + OpenStreetMap, species filter, popups linking to detail.
- Backup/Restore: export JSON and ZIP (photos included), download or Web Share when supported; merge or replace imports; reset local data.
- Offline ready after first load; service worker precaches app shell and CDN libs; manifest + iOS meta for Add to Home Screen.

## Tech Stack
- Vanilla HTML/CSS/JS (ES modules), no build tooling required.
- IndexedDB via minimal wrapper (Dexie not used to avoid external install).
- Leaflet via CDN for maps; JSZip via CDN for ZIP export.
- Service worker for precache + runtime cache; manifest with maskable icons.

## Project Structure
```
index.html              // Dashboard
catch-form.html         // Add/Edit catch
gallery.html            // Gallery
catch.html              // Catch detail
map.html                // Map
backup.html             // Import/Export/Reset
service-worker.js
manifest.webmanifest
assets/
  css/styles.css
  js/*.js               // data layer, pages, utils, UI, SW register
  icons/                // PWA icons
package.json            // scripts for dev/build/preview
```

## Run Locally
Prereq: Python 3 (for simple static server).
```sh
npm run dev        # serves at http://localhost:5173
```
First visit online to allow the service worker to cache external CDNs (Leaflet, JSZip). Data persists in IndexedDB between refreshes.

## Build
Creates static `dist/` ready for any static host.
```sh
npm run build
```
Preview the build:
```sh
npm run preview    # serves dist at http://localhost:4173
```

## Deploy to GitHub + Render (Static Site)
1) Commit and push:
```sh
git init
git add .
git commit -m "Initial Fish Catch Tracker PWA"
git branch -M main
git remote add origin git@github.com:<you>/fish-catch-tracker.git
git push -u origin main
```
2) Render dashboard → New → Static Site → connect the repo.
   - Build Command: `npm run build`
   - Publish Directory: `dist`
   - Index Document: `index.html`
   - 404/Fallback: `index.html` (for client-side nav)
3) Deploy. Render auto-redeploys on pushes.

## Import/Export & Backup
- Export JSON (always) and ZIP (with photos). Download and, if supported, share via Web Share API.
- Import supports JSON/ZIP with preview; choose Merge (add new IDs) or Replace (wipe then import).
- “Reset local data” wipes IndexedDB on this device only.

## Notes
- Map tiles load from OpenStreetMap; cached tiles work offline only for areas already viewed.
- For iOS: open in Safari, tap Share → Add to Home Screen to install as a PWA.
- Service worker and manifest live at the site root; keep paths if you change hosting structure.
