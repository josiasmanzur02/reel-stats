import { getAllCatches, getPhotosByCatch } from "./db.js";
import { qs, formatDate, formatWeight, formatLength } from "./utils.js";
import { renderEmpty, showToast } from "./ui.js";

const recentContent = qs("#recent-content");
const pbList = qs("#pb-list");

const renderStats = (catches) => {
  qs("#stat-total").textContent = catches.length;
  const uniqueSpecies = new Set(catches.map((c) => c.species?.toLowerCase().trim()).filter(Boolean));
  qs("#stat-species").textContent = uniqueSpecies.size;
  const pbCount = catches.filter((c) => c.isPBWeight || c.isPBLength).length;
  qs("#stat-pb").textContent = pbCount;
  if (!catches.length) {
    qs("#stat-latest").textContent = "—";
    qs("#stat-latest-meta").textContent = "";
    return;
  }
  const latest = [...catches].sort((a, b) => new Date(b.dateCaught) - new Date(a.dateCaught))[0];
  qs("#stat-latest").textContent = latest.species || "—";
  qs("#stat-latest-meta").textContent = `${formatDate(latest.dateCaught)} • ${latest.locationName}`;
};

const renderRecent = async (catches) => {
  if (!catches.length) {
    recentContent.classList.add("muted");
    recentContent.textContent = "No catches yet. Log your first one!";
    return;
  }
  const latest = [...catches].sort((a, b) => new Date(b.dateCaught) - new Date(a.dateCaught))[0];
  const photos = await getPhotosByCatch(latest.id);
  const thumb = photos[0]?.thumbDataUrl;
  recentContent.innerHTML = `
    <div class="inline" style="align-items:center; gap:16px;">
      ${thumb ? `<img src="${thumb}" alt="photo" style="width:110px;height:110px;border-radius:14px;object-fit:cover;">` : ""}
      <div>
        <div class="pill">${formatDate(latest.dateCaught)}</div>
        <h3 style="margin:6px 0;">${latest.species}</h3>
        <div class="muted">${latest.locationName}</div>
        <div>${formatWeight(latest.weight, latest.weightUnit)} • ${formatLength(latest.length, latest.lengthUnit)}</div>
        <div class="chips" style="margin-top:6px;">
          ${latest.isPBWeight ? `<span class="badge pb">PB Weight</span>` : ""}
          ${latest.isPBLength ? `<span class="badge pb">PB Length</span>` : ""}
        </div>
        <div class="btn-row" style="margin-top:8px;">
          <a class="btn secondary" href="./catch.html?id=${latest.id}">View</a>
          <a class="btn secondary" href="./catch-form.html?id=${latest.id}">Edit</a>
        </div>
      </div>
    </div>
  `;
};

const renderPBs = (catches) => {
  const pbs = catches
    .filter((c) => c.isPBWeight)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);
  if (!pbs.length) {
    renderEmpty(pbList, "No PBs yet.");
    return;
  }
  pbList.classList.add("cards");
  pbList.innerHTML = pbs
    .map(
      (c) => `
      <div class="card catch-card">
        <div class="chips" style="margin-bottom:8px;">
          <span class="badge pb">PB Weight</span>
        </div>
        <h3 style="margin:0 0 4px;">${c.species}</h3>
        <div class="muted">${formatDate(c.dateCaught)} • ${c.locationName}</div>
        <div style="margin-top:6px;">${formatWeight(c.weight, c.weightUnit)} • ${formatLength(c.length, c.lengthUnit)}</div>
        <a class="btn secondary" style="margin-top:8px;" href="./catch.html?id=${c.id}">View</a>
      </div>
    `
    )
    .join("");
};

const load = async () => {
  try {
    const catches = await getAllCatches();
    renderStats(catches);
    await renderRecent(catches);
    renderPBs(catches);
  } catch (err) {
    console.error(err);
    showToast("Failed to load dashboard", "error");
  }
};

load();
