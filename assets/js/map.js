import { getAllCatches, getPhotosByCatch } from "./db.js";
import { qs, formatDate, formatWeight, formatLength } from "./utils.js";
import { showToast } from "./ui.js";

const speciesFilter = qs("#species-filter");
let L;
let map;
let markers = [];
let catches = [];

const initLeaflet = async () => {
  if (L) return L;
  L = await import("https://unpkg.com/leaflet@1.9.4/dist/leaflet-src.esm.js");
  return L;
};

const clearMarkers = () => {
  markers.forEach((m) => m.remove());
  markers = [];
};

const makePopup = async (c) => {
  const photos = await getPhotosByCatch(c.id);
  const img = photos[0]?.thumbDataUrl;
  return `
    <div style="max-width:180px;">
      <div class="pill">${formatDate(c.dateCaught)}</div>
      <strong>${c.species}</strong><br/>
      ${c.locationName}<br/>
      ${formatWeight(c.weight, c.weightUnit)} • ${formatLength(c.length, c.lengthUnit)}<br/>
      ${img ? `<img src="${img}" style="width:100%;border-radius:8px;margin-top:6px;">` : ""}
      <div style="margin-top:6px;"><a href="./catch.html?id=${c.id}">Open</a></div>
    </div>
  `;
};

const renderMarkers = async () => {
  const species = speciesFilter.value;
  clearMarkers();
  const filtered = species ? catches.filter((c) => c.species === species) : catches;
  if (!filtered.length) return;
  const popupPromises = filtered.map((c) => makePopup(c));
  const popups = await Promise.all(popupPromises);
  filtered.forEach((c, idx) => {
    const marker = L.marker([c.lat, c.lng]).addTo(map);
    marker.bindPopup(popups[idx]);
    markers.push(marker);
  });
  const group = L.featureGroup(markers);
  map.fitBounds(group.getBounds().pad(0.25));
};

const load = async () => {
  try {
    await initLeaflet();
    catches = await getAllCatches();
    const species = Array.from(new Set(catches.map((c) => c.species).filter(Boolean))).sort();
    speciesFilter.innerHTML = '<option value="">All species</option>' + species.map((s) => `<option value="${s}">${s}</option>`).join("");
    map = L.map("map").setView([39.5, -98.35], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    await renderMarkers();
  } catch (err) {
    console.error(err);
    showToast("Map failed to load", "error");
  }
};

speciesFilter.addEventListener("change", renderMarkers);

load();
