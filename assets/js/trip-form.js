import { getTrip, saveTrip } from "./db.js";
import {
  clamp,
  dateTimeInputToIso,
  escapeHtml,
  formatDateTime,
  formatTimeRange,
  isoToDateTimeInput,
  roundToNearestQuarterHour,
} from "./utils.js";
import { createWeatherFallback, fetchWeatherSnapshot, formatWeatherSummary } from "./weather.js";
import { showToast } from "./ui.js";

const params = new URLSearchParams(location.search);
const tripId = params.get("id");

const form = document.getElementById("trip-form");
const title = document.getElementById("form-title");
const geoStatus = document.getElementById("geo-status");
const weatherSummary = document.getElementById("weather-summary");
const weatherMeta = document.getElementById("weather-meta");
const useLocationBtn = document.getElementById("use-location");
const refreshWeatherBtn = document.getElementById("refresh-weather");

let currentWeather = null;
let weatherFingerprint = "";

const getPosition = (options = { enableHighAccuracy: true, timeout: 10000 }) =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not available on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });

const setError = (field, message = "") => {
  const el = document.querySelector(`[data-error-for="${field}"]`);
  if (el) el.textContent = message;
};

const getWeatherContext = () => {
  const lat = Number(form.lat.value);
  const lng = Number(form.lng.value);
  const startAt = dateTimeInputToIso(form.startAt.value);
  const endAt = dateTimeInputToIso(form.endAt.value);
  if (!form.startAt.value || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat: clamp(lat, -90, 90),
    lng: clamp(lng, -180, 180),
    startAt,
    endAt,
    dateKey: form.startAt.value.slice(0, 10),
  };
};

const getFingerprint = (context) =>
  context ? [context.lat.toFixed(4), context.lng.toFixed(4), context.startAt, context.endAt].join("|") : "";

const renderWeather = () => {
  weatherSummary.textContent = formatWeatherSummary(currentWeather);
  weatherMeta.textContent =
    currentWeather?.status === "ready" && currentWeather?.fetchedAt
      ? `Saved ${formatDateTime(currentWeather.fetchedAt)}`
      : currentWeather?.summary
        ? currentWeather.summary
        : "Weather will be saved with the trip when a location and time range are available.";
};

const refreshWeather = async (manual = true) => {
  const context = getWeatherContext();
  if (!context) {
    currentWeather = createWeatherFallback("Add a location and time range first.");
    renderWeather();
    if (manual) showToast("Add a location and time range first.", "error");
    return;
  }

  currentWeather = await fetchWeatherSnapshot(context);
  weatherFingerprint = getFingerprint(context);
  renderWeather();

  if (!manual) return;
  showToast(
    currentWeather.status === "ready" ? "Weather updated for this trip." : currentWeather.summary || "Weather unavailable.",
    currentWeather.status === "ready" ? "success" : "error"
  );
};

const fillCurrentLocation = async ({ silent = false } = {}) => {
  geoStatus.textContent = "Reading your device location...";
  try {
    const position = await getPosition();
    const lat = position.coords.latitude.toFixed(5);
    const lng = position.coords.longitude.toFixed(5);
    form.lat.value = lat;
    form.lng.value = lng;
    if (!form.locationName.value.trim()) form.locationName.value = "Current fishing spot";
    geoStatus.textContent = `GPS updated to ${lat}, ${lng}`;
    if (!silent) showToast("Current location saved into the trip form.", "success");
    if (form.startAt.value) await refreshWeather(false);
  } catch (error) {
    console.error(error);
    geoStatus.textContent = "Location permission was denied or unavailable.";
    if (!silent) showToast("Unable to read your current location.", "error");
  }
};

