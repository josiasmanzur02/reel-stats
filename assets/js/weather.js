import { formatDateTime, formatTimeRange, getDateKey } from "./utils.js";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";

const WEATHER_LABELS = {
  0: "Clear sky",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Freezing fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Heavy showers",
  82: "Violent showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Strong thunderstorm with hail",
};

const toNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);
const cToF = (value) => (value == null ? null : (value * 9) / 5 + 32);
const kmhToMph = (value) => (value == null ? null : value * 0.621371);
const mmToIn = (value) => (value == null ? null : value / 25.4);

const findClosestIndex = (times = [], targetIso) => {
  if (!times.length) return -1;
  if (!targetIso) return 0;
  const targetMs = new Date(targetIso).getTime();
  let closestIndex = 0;
  let closestDiff = Math.abs(new Date(times[0]).getTime() - targetMs);
  times.forEach((time, index) => {
    const diff = Math.abs(new Date(time).getTime() - targetMs);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestIndex = index;
    }
  });
  return closestIndex;
};

export const createWeatherFallback = (summary = "Weather unavailable right now.") => ({
  status: "unavailable",
  summary,
  fetchedAt: new Date().toISOString(),
  source: "open-meteo",
});

export const weatherLabelFromCode = (code) => WEATHER_LABELS[code] || "Conditions unavailable";

export const fetchWeatherSnapshot = async ({ lat, lng, startAt, endAt, dateKey }) => {
  const latitude = toNumber(lat);
  const longitude = toNumber(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !startAt) {
    return createWeatherFallback("Add a location and time range to fetch weather.");
  }

  const startDate = dateKey || getDateKey(startAt);
  const endDate = endAt ? getDateKey(endAt) : startDate;
  const todayKey = getDateKey(new Date());
  const baseUrl = startDate < todayKey ? ARCHIVE_URL : FORECAST_URL;
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "auto",
    start_date: startDate,
    end_date: endDate,
    hourly: "temperature_2m,weather_code,precipitation,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
  });

  try {
    const response = await fetch(`${baseUrl}?${params.toString()}`);
    if (!response.ok) throw new Error(`Weather request failed with ${response.status}`);
    const payload = await response.json();
    const hourlyTimes = payload.hourly?.time || [];
    const closestIndex = findClosestIndex(hourlyTimes, startAt);
    const weatherCode =
      payload.hourly?.weather_code?.[closestIndex] ??
      payload.daily?.weather_code?.[0] ??
      null;
    const temperatureF = cToF(toNumber(payload.hourly?.temperature_2m?.[closestIndex]));
    const precipitationIn =
      mmToIn(toNumber(payload.hourly?.precipitation?.[closestIndex])) ??
      mmToIn(toNumber(payload.daily?.precipitation_sum?.[0]));
    const windMph =
      kmhToMph(toNumber(payload.hourly?.wind_speed_10m?.[closestIndex])) ??
      kmhToMph(toNumber(payload.daily?.wind_speed_10m_max?.[0]));
    const highF = cToF(toNumber(payload.daily?.temperature_2m_max?.[0]));
    const lowF = cToF(toNumber(payload.daily?.temperature_2m_min?.[0]));
    const label = weatherLabelFromCode(weatherCode);

    const parts = [
      label,
      Number.isFinite(temperatureF) ? `${Math.round(temperatureF)} F` : "",
      Number.isFinite(windMph) ? `${Math.round(windMph)} mph wind` : "",
      Number.isFinite(precipitationIn) && precipitationIn > 0 ? `${precipitationIn.toFixed(2)} in precip.` : "",
    ].filter(Boolean);

    return {
      status: "ready",
      source: "open-meteo",
      fetchedAt: new Date().toISOString(),
      observedAt: hourlyTimes[closestIndex] || startAt,
      timeRange: formatTimeRange(startAt, endAt),
      weatherCode,
      label,
      summary: parts.join(" | "),
      temperatureF,
      windMph,
      precipitationIn,
      highF,
      lowF,
    };
  } catch (error) {
    console.error(error);
    return createWeatherFallback(
      navigator.onLine ? "Weather could not be refreshed." : "Weather is unavailable while offline."
    );
  }
};

export const formatWeatherSummary = (weather) => {
  if (!weather) return "Weather not captured yet.";
  if (weather.status !== "ready") return weather.summary || "Weather unavailable.";
  const details = [
    weather.summary,
    weather.observedAt ? `Snapshot ${formatDateTime(weather.observedAt)}` : "",
    weather.timeRange ? `Window ${weather.timeRange}` : "",
  ].filter(Boolean);
  return details.join(" | ");
};
