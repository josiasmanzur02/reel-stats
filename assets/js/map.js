import { getAllCatches, getAllPhotos, getAllTrips } from "./db.js";
import {
  escapeHtml,
  formatDate,
  formatLength,
  formatRating,
  formatTimeRange,
  formatWeight,
} from "./utils.js";
import { showToast } from "./ui.js";

const layerSelect = document.getElementById("map-layer");
const speciesFilter = document.getElementById("species-filter");
const mapNote = document.getElementById("map-note");

let map;
let markerLayer;
let catches = [];
let trips = [];
let photoMap = new Map();

const tripMap = new Map();

const ensureMap = () => {
  if (map) return;
  map = window.L.map("map", {
    zoomControl: false,
    preferCanvas: true,
  }).setView([39.5, -98.35], 4);

  window.L.control.zoom({ position: "topright" }).addTo(map);
  window.L.control.scale({ imperial: true, metric: false }).addTo(map);
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
    maxZoom: 18,
  }).addTo(map);

  markerLayer = window.L.layerGroup().addTo(map);
};

const populateSpecies = () => {
  const species = Array.from(new Set(catches.map((record) => record.species).filter(Boolean))).sort();
  speciesFilter.innerHTML =
    '<option value="">All species</option>' +
    species.map((speciesName) => `<option value="${escapeHtml(speciesName)}">${escapeHtml(speciesName)}</option>`).join("");
};

const catchPopup = (record, trip) => {
  const image = photoMap.get(record.id);
  return `
    <div class="map-popup">
      <div class="chip-row">
        <span class="badge">${escapeHtml(formatDate(record.dateCaught))}</span>
        ${trip ? `<span class="badge soft">${escapeHtml(formatRating(trip.rating))}</span>` : ""}
      </div>
      <strong>${escapeHtml(record.species || "Catch")}</strong>
      <p>${escapeHtml(record.locationName || "Unknown spot")}</p>
      <p>${escapeHtml(formatWeight(record.weight, record.weightUnit))} | ${escapeHtml(formatLength(record.length, record.lengthUnit))}</p>
      ${image ? `<img src="${image}" alt="${escapeHtml(record.species || "Catch")}">` : ""}
      <a href="./catch.html?id=${record.id}">Open catch</a>
    </div>
  `;
};

const tripPopup = (trip, catchCount) => `
  <div class="map-popup">
    <div class="chip-row">
      <span class="badge">${escapeHtml(formatRating(trip.rating))}</span>
      <span class="badge soft">${escapeHtml(catchCount ? `${catchCount} catches` : "Trip only")}</span>
    </div>
    <strong>${escapeHtml(trip.locationName || trip.title || "Fishing trip")}</strong>
    <p>${escapeHtml(formatTimeRange(trip.startAt, trip.endAt))}</p>
    <p>${escapeHtml(trip.weather?.summary || "Weather not captured yet")}</p>
    <a href="./trip-form.html?id=${trip.id}">Edit trip</a>
  </div>
`;

const renderMarkers = () => {
  if (!markerLayer) return;
  markerLayer.clearLayers();

  const bounds = [];
  const mode = layerSelect.value;
  const species = speciesFilter.value;
  const catchCounts = catches.reduce((map, record) => {
    if (!record.tripId) return map;
    map.set(record.tripId, (map.get(record.tripId) || 0) + 1);
    return map;
  }, new Map());

  if (mode !== "trips") {
    catches
      .filter((record) => !species || record.species === species)
      .forEach((record) => {
        if (!Number.isFinite(Number(record.lat)) || !Number.isFinite(Number(record.lng))) return;
        const trip = tripMap.get(record.tripId);
        const marker = window.L.marker([record.lat, record.lng]).bindPopup(catchPopup(record, trip));
        marker.addTo(markerLayer);
        bounds.push([record.lat, record.lng]);
      });
  }

  if (mode !== "catches") {
    trips.forEach((trip) => {
      if (!Number.isFinite(Number(trip.lat)) || !Number.isFinite(Number(trip.lng))) return;
      const marker = window.L.circleMarker([trip.lat, trip.lng], {
        radius: 8,
        color: "#0f4c5c",
        fillColor: "#0ea5a3",
        fillOpacity: 0.9,
        weight: 2,
      }).bindPopup(tripPopup(trip, catchCounts.get(trip.id) || 0));
      marker.addTo(markerLayer);
      bounds.push([trip.lat, trip.lng]);
    });
  }

  mapNote.textContent = navigator.onLine
    ? "Basemap tiles are cached as you browse, so the map keeps working better offline over time."
    : "Offline mode is active. Previously viewed map tiles will appear when they are already cached.";

  if (!bounds.length) {
    map.setView([39.5, -98.35], 4);
    return;
  }

  map.fitBounds(bounds, {
    padding: [32, 32],
    maxZoom: bounds.length === 1 ? 12 : 10,
  });
};

const load = async () => {
  try {
    ensureMap();
    const [catchRecords, tripRecords, photos] = await Promise.all([getAllCatches(), getAllTrips(), getAllPhotos()]);
    catches = catchRecords;
    trips = tripRecords;
    photoMap = photos.reduce((map, photo) => {
      if (!map.has(photo.catchId)) map.set(photo.catchId, photo.thumbDataUrl || photo.fullDataUrl);
      return map;
    }, new Map());
    tripRecords.forEach((trip) => tripMap.set(trip.id, trip));
    populateSpecies();
    renderMarkers();
  } catch (error) {
    console.error(error);
    showToast("Failed to load the map.", "error");
  }
};

layerSelect?.addEventListener("change", renderMarkers);
speciesFilter?.addEventListener("change", renderMarkers);

load();
