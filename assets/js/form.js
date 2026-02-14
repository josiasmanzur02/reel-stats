import {
  saveCatch,
  getCatch,
  addPhotos,
  getPhotosByCatch,
  deletePhoto,
} from "./db.js";
import { processFiles } from "./photo.js";
import { qs, clamp } from "./utils.js";
import { showToast } from "./ui.js";

const params = new URLSearchParams(location.search);
const catchId = params.get("id");

const form = qs("#catch-form");
const preview = qs("#photo-preview");
const title = qs("#form-title");

let existingPhotos = [];
let pendingPhotos = [];
let removedPhotoIds = new Set();

const setError = (field, message = "") => {
  const el = document.querySelector(`[data-error-for='${field}']`);
  if (el) el.textContent = message;
};

const validate = () => {
  ["species", "dateCaught", "locationName", "lat", "lng", "weight", "length"].forEach((f) => setError(f, ""));
  const data = {
    id: catchId || undefined,
    species: form.species.value.trim(),
    nickname: form.nickname.value.trim(),
    dateCaught: form.dateCaught.value,
    locationName: form.locationName.value.trim(),
    lat: Number(form.lat.value),
    lng: Number(form.lng.value),
    weight: Number(form.weight.value),
    weightUnit: form.weightUnit.value,
    length: Number(form.length.value),
    lengthUnit: form.lengthUnit.value,
    notes: form.notes.value.trim(),
  };
  let valid = true;
  if (!data.species) {
    setError("species", "Required");
    valid = false;
  }
  if (!data.dateCaught) {
    setError("dateCaught", "Required");
    valid = false;
  }
  if (!data.locationName) {
    setError("locationName", "Required");
    valid = false;
  }
  if (!Number.isFinite(data.lat) || data.lat < -90 || data.lat > 90) {
    setError("lat", "Must be between -90 and 90");
    valid = false;
  }
  if (!Number.isFinite(data.lng) || data.lng < -180 || data.lng > 180) {
    setError("lng", "Must be between -180 and 180");
    valid = false;
  }
  if (!Number.isFinite(data.weight) || data.weight <= 0) {
    setError("weight", "Must be > 0");
    valid = false;
  }
  if (!Number.isFinite(data.length) || data.length <= 0) {
    setError("length", "Must be > 0");
    valid = false;
  }
  if (!valid) return null;

  const isoDate = new Date(`${data.dateCaught}T12:00:00`).toISOString();
  return { ...data, dateCaught: isoDate, lat: clamp(data.lat, -90, 90), lng: clamp(data.lng, -180, 180) };
};

const renderPhotos = () => {
  const activeExisting = existingPhotos.filter((p) => !removedPhotoIds.has(p.id));
  const all = [...activeExisting, ...pendingPhotos];
  if (!all.length) {
    preview.innerHTML = '<span class="muted">No photos added yet.</span>';
    return;
  }
  preview.innerHTML = all
    .map(
      (p) => `
      <div class="chip" data-id="${p.id}">
        <img src="${p.thumbDataUrl}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:8px;">
        <button type="button" class="btn danger" data-remove="${p.id}" style="padding:4px 8px;font-size:12px;">Remove</button>
      </div>
    `
    )
    .join("");
};

const loadExisting = async () => {
  if (!catchId) return;
  title.textContent = "Edit Catch";
  const data = await getCatch(catchId);
  if (!data) {
    showToast("Catch not found", "error");
    return;
  }
  form.species.value = data.species || "";
  form.nickname.value = data.nickname || "";
  form.dateCaught.value = data.dateCaught ? data.dateCaught.slice(0, 10) : "";
  form.locationName.value = data.locationName || "";
  form.lat.value = data.lat ?? "";
  form.lng.value = data.lng ?? "";
  form.weight.value = data.weight ?? "";
  form.weightUnit.value = data.weightUnit || "lb";
  form.length.value = data.length ?? "";
  form.lengthUnit.value = data.lengthUnit || "in";
  form.notes.value = data.notes || "";
  existingPhotos = await getPhotosByCatch(catchId);
  renderPhotos();
};

qs("#photos").addEventListener("change", async (e) => {
  const files = e.target.files;
  if (!files?.length) return;
  const newPhotos = await processFiles(files);
  pendingPhotos = pendingPhotos.concat(newPhotos);
  renderPhotos();
  showToast(`Added ${newPhotos.length} photo${newPhotos.length > 1 ? "s" : ""}`);
});

preview.addEventListener("click", async (e) => {
  const id = e.target.dataset.remove;
  if (!id) return;
  if (existingPhotos.find((p) => p.id === id)) {
    removedPhotoIds.add(id);
  } else {
    pendingPhotos = pendingPhotos.filter((p) => p.id !== id);
  }
  renderPhotos();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = validate();
  if (!payload) return;
  try {
    const id = await saveCatch(payload);
    if (removedPhotoIds.size) {
      for (const pid of removedPhotoIds) await deletePhoto(pid);
    }
    if (pendingPhotos.length) {
      await addPhotos(id, pendingPhotos);
    }
    showToast("Saved!", "success");
    setTimeout(() => (window.location.href = `./catch.html?id=${id}`), 200);
  } catch (err) {
    console.error(err);
    showToast("Failed to save", "error");
  }
});

loadExisting();
