import { getAllCatches, getAllPhotos } from "./db.js";
import { qs, formatDate, formatWeight, formatLength } from "./utils.js";
import { renderEmpty, showToast } from "./ui.js";

const gallery = qs("#gallery");
const searchInput = qs("#search");
const speciesFilter = qs("#filter-species");
const sortSelect = qs("#sort");
const pbOnly = qs("#pb-only");
const fromDate = qs("#from-date");
const toDate = qs("#to-date");

let catches = [];
let photoMap = new Map(); // catchId -> thumb

const load = async () => {
  try {
    catches = await getAllCatches();
    const photos = await getAllPhotos();
    photoMap = photos.reduce((acc, p) => {
      if (!acc.has(p.catchId)) acc.set(p.catchId, p.thumbDataUrl || p.fullDataUrl);
      return acc;
    }, new Map());
    populateSpecies();
    applyFilters();
  } catch (err) {
    console.error(err);
    showToast("Failed to load gallery", "error");
  }
};

const populateSpecies = () => {
  const species = Array.from(new Set(catches.map((c) => c.species).filter(Boolean))).sort();
  speciesFilter.innerHTML = '<option value="">All species</option>' + species.map((s) => `<option value="${s}">${s}</option>`).join("");
};

const applyFilters = () => {
  const term = searchInput.value.trim().toLowerCase();
  const species = speciesFilter.value;
  const onlyPB = pbOnly.checked;
  const from = fromDate.value ? new Date(fromDate.value) : null;
  const to = toDate.value ? new Date(toDate.value) : null;

  let results = catches.filter((c) => {
    if (species && c.species !== species) return false;
    if (onlyPB && !(c.isPBLength || c.isPBWeight)) return false;
    if (from && new Date(c.dateCaught) < from) return false;
    if (to && new Date(c.dateCaught) > to) return false;
    if (term) {
      const hay = `${c.species} ${c.nickname || ""} ${c.locationName} ${c.notes || ""}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });

  const sort = sortSelect.value;
  results = results.sort((a, b) => {
    switch (sort) {
      case "oldest":
        return new Date(a.dateCaught) - new Date(b.dateCaught);
      case "heaviest":
        return b.weight - a.weight;
      case "longest":
        return b.length - a.length;
      default:
        return new Date(b.dateCaught) - new Date(a.dateCaught);
    }
  });

  render(results);
};

const render = (items) => {
  if (!items.length) {
    renderEmpty(gallery, "No catches match your filters.");
    return;
  }
  gallery.innerHTML = items
    .map((c) => {
      const img = photoMap.get(c.id);
      return `
      <a class="card catch-card" href="./catch.html?id=${c.id}">
        ${img ? `<img src="${img}" alt="${c.species}">` : '<div class="empty" style="height:160px;">No photo</div>'}
        <div class="chips" style="margin:6px 0;">${c.isPBWeight ? '<span class="badge pb">PB Weight</span>' : ""} ${
        c.isPBLength ? '<span class="badge pb">PB Length</span>' : ""
      }</div>
        <h3 style="margin:0;">${c.species}</h3>
        <div class="muted">${formatDate(c.dateCaught)} • ${c.locationName}</div>
        <div style="margin-top:6px;">${formatWeight(c.weight, c.weightUnit)} • ${formatLength(c.length, c.lengthUnit)}</div>
      </a>
    `;
    })
    .join("");
};

["input", "change"].forEach((ev) => {
  searchInput.addEventListener(ev, applyFilters);
  speciesFilter.addEventListener(ev, applyFilters);
  sortSelect.addEventListener(ev, applyFilters);
  pbOnly.addEventListener(ev, applyFilters);
  fromDate.addEventListener(ev, applyFilters);
  toDate.addEventListener(ev, applyFilters);
});

load();
