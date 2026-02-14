import { getCatch, getPhotosByCatch, deleteCatch } from "./db.js";
import { qs, formatDate, formatWeight, formatLength, formatLatLng } from "./utils.js";
import { showToast, confirmAction, renderEmpty } from "./ui.js";

const params = new URLSearchParams(location.search);
const catchId = params.get("id");

const title = qs("#title");
const meta = qs("#meta");
const badges = qs("#badges");
const photoStrip = qs("#photo-strip");
const detailGrid = qs("#detail-grid");
const notesBlock = qs("#notes-block");
const editBtn = qs("#edit-btn");
const deleteBtn = qs("#delete-btn");

const load = async () => {
  if (!catchId) {
    renderEmpty(detailGrid, "Missing catch id.");
    return;
  }
  try {
    const data = await getCatch(catchId);
    if (!data) {
      renderEmpty(detailGrid, "Catch not found.");
      return;
    }
    const photos = await getPhotosByCatch(catchId);
    title.textContent = data.species || "Catch";
    meta.textContent = `${formatDate(data.dateCaught)} • ${data.locationName}`;
    badges.innerHTML = `
      ${data.isPBWeight ? '<span class="badge pb">PB Weight</span>' : ""}
      ${data.isPBLength ? '<span class="badge pb">PB Length</span>' : ""}
    `;
    if (photos.length) {
      photoStrip.innerHTML = photos
        .map((p) => `<img src="${p.fullDataUrl || p.thumbDataUrl}" alt="photo of ${data.species}">`)
        .join("");
    } else {
      photoStrip.innerHTML = '<div class="empty">No photos</div>';
    }
    detailGrid.classList.add("cards");
    detailGrid.innerHTML = `
      <div class="card"><div class="muted">Weight</div><div class="stat-number">${formatWeight(
        data.weight,
        data.weightUnit
      )}</div></div>
      <div class="card"><div class="muted">Length</div><div class="stat-number">${formatLength(
        data.length,
        data.lengthUnit
      )}</div></div>
      <div class="card"><div class="muted">Coords</div><div class="stat-number" style="font-size:20px;">${formatLatLng(
        data.lat,
        data.lng
      )}</div></div>
      <div class="card"><div class="muted">Nickname</div><div class="stat-number" style="font-size:20px;">${
        data.nickname || "—"
      }</div></div>
    `;
    notesBlock.innerHTML = data.notes
      ? `<h3>Notes</h3><p>${data.notes}</p>`
      : `<div class="muted">No notes added.</div>`;

    editBtn.href = `./catch-form.html?id=${catchId}`;
  } catch (err) {
    console.error(err);
    showToast("Failed to load catch", "error");
  }
};

deleteBtn.addEventListener("click", async () => {
  if (!confirmAction("Delete this catch? This cannot be undone.")) return;
  try {
    await deleteCatch(catchId);
    showToast("Deleted", "success");
    setTimeout(() => (window.location.href = "./gallery.html"), 200);
  } catch (err) {
    console.error(err);
    showToast("Failed to delete", "error");
  }
});

load();
