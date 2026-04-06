import { deleteCatch, getCatch, getPhotosByCatch, getTrip } from "./db.js";
import {
  escapeHtml,
  excerpt,
  formatDate,
  formatLatLng,
  formatLength,
  formatRating,
  formatTimeRange,
  formatWeight,
} from "./utils.js";
import { confirmAction, renderEmpty, showToast } from "./ui.js";

const params = new URLSearchParams(location.search);
const catchId = params.get("id");

const title = document.getElementById("title");
const meta = document.getElementById("meta");
const badges = document.getElementById("badges");
const photoStrip = document.getElementById("photo-strip");
const detailGrid = document.getElementById("detail-grid");
const tripContext = document.getElementById("trip-context");
const weatherContext = document.getElementById("weather-context");
const notesBlock = document.getElementById("notes-block");
const editBtn = document.getElementById("edit-btn");
const deleteBtn = document.getElementById("delete-btn");

const renderPhotos = (photos, species) => {
  if (!photos.length) {
    renderEmpty(photoStrip, "No photos saved for this catch yet.");
    return;
  }
  photoStrip.innerHTML = photos
    .map(
      (photo) =>
        `<img src="${photo.fullDataUrl || photo.thumbDataUrl}" alt="${escapeHtml(species || "Catch photo")}">`
    )
    .join("");
};

const renderTripContext = (trip) => {
  if (!trip) {
    renderEmpty(tripContext, "This catch is not linked to a fishing trip yet.");
    weatherContext.innerHTML = "";
    return;
  }

  tripContext.innerHTML = `
    <div class="stack-lg">
      <div class="chip-row">
        <span class="badge soft">${escapeHtml(formatRating(trip.rating))}</span>
        <span class="badge">${escapeHtml(formatDate(trip.startAt))}</span>
      </div>
      <h3>${escapeHtml(trip.locationName || trip.title || "Fishing trip")}</h3>
      <p class="muted">${escapeHtml(formatTimeRange(trip.startAt, trip.endAt))}</p>
      ${
        trip.conditionsNotes
          ? `<p>${escapeHtml(excerpt(trip.conditionsNotes, 160))}</p>`
          : `<p class="muted">No manual condition notes saved for this trip.</p>`
      }
      <div class="btn-row">
        <a class="btn secondary" href="./trip-form.html?id=${trip.id}">Edit trip</a>
        <a class="btn secondary" href="./catch-form.html?tripId=${trip.id}">Add another catch</a>
      </div>
    </div>
  `;

  weatherContext.innerHTML = `
    <div class="weather-summary">
      <h3>Weather snapshot</h3>
      <p>${escapeHtml(trip.weather?.summary || "Weather was not captured for this trip.")}</p>
      ${
        trip.weather?.observedAt
          ? `<p class="muted">Snapshot ${escapeHtml(formatDate(trip.weather.observedAt))}</p>`
          : ""
      }
    </div>
  `;
};

const renderNotes = (record, trip) => {
  notesBlock.innerHTML = `
    <div class="notes-split">
      <section class="panel inset">
        <h3>Catch notes</h3>
        <p>${escapeHtml(record.notes || "No notes saved for this catch.")}</p>
      </section>
      <section class="panel inset">
        <h3>Trip notes</h3>
        <p>${escapeHtml(trip?.notes || "No broader trip notes saved.")}</p>
      </section>
    </div>
  `;
};

const load = async () => {
  if (!catchId) {
    renderEmpty(detailGrid, "Missing catch id.");
    return;
  }

  try {
    const record = await getCatch(catchId);
    if (!record) {
      renderEmpty(detailGrid, "Catch not found.");
      return;
    }

    const [photos, trip] = await Promise.all([
      getPhotosByCatch(catchId),
      record.tripId ? getTrip(record.tripId) : Promise.resolve(null),
    ]);

    title.textContent = record.species || "Catch";
    meta.textContent = `${formatDate(record.dateCaught)} | ${record.locationName || "Unknown spot"}`;
    badges.innerHTML = `
      ${record.isPBWeight ? '<span class="badge pb">PB weight</span>' : ""}
      ${record.isPBLength ? '<span class="badge pb">PB length</span>' : ""}
      ${trip ? `<span class="badge soft">${escapeHtml(formatRating(trip.rating))}</span>` : ""}
    `;

    renderPhotos(photos, record.species);
    renderTripContext(trip);
    renderNotes(record, trip);

    detailGrid.innerHTML = `
      <div class="metric-card">
        <span class="eyebrow small">Weight</span>
        <strong>${escapeHtml(formatWeight(record.weight, record.weightUnit))}</strong>
      </div>
      <div class="metric-card">
        <span class="eyebrow small">Length</span>
        <strong>${escapeHtml(formatLength(record.length, record.lengthUnit))}</strong>
      </div>
      <div class="metric-card">
        <span class="eyebrow small">Location</span>
        <strong>${escapeHtml(record.locationName || "Unknown spot")}</strong>
      </div>
      <div class="metric-card">
        <span class="eyebrow small">Coordinates</span>
        <strong>${escapeHtml(formatLatLng(record.lat, record.lng))}</strong>
      </div>
      <div class="metric-card">
        <span class="eyebrow small">Nickname</span>
        <strong>${escapeHtml(record.nickname || "No nickname")}</strong>
      </div>
      <div class="metric-card">
        <span class="eyebrow small">Linked trip</span>
        <strong>${escapeHtml(trip?.locationName || "Standalone catch")}</strong>
      </div>
    `;

    editBtn.href = `./catch-form.html?id=${catchId}`;
  } catch (error) {
    console.error(error);
    showToast("Failed to load the catch detail.", "error");
  }
};

deleteBtn?.addEventListener("click", async () => {
  if (!confirmAction("Delete this catch? This cannot be undone.")) return;
  try {
    await deleteCatch(catchId);
    showToast("Catch deleted.", "success");
    setTimeout(() => {
      window.location.href = "./gallery.html";
    }, 180);
  } catch (error) {
    console.error(error);
    showToast("Failed to delete the catch.", "error");
  }
});

load();
