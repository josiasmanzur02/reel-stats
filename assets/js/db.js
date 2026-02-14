import { uuid } from "./utils.js";

const DB_NAME = "fish_catch_tracker";
const DB_VERSION = 1;
let dbPromise;

const getDB = () => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("catches")) {
        const store = db.createObjectStore("catches", { keyPath: "id" });
        store.createIndex("species", "species");
        store.createIndex("dateCaught", "dateCaught");
        store.createIndex("isPBWeight", "isPBWeight");
        store.createIndex("isPBLength", "isPBLength");
      }
      if (!db.objectStoreNames.contains("photos")) {
        const store = db.createObjectStore("photos", { keyPath: "id" });
        store.createIndex("catchId", "catchId");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
};

const txStores = (stores, mode, fn) =>
  getDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(stores, mode);
        fn(tx, resolve, reject);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );

const requestPromise = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export const getAllCatches = async () => {
  const db = await getDB();
  const tx = db.transaction(["catches"], "readonly");
  const req = tx.objectStore("catches").getAll();
  return requestPromise(req);
};

export const getCatch = async (id) => {
  const db = await getDB();
  const tx = db.transaction(["catches"], "readonly");
  const req = tx.objectStore("catches").get(id);
  return requestPromise(req);
};

export const getPhotosByCatch = async (catchId) => {
  const db = await getDB();
  const tx = db.transaction(["photos"], "readonly");
  const idx = tx.objectStore("photos").index("catchId");
  const req = idx.getAll(IDBKeyRange.only(catchId));
  return requestPromise(req);
};

export const addPhotos = async (catchId, photos) => {
  if (!photos?.length) return;
  const db = await getDB();
  const tx = db.transaction(["photos"], "readwrite");
  const store = tx.objectStore("photos");
  photos.forEach((p) => {
    store.put({ ...p, catchId });
  });
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
};

export const deletePhotosForCatch = async (catchId) => {
  const photos = await getPhotosByCatch(catchId);
  if (!photos.length) return;
  const db = await getDB();
  const tx = db.transaction(["photos"], "readwrite");
  const store = tx.objectStore("photos");
  photos.forEach((p) => store.delete(p.id));
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
};

export const deletePhoto = async (id) => {
  const db = await getDB();
  const tx = db.transaction(["photos"], "readwrite");
  tx.objectStore("photos").delete(id);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
};

export const saveCatch = async (data) => {
  const now = new Date().toISOString();
  const existing = data.id ? await getCatch(data.id) : null;
  const record = {
    ...existing,
    ...data,
    id: existing?.id || data.id || uuid(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    isPBWeight: existing?.isPBWeight || false,
    isPBLength: existing?.isPBLength || false,
  };
  const db = await getDB();
  const tx = db.transaction(["catches"], "readwrite");
  tx.objectStore("catches").put(record);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  await recalcPBs();
  return record.id;
};

export const deleteCatch = async (id) => {
  await deletePhotosForCatch(id);
  const db = await getDB();
  const tx = db.transaction(["catches"], "readwrite");
  tx.objectStore("catches").delete(id);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  await recalcPBs();
};

export const recalcPBs = async () => {
  const catches = await getAllCatches();
  const bySpecies = {};
  catches.forEach((c) => {
    const key = (c.species || "").trim().toLowerCase();
    if (!bySpecies[key]) bySpecies[key] = [];
    bySpecies[key].push(c);
  });

  const winners = new Map(); // id -> {w?:bool, l?:bool}
  // Highest weight/length per species; newest (updatedAt) wins ties.
  const choose = (arr, field) => {
    if (!arr.length) return null;
    return arr
      .filter((c) => typeof c[field] === "number" && !isNaN(c[field]))
      .sort((a, b) => {
        if (b[field] === a[field]) return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
        return b[field] - a[field];
      })[0];
  };

  Object.values(bySpecies).forEach((list) => {
    const weightWinner = choose(list, "weight");
    const lengthWinner = choose(list, "length");
    if (weightWinner) winners.set(weightWinner.id, { ...(winners.get(weightWinner.id) || {}), w: true });
    if (lengthWinner) winners.set(lengthWinner.id, { ...(winners.get(lengthWinner.id) || {}), l: true });
  });

  const db = await getDB();
  const tx = db.transaction(["catches"], "readwrite");
  const store = tx.objectStore("catches");
  catches.forEach((c) => {
    const win = winners.get(c.id) || {};
    const isPBWeight = Boolean(win.w);
    const isPBLength = Boolean(win.l);
    if (c.isPBWeight !== isPBWeight || c.isPBLength !== isPBLength) {
      store.put({ ...c, isPBWeight, isPBLength });
    }
  });

  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
};

export const exportData = async () => {
  const [catches, photos] = await Promise.all([getAllCatches(), getAllPhotos()]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    catches,
    photos,
  };
};

const getAllPhotos = async () => {
  const db = await getDB();
  const tx = db.transaction(["photos"], "readonly");
  const req = tx.objectStore("photos").getAll();
  return requestPromise(req);
};

export { getAllPhotos };

export const importData = async (payload, mode = "merge") => {
  if (!payload || !Array.isArray(payload.catches) || !Array.isArray(payload.photos)) {
    throw new Error("Invalid backup file");
  }

  if (mode === "replace") {
    await resetDatabase();
  }

  const db = await getDB();
  const tx = db.transaction(["catches", "photos"], "readwrite");
  const catchStore = tx.objectStore("catches");
  const photoStore = tx.objectStore("photos");

  payload.catches.forEach((c) => {
    if (c.id && c.species && c.dateCaught && typeof c.lat === "number" && typeof c.lng === "number") {
      if (mode === "merge") {
        catchStore.get(c.id).onsuccess = (ev) => {
          if (!ev.target.result) catchStore.put(c);
        };
      } else {
        catchStore.put(c);
      }
    }
  });

  payload.photos.forEach((p) => {
    if (p.id && p.catchId && p.fullDataUrl) {
      if (mode === "merge") {
        photoStore.get(p.id).onsuccess = (ev) => {
          if (!ev.target.result) photoStore.put(p);
        };
      } else {
        photoStore.put(p);
      }
    }
  });

  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

  await recalcPBs();
};

export const resetDatabase = async () => {
  const db = await getDB();
  db.close();
  await new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
  dbPromise = null;
};
