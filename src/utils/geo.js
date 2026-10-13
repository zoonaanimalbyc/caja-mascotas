import { SEDES, RADIO_SEDE_METROS } from '../config';

export function distanciaMetros(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = x => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function detectarSede() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ ok: false, motivo: 'sin_soporte' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        let mejor = null;
        let mejorDist = Infinity;
        SEDES.forEach(s => {
          const d = distanciaMetros(latitude, longitude, s.lat, s.lng);
          if (d < mejorDist) { mejorDist = d; mejor = s; }
        });
        if (mejor && mejorDist <= RADIO_SEDE_METROS) {
          resolve({ ok: true, sede: mejor.nombre, distancia: Math.round(mejorDist), accuracy: Math.round(accuracy) });
        } else {
          resolve({
            ok: false,
            motivo: 'lejos',
            sedeMasCercana: mejor?.nombre,
            distancia: Math.round(mejorDist),
          });
        }
      },
      (err) => {
        resolve({ ok: false, motivo: err.code === 1 ? 'permiso_denegado' : 'error' });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}