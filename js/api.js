async function fetchWeatherData(lat, lng) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m&daily=sunrise,sunset&timezone=auto`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Weather API fetch failed');
    return await response.json();
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return null;
  }
}

async function fetchMarineData(lat, lng) {
  const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&hourly=wave_height,wave_period,wave_direction&timezone=auto`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Marine API fetch failed');
    return await response.json();
  } catch (error) {
    console.error('Error fetching marine data:', error);
    return null;
  }
}

async function geocodeLocation(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Geocoding API fetch failed');
    const data = await response.json();
    return data.results && data.results.length > 0 ? data.results[0] : null;
  } catch (error) {
    console.error('Error fetching geocoding data:', error);
    return null;
  }
}

window.api = {
  fetchWeatherData,
  fetchMarineData,
  geocodeLocation
};
