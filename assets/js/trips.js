import { deleteTrip, getAllCatches, getAllTrips } from "./db.js";
import {
  escapeHtml,
  excerpt,
  formatDateKey,
  formatDuration,
  formatRating,
  formatTimeRange,
  getDateKey,
} from "./utils.js";
import { confirmAction, renderEmpty, showToast } from "./ui.js";

const monthLabel = document.getElementById("month-label");
const calendarGrid = document.getElementById("calendar-grid");
const tripList = document.getElementById("trip-list");
const searchInput = document.getElementById("trip-search");
const activeLabel = document.getElementById("active-label");

let trips = [];
let catchCounts = new Map();
let visibleMonth = new Date();
visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
let selectedDateKey = "";

const setText = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
};

const focusFromQuery = new URLSearchParams(location.search).get("focus");

const monthName = (date) =>
  date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

const isTripVisible = (trip, term) => {
  const matchesDay = selectedDateKey ? trip.dateKey === selectedDateKey : trip.dateKey?.startsWith(monthKey(visibleMonth));
  if (!matchesDay) return false;
  if (!term) return true;
  const haystack = `${trip.locationName || ""} ${trip.notes || ""} ${trip.conditionsNotes || ""}`.toLowerCase();
  return haystack.includes(term);
};

const monthKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const renderStats = () => {
  const hours = trips.reduce((sum, trip) => {
    const diff = new Date(trip.endAt || trip.startAt) - new Date(trip.startAt);
    return diff > 0 ? sum + diff / 3600000 : sum;
  }, 0);
  const ratedTrips = trips.filter((trip) => Number.isFinite(Number(trip.rating)) && Number(trip.rating) > 0);
  const uniqueSpots = new Set(trips.map((trip) => (trip.locationName || "").trim()).filter(Boolean));

  setText("trip-stat-total", trips.length);
  setText("trip-stat-hours", hours ? hours.toFixed(hours >= 10 ? 0 : 1) : "0");
  setText(
    "trip-stat-rating",
    ratedTrips.length
      ? `${(ratedTrips.reduce((sum, trip) => sum + Number(trip.rating), 0) / ratedTrips.length).toFixed(1)}/5`
      : "Not rated"
  );
  setText("trip-stat-spots", uniqueSpots.size);
};

const renderCalendar = () => {
  monthLabel.textContent = monthName(visibleMonth);
  const tripCountsByDay = trips.reduce((map, trip) => {
    if (!trip.dateKey) return map;
    map.set(trip.dateKey, (map.get(trip.dateKey) || 0) + 1);
    return map;
  }, new Map());

  const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const lastDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0);
  const leadingBlanks = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    .map((label) => `<div class="calendar-weekday">${label}</div>`)
    .join("");

  const cells = [];
  for (let i = 0; i < leadingBlanks; i += 1) {
    cells.push('<div class="calendar-blank"></div>');
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
    const dateKey = getDateKey(date);
    const count = tripCountsByDay.get(dateKey) || 0;
    const isSelected = selectedDateKey === dateKey;
    cells.push(`
      <button class="calendar-day${count ? " has-events" : ""}${isSelected ? " selected" : ""}" data-date="${dateKey}" type="button">
        <span>${day}</span>
        ${count ? `<strong>${count}</strong>` : '<strong class="ghost">0</strong>'}
      </button>
    `);
  }

  calendarGrid.innerHTML = weekdayLabels + cells.join("");
};

