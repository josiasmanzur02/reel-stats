export const qs = (sel, parent = document) => parent.querySelector(sel);
export const qsa = (sel, parent = document) => Array.from(parent.querySelectorAll(sel));

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

export const formatDate = (iso) => (iso ? dateFormatter.format(new Date(iso)) : "--");
export const formatDateTime = (iso) => (iso ? dateTimeFormatter.format(new Date(iso)) : "--");
export const formatTime = (iso) => (iso ? timeFormatter.format(new Date(iso)) : "--");
export const formatDateKey = (dateKey) => (dateKey ? formatDate(`${dateKey}T12:00:00`) : "--");

export const formatWeight = (value, unit = "lb") =>
  Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)} ${unit}` : "--";
export const formatLength = (value, unit = "in") =>
  Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)} ${unit}` : "--";
export const formatLatLng = (lat, lng) =>
  Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
    ? `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`
    : "--";

export const getDateKey = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const isoToDateInput = (iso) => getDateKey(iso);

export const isoToDateTimeInput = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const dateInputToIso = (value) => (value ? new Date(`${value}T12:00:00`).toISOString() : "");
export const dateTimeInputToIso = (value) => (value ? new Date(value).toISOString() : "");

export const formatTimeRange = (startAt, endAt) => {
  if (!startAt && !endAt) return "--";
  if (startAt && !endAt) return formatDateTime(startAt);
  if (!startAt && endAt) return formatDateTime(endAt);
  const sameDay = getDateKey(startAt) === getDateKey(endAt);
  if (sameDay) return `${formatDate(startAt)} | ${formatTime(startAt)} - ${formatTime(endAt)}`;
  return `${formatDateTime(startAt)} - ${formatDateTime(endAt)}`;
};

export const formatDuration = (startAt, endAt) => {
  if (!startAt || !endAt) return "--";
  const diffMs = new Date(endAt) - new Date(startAt);
  if (!Number.isFinite(diffMs) || diffMs < 0) return "--";
  const totalMinutes = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

export const formatRating = (rating) => {
  const value = Number(rating);
  return Number.isFinite(value) && value > 0 ? `${value}/5` : "Not rated";
};

export const downloadFile = (filename, data, mime = "application/octet-stream") => {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return blob;
};

export const tryShare = async (filename, blob) => {
  const file = blob instanceof File ? blob : new File([blob], filename, { type: blob.type || "application/octet-stream" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: "Reel Stats backup",
      text: "Offline fishing log backup",
    });
    return true;
  }
  return false;
};

export const readFileAsText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
export const clamp = (num, min, max) => Math.min(Math.max(num, min), max);
export const excerpt = (value = "", length = 120) =>
  value.length > length ? `${value.slice(0, length).trimEnd()}...` : value;
export const sortByDateDesc = (arr, key = "dateCaught") =>
  [...arr].sort((a, b) => new Date(b[key] || 0) - new Date(a[key] || 0));

export const roundToNearestQuarterHour = (date = new Date()) => {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  rounded.setMinutes(Math.ceil(minutes / 15) * 15, 0, 0);
  return rounded;
};

export const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
