import { exportData, importData, resetDatabase } from "./db.js";
import { downloadFile, readFileAsText, tryShare } from "./utils.js";
import { confirmAction, showToast } from "./ui.js";

const exportJsonBtn = document.getElementById("export-json");
const exportShareBtn = document.getElementById("export-share");
const importFileInput = document.getElementById("import-file");
const importMergeBtn = document.getElementById("import-merge");
const importReplaceBtn = document.getElementById("import-replace");
const preview = document.getElementById("import-preview");
const resetBtn = document.getElementById("reset-btn");

let pendingImport = null;

const showPreview = (payload) => {
  if (!payload) {
    preview.textContent = "";
    return;
  }

  preview.textContent = [
    `Trips: ${payload.trips?.length || 0}`,
    `Catches: ${payload.catches?.length || 0}`,
    `Photos: ${payload.photos?.length || 0}`,
    payload.exportedAt ? `Exported: ${payload.exportedAt}` : "",
  ]
    .filter(Boolean)
    .join("\n");
};

const parseImportFile = async (file) => {
  if (!file?.name.endsWith(".json")) {
    throw new Error("Only JSON backups are supported.");
  }
  const text = await readFileAsText(file);
  return JSON.parse(text);
};

const exportBackup = async (share = false) => {
  const payload = await exportData();
  const json = JSON.stringify(payload, null, 2);
  const blob = downloadFile(`reel-stats-backup-${Date.now()}.json`, json, "application/json");
  if (share) {
    const shared = await tryShare("reel-stats-backup.json", blob);
    if (!shared) showToast("Share is not available on this device, so the file was downloaded instead.");
  }
  showToast("Backup exported.", "success");
};

const handleImport = async (mode) => {
  if (!pendingImport) {
    showToast("Choose a backup file first.", "error");
    return;
  }
  try {
    await importData(pendingImport, mode);
    showToast("Backup imported.", "success");
  } catch (error) {
    console.error(error);
    showToast("Import failed.", "error");
  }
};

exportJsonBtn?.addEventListener("click", () => exportBackup(false));
exportShareBtn?.addEventListener("click", () => exportBackup(true));

importFileInput?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    pendingImport = await parseImportFile(file);
    showPreview(pendingImport);
    showToast("Backup ready to import.");
  } catch (error) {
    console.error(error);
    pendingImport = null;
    showPreview(null);
    showToast("Unable to read that backup file.", "error");
  }
});

importMergeBtn?.addEventListener("click", () => handleImport("merge"));
importReplaceBtn?.addEventListener("click", () => handleImport("replace"));

resetBtn?.addEventListener("click", async () => {
  if (!confirmAction("Reset all local trips, catches, and photos from this device?")) return;
  await resetDatabase();
  showToast("All local data was cleared.", "success");
  setTimeout(() => {
    window.location.reload();
  }, 180);
});
