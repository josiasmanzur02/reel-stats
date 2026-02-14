import { exportData, importData, resetDatabase } from "./db.js";
import {
  downloadFile,
  tryShare,
  readFileAsText,
  readFileAsArrayBuffer,
} from "./utils.js";
import { showToast, confirmAction } from "./ui.js";

const exportJsonBtn = document.getElementById("export-json");
const exportZipBtn = document.getElementById("export-zip");
const exportShareBtn = document.getElementById("export-share");
const importFileInput = document.getElementById("import-file");
const importMergeBtn = document.getElementById("import-merge");
const importReplaceBtn = document.getElementById("import-replace");
const preview = document.getElementById("import-preview");
const resetBtn = document.getElementById("reset-btn");

let pendingImport = null;

const dataUrlToParts = (dataUrl) => {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  return match ? { mime: match[1], base64: match[2] } : null;
};

const handleExportJson = async (share = false) => {
  const payload = await exportData();
  const json = JSON.stringify(payload, null, 2);
  const blob = downloadFile(`fish-catch-export-${Date.now()}.json`, json, "application/json");
  if (share) {
    const shared = await tryShare("fish-catch-export.json", blob);
    if (!shared) showToast("Share not available, file downloaded instead.");
  }
  showToast("Export ready", "success");
};

const handleExportZip = async () => {
  try {
    const JSZip = (await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm")).default;
    const payload = await exportData();
    const zip = new JSZip();
    zip.file(
      "catches.json",
      JSON.stringify({ version: payload.version, exportedAt: payload.exportedAt, catches: payload.catches }, null, 2)
    );
    zip.file(
      "photo-meta.json",
      JSON.stringify(
        payload.photos.map((p) => ({ id: p.id, catchId: p.catchId, mimeType: p.mimeType, createdAt: p.createdAt })),
        null,
        2
      )
    );
    payload.photos.forEach((p) => {
      if (!p.fullDataUrl) return;
      const parts = dataUrlToParts(p.fullDataUrl);
      if (!parts) return;
      const ext = parts.mime.includes("png") ? "png" : parts.mime.includes("webp") ? "webp" : "jpg";
      zip.file(`photos/${p.id}.${ext}`, parts.base64, { base64: true });
    });
    const blob = await zip.generateAsync({ type: "blob" });
    downloadFile(`fish-catch-export-${Date.now()}.zip`, blob, "application/zip");
    showToast("ZIP exported", "success");
  } catch (err) {
    console.error(err);
    showToast("ZIP export failed, JSON still works.", "error");
  }
};

const parseImportFile = async (file) => {
  if (!file) return null;
  if (file.name.endsWith(".json")) {
    const text = await readFileAsText(file);
    return JSON.parse(text);
  }
  if (file.name.endsWith(".zip")) {
    const JSZip = (await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm")).default;
    const buf = await readFileAsArrayBuffer(file);
    const zip = await JSZip.loadAsync(buf);
    const catchesEntry = zip.file("catches.json");
    if (!catchesEntry) throw new Error("Missing catches.json inside ZIP");
    const catchesPayload = JSON.parse(await catchesEntry.async("string"));
    let metaMap = {};
    const metaEntry = zip.file("photo-meta.json");
    if (metaEntry) {
      const meta = JSON.parse(await metaEntry.async("string"));
      metaMap = Object.fromEntries((meta || []).map((m) => [m.id, m]));
    }
    const photos = [];
    const photoFiles = Object.values(zip.files).filter((f) => f.name.startsWith("photos/") && !f.dir);
    for (const f of photoFiles) {
      const base64 = await f.async("base64");
      const ext = f.name.split(".").pop();
      const mime =
        ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "json" ? "application/json" : "image/jpeg";
      const id = f.name.split("/").pop().split(".")[0];
      const meta = metaMap[id] || {};
      photos.push({
        id,
        catchId: meta.catchId || null,
        mimeType: meta.mimeType || mime,
        fullDataUrl: `data:${mime};base64,${base64}`,
        thumbDataUrl: `data:${mime};base64,${base64}`,
        createdAt: meta.createdAt || new Date().toISOString(),
      });
    }
    return { catches: catchesPayload.catches || [], photos };
  }
  throw new Error("Unsupported file type");
};

const showPreview = (payload) => {
  if (!payload) {
    preview.textContent = "";
    return;
  }
  const summary = [
    `Catches: ${payload.catches?.length || 0}`,
    `Photos: ${payload.photos?.length || 0}`,
    payload.exportedAt ? `Exported: ${payload.exportedAt}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  preview.textContent = summary;
};

importFileInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    pendingImport = await parseImportFile(file);
    showPreview(pendingImport);
    showToast("Import file ready");
  } catch (err) {
    console.error(err);
    showToast("Unable to read import file", "error");
    pendingImport = null;
  }
});

const handleImport = async (mode) => {
  if (!pendingImport) {
    showToast("Choose a file first", "error");
    return;
  }
  try {
    await importData(pendingImport, mode);
    showToast("Import complete", "success");
  } catch (err) {
    console.error(err);
    showToast("Import failed", "error");
  }
};

exportJsonBtn.addEventListener("click", () => handleExportJson(false));
exportZipBtn.addEventListener("click", handleExportZip);
exportShareBtn.addEventListener("click", () => handleExportJson(true));
importMergeBtn.addEventListener("click", () => handleImport("merge"));
importReplaceBtn.addEventListener("click", () => handleImport("replace"));

resetBtn.addEventListener("click", async () => {
  if (!confirmAction("Reset all local data? This cannot be undone.")) return;
  await resetDatabase();
  showToast("Local data cleared", "success");
  setTimeout(() => location.reload(), 150);
});
