import { getAllCatches, getAllPhotos, getAllTrips } from "./db.js";
import {
  escapeHtml,
  excerpt,
  formatDate,
  formatDuration,
  formatLength,
  formatRating,
  formatTimeRange,
  formatWeight,
} from "./utils.js";
import { renderEmpty, showToast } from "./ui.js";

const recentTrip = document.getElementById("recent-trip");
const recentCatch = document.getElementById("recent-catch");
const pbList = document.getElementById("pb-list");
const spotList = document.getElementById("spot-list");

const setText = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
};

const buildPhotoMap = (photos) =>
  photos.reduce((map, photo) => {
    if (!map.has(photo.catchId)) map.set(photo.catchId, photo.thumbDataUrl || photo.fullDataUrl);
    return map;
  }, new Map());

const renderStats = (catches, trips) => {
  const ratedTrips = trips.filter((trip) => Number.isFinite(Number(trip.rating)) && Number(trip.rating) > 0);
  const totalMinutes = trips.reduce((sum, trip) => {
    const diff = new Date(trip.endAt || trip.startAt) - new Date(trip.startAt);
    return diff > 0 ? sum + Math.round(diff / 60000) : sum;
  }, 0);
  const totalHours = totalMinutes / 60;

  setText("stat-catches", catches.length);
  setText("stat-trips", trips.length);
  setText("stat-hours", totalHours ? totalHours.toFixed(totalHours >= 10 ? 0 : 1) : "0");
  setText(
    "stat-rating",
    ratedTrips.length
      ? `${(ratedTrips.reduce((sum, trip) => sum + Number(trip.rating), 0) / ratedTrips.length).toFixed(1)}/5`
      : "Not rated"
  );
};

const renderRecentTrip = (trips, catchesByTrip) => {
  if (!trips.length) {
    renderEmpty(recentTrip, "No trips logged yet. Start with a fishing session so the calendar, weather, and ratings have data.");
    return;
  }

  const trip = trips[0];
  const catchCount = catchesByTrip.get(trip.id) || 0;
  recentTrip.innerHTML = `
    <div class="stack-lg">
      <div class="chip-row">
        <span class="badge soft">Latest trip</span>
        <span class="badge">${escapeHtml(formatRating(trip.rating))}</span>
      </div>
      <div>
        <h3>${escapeHtml(trip.locationName || trip.title || "Fishing trip")}</h3>
        <p class="muted">${escapeHtml(formatTimeRange(trip.startAt, trip.endAt))}</p>
      </div>
      <div class="detail-list">
        <div><span>Duration</span><strong>${escapeHtml(formatDuration(trip.startAt, trip.endAt))}</strong></div>
        <div><span>Catches linked</span><strong>${catchCount}</strong></div>
        <div><span>Weather</span><strong>${escapeHtml(trip.weather?.summary || "Not captured yet")}</strong></div>
      </div>
      ${
        trip.notes || trip.conditionsNotes
          ? `<p class="muted">${escapeHtml(excerpt(trip.notes || trip.conditionsNotes, 120))}</p>`
          : ""
      }
      <div class="btn-row">
        <a class="btn" href="./trip-form.html?id=${trip.id}">Edit trip</a>
        <a class="btn secondary" href="./catch-form.html?tripId=${trip.id}">Add catch</a>
      </div>
    </div>
  `;
};

