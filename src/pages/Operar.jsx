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
  const [estadoTurnos, setEstadoTurnos] = useState(null);
  const [load, setLoad] = useState(true);
  const [abierto, setAbierto] = useState({ arqueos: true, movimientos: false, cierre: false });

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

  // ----- ESTADO EN VIVO DEL TURNO -----
  const estadoTurno = (() => {
    if (!estadoTurnos) return null;
    const t1 = estadoTurnos.turno1 || {};
    const t2 = estadoTurnos.turno2 || {};

    let turnoData = null;
    if (t1.apertura && !t1.cierre) turnoData = { ...t1.apertura, numero: 1 };
    else if (t2.apertura && !t2.cierre) turnoData = { ...t2.apertura, numero: 2 };
    else return null;

    const horaApertura = String(turnoData.hora_apertura || '').replace("'", '').slice(0, 5);
    const ahora = new Date().toTimeString().slice(0, 5);

    const saldoInicial = Number(turnoData.contado_apertura) || 0;

    const movsTurno = (data.movimientos || []).filter(m => {
      const h = String(m.hora || '').replace("'", '').slice(0, 5);
      if (!horaApertura) return true;
      return h >= horaApertura && h <= ahora;
    });

    const sum = tipo => movsTurno.filter(m => m.tipo === tipo)
                                  .reduce((a, m) => a + Number(m.valor || 0), 0);

    const total_ingresos = sum('INGRESO');
    const total_egresos = sum('EGRESO');
    const total_fletes = sum('FLETE');
    const total_spa = sum('SPA');

    const arqueosTurno = (data.arqueos || []).filter(a => {
      if (a.tipo === 'cierre') return false;
      const h = String(a.hora || '').replace("'", '').slice(0, 5);
      if (!horaApertura) return true;
      return h >= horaApertura && h <= ahora;
    });

    const ultimoArqueo = arqueosTurno.length > 0
      ? arqueosTurno[arqueosTurno.length - 1]
      : null;

    const ventasSiigoActual = ultimoArqueo ? (Number(ultimoArqueo.ventas_siigo) || 0) : 0;
    const contadoActual = ultimoArqueo
      ? (Number(ultimoArqueo.total) || 0)
      : saldoInicial;

    const esperado = saldoInicial
      + ventasSiigoActual
      + total_ingresos
      - total_egresos
      - total_fletes
      - total_spa;

    const diferencia = contadoActual - esperado;

    return {
      numero: turnoData.numero,
      usuario: turnoData.usuario_apertura,
      horaApertura,
      saldoInicial,
      ventasSiigoActual,
      total_ingresos,
      total_egresos,
      total_fletes,
      total_spa,
      esperado,
      contadoActual,
      diferencia,
      ultimoArqueo,
      tieneArqueoParcial: !!ultimoArqueo,
    };
  })();

  const t1 = estadoTurnos?.turno1 || {};
  const t2 = estadoTurnos?.turno2 || {};
  const diaCerrado = estadoTurnos?.diaCerrado;

  return (
    <div>
      <h2>Hoy · {sede} · {hoy()}</h2>

      {diaCerrado && (
        <p className="info info-ok">✅ El día está completamente cerrado.</p>
      )}

      {/* Resumen del turno 1 cerrado */}
      {t1.cierre && (
        <div className={`cierre-resumen ${t1.cierre.estado === 'cuadra' ? 'ok' : 'err'}`}>
          <div className="cierre-resumen-head">
            <span>🌅 <b>Turno 1 cerrado</b></span>
            <span className="cierre-resumen-dif">{fmt(t1.cierre.diferencia)}</span>
          </div>
          <div className="cierre-resumen-body">
            {t1.cierre.estado === 'cuadra' ? '🟢 Cuadra' : '🔴 Descuadre'}
            {' · '}Contado: <b>{fmt(t1.cierre.contado)}</b>
          </div>
        </div>
      )}

      {/* Estado en vivo del turno activo */}
      {estadoTurno && (
        <EstadoTurno estado={estadoTurno} />
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
                    <th style={{ textAlign: 'right' }}>Ventas SIIGO</th>
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
                      <td className="cell-num" style={{ textAlign: 'right' }}>
                        {Number(a.ventas_siigo) > 0 ? fmt(a.ventas_siigo) : '—'}
                      </td>
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

function EstadoTurno({ estado }) {
  const fmtLocal = n => '$' + Number(n || 0).toLocaleString('es-CO');
  const diferencia = estado.diferencia;
  const cuadra = diferencia === 0;
  const clase = cuadra ? 'ok' : (diferencia < 0 ? 'falta' : 'sobra');

  return (
    <div className={`estado-turno ${clase}`}>
      <div className="estado-turno-titulo">
        📊 Estado en vivo del turno {estado.numero}
      </div>
      <div className="estado-turno-body">
        <div className="estado-linea">
          <span>Saldo inicial (contado apertura)</span>
          <b>{fmtLocal(estado.saldoInicial)}</b>
        </div>
        <div className="estado-linea">
          <span>Ventas SIIGO {estado.tieneArqueoParcial ? '(último arqueo)' : '(sin arqueo aún)'}</span>
          <b>+{fmtLocal(estado.ventasSiigoActual)}</b>
        </div>
        <div className="estado-linea">
          <span>+ Ingresos</span>
          <b>+{fmtLocal(estado.total_ingresos)}</b>
        </div>
        <div className="estado-linea">
          <span>− Egresos</span>
          <b>−{fmtLocal(estado.total_egresos)}</b>
        </div>
        <div className="estado-linea">
          <span>− Fletes</span>
          <b>−{fmtLocal(estado.total_fletes)}</b>
        </div>
        <div className="estado-linea">
          <span>− SPA</span>
          <b>−{fmtLocal(estado.total_spa)}</b>
        </div>
        <div className="estado-linea estado-linea-total">
          <span>ESPERADO AHORA</span>
          <b>{fmtLocal(estado.esperado)}</b>
        </div>
        <div className="estado-linea">
          <span>
            {estado.tieneArqueoParcial
              ? `Último arqueo (${String(estado.ultimoArqueo.hora).replace("'", '').slice(0, 5)})`
              : 'Contado apertura'}
          </span>
          <b>{fmtLocal(estado.contadoActual)}</b>
        </div>
        <div className={`estado-linea estado-linea-dif ${clase}`}>
          <span>DIFERENCIA</span>
          <b>
            {cuadra ? '🟢 $0' : (diferencia < 0 ? '🔴 ' : '🟡 +') + fmtLocal(diferencia)}
          </b>
        </div>
      </div>
    </div>
  );
}