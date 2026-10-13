import { useEffect, useState } from 'react';
import { api } from '../api';

const hoy = () => new Date().toISOString().slice(0, 10);
const fmt = n => '$' + Number(n || 0).toLocaleString('es-CO');

const fmtHora = (h) => {
  if (!h) return '—';
  const s = String(h);
  if (s.includes('T')) return s.split('T')[1]?.slice(0, 5) || '';
  if (s.includes(':')) return s.slice(0, 5);
  return s;
};

const fmtTipo = (t) => {
  if (t === 'apertura') return '🌅 Apertura';
  if (t === 'cierre')   return '🌙 Cierre';
  if (t === '2h')       return '⏰ 2h';
  return t;
};

const claseTipo = (t) => {
  if (t === 'apertura') return 'badge-apertura';
  if (t === 'cierre')   return 'badge-cierre';
  return 'badge-2h';
};

const fmtTipoMov = (t) => {
  const map = {
    INGRESO: '💰 Ingreso',
    EGRESO: '📤 Egreso',
    FLETE: '🛵 Flete',
    SPA: '💆 SPA',
    SPA_QR: '📱 SPA QR',
  };
  return map[t] || t;
};

export default function Hoy({ sede, user }) {
  const [data, setData] = useState({ arqueos: [], movimientos: [], cierre: null });
  const [load, setLoad] = useState(true);
  const [abierto, setAbierto] = useState({ arqueos: true, movimientos: false, cierre: false });
  const [estadoTurnos, setEstadoTurnos] = useState(null);

  useEffect(() => {
    setLoad(true);
    Promise.all([
      api.getHoy(sede, hoy()),
      api.getEstadoTurnos({ sede, fecha: hoy() }).catch(() => null),
    ])
      .then(([h, t]) => { setData(h); setEstadoTurnos(t); })
      .finally(() => setLoad(false));
  }, [sede]);

  const toggle = (key) => setAbierto({ ...abierto, [key]: !abierto[key] });

  if (load) return <div className="loading">Cargando datos…</div>;

  const turnoEnCurso =
    estadoTurnos && estadoTurnos.turno1.apertura && !estadoTurnos.turno1.cierre ? 'Turno 1' :
    estadoTurnos && estadoTurnos.turno2.apertura && !estadoTurnos.turno2.cierre ? 'Turno 2' :
    estadoTurnos && estadoTurnos.turno2.cierre ? 'Día cerrado' : null;

  return (
    <div>
      <h2>Hoy · {sede} · {hoy()}</h2>

      {turnoEnCurso && (
        <p className={`info ${turnoEnCurso === 'Día cerrado' ? 'info-ok' : ''}`}>
          {turnoEnCurso === 'Día cerrado'
            ? '✅ El día está completamente cerrado.'
            : `☀️ ${turnoEnCurso} en curso.`}
        </p>
      )}

      {/* ------ ACORDEÓN ARQUEOS ------ */}
      <div className="acordeon">
        <button className="acordeon-head" onClick={() => toggle('arqueos')}>
          <span>🌅 Arqueos <b>({data.arqueos.length})</b></span>
          <span className={`chevron ${abierto.arqueos ? 'open' : ''}`}>▾</span>
        </button>
        {abierto.arqueos && (
          <div className="acordeon-body">
            {data.arqueos.length === 0 ? (
              <p className="tabla-vacia">Sin arqueos hoy</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Tipo</th>
                    <th>Responsable</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.arqueos.map(a => (
                    <tr key={a.id}>
                      <td className="cell-num">{fmtHora(a.hora)}</td>
                      <td>
                        <span className={`tipo-badge ${claseTipo(a.tipo)}`}>
                          {fmtTipo(a.tipo)}
                        </span>
                      </td>
                      <td>{a.usuario_email || '—'}</td>
                      <td className="cell-num" style={{ textAlign: 'right' }}>{fmt(a.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ------ ACORDEÓN MOVIMIENTOS ------ */}
      <div className="acordeon">
        <button className="acordeon-head" onClick={() => toggle('movimientos')}>
          <span>💸 Movimientos <b>({data.movimientos.length})</b></span>
          <span className={`chevron ${abierto.movimientos ? 'open' : ''}`}>▾</span>
        </button>
        {abierto.movimientos && (
          <div className="acordeon-body">
            {data.movimientos.length === 0 ? (
              <p className="tabla-vacia">Sin movimientos hoy</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th>Responsable</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.movimientos.map(m => (
                    <tr key={m.id}>
                      <td className="cell-num">{fmtHora(m.hora)}</td>
                      <td><span className="tipo-badge badge-mov">{fmtTipoMov(m.tipo)}</span></td>
                      <td>
                        {m.descripcion && String(m.descripcion).trim() ? (
                          m.descripcion
                        ) : (
                          <span style={{ color: '#AAA', fontStyle: 'italic' }}>Sin descripción</span>
                        )}
                      </td>
                      <td>{m.responsable || '—'}</td>
                      <td className="cell-num" style={{ textAlign: 'right' }}>{fmt(m.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ------ ACORDEÓN CIERRE ------ */}
      <div className="acordeon">
        <button className="acordeon-head" onClick={() => toggle('cierre')}>
          <span>
            📊 Cierre del día{' '}
            {data.cierre && (
              <span className={`badge-estado ${data.cierre.estado === 'cuadra' ? 'ok' : 'err'}`}>
                {data.cierre.estado === 'cuadra' ? '🟢 Cuadra' : '🔴 Descuadre'}
              </span>
            )}
          </span>
          <span className={`chevron ${abierto.cierre ? 'open' : ''}`}>▾</span>
        </button>
        {abierto.cierre && (
          <div className="acordeon-body">
            {!data.cierre ? (
              <p className="tabla-vacia">Aún no se ha cerrado el día.</p>
            ) : (
              <div className={`cierre ${data.cierre.estado}`} style={{ margin: 0 }}>
                <p><span>Esperado</span><b>{fmt(data.cierre.esperado)}</b></p>
                <p><span>Contado</span><b>{fmt(data.cierre.contado)}</b></p>
                <p><span>Diferencia</span><b>{fmt(data.cierre.diferencia)}</b></p>
                <p className="estado-cierre">
                  {data.cierre.estado === 'cuadra'
                    ? '🟢 Cuadra perfectamente'
                    : '🔴 Descuadre — notificado al admin'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}