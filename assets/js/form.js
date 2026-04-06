import {
  addPhotos,
  deletePhoto,
  getAllTrips,
  getCatch,
  getPhotosByCatch,
  saveCatch,
} from "./db.js";
import { processFiles } from "./photo.js";
import {
  clamp,
  dateInputToIso,
  escapeHtml,
  formatTimeRange,
  isoToDateInput,
} from "./utils.js";
import { showToast } from "./ui.js";

const params = new URLSearchParams(location.search);
const catchId = params.get("id");
const selectedTripId = params.get("tripId");

const form = document.getElementById("catch-form");
const preview = document.getElementById("photo-preview");
const title = document.getElementById("form-title");
const tripSummary = document.getElementById("trip-summary");
const useTripDetailsBtn = document.getElementById("use-trip-details");
const useLocationBtn = document.getElementById("use-location");
const locationStatus = document.getElementById("location-status");

let tripMap = new Map();
let existingPhotos = [];
let pendingPhotos = [];
let removedPhotoIds = new Set();

const getPosition = (options = { enableHighAccuracy: true, timeout: 10000 }) =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not available."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });

const setError = (field, message = "") => {
  const el = document.querySelector(`[data-error-for="${field}"]`);
  if (el) el.textContent = message;
};

const renderPhotos = () => {
  const activeExisting = existingPhotos.filter((photo) => !removedPhotoIds.has(photo.id));
  const allPhotos = [...activeExisting, ...pendingPhotos];
  if (!allPhotos.length) {
    preview.innerHTML = '<div class="empty-inline">No photos added yet.</div>';
    return;
  }

  preview.innerHTML = allPhotos
    .map(
      (photo) => `
        <div class="photo-pill">
          <img src="${photo.thumbDataUrl}" alt="Catch preview">
          <button type="button" class="btn ghost danger-text" data-remove="${photo.id}">Remove</button>
        </div>
      `
    )
    .join("");
};

const populateTrips = async () => {
  const trips = await getAllTrips();
  tripMap = trips.reduce((map, trip) => {
    map.set(trip.id, trip);
    return map;
  }, new Map());

  form.tripId.innerHTML =
    '<option value="">Standalone catch</option>' +
    trips
      .map(
        (trip) => `
          <option value="${trip.id}">
            ${escapeHtml(`${trip.locationName || trip.title} | ${formatTimeRange(trip.startAt, trip.endAt)}`)}
          </option>
        `
      )
      .join("");

  if (selectedTripId && tripMap.has(selectedTripId)) {
    form.tripId.value = selectedTripId;
    applyTripDefaults(tripMap.get(selectedTripId), { force: true });
  }
  updateTripSummary();
};

const updateTripSummary = () => {
  const trip = tripMap.get(form.tripId.value);
  tripSummary.innerHTML = trip
    ? `
      <div class="note-card">
        <strong>${escapeHtml(trip.locationName || trip.title || "Fishing trip")}</strong>
        <span>${escapeHtml(formatTimeRange(trip.startAt, trip.endAt))}</span>
      </div>
    `
    : '<div class="note-card muted">This catch can stay standalone or be attached to a fishing trip.</div>';
};

const applyTripDefaults = (trip, { force = false } = {}) => {
  if (!trip) return;
  if (force || !form.dateCaught.value) form.dateCaught.value = trip.dateKey || isoToDateInput(trip.startAt);
  if (force || !form.locationName.value.trim()) form.locationName.value = trip.locationName || "";
  if (force || !form.lat.value) form.lat.value = Number.isFinite(Number(trip.lat)) ? Number(trip.lat).toFixed(5) : "";
  if (force || !form.lng.value) form.lng.value = Number.isFinite(Number(trip.lng)) ? Number(trip.lng).toFixed(5) : "";
  updateTripSummary();
};

