import { useEffect, useState } from 'react';

const INTERVALO_HORAS = 3;
const INTERVALO_MS = INTERVALO_HORAS * 60 * 60 * 1000;

export function useRecordatorioArqueo(arqueos, tipoEstado) {
  const [recordatorio, setRecordatorio] = useState(null);

  useEffect(() => {
    if (tipoEstado === 'diaCerrado' || tipoEstado === 'sinTurno') {
      setRecordatorio(null);
      return;
    }

    function revisar() {
      const ahora = Date.now();
      let ultimo = null;

      if (arqueos && arqueos.length > 0) {
        const horas = arqueos.map(a => {
          const h = String(a.hora || '').replace("'", '').slice(0, 5);
          if (!h || !h.includes(':')) return 0;
          const [hh, mm] = h.split(':').map(Number);
          const d = new Date();
          d.setHours(hh, mm, 0, 0);
          return d.getTime();
        }).filter(t => t > 0);

        if (horas.length > 0) {
          ultimo = Math.max(...horas);
        }
      }

      if (!ultimo) {
        setRecordatorio({
          mensaje: 'No has hecho ningún arqueo en este turno. Haz uno ahora.',
          minutos: null,
          urgente: true,
        });
        return;
      }

      const diffMs = ahora - ultimo;
      const diffMin = Math.floor(diffMs / 60000);
      const diffHoras = diffMs / INTERVALO_MS;

      if (diffMs >= INTERVALO_MS) {
        setRecordatorio({
          mensaje: `Han pasado ${Math.floor(diffMin / 60)}h ${diffMin % 60}min desde el último arqueo.`,
          minutos: diffMin,
          urgente: diffHoras >= 1.5,
        });
      } else {
        setRecordatorio(null);
      }
    }

    revisar();
    const interval = setInterval(revisar, 60000);

    return () => clearInterval(interval);
  }, [arqueos, tipoEstado]);

  return recordatorio;
}

export async function pedirPermisoNotificaciones() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const perm = await Notification.requestPermission();
  return perm === 'granted';
}

export function mostrarNotificacion(titulo, cuerpo) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    new Notification(titulo, {
      body: cuerpo,
      icon: '/caja-mascotas/logo.png',
      tag: 'arqueo-recordatorio',
    });
  } catch (e) {
    console.warn('No se pudo mostrar la notificación:', e);
  }
}