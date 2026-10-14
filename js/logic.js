function calculateSafetyScore(waveHeight, wavePeriod, windSpeed, precipProb) {
  let pWaveCombined = 0;
  let pWind = 0;
  let pRain = 0;

  // 1. Combined Wave Penalty
  let pWaveBase = 0;
  if (waveHeight <= 0.6) {
    pWaveBase = 0;
  } else if (waveHeight <= 1.0) {
    pWaveBase = 15;
  } else if (waveHeight <= 1.4) {
    pWaveBase = 35;
  } else {
    pWaveBase = 50;
  }

  if (waveHeight > 0.6) {
    if (wavePeriod < 6) {
      pWaveCombined = pWaveBase * 1.5;
    } else if (wavePeriod <= 10) {
      pWaveCombined = pWaveBase * 1.0;
    } else {
      pWaveCombined = pWaveBase * 0.5;
    }
  } else {
    pWaveCombined = pWaveBase;
  }

  // 2. Wind Penalty
  if (windSpeed <= 12) {
    pWind = 0;
  } else if (windSpeed <= 16) {
    pWind = 15;
  } else if (windSpeed <= 22) {
    pWind = 30;
  } else {
    pWind = 45;
  }

  // 3. Rain Penalty
  if (precipProb <= 35) {
    pRain = 0;
  } else if (precipProb <= 60) {
    pRain = 10;
  } else {
    pRain = 20;
  }

  const score = Math.max(0, 100 - pWaveCombined - pWind - pRain);

  let category = '';
  let colorClass = '';
  if (score >= 80) {
    category = 'Green - Favorable / Calm Conditions';
    colorClass = 'score-green';
  } else if (score >= 60) {
    category = 'Amber - Moderate Conditions';
    colorClass = 'score-amber';
  } else {
    category = 'Red - Challenging Conditions';
    colorClass = 'score-red';
  }

  return {
    score: Math.round(score),
    category,
    colorClass
  };
}

const MAX_LOCATIONS = 10;

function saveForecastToStorage(lat, lng, weatherData, marineData) {
  const locKey = `loc_${lat.toFixed(4)}_${lng.toFixed(4)}`;
  const timestamp = Date.now();

  const payload = {
    lat,
    lng,
    weatherData,
    marineData,
    timestamp
  };

  // LRU logic
  let storedLocationsStr = localStorage.getItem('scuba_locations');
  let storedLocations = storedLocationsStr ? JSON.parse(storedLocationsStr) : [];

  // Remove existing entry if it exists
  storedLocations = storedLocations.filter(loc => loc.key !== locKey);

  // Add to front (most recently used)
  storedLocations.unshift({ key: locKey, timestamp });

  // Truncate to MAX_LOCATIONS
  if (storedLocations.length > MAX_LOCATIONS) {
    const evicted = storedLocations.pop();
    localStorage.removeItem(evicted.key);
  }

  localStorage.setItem('scuba_locations', JSON.stringify(storedLocations));
  localStorage.setItem(locKey, JSON.stringify(payload));
}

function getForecastFromStorage(lat, lng) {
  const locKey = `loc_${lat.toFixed(4)}_${lng.toFixed(4)}`;
  const storedStr = localStorage.getItem(locKey);

  if (!storedStr) return null;

  const data = JSON.parse(storedStr);
  const now = Date.now();
  const diffHours = (now - data.timestamp) / (1000 * 60 * 60);

  if (diffHours > 48) {
    // Stale data expiration > 48 hours: Nullify the forecast array.
    localStorage.removeItem(locKey);
    return { data: null, stale: true, blocked: true };
  } else if (diffHours > 12) {
    // Stale data expiration > 12 hours: Render a visible warning.
    return { data, stale: true, blocked: false };
  }

  return { data, stale: false, blocked: false };
}

window.logic = {
  calculateSafetyScore,
  saveForecastToStorage,
  getForecastFromStorage
};