const validate = () => {
  ["species", "dateCaught", "locationName", "lat", "lng", "weight", "length"].forEach((field) => setError(field, ""));
  const lat = Number(form.lat.value);
  const lng = Number(form.lng.value);
  const weight = Number(form.weight.value);
  const length = Number(form.length.value);
  const payload = {
    id: catchId || undefined,
    tripId: form.tripId.value || null,
    species: form.species.value.trim(),
    nickname: form.nickname.value.trim(),
    dateCaught: dateInputToIso(form.dateCaught.value),
    locationName: form.locationName.value.trim(),
    lat,
    lng,
    weight,
    weightUnit: form.weightUnit.value,
    length,
    lengthUnit: form.lengthUnit.value,
    notes: form.notes.value.trim(),
  };

  let valid = true;
  if (!payload.species) {
    setError("species", "Required");
    valid = false;
  }
  if (!form.dateCaught.value) {
    setError("dateCaught", "Required");
    valid = false;
  }
  if (!payload.locationName) {
    setError("locationName", "Required");
    valid = false;
  }
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    setError("lat", "Latitude must be between -90 and 90");
    valid = false;
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    setError("lng", "Longitude must be between -180 and 180");
    valid = false;
  }
  if (!Number.isFinite(weight) || weight <= 0) {
    setError("weight", "Enter a positive weight");
    valid = false;
  }
  if (!Number.isFinite(length) || length <= 0) {
    setError("length", "Enter a positive length");
    valid = false;
  }

  if (!valid) return null;
  return {
    ...payload,
    lat: clamp(lat, -90, 90),
    lng: clamp(lng, -180, 180),
  };
};

const fillCurrentLocation = async () => {
  locationStatus.textContent = "Reading your current location...";
  try {
    const position = await getPosition();
    form.lat.value = position.coords.latitude.toFixed(5);
    form.lng.value = position.coords.longitude.toFixed(5);
    if (!form.locationName.value.trim()) form.locationName.value = "Current fishing spot";
    locationStatus.textContent = "Current coordinates added to the catch form.";
    showToast("Current location added.", "success");
  } catch (error) {
    console.error(error);
    locationStatus.textContent = "Unable to read your location.";
    showToast("Unable to read your current location.", "error");
  }
};

const loadExisting = async () => {
  if (!catchId) return;
  title.textContent = "Edit catch";
  const record = await getCatch(catchId);
  if (!record) {
    showToast("Catch not found.", "error");
    return;
  }

  form.tripId.value = record.tripId || "";
  form.species.value = record.species || "";
  form.nickname.value = record.nickname || "";
  form.dateCaught.value = isoToDateInput(record.dateCaught);
  form.locationName.value = record.locationName || "";
  form.lat.value = Number.isFinite(Number(record.lat)) ? Number(record.lat).toFixed(5) : "";
  form.lng.value = Number.isFinite(Number(record.lng)) ? Number(record.lng).toFixed(5) : "";
  form.weight.value = record.weight ?? "";
  form.weightUnit.value = record.weightUnit || "lb";
  form.length.value = record.length ?? "";
  form.lengthUnit.value = record.lengthUnit || "in";
  form.notes.value = record.notes || "";

  existingPhotos = await getPhotosByCatch(catchId);
  updateTripSummary();
  renderPhotos();
};

document.getElementById("photos")?.addEventListener("change", async (event) => {
  const files = event.target.files;
  if (!files?.length) return;
  const newPhotos = await processFiles(files);
  pendingPhotos = pendingPhotos.concat(newPhotos);
  renderPhotos();
  showToast(`Added ${newPhotos.length} photo${newPhotos.length > 1 ? "s" : ""}.`, "success");
});

preview?.addEventListener("click", (event) => {
  const id = event.target.closest("[data-remove]")?.dataset.remove;
  if (!id) return;
  if (existingPhotos.some((photo) => photo.id === id)) {
    removedPhotoIds.add(id);
  } else {
    pendingPhotos = pendingPhotos.filter((photo) => photo.id !== id);
  }
  renderPhotos();
});

form.tripId?.addEventListener("change", () => {
  const trip = tripMap.get(form.tripId.value);
  applyTripDefaults(trip);
});

useTripDetailsBtn?.addEventListener("click", () => {
  const trip = tripMap.get(form.tripId.value);
  if (!trip) {
    showToast("Choose a trip first to pull in its details.", "error");
    return;
  }
  applyTripDefaults(trip, { force: true });
  showToast("Trip details copied into the catch form.", "success");
});

useLocationBtn?.addEventListener("click", fillCurrentLocation);

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = validate();
  if (!payload) return;

  try {
    const id = await saveCatch(payload);
    if (removedPhotoIds.size) {
      for (const photoId of removedPhotoIds) {
        await deletePhoto(photoId);
      }
    }
    if (pendingPhotos.length) {
      await addPhotos(id, pendingPhotos);
    }
    showToast("Catch saved.", "success");
    setTimeout(() => {
      window.location.href = `./catch.html?id=${id}`;
    }, 180);
  } catch (error) {
    console.error(error);
    showToast("Failed to save the catch.", "error");
  }
});

const init = async () => {
  try {
    await populateTrips();
    await loadExisting();
    renderPhotos();
  } catch (error) {
    console.error(error);
    showToast("Failed to load the catch form.", "error");
  }
};

init();
