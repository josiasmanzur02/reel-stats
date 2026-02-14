export const qs = (sel, parent = document) => parent.querySelector(sel);
export const qsa = (sel, parent = document) => Array.from(parent.querySelectorAll(sel));

export const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");
export const formatDateTime = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

export const formatWeight = (value, unit = "lb") => `${Number(value).toFixed(2)} ${unit}`;
export const formatLength = (value, unit = "in") => `${Number(value).toFixed(1)} ${unit}`;
export const formatLatLng = (lat, lng) => `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;

export const downloadFile = (filename, data, mime = "application/octet-stream") => {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return blob;
};

export const tryShare = async (filename, blob) => {
  if (navigator.canShare && navigator.canShare({ files: [blob] })) {
    await navigator.share({ files: [blob], title: "Fish Catch Tracker backup", text: "Backup file" });
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

export const readFileAsArrayBuffer = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });

export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

export const sortByDateDesc = (arr, key = "dateCaught") =>
  [...arr].sort((a, b) => new Date(b[key]) - new Date(a[key]));