const renderRecentCatch = (catches, photoMap, tripMap) => {
  if (!catches.length) {
    renderEmpty(recentCatch, "No catches logged yet. Add a catch from a trip card or directly from the catch form.");
    return;
  }

  const catchRecord = catches[0];
  const trip = tripMap.get(catchRecord.tripId);
  const image = photoMap.get(catchRecord.id);

  recentCatch.innerHTML = `
    <div class="feature-card">
      ${
        image
          ? `<img class="feature-image" src="${image}" alt="${escapeHtml(catchRecord.species || "Catch")}">`
          : `<div class="feature-image placeholder">No photo yet</div>`
      }
      <div class="stack-lg">
        <div class="chip-row">
          ${catchRecord.isPBWeight ? '<span class="badge pb">PB weight</span>' : ""}
          ${catchRecord.isPBLength ? '<span class="badge pb">PB length</span>' : ""}
          ${trip ? `<span class="badge soft">${escapeHtml(formatRating(trip.rating))}</span>` : ""}
        </div>
        <div>
          <h3>${escapeHtml(catchRecord.species || "Catch")}</h3>
          <p class="muted">${escapeHtml(formatDate(catchRecord.dateCaught))} | ${escapeHtml(catchRecord.locationName || "Unknown spot")}</p>
        </div>
        <div class="detail-list compact">
          <div><span>Weight</span><strong>${escapeHtml(formatWeight(catchRecord.weight, catchRecord.weightUnit))}</strong></div>
          <div><span>Length</span><strong>${escapeHtml(formatLength(catchRecord.length, catchRecord.lengthUnit))}</strong></div>
          <div><span>Trip</span><strong>${escapeHtml(trip?.locationName || "Standalone catch")}</strong></div>
        </div>
        <div class="btn-row">
          <a class="btn" href="./catch.html?id=${catchRecord.id}">Open catch</a>
          <a class="btn secondary" href="./catch-form.html?id=${catchRecord.id}">Edit catch</a>
        </div>
      </div>
    </div>
  `;
};

const renderPBs = (catches) => {
  const pbs = catches.filter((record) => record.isPBWeight || record.isPBLength).slice(0, 6);
  if (!pbs.length) {
    renderEmpty(pbList, "Personal bests will appear here once you log catches.");
    return;
  }

  pbList.innerHTML = pbs
    .map(
      (record) => `
        <a class="mini-card" href="./catch.html?id=${record.id}">
          <div class="chip-row">
            ${record.isPBWeight ? '<span class="badge pb">PB weight</span>' : ""}
            ${record.isPBLength ? '<span class="badge pb">PB length</span>' : ""}
          </div>
          <h3>${escapeHtml(record.species || "Catch")}</h3>
          <p class="muted">${escapeHtml(formatDate(record.dateCaught))}</p>
          <strong>${escapeHtml(formatWeight(record.weight, record.weightUnit))}</strong>
        </a>
      `
    )
    .join("");
};

const renderTopSpots = (trips) => {
  if (!trips.length) {
    renderEmpty(spotList, "Your most-visited spots will appear after you log a few trips.");
    return;
  }

  const spotCounts = trips.reduce((map, trip) => {
    const key = (trip.locationName || "Unknown spot").trim();
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());

  const topSpots = [...spotCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  spotList.innerHTML = topSpots
    .map(
      ([spot, count]) => `
        <div class="mini-card">
          <span class="eyebrow small">Spot</span>
          <h3>${escapeHtml(spot)}</h3>
          <p class="muted">${count} ${count === 1 ? "trip" : "trips"}</p>
        </div>
      `
    )
    .join("");
};

const load = async () => {
  try {
    const [catches, trips, photos] = await Promise.all([getAllCatches(), getAllTrips(), getAllPhotos()]);
    const photoMap = buildPhotoMap(photos);
    const catchesByTrip = catches.reduce((map, record) => {
      if (!record.tripId) return map;
      map.set(record.tripId, (map.get(record.tripId) || 0) + 1);
      return map;
    }, new Map());
    const tripMap = trips.reduce((map, trip) => {
      map.set(trip.id, trip);
      return map;
    }, new Map());

    renderStats(catches, trips);
    renderRecentTrip(trips, catchesByTrip);
    renderRecentCatch(catches, photoMap, tripMap);
    renderPBs(catches);
    renderTopSpots(trips);
  } catch (error) {
    console.error(error);
    showToast("Failed to load the dashboard.", "error");
  }
};

load();
