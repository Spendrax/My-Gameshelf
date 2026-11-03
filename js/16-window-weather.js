'use strict';
// THE WINDOW VIEW — what you see outside: a scene (city, mountains, beach, forest, space), a time of day
// (dawn, day, sunset, night) and the weather (clear, cloudy, rain, snow, storm).
// "Live" follows real life: the time of day from your clock and today's sunrise/sunset, and the weather and
// temperature where you are, from Open-Meteo (free, no key). The page shows it through body[data-scene],
// [data-time] and [data-weather] (css/room.css). The choices are made in Customize (09-customize.js).

let live = load('gr.weather', null); // last real weather: { temp, weather, sunrise, sunset, at, lat }

// Open-Meteo's weather codes → our five kinds of weather
function weatherKind(code) {
  if (code <= 1) return 'clear';
  if (code <= 3 || code === 45 || code === 48) return 'cloudy'; // 45/48 = fog
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  return 'rain'; // drizzle, rain, showers
}

// Minutes since midnight, from a Date or from "2026-11-03T06:41"
const minutes = (t) =>
  typeof t === 'string' ? +t.slice(11, 13) * 60 + +t.slice(14, 16) : t.getHours() * 60 + t.getMinutes();

// Dawn and sunset last 45 minutes on each side of sunrise and sunset (6:30 and 18:00 if we don't know them)
function timeOfDay() {
  const now = minutes(new Date());
  const rise = live?.sunrise ? minutes(live.sunrise) : 390;
  const down = live?.sunset ? minutes(live.sunset) : 1080;
  if (Math.abs(now - rise) <= 45) return 'dawn';
  if (Math.abs(now - down) <= 45) return 'sunset';
  return now > rise && now < down ? 'day' : 'night';
}

function applyWindow() {
  const l = set.look;
  const isLive = l.sky === 'live';
  Object.assign(document.body.dataset, {
    scene: l.scene,
    time: isLive ? timeOfDay() : l.time,
    weather: isLive ? live?.weather || 'clear' : l.weather,
  });
  $('.window .temp').textContent = isLive && live && l.loc ? `${Math.round(live.temp)}°` : '';
}

// Real weather, at most every 30 minutes
async function fetchWeather(force) {
  const loc = set.look.loc;
  if (set.look.sky !== 'live' || !loc) return;
  if (!force && live && live.lat === loc.lat && Date.now() - live.at < 30 * 60e3) return;
  try {
    const d = await (
      await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,weather_code&daily=sunrise,sunset&timezone=auto&forecast_days=1`,
      )
    ).json();
    live = {
      temp: d.current.temperature_2m,
      weather: weatherKind(d.current.weather_code),
      sunrise: d.daily.sunrise[0],
      sunset: d.daily.sunset[0],
      at: Date.now(),
      lat: loc.lat,
    };
    store('gr.weather', live);
  } catch {
    return; // offline: keep the last known weather
  }
  applyWindow();
  if ($('#dlgLook').open) drawLook(); // update "Now: …" in Customize
}

/* ---------- Your location (for Live) ---------- */

function setLocation(lat, lon, name) {
  set.look.loc = { lat: +lat.toFixed(2), lon: +lon.toFixed(2), name }; // rounded: no need for an exact spot
  saveSet();
  fetchWeather(true);
  drawLook();
}

// The extra lines shown in Customize under "Time & weather"
function windowControls() {
  const l = set.look;
  if (l.sky !== 'live') {
    return `<label>Time of day</label>${chips('time', OPTS.time, l.time)}
      <label>Weather</label>${chips('weather', OPTS.weather, l.weather)}`;
  }
  const now = l.loc && live ? `Now in ${esc(l.loc.name)}: ${Math.round(live.temp)}°C, ${live.weather}` : '';
  return `<p class="dim small">${now || 'Add where you are to get your real weather. Without it, only the time of day follows the clock.'}</p>
    <div class="row"><button class="btn" id="cLocate">\u{1F4CD} Use my location</button>
      <input id="cCity" placeholder="or type a city" enterkeyhint="search" style="flex:1;min-width:120px"></div>
    <p class="dim small">Weather data by <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo.com</a></p>`;
}

$('#cBody').addEventListener('click', (e) => {
  if (e.target.id !== 'cLocate') return;
  if (!navigator.geolocation) return toast('Your browser can’t share your location. Type your city.');
  toast('Finding you…');
  navigator.geolocation.getCurrentPosition(
    (p) => setLocation(p.coords.latitude, p.coords.longitude, 'your area'),
    () => toast('Location not allowed. Type your city instead.'),
    { timeout: 10000, maximumAge: 3600e3 },
  );
});
$('#cBody').addEventListener('change', async (e) => {
  if (e.target.id !== 'cCity' || !e.target.value.trim()) return;
  try {
    const d = await (
      await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(e.target.value.trim())}`,
      )
    ).json();
    const c = d.results?.[0];
    if (!c) return toast('City not found. Check the spelling.');
    setLocation(c.latitude, c.longitude, c.name);
  } catch {
    toast('No connection. Try again later.');
  }
});

on('look', applyWindow);
on('look', () => fetchWeather());
setInterval(() => {
  applyWindow();
  fetchWeather();
}, 5 * 60e3);
document.addEventListener('visibilitychange', () => document.hidden || (applyWindow(), fetchWeather()));
applyWindow();
fetchWeather();
