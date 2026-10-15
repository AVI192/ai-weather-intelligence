const OPENWEATHER_BASE_URL =
  'https://api.openweathermap.org/data/2.5';

const OPENWEATHER_GEO_URL =
  'https://api.openweathermap.org/geo/1.0';

const OPEN_METEO_URL =
  'https://api.open-meteo.com/v1/forecast';

const getApiKey = () => {
  const key = process.env.OPENWEATHER_API_KEY;

  if (!key || !key.trim()) {
    throw new Error('OPENWEATHER_API_KEY is not configured.');
  }

  return key.trim();
};

// Simple in-memory TTL cache (60 seconds) to avoid repeating identical queries and hitting rate limits
const cache = new Map();
const CACHE_TTL_MS = 60 * 1000;

const getCached = (key) => {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  return item.data;
};

const setCached = (key, data) => {
  if (cache.size > 200) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
};

// Safe fetch with 8s timeout and bounded single retry for 429 rate limit
const fetchWithRetry = async (url, options = {}, retriesLeft = 1) => {
  const signal = options.signal || AbortSignal.timeout(8000);
  try {
    const response = await fetch(url, { ...options, signal });

    if (response.status === 429 && retriesLeft > 0) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const waitMs = retryAfterHeader && Number.isFinite(Number(retryAfterHeader))
        ? Math.min(Math.max(Number(retryAfterHeader) * 1000, 500), 2000)
        : 800;
      await new Promise(resolve => setTimeout(resolve, waitMs));
      return fetchWithRetry(url, options, retriesLeft - 1);
    }

    return response;
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new Error('Weather API request timed out after 8 seconds.');
    }
    throw err;
  }
};

const handleResponse = async (response) => {
  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (response.ok) {
    return data;
  }

  if (response.status === 401) {
    throw new Error('OpenWeather API authentication failed. Verify your API credentials.');
  }

  if (response.status === 404) {
    throw new Error('Weather data was not found for the requested location.');
  }

  if (response.status === 429) {
    throw new Error('OpenWeather API rate limit reached (HTTP 429). Please wait a moment before trying again.');
  }

  throw new Error(
    data?.message ||
      `Weather provider request failed with status ${response.status}.`
  );
};

export const searchLocations = async (query) => {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return [];
  }

  const trimmedQuery = query.trim();
  const cacheKey = `geo:${trimmedQuery.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const apiKey = getApiKey();
  const url =
    `${OPENWEATHER_GEO_URL}/direct` +
    `?q=${encodeURIComponent(trimmedQuery)}` +
    `&limit=8` +
    `&appid=${apiKey}`;

  const response = await fetchWithRetry(url);
  const data = await handleResponse(response);

  if (!Array.isArray(data)) {
    return [];
  }

  const results = data.map((item) => ({
    name: item.name || '',
    state: item.state || '',
    country: item.country || '',
    lat: item.lat,
    lon: item.lon,
    displayName: [
      item.name,
      item.state,
      item.country
    ]
      .filter(Boolean)
      .join(', ')
  }));

  setCached(cacheKey, results);
  return results;
};

export const reverseGeocode = async (lat, lon) => {
  if (
    typeof lat !== 'number' ||
    typeof lon !== 'number' ||
    Number.isNaN(lat) ||
    Number.isNaN(lon)
  ) {
    throw new Error('Invalid coordinates.');
  }

  const cacheKey = `revgeo:${lat.toFixed(3)}:${lon.toFixed(3)}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const apiKey = getApiKey();
  const url =
    `${OPENWEATHER_GEO_URL}/reverse` +
    `?lat=${lat}` +
    `&lon=${lon}` +
    `&limit=1` +
    `&appid=${apiKey}`;

  const response = await fetchWithRetry(url);
  const data = await handleResponse(response);

  if (!Array.isArray(data) || data.length === 0) {
    const empty = { name: '', state: '', country: '' };
    setCached(cacheKey, empty);
    return empty;
  }

  const result = {
    name: data[0].name || '',
    state: data[0].state || '',
    country: data[0].country || ''
  };
  setCached(cacheKey, result);
  return result;
};

export const getCurrentWeather = async (lat, lon) => {
  if (
    typeof lat !== 'number' ||
    typeof lon !== 'number' ||
    Number.isNaN(lat) ||
    Number.isNaN(lon)
  ) {
    throw new Error('Invalid coordinates.');
  }

  const cacheKey = `current:${lat.toFixed(3)}:${lon.toFixed(3)}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const apiKey = getApiKey();
  const url =
    `${OPENWEATHER_BASE_URL}/weather` +
    `?lat=${lat}` +
    `&lon=${lon}` +
    `&units=metric` +
    `&appid=${apiKey}`;

  const response = await fetchWithRetry(url);
  const data = await handleResponse(response);

  setCached(cacheKey, data);
  return data;
};

export const getForecast = async (lat, lon) => {
  if (
    typeof lat !== 'number' ||
    typeof lon !== 'number' ||
    Number.isNaN(lat) ||
    Number.isNaN(lon)
  ) {
    throw new Error('Invalid coordinates.');
  }

  const cacheKey = `forecast:${lat.toFixed(3)}:${lon.toFixed(3)}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const apiKey = getApiKey();
  const url =
    `${OPENWEATHER_BASE_URL}/forecast` +
    `?lat=${lat}` +
    `&lon=${lon}` +
    `&units=metric` +
    `&appid=${apiKey}`;

  const response = await fetchWithRetry(url);
  const data = await handleResponse(response);

  setCached(cacheKey, data);
  return data;
};

export const getUVIndex = async (lat, lon) => {
  if (
    typeof lat !== 'number' ||
    typeof lon !== 'number' ||
    Number.isNaN(lat) ||
    Number.isNaN(lon)
  ) {
    throw new Error('Invalid coordinates.');
  }

  const cacheKey = `uv:${lat.toFixed(3)}:${lon.toFixed(3)}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const url =
    `${OPEN_METEO_URL}` +
    `?latitude=${lat}` +
    `&longitude=${lon}` +
    `&current=uv_index`;

  const response = await fetchWithRetry(url);
  const data = await handleResponse(response);

  const result = {
    uvIndex:
      typeof data?.current?.uv_index === 'number'
        ? Math.round(data.current.uv_index * 10) / 10
        : null
  };

  setCached(cacheKey, result);
  return result;
};