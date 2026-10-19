// src/utils/fechas.js
// Utilidades de fecha en horario LOCAL (America/Bogota).
// Evita el bug de toISOString() que devuelve UTC y hace saltar el día a las 19:00.

/**
 * Devuelve la fecha en formato 'YYYY-MM-DD' usando la hora LOCAL del dispositivo.
 * @param {Date} d - Fecha a formatear (por defecto: ahora)
 * @returns {string} Ejemplo: '2026-10-16'
 */
export function fechaLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

/**
 * Devuelve la fecha de HOY en formato 'YYYY-MM-DD' (hora local).
 * @returns {string}
 */
export function hoyLocal() {
  return fechaLocal(new Date());
}

/**
 * Devuelve la hora actual en formato 'HH:MM' (hora local).
 * @param {Date} d - Fecha (por defecto: ahora)
 * @returns {string} Ejemplo: '19:05'
 */
export function horaLocal(d = new Date()) {
  return d.toTimeString().slice(0, 5);
}

/**
 * Primer día del mes actual en formato 'YYYY-MM-DD' (hora local).
 * @param {Date} d - Fecha de referencia (por defecto: ahora)
 * @returns {string}
 */
export function primerDiaMesLocal(d = new Date()) {
  return fechaLocal(new Date(d.getFullYear(), d.getMonth(), 1));
}

/**
 * Primer día del mes anterior en formato 'YYYY-MM-DD' (hora local).
 * @param {Date} d - Fecha de referencia (por defecto: ahora)
 * @returns {string}
 */
export function primerDiaMesAnteriorLocal(d = new Date()) {
  return fechaLocal(new Date(d.getFullYear(), d.getMonth() - 1, 1));
}

/**
 * Lunes de la semana actual en formato 'YYYY-MM-DD' (hora local).
 * @param {Date} d - Fecha de referencia (por defecto: ahora)
 * @returns {string}
 */
export function lunesDeEstaSemanaLocal(d = new Date()) {
  const lunes = new Date(d);
  lunes.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return fechaLocal(lunes);
}