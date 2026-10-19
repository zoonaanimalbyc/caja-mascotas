import { API_URL } from './config';

/* ---------- CACHÉ EN MEMORIA ---------- */
const cache = {
  usuarios: { data: null, ts: 0 },
  admins:   { data: null, ts: 0 },
};
const CACHE_TTL = 30 * 60 * 1000;

function getCache(key) {
  const c = cache[key];
  if (c.data && (Date.now() - c.ts) < CACHE_TTL) return c.data;
  return null;
}

function setCache(key, data) {
  cache[key] = { data, ts: Date.now() };
}

function clearCache(key) {
  if (key) cache[key] = { data: null, ts: 0 };
  else Object.keys(cache).forEach(k => cache[k] = { data: null, ts: 0 });
}

/* ---------- FETCH ---------- */
async function call(action, payload = {}) {
  const isRead = action.startsWith('get') || action === 'ping';
  const cacheKey = action + JSON.stringify(payload);
  
  // Si es una consulta (get), intentamos leer de la memoria del navegador primero
  if (isRead) {
    const localCache = sessionStorage.getItem(cacheKey);
    if (localCache) {
      const { data, ts } = JSON.parse(localCache);
      // Si los datos tienen menos de 2 minutos de antigüedad, los usamos
      if (Date.now() - ts < 120000) {
        return data;
      }
    }
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...payload }),
  });

  const text = await res.text();
  let j;
  try {
    j = JSON.parse(text);
  } catch (e) {
    console.error('Respuesta no-JSON del backend:', text.slice(0, 300));
    throw new Error('El servidor no respondió correctamente.');
  }
  if (!j.ok) throw new Error(j.error || 'Error API');
  
  // Guardamos en la memoria del navegador si es una consulta
  if (isRead) {
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ data: j.data, ts: Date.now() }));
    } catch (e) {}
  } else {
    // Si es una acción (guardar, abrir, cerrar), limpiamos la memoria para que traiga datos frescos
    sessionStorage.clear();
  }
  
  return j.data;
}

export const api = {
  ping:                    ()           => call('ping'),
  login:                   (data)       => call('login', data),
  getHoy:                  (sede, fecha)=> call('getHoy', { sede, fecha }),
  guardarArqueo:           (data)       => call('guardarArqueo', data),
  guardarMovimiento:       (data)       => call('guardarMovimiento', data),
  getSaldoInicial:         (sede, fecha)=> call('getSaldoInicial', { sede, fecha }),
  cerrarDia:               (data)       => call('cerrarDia', data),
  getDashboard:            (sede)       => call('getDashboard', { sede }),
  validarAdmin:            (data)       => call('validarAdmin', data),
  registrarRevision:       (data)       => call('registrarRevision', data),
  getRevisiones:           (data)       => call('getRevisiones', data),
  abrirTurno:              (data)       => call('abrirTurno', data),
  cerrarTurno:             (data)       => call('cerrarTurno', data),
  getEstadoTurnos:         (data)       => call('getEstadoTurnos', data),
  getTurnosPendientes: (data) => call('getTurnosPendientes', data),

  getUsuarios: async () => {
    const cached = getCache('usuarios');
    if (cached) return cached;
    const data = await call('getUsuarios');
    setCache('usuarios', data);
    return data;
  },

  getAdmins: async () => {
    const cached = getCache('admins');
    if (cached) return cached;
    const data = await call('getAdmins');
    setCache('admins', data);
    return data;
  },

  revisarDescuadre:        (data)       => call('revisarDescuadre', data),
  getDescuadresPendientes: (data)       => call('getDescuadresPendientes', data),
  getHistorialRevisiones:  (data)       => call('getHistorialRevisiones', data),
  getEstadisticas:         (data)       => call('getEstadisticas', data),
  getHistorial:            (data)       => call('getHistorial', data),
  getDetalleTurno:         (data)       => call('getDetalleTurno', data),

  clearCache,
};