const renderTripList = () => {
  const term = searchInput.value.trim().toLowerCase();
  const visibleTrips = trips.filter((trip) => isTripVisible(trip, term));

  activeLabel.textContent = selectedDateKey
    ? `Showing trips for ${formatDateKey(selectedDateKey)}`
    : `Showing ${monthName(visibleMonth)}`;

  if (!visibleTrips.length) {
    renderEmpty(
      tripList,
      selectedDateKey
        ? "No trips match this day. Pick another date or clear the selection."
        : "No trips in this month yet. Log one to start building your calendar."
    );
    return;
  }

  tripList.innerHTML = visibleTrips
    .map((trip) => {
      const catchCount = catchCounts.get(trip.id) || 0;
      return `
        <article class="trip-card${trip.id === focusFromQuery ? " focused" : ""}">
          <div class="trip-card-header">
            <div>
              <div class="chip-row">
                <span class="badge soft">${escapeHtml(formatRating(trip.rating))}</span>
                <span class="badge">${escapeHtml(catchCount ? `${catchCount} catches` : "No catches yet")}</span>
              </div>
              <h3>${escapeHtml(trip.locationName || trip.title || "Fishing trip")}</h3>
              <p class="muted">${escapeHtml(formatTimeRange(trip.startAt, trip.endAt))}</p>
            </div>
            <div class="trip-card-actions">
              <a class="btn secondary" href="./trip-form.html?id=${trip.id}">Edit</a>
              <a class="btn" href="./catch-form.html?tripId=${trip.id}">Add catch</a>
            </div>
          </div>
          <div class="detail-list compact">
            <div><span>Duration</span><strong>${escapeHtml(formatDuration(trip.startAt, trip.endAt))}</strong></div>
            <div><span>Weather</span><strong>${escapeHtml(trip.weather?.summary || "Not captured yet")}</strong></div>
          </div>
          ${
            trip.conditionsNotes
              ? `<p>${escapeHtml(excerpt(trip.conditionsNotes, 180))}</p>`
              : `<p class="muted">No manual condition notes saved for this trip.</p>`
          }
          ${
            trip.notes
              ? `<p class="muted">${escapeHtml(excerpt(trip.notes, 180))}</p>`
              : ""
          }
          <div class="btn-row">
            <button class="btn ghost danger-text" data-delete-trip="${trip.id}" type="button">Delete trip</button>
          </div>
        </article>
      `;
    })
    .join("");
};

const load = async () => {
  try {
    const [tripRecords, catches] = await Promise.all([getAllTrips(), getAllCatches()]);
    trips = tripRecords;
    catchCounts = catches.reduce((map, record) => {
      if (!record.tripId) return map;
      map.set(record.tripId, (map.get(record.tripId) || 0) + 1);
      return map;
    }, new Map());

    renderStats();
    renderCalendar();
    renderTripList();
  } catch (error) {
    console.error(error);
    showToast("Failed to load the fishing log.", "error");
  }
};

document.getElementById("month-prev")?.addEventListener("click", () => {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
  selectedDateKey = "";
  renderCalendar();
  renderTripList();
});

document.getElementById("month-next")?.addEventListener("click", () => {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  selectedDateKey = "";
  renderCalendar();
  renderTripList();
});

document.getElementById("month-reset")?.addEventListener("click", () => {
  visibleMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  selectedDateKey = "";
  renderCalendar();
  renderTripList();
});

document.getElementById("clear-day-filter")?.addEventListener("click", () => {
  selectedDateKey = "";
  renderCalendar();
  renderTripList();
});

calendarGrid?.addEventListener("click", (event) => {
  const target = event.target.closest("[data-date]");
  if (!target) return;
  selectedDateKey = target.dataset.date === selectedDateKey ? "" : target.dataset.date;
  renderCalendar();
  renderTripList();
});

searchInput?.addEventListener("input", renderTripList);

tripList?.addEventListener("click", async (event) => {
  const tripId = event.target.closest("[data-delete-trip]")?.dataset.deleteTrip;
  if (!tripId) return;
  if (!confirmAction("Delete this trip? Linked catches will stay saved but no longer point to it.")) return;
  try {
    await deleteTrip(tripId);
    trips = trips.filter((trip) => trip.id !== tripId);
    catchCounts.delete(tripId);
    renderStats();
    renderCalendar();
    renderTripList();
    showToast("Trip deleted.", "success");
  } catch (error) {
    console.error(error);
    showToast("Failed to delete the trip.", "error");
  }
});

load();