const validate = () => {
  ["startAt", "endAt", "locationName", "lat", "lng"].forEach((field) => setError(field, ""));

  const startAtValue = form.startAt.value;
  const endAtValue = form.endAt.value;
  const locationName = form.locationName.value.trim();
  const lat = Number(form.lat.value);
  const lng = Number(form.lng.value);
  const rating = Number(form.rating.value);

  let valid = true;
  if (!startAtValue) {
    setError("startAt", "Required");
    valid = false;
  }
  if (!endAtValue) {
    setError("endAt", "Required");
    valid = false;
  }
  if (startAtValue && endAtValue && new Date(endAtValue) < new Date(startAtValue)) {
    setError("endAt", "End time must be after the start time");
    valid = false;
  }
  if (!locationName) {
    setError("locationName", "Required");
    valid = false;
  }
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    setError("lat", "Enter a latitude between -90 and 90");
    valid = false;
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    setError("lng", "Enter a longitude between -180 and 180");
    valid = false;
  }

  if (!valid) return null;

  return {
    id: tripId || undefined,
    title: locationName,
    locationName,
    lat: clamp(lat, -90, 90),
    lng: clamp(lng, -180, 180),
    startAt: dateTimeInputToIso(startAtValue),
    endAt: dateTimeInputToIso(endAtValue),
    dateKey: startAtValue.slice(0, 10),
    rating: Number.isFinite(rating) && rating > 0 ? rating : null,
    conditionsNotes: form.conditionsNotes.value.trim(),
    notes: form.notes.value.trim(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
};

const setDefaultTimes = () => {
  if (tripId) return;
  const start = roundToNearestQuarterHour(new Date());
  const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
  form.startAt.value = isoToDateTimeInput(start.toISOString());
  form.endAt.value = isoToDateTimeInput(end.toISOString());
};

const loadExisting = async () => {
  if (!tripId) return;
  title.textContent = "Edit fishing trip";
  const record = await getTrip(tripId);
  if (!record) {
    showToast("Trip not found.", "error");
    return;
  }

  form.locationName.value = record.locationName || "";
  form.lat.value = Number.isFinite(Number(record.lat)) ? Number(record.lat).toFixed(5) : "";
  form.lng.value = Number.isFinite(Number(record.lng)) ? Number(record.lng).toFixed(5) : "";
  form.startAt.value = isoToDateTimeInput(record.startAt);
  form.endAt.value = isoToDateTimeInput(record.endAt);
  form.rating.value = record.rating || "";
  form.conditionsNotes.value = record.conditionsNotes || "";
  form.notes.value = record.notes || "";
  currentWeather = record.weather || createWeatherFallback("Weather not captured yet.");
  weatherFingerprint = getFingerprint(getWeatherContext());
  renderWeather();
};

useLocationBtn?.addEventListener("click", () => fillCurrentLocation());
refreshWeatherBtn?.addEventListener("click", () => refreshWeather());

["startAt", "endAt", "lat", "lng"].forEach((field) => {
  form[field]?.addEventListener("change", () => {
    const nextFingerprint = getFingerprint(getWeatherContext());
    if (currentWeather && weatherFingerprint && nextFingerprint !== weatherFingerprint) {
      weatherMeta.textContent = "Trip details changed. Refresh weather to store a current snapshot.";
    }
  });
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = validate();
  if (!payload) return;

  const context = getWeatherContext();
  if (context) {
    const nextFingerprint = getFingerprint(context);
    if (!currentWeather || nextFingerprint !== weatherFingerprint) {
      currentWeather = await fetchWeatherSnapshot(context);
      weatherFingerprint = nextFingerprint;
      renderWeather();
    }
  }

  payload.weather = currentWeather || createWeatherFallback("Weather was not captured for this trip.");

  try {
    const id = await saveTrip(payload);
    const intent = event.submitter?.value || "save";
    showToast("Trip saved.", "success");
    setTimeout(() => {
      window.location.href =
        intent === "catch" ? `./catch-form.html?tripId=${id}` : `./trips.html?focus=${id}`;
    }, 180);
  } catch (error) {
    console.error(error);
    showToast("Failed to save the trip.", "error");
  }
});

setDefaultTimes();
renderWeather();
loadExisting().then(() => {
  if (!tripId) fillCurrentLocation({ silent: true });
});
