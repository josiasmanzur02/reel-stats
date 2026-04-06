# Reel Stats
Offline-first fishing log and catch tracker built with plain HTML, CSS, and JavaScript.

## What It Does
- Log fishing trips with a start and end time, trip rating, notes, manual condition notes, and weather snapshots.
- Link catches to trips so your calendar, gallery, dashboard, and map stay connected.
- Save photos locally in IndexedDB with automatic client-side resizing.
- Use your device location in the trip and catch forms.
- Review activity in a mobile-first dashboard, trip calendar, catch gallery, and map.
- Export or import a single JSON backup that includes trips, catches, photos, notes, and weather data.
- Keep the app shell available offline with a service worker and locally bundled map library assets.

## Structure
```text
index.html              Dashboard
trips.html              Trip log + calendar
trip-form.html          Add/Edit trip
catch-form.html         Add/Edit catch
gallery.html            Catch gallery
catch.html              Catch detail
map.html                Trips + catches map
backup.html             Backup / restore / reset
service-worker.js
manifest.webmanifest
assets/
  css/styles.css
  js/
    db.js               IndexedDB data layer
    weather.js          Weather snapshot helper
    trips.js            Calendar + trip list page logic
    trip-form.js        Trip form logic
    form.js             Catch form logic
    dashboard.js        Dashboard logic
    gallery.js          Gallery logic
    detail.js           Catch detail logic
    map.js              Map logic
    backup.js           Backup / import logic
  vendor/leaflet/       Local map assets for offline use
```

## Run
```sh
npm run dev
```

## Build
```sh
npm run build
```

The build output is written to `dist/`.

## Offline Notes
- The app shell, local assets, and previously viewed map tiles are cached by the service worker.
- Weather snapshots are fetched when a connection is available and then stored with the trip.
- If you create a trip fully offline, you can still save it immediately and add manual condition notes; the weather can be refreshed later.
