import { getDateKey, sortByDateDesc, uuid } from "./utils.js";

const DB_NAME = "fish_catch_tracker";
const DB_VERSION = 2;
let dbPromise;
let postMigrationPromise;

const requestPromise = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const waitForTransaction = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

const createCatchStore = (db) => {
  const store = db.createObjectStore("catches", { keyPath: "id" });
  store.createIndex("species", "species");
  store.createIndex("dateCaught", "dateCaught");
  store.createIndex("isPBWeight", "isPBWeight");
  store.createIndex("isPBLength", "isPBLength");
  store.createIndex("tripId", "tripId");
  return store;
};

const createPhotoStore = (db) => {
  const store = db.createObjectStore("photos", { keyPath: "id" });
  store.createIndex("catchId", "catchId");
  return store;
};

const createTripStore = (db) => {
  const store = db.createObjectStore("trips", { keyPath: "id" });
  store.createIndex("dateKey", "dateKey");
  store.createIndex("startAt", "startAt");
  store.createIndex("rating", "rating");
  return store;
};

const openDatabase = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const tx = event.target.transaction;

      if (!db.objectStoreNames.contains("catches")) {
        createCatchStore(db);
      } else {
        const catches = tx.objectStore("catches");
        if (!catches.indexNames.contains("species")) catches.createIndex("species", "species");
        if (!catches.indexNames.contains("dateCaught")) catches.createIndex("dateCaught", "dateCaught");
        if (!catches.indexNames.contains("isPBWeight")) catches.createIndex("isPBWeight", "isPBWeight");
        if (!catches.indexNames.contains("isPBLength")) catches.createIndex("isPBLength", "isPBLength");
        if (!catches.indexNames.contains("tripId")) catches.createIndex("tripId", "tripId");
      }

      if (!db.objectStoreNames.contains("photos")) {
        createPhotoStore(db);
      } else {
        const photos = tx.objectStore("photos");
        if (!photos.indexNames.contains("catchId")) photos.createIndex("catchId", "catchId");
      }

      if (!db.objectStoreNames.contains("trips")) {
        createTripStore(db);
      } else {
        const trips = tx.objectStore("trips");
        if (!trips.indexNames.contains("dateKey")) trips.createIndex("dateKey", "dateKey");
        if (!trips.indexNames.contains("startAt")) trips.createIndex("startAt", "startAt");
        if (!trips.indexNames.contains("rating")) trips.createIndex("rating", "rating");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const getOpenDB = async () => {
  if (!dbPromise) dbPromise = openDatabase();
  return dbPromise;
};

const getAllFromStore = async (db, storeName) => {
  const tx = db.transaction([storeName], "readonly");
  return requestPromise(tx.objectStore(storeName).getAll());
};

const getAllKeysFromStore = async (db, storeName) => {
  const tx = db.transaction([storeName], "readonly");
  return requestPromise(tx.objectStore(storeName).getAllKeys());
};

const buildLegacyFingerprint = (record) => {
  const dateKey = record.dateKey || getDateKey(record.startAt || record.dateCaught);
  const location = (record.locationName || "").trim().toLowerCase();
  const lat = Number.isFinite(Number(record.lat)) ? Number(record.lat).toFixed(4) : "na";
  const lng = Number.isFinite(Number(record.lng)) ? Number(record.lng).toFixed(4) : "na";
  return `${dateKey}|${location}|${lat}|${lng}`;
};

const ensureLegacyTrips = async (db) => {
  const [catches, trips] = await Promise.all([getAllFromStore(db, "catches"), getAllFromStore(db, "trips")]);
  const unlinked = catches.filter((record) => !record.tripId);
  if (!unlinked.length) return;

  const tripByFingerprint = trips.reduce((map, trip) => {
    map.set(buildLegacyFingerprint(trip), trip);
    return map;
  }, new Map());

  const tx = db.transaction(["catches", "trips"], "readwrite");
  const catchStore = tx.objectStore("catches");
  const tripStore = tx.objectStore("trips");

  unlinked.forEach((record) => {
    if (!record.dateCaught || !record.locationName) return;
    const fingerprint = buildLegacyFingerprint(record);
    let trip = tripByFingerprint.get(fingerprint);
    if (!trip) {
      const now = new Date().toISOString();
      trip = {
        id: uuid(),
        title: record.locationName,
        dateKey: getDateKey(record.dateCaught),
        startAt: record.dateCaught,
        endAt: record.dateCaught,
        locationName: record.locationName,
        lat: Number(record.lat),
        lng: Number(record.lng),
        rating: null,
        notes: "",
        conditionsNotes: "",
        weather: null,
        createdAt: record.createdAt || now,
        updatedAt: now,
        inferredFromLegacy: true,
      };
      tripStore.put(trip);
      tripByFingerprint.set(fingerprint, trip);
    }
    catchStore.put({ ...record, tripId: trip.id });
  });

  await waitForTransaction(tx);
};

const ensureReady = async () => {
  const db = await getOpenDB();
  if (!postMigrationPromise) {
    postMigrationPromise = ensureLegacyTrips(db).catch((error) => {
      console.error("Legacy trip migration failed", error);
    });
  }
  await postMigrationPromise;
  return db;
};

const normalizeTrip = (data = {}, existing = {}) => {
  const now = new Date().toISOString();
  const startAt = data.startAt || existing.startAt || now;
  const endAt = data.endAt || existing.endAt || startAt;
  const rating =
    data.rating !== undefined
      ? data.rating === null || data.rating === "" || Number(data.rating) <= 0
        ? null
        : Number(data.rating)
      : existing.rating ?? null;
  return {
    ...existing,
    ...data,
    id: existing.id || data.id || uuid(),
    title: data.title ?? existing.title ?? data.locationName ?? existing.locationName ?? "Fishing trip",
    startAt,
    endAt,
    dateKey: data.dateKey || existing.dateKey || getDateKey(startAt),
    locationName: data.locationName ?? existing.locationName ?? "",
    lat: Number(data.lat ?? existing.lat),
    lng: Number(data.lng ?? existing.lng),
    rating,
    notes: data.notes ?? existing.notes ?? "",
    conditionsNotes: data.conditionsNotes ?? existing.conditionsNotes ?? "",
    weather: data.weather ?? existing.weather ?? null,
    timezone: data.timezone ?? existing.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    inferredFromLegacy: data.inferredFromLegacy ?? existing.inferredFromLegacy ?? false,
    createdAt: existing.createdAt || data.createdAt || now,
    updatedAt: now,
  };
};

const normalizeCatch = (data = {}, existing = {}) => {
  const now = new Date().toISOString();
  return {
    ...existing,
    ...data,
    id: existing.id || data.id || uuid(),
    tripId: data.tripId ?? existing.tripId ?? null,
    createdAt: existing.createdAt || data.createdAt || now,
    updatedAt: now,
    isPBWeight: existing.isPBWeight || false,
    isPBLength: existing.isPBLength || false,
  };
};

export const getAllCatches = async () => {
  const db = await ensureReady();
  const catches = await getAllFromStore(db, "catches");
  return sortByDateDesc(catches, "dateCaught");
};

export const getCatch = async (id) => {
  const db = await ensureReady();
  const tx = db.transaction(["catches"], "readonly");
  return requestPromise(tx.objectStore("catches").get(id));
};

export const getAllTrips = async () => {
  const db = await ensureReady();
  const trips = await getAllFromStore(db, "trips");
  return sortByDateDesc(trips, "startAt");
};

export const getTrip = async (id) => {
  const db = await ensureReady();
  const tx = db.transaction(["trips"], "readonly");
  return requestPromise(tx.objectStore("trips").get(id));
};

export const getCatchesByTrip = async (tripId) => {
  const db = await ensureReady();
  const tx = db.transaction(["catches"], "readonly");
  return requestPromise(tx.objectStore("catches").index("tripId").getAll(IDBKeyRange.only(tripId)));
};

export const getPhotosByCatch = async (catchId) => {
  const db = await ensureReady();
  const tx = db.transaction(["photos"], "readonly");
  return requestPromise(tx.objectStore("photos").index("catchId").getAll(IDBKeyRange.only(catchId)));
};

export const getAllPhotos = async () => {
  const db = await ensureReady();
  return getAllFromStore(db, "photos");
};

export const addPhotos = async (catchId, photos) => {
  if (!photos?.length) return;
  const db = await ensureReady();
  const tx = db.transaction(["photos"], "readwrite");
  const store = tx.objectStore("photos");
  photos.forEach((photo) => store.put({ ...photo, catchId }));
  await waitForTransaction(tx);
};

export const deletePhotosForCatch = async (catchId) => {
  const photos = await getPhotosByCatch(catchId);
  if (!photos.length) return;
  const db = await ensureReady();
  const tx = db.transaction(["photos"], "readwrite");
  const store = tx.objectStore("photos");
  photos.forEach((photo) => store.delete(photo.id));
  await waitForTransaction(tx);
};

export const deletePhoto = async (id) => {
  const db = await ensureReady();
  const tx = db.transaction(["photos"], "readwrite");
  tx.objectStore("photos").delete(id);
  await waitForTransaction(tx);
};

export const saveTrip = async (data) => {
  const existing = data.id ? await getTrip(data.id) : null;
  const record = normalizeTrip(data, existing || {});
  const db = await ensureReady();
  const tx = db.transaction(["trips"], "readwrite");
  tx.objectStore("trips").put(record);
  await waitForTransaction(tx);
  return record.id;
};

export const deleteTrip = async (id) => {
  const db = await ensureReady();
  const catches = await getCatchesByTrip(id);
  const tx = db.transaction(["trips", "catches"], "readwrite");
  tx.objectStore("trips").delete(id);
  const catchStore = tx.objectStore("catches");
  catches.forEach((record) => catchStore.put({ ...record, tripId: null, updatedAt: new Date().toISOString() }));
  await waitForTransaction(tx);
};

export const saveCatch = async (data) => {
  const existing = data.id ? await getCatch(data.id) : null;
  const record = normalizeCatch(data, existing || {});
  const db = await ensureReady();
  const tx = db.transaction(["catches"], "readwrite");
  tx.objectStore("catches").put(record);
  await waitForTransaction(tx);
  await recalcPBs();
  return record.id;
};

export const deleteCatch = async (id) => {
  await deletePhotosForCatch(id);
  const db = await ensureReady();
  const tx = db.transaction(["catches"], "readwrite");
  tx.objectStore("catches").delete(id);
  await waitForTransaction(tx);
  await recalcPBs();
};

export const recalcPBs = async () => {
  const catches = await getAllCatches();
  const bySpecies = catches.reduce((acc, record) => {
    const key = (record.species || "").trim().toLowerCase();
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(record);
    return acc;
  }, {});

  const chooseWinner = (records, field) =>
    records
      .filter((record) => Number.isFinite(Number(record[field])))
      .sort((a, b) => {
        if (Number(b[field]) === Number(a[field])) {
          return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
        }
        return Number(b[field]) - Number(a[field]);
      })[0] || null;

  const winners = new Map();
  Object.values(bySpecies).forEach((records) => {
    const weightWinner = chooseWinner(records, "weight");
    const lengthWinner = chooseWinner(records, "length");
    if (weightWinner) winners.set(weightWinner.id, { ...(winners.get(weightWinner.id) || {}), weight: true });
    if (lengthWinner) winners.set(lengthWinner.id, { ...(winners.get(lengthWinner.id) || {}), length: true });
  });

  const db = await ensureReady();
  const tx = db.transaction(["catches"], "readwrite");
  const store = tx.objectStore("catches");
  catches.forEach((record) => {
    const winner = winners.get(record.id) || {};
    const isPBWeight = Boolean(winner.weight);
    const isPBLength = Boolean(winner.length);
    if (record.isPBWeight !== isPBWeight || record.isPBLength !== isPBLength) {
      store.put({ ...record, isPBWeight, isPBLength });
    }
  });
  await waitForTransaction(tx);
};

export const exportData = async () => {
  const [trips, catches, photos] = await Promise.all([getAllTrips(), getAllCatches(), getAllPhotos()]);
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    trips,
    catches,
    photos,
  };
};

