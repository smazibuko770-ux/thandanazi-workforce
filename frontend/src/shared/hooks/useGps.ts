import { GpsPoint } from '../types/domain';

export const GPS_UNAVAILABLE: GpsPoint = { lat: 0, lng: 0, accuracy: 5000, unavailable: true, error: 'GPS unavailable' };

export function isGpsUnavailable(gps?: GpsPoint | null) {
  return !!gps?.unavailable || (gps?.lat === 0 && gps?.lng === 0);
}

export function getGps(): Promise<GpsPoint> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ ...GPS_UNAVAILABLE, error: 'Geolocation is not supported on this device.' });
      return;
    }

    let settled = false;
    const fallbackTimer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ...GPS_UNAVAILABLE, error: 'GPS request timed out.' });
    }, 9000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(fallbackTimer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
      },
      (err) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(fallbackTimer);
        resolve({ ...GPS_UNAVAILABLE, error: err.message || 'GPS permission denied or unavailable.' });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 }
    );
  });
}
