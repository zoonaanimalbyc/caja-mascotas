import { useEffect, useState } from 'react';
import { api } from '../api';

const hoyStr = () => new Date().toISOString().slice(0, 10);
const fmt = n => '$' + Number(n || 0).toLocaleString('es-CO');

export default function Historial({ sede, user }) {
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [desde, setDesde] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 10);
  });
  const [hasta, setHasta] = useState(hoyStr());
  const [filtroCajero, setFiltroCajero] = useState('');
  const [detalle, setDetalle] = useState(null);
  const [abiertos, setAbiertos] = useState({});

  async function cargar() {
    setCargando(true);
    try {
      const data = await api.getHistorial({
        sede, desde, hasta,
        usuario: filtroCajero || undefined,
        limite: 100,
      });
      setHistorial(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setHistorial([]);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, [sede, desde, hasta, filtroCajero]);

  async function abrirDetalle(row) {
    try {
      const d = await api.getDetalleTurno({
        sede: row.sede,
        fecha: row.fecha,
        turno: row.turno,
      });
      setDetalle({ row, ...d });
    } catch (e) {
      alert('Error al cargar el detalle: ' + e.message);
    }
  }

  const toggleDia = (fecha) => {
    setAbiertos({ ...abiertos, [fecha]: !abiertos[fecha] });
  };

  // Agrupar por fecha
  const grupos = {};
  historial.forEach(row => {
    if (!grupos[row.fecha]) grupos[row.fecha] = [];
    grupos[row.fecha].push(row);
  });
  const fechas = Object.keys(grupos).sort((a, b) => b.localeCompare(a));

  // Resumen del día
  function resumenDia(rows) {
    const totalEsperado = rows.reduce((s, r) => s + r.esperado, 0);
    const totalContado = rows.reduce((s, r) => s + r.contado, 0);
    const totalDiferencias = rows.reduce((s, r) => s + Math.abs(r.diferencia), 0);
    const descuadres = rows.filter(r => r.estado === 'descuadre').length;
    return { totalEsperado, totalContado, totalDiferencia: totalContado - totalEsperado, descuadres };
  }

  return (
    <div>
      <h2>Historial · {sede}</h2>

      {/* Filtros */}
      <div className="filtros-fecha">
        <label style={{ margin: 0 }}>Desde</label>
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
        <label style={{ margin: 0 }}>Hasta</label>
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
        <input
          type="text"
          placeholder="Filtrar por cajero…"
          value={filtroCajero}
          onChange={e => setFiltroCajero(e.target.value)}
          style={{ flex: 1, minWidth: 180 }}
        />
      </div>

      {cargando ? (
        <div className="loading">Cargando historial…</div>
      ) : fechas.length === 0 ? (
        <p className="tabla-vacia">Sin turnos en este rango.</p>
      ) : (
        fechas.map(fecha => {
          const rows = grupos[fecha];
          const resumen = resumenDia(rows);
          const abierto = abiertos[fecha];
          return (
            <div key={fecha} className="acordeon">
              <button className="acordeon-head" onClick={() => toggleDia(fecha)}>
                <span>
                  📅 <b>{fecha}</b>{' '}
                  <span className="hist-hint">
                    {rows.length} turno{rows.length > 1 ? 's' : ''} ·{' '}
                    {resumen.descuadres > 0 ? (
                      <span className="badge-estado err">{resumen.descuadres} desc.</span>
                    ) : (
                      <span className="badge-estado ok">🟢 Cuadra</span>
                    )}
                  </span>
                </span>
                <span className={`chevron ${abierto ? 'open' : ''}`}>▾</span>
              </button>

              {abierto && (
                <div className="acordeon-body">
                  <table>
                    <thead>
                      <tr>
                        <th>Turno</th>
                        <th>Cajero</th>
                        <th style={{ textAlign: 'right' }}>Esperado</th>
                        <th style={{ textAlign: 'right' }}>Contado</th>
                        <th style={{ textAlign: 'right' }}>Diferencia</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(row => (
                        <tr key={row.id}>
                          <td>Turno {row.turno}</td>
                          <td>{row.usuario_email || '—'}</td>
                          <td className="cell-num" style={{ textAlign: 'right' }}>{fmt(row.esperado)}</td>
                          <td className="cell-num" style={{ textAlign: 'right' }}>{fmt(row.contado)}</td>
                          <td className="cell-num" style={{
                            textAlign: 'right',
                            color: row.diferencia < 0 ? '#B4553F' : row.diferencia > 0 ? '#4A8B5E' : 'inherit',
                            fontWeight: 700,
                          }}>
                            {fmt(row.diferencia)}
                          </td>
                          <td>
                            <span className={`badge-estado ${row.estado === 'cuadra' ? 'ok' : 'err'}`}>
                              {row.estado === 'cuadra' ? '🟢 OK' : '🔴 Desc.'}
                            </span>
                          </td>
                          <td>
                            <button className="btn-ver" onClick={() => abrirDetalle(row)} title="Ver detalle">
                              👁 Ver
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="2"><b>Total día</b></td>
                        <td className="cell-num" style={{ textAlign: 'right' }}><b>{fmt(resumen.totalEsperado)}</b></td>
                        <td className="cell-num" style={{ textAlign: 'right' }}><b>{fmt(resumen.totalContado)}</b></td>
                        <td className="cell-num" style={{ textAlign: 'right', color: resumen.totalDiferencia < 0 ? '#B4553F' : '#4A8B5E' }}>
                          <b>{fmt(resumen.totalDiferencia)}</b>
                        </td>
                        <td colSpan="2"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}

      {detalle && <DetalleTurno data={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
}

function DetalleTurno({ data, onClose }) {
  const { row, apertura, arqueos, movimientos, cierre } = data;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
        <div className="modal-head">
          <h3>📋 Turno {row.turno} · {row.fecha}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {apertura && (
            <div className="detalle-item">
              <h4 style={{ marginTop: 0 }}>🌅 Apertura</h4>
              <p>👤 {apertura.usuario_apertura} a las {String(apertura.hora_apertura || '').replace("'", '')}</p>
              <p>Saldo inicial: <b>{fmt(apertura.saldo_inicial)}</b></p>
              <p>Contado al abrir: <b>{fmt(apertura.contado_apertura)}</b></p>
              {Number(apertura.diferencia_apertura) !== 0 && (
                <p style={{ color: '#B4553F', fontWeight: 700 }}>
                  ⚠️ Diferencia al recibir: {fmt(apertura.diferencia_apertura)}
                </p>
              )}
            </div>
          )}

          <h4>Arqueos ({arqueos.length})</h4>
          {arqueos.length === 0 ? (
            <p className="tabla-vacia">Sin arqueos.</p>
          ) : (
            <table style={{ marginBottom: 16 }}>
              <thead><tr><th>Hora</th><th>Tipo</th><th>Responsable</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
              <tbody>
                {arqueos.map((a, i) => (
                  <tr key={i}>
                    <td className="cell-num">{String(a.hora || '').replace("'", '')}</td>
                    <td>{a.tipo}</td>
                    <td>{a.usuario_email || '—'}</td>
                    <td className="cell-num" style={{ textAlign: 'right' }}>{fmt(a.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h4>Movimientos ({movimientos.length})</h4>
          {movimientos.length === 0 ? (
            <p className="tabla-vacia">Sin movimientos.</p>
          ) : (
            <table style={{ marginBottom: 16 }}>
              <thead><tr><th>Hora</th><th>Tipo</th><th>Descripción</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
              <tbody>
                {movimientos.map((m, i) => (
                  <tr key={i}>
                    <td className="cell-num">{String(m.hora || '').replace("'", '')}</td>
                    <td>{m.tipo}</td>
                    <td>{m.descripcion || '—'}</td>
                    <td className="cell-num" style={{ textAlign: 'right' }}>{fmt(m.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {cierre && (
            <>
              <h4>Cierre</h4>
              <div className={`cierre ${cierre.estado}`} style={{ margin: 0 }}>
                <p><span>Esperado</span><b>{fmt(cierre.esperado)}</b></p>
                <p><span>Contado</span><b>{fmt(cierre.contado)}</b></p>
                <p><span>Diferencia</span><b>{fmt(cierre.diferencia)}</b></p>
                <p className="estado-cierre">
                  {cierre.estado === 'cuadra' ? '🟢 Cuadra' : '🔴 Descuadre'}
                </p>
              </div>
            </>
          )}

          <div className="acciones-arqueo" style={{ marginTop: 20 }}>
            <button className="btn-guardar" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}