const hasRecordId = (record) => Boolean(record?.id);

export const importData = async (payload, mode = "merge") => {
  if (
    !payload ||
    !Array.isArray(payload.catches) ||
    !Array.isArray(payload.photos) ||
    !Array.isArray(payload.trips || [])
  ) {
    throw new Error("Invalid backup file");
  }

  if (mode === "replace") {
    await resetDatabase();
  }

  const db = await ensureReady();
  const [existingTripIds, existingCatchIds, existingPhotoIds] =
    mode === "merge"
      ? await Promise.all([
          getAllKeysFromStore(db, "trips").then((ids) => new Set(ids)),
          getAllKeysFromStore(db, "catches").then((ids) => new Set(ids)),
          getAllKeysFromStore(db, "photos").then((ids) => new Set(ids)),
        ])
      : [new Set(), new Set(), new Set()];

  const tx = db.transaction(["trips", "catches", "photos"], "readwrite");
  const tripStore = tx.objectStore("trips");
  const catchStore = tx.objectStore("catches");
  const photoStore = tx.objectStore("photos");

  (payload.trips || []).forEach((trip) => {
    if (!hasRecordId(trip) || (mode === "merge" && existingTripIds.has(trip.id))) return;
    tripStore.put(normalizeTrip(trip));
  });

  payload.catches.forEach((record) => {
    if (
      !hasRecordId(record) ||
      !record.species ||
      !record.dateCaught ||
      !Number.isFinite(Number(record.lat)) ||
      !Number.isFinite(Number(record.lng)) ||
      (mode === "merge" && existingCatchIds.has(record.id))
    ) {
      return;
    }
    catchStore.put(normalizeCatch(record));
  });

  payload.photos.forEach((photo) => {
    if (!hasRecordId(photo) || !photo.catchId || !photo.fullDataUrl || (mode === "merge" && existingPhotoIds.has(photo.id))) {
      return;
    }
    photoStore.put(photo);
  });

  await waitForTransaction(tx);
  await recalcPBs();
};

export const resetDatabase = async () => {
  const db = await getOpenDB();
  db.close();
  await new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
  dbPromise = null;
  postMigrationPromise = null;
};
