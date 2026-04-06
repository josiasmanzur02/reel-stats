import { getAllCatches, getAllPhotos, getAllTrips } from "./db.js";
import {
  escapeHtml,
  formatDate,
  formatLength,
  formatRating,
  formatWeight,
} from "./utils.js";
import { renderEmpty, showToast } from "./ui.js";

const gallery = document.getElementById("gallery");
const searchInput = document.getElementById("search");
const speciesFilter = document.getElementById("filter-species");
const sortSelect = document.getElementById("sort");
const pbOnly = document.getElementById("pb-only");
const fromDate = document.getElementById("from-date");
const toDate = document.getElementById("to-date");
const gallerySummary = document.getElementById("gallery-summary");

let catches = [];
let photoMap = new Map();
let tripMap = new Map();

const populateSpecies = () => {
  const species = Array.from(new Set(catches.map((record) => record.species).filter(Boolean))).sort();
  speciesFilter.innerHTML =
    '<option value="">All species</option>' +
    species.map((speciesName) => `<option value="${escapeHtml(speciesName)}">${escapeHtml(speciesName)}</option>`).join("");
};

const render = (items) => {
  gallerySummary.textContent = `${items.length} ${items.length === 1 ? "catch" : "catches"} shown`;
  if (!items.length) {
    renderEmpty(gallery, "No catches match the current filters.");
    return;
  }

  gallery.innerHTML = items
    .map((record) => {
      const image = photoMap.get(record.id);
      const trip = tripMap.get(record.tripId);
      return `
        <a class="catch-card panel" href="./catch.html?id=${record.id}">
          ${
            image
              ? `<img class="card-image" src="${image}" alt="${escapeHtml(record.species || "Catch")}">`
              : '<div class="card-image placeholder">No photo</div>'
          }
          <div class="stack">
            <div class="chip-row">
              ${record.isPBWeight ? '<span class="badge pb">PB weight</span>' : ""}
              ${record.isPBLength ? '<span class="badge pb">PB length</span>' : ""}
              ${trip ? `<span class="badge soft">${escapeHtml(formatRating(trip.rating))}</span>` : ""}
            </div>
            <div>
              <h3>${escapeHtml(record.species || "Catch")}</h3>
              <p class="muted">${escapeHtml(formatDate(record.dateCaught))} | ${escapeHtml(record.locationName || "Unknown spot")}</p>
            </div>
            <div class="detail-list compact">
              <div><span>Weight</span><strong>${escapeHtml(formatWeight(record.weight, record.weightUnit))}</strong></div>
              <div><span>Length</span><strong>${escapeHtml(formatLength(record.length, record.lengthUnit))}</strong></div>
              <div><span>Trip</span><strong>${escapeHtml(trip?.locationName || "Standalone")}</strong></div>
            </div>
          </div>
        </a>
      `;
    })
    .join("");
};

const applyFilters = () => {
  const term = searchInput.value.trim().toLowerCase();
  const species = speciesFilter.value;
  const onlyPB = pbOnly.checked;
  const from = fromDate.value ? new Date(`${fromDate.value}T00:00:00`) : null;
  const to = toDate.value ? new Date(`${toDate.value}T23:59:59`) : null;

  let results = catches.filter((record) => {
    if (species && record.species !== species) return false;
    if (onlyPB && !(record.isPBLength || record.isPBWeight)) return false;
    if (from && new Date(record.dateCaught) < from) return false;
    if (to && new Date(record.dateCaught) > to) return false;
    if (term) {
      const trip = tripMap.get(record.tripId);
      const haystack = `${record.species || ""} ${record.nickname || ""} ${record.locationName || ""} ${record.notes || ""} ${
        trip?.notes || ""
      } ${trip?.conditionsNotes || ""}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });

  results = results.sort((a, b) => {
    switch (sortSelect.value) {
      case "oldest":
        return new Date(a.dateCaught) - new Date(b.dateCaught);
      case "heaviest":
        return Number(b.weight) - Number(a.weight);
      case "longest":
        return Number(b.length) - Number(a.length);
      default:
        return new Date(b.dateCaught) - new Date(a.dateCaught);
    }
  });

  render(results);
};

const load = async () => {
  try {
    const [catchRecords, photos, trips] = await Promise.all([getAllCatches(), getAllPhotos(), getAllTrips()]);
    catches = catchRecords;
    photoMap = photos.reduce((map, photo) => {
      if (!map.has(photo.catchId)) map.set(photo.catchId, photo.thumbDataUrl || photo.fullDataUrl);
      return map;
    }, new Map());
    tripMap = trips.reduce((map, trip) => {
      map.set(trip.id, trip);
      return map;
    }, new Map());
    populateSpecies();
    applyFilters();
  } catch (error) {
    console.error(error);
    showToast("Failed to load the catch gallery.", "error");
  }
};

["input", "change"].forEach((eventName) => {
  searchInput?.addEventListener(eventName, applyFilters);
  speciesFilter?.addEventListener(eventName, applyFilters);
  sortSelect?.addEventListener(eventName, applyFilters);
  pbOnly?.addEventListener(eventName, applyFilters);
  fromDate?.addEventListener(eventName, applyFilters);
  toDate?.addEventListener(eventName, applyFilters);
});

load();
