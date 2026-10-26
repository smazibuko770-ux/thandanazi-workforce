import { GpsPoint } from '../types/domain';

export interface WeatherClockInWarning {
  level: 'none' | 'caution' | 'danger';
  title: string;
  message: string;
  details: string[];
  source: 'Open-Meteo';
}

const THUNDER_CODES = new Set([95, 96, 99]);
const HEAVY_RAIN_CODES = new Set([65, 66, 67, 80, 81, 82]);
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(() => reject(new Error('Weather check timed out')), ms);
    promise.then((value) => { window.clearTimeout(id); resolve(value); }, (error) => { window.clearTimeout(id); reject(error); });
  });
}

function nearestForecastIndex(times: string[]) {
  const now = Date.now();
  let best = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  times.forEach((time, index) => {
    const forecastTime = new Date(time).getTime();
    const delta = Math.abs(forecastTime - now);
    if (delta < bestDelta) {
      best = index;
      bestDelta = delta;
    }
  });
  return best;
}

export async function getClockInWeatherWarning(gps: GpsPoint): Promise<WeatherClockInWarning> {
  if (gps.unavailable || !Number.isFinite(gps.lat) || !Number.isFinite(gps.lng)) {
    return {
      level: 'none',
      title: 'Weather check unavailable',
      message: 'GPS is unavailable, so the app could not check local weather. You may continue if the site is safe.',
      details: ['GPS unavailable'],
      source: 'Open-Meteo'
    };
  }

  const params = new URLSearchParams({
    latitude: String(gps.lat),
    longitude: String(gps.lng),
    hourly: 'precipitation_probability,weather_code,wind_speed_10m,precipitation',
    forecast_days: '1',
    timezone: 'auto'
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;

  try {
    const response = await withTimeout(fetch(url), 9000);
    if (!response.ok) throw new Error(`Weather API error ${response.status}`);
    const data = await response.json();
    const times: string[] = data?.hourly?.time || [];
    if (!times.length) throw new Error('No weather forecast returned');

    const index = nearestForecastIndex(times);
    const rainProbability = Number(data.hourly.precipitation_probability?.[index] ?? 0);
    const code = Number(data.hourly.weather_code?.[index] ?? 0);
    const windSpeed = Number(data.hourly.wind_speed_10m?.[index] ?? 0);
    const precipitation = Number(data.hourly.precipitation?.[index] ?? 0);
    const details = [
      `Rain probability: ${rainProbability}%`,
      `Wind speed: ${Math.round(windSpeed)} km/h`,
      `Expected precipitation: ${precipitation} mm`,
      `Forecast time: ${times[index]}`
    ];

    const storm = THUNDER_CODES.has(code);
    const heavyRain = HEAVY_RAIN_CODES.has(code) || precipitation >= 2.5;
    const rainLikely = rainProbability >= 40 || precipitation >= 0.5 || RAIN_CODES.has(code);
    const strongWind = windSpeed >= 35;

    if (storm || heavyRain) {
      return {
        level: 'danger',
        title: 'Severe weather warning',
        message: 'Storms or heavy rain may affect safe machine operation. Do you want to continue clocking in?',
        details,
        source: 'Open-Meteo'
      };
    }

    if (rainLikely || strongWind) {
      return {
        level: 'caution',
        title: 'Weather warning',
        message: 'The weather looks like it may rain or become unsafe. Do you want to continue clocking in?',
        details,
        source: 'Open-Meteo'
      };
    }

    return {
      level: 'none',
      title: 'Weather clear',
      message: 'No rain or strong-wind warning was detected near your current location.',
      details,
      source: 'Open-Meteo'
    };
  } catch (error: any) {
    return {
      level: 'none',
      title: 'Weather check unavailable',
      message: 'The app could not reach the weather service. You may continue if the site is safe.',
      details: [error?.message || 'Unknown weather error'],
      source: 'Open-Meteo'
    };
  }
}
