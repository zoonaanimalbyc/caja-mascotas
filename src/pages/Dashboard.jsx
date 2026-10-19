import { useEffect, useState } from 'react';
import { api } from '../api';
import { hoyLocal, primerDiaMesLocal, lunesDeEstaSemanaLocal } from '../utils/fechas';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { exportarPDFDia, exportarExcelMes, exportarPDFCajero } from '../utils/reportes';

const CACHE_KEY = 'dashboard_cache_';
const hoyStr = () => hoyLocal();
const fmt = n => '$' + Number(n || 0).toLocaleString('es-CO');

const COLORES = ['#1F4A2C', '#3F7D4F', '#C4B234', '#B4553F', '#4A8B5E', '#A89A28', '#2B5A3F'];

export default function Dashboard({ sede, user }) {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [pendientes, setPendientes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [modal, setModal] = useState(null);
  const [modalCajero, setModalCajero] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(false);

  const [rango, setRango] = useState('mes');
  const [desde, setDesde] = useState(() => {
    const d = new Date();
    return primerDiaMesLocal(d);
  });
  const [hasta, setHasta] = useState(() => hoyStr());

  function aplicarRango(nuevoRango) {
    const hoy = new Date();
    setRango(nuevoRango);
    if (nuevoRango === 'hoy') {
      setDesde(hoyStr());
      setHasta(hoyStr());
    } else if (nuevoRango === 'semana') {
      setDesde(lunesDeEstaSemanaLocal(hoy));
      setHasta(hoyStr());
    } else if (nuevoRango === 'mes') {
      setDesde(primerDiaMesLocal(hoy));
      setHasta(hoyStr());
    }
  }

  async function recargarTodo() {
    setCargando(true);
    try {
      const [dash, pend, users, st] = await Promise.all([
        api.getDashboard(sede),
        api.getDescuadresPendientes({ sede }).catch(() => []),
        api.getUsuarios().catch(() => []),
        api.getEstadisticas({ sede, desde, hasta }).catch(() => null),
      ]);
      setData(dash);
      setPendientes(Array.isArray(pend) ? pend : []);
      setUsuarios(users || []);
      setStats(st);
      try { localStorage.setItem(CACHE_KEY + sede, JSON.stringify(dash)); } catch (e) {}
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    try {
      const cache = localStorage.getItem(CACHE_KEY + sede);
      if (cache) setData(JSON.parse(cache));
    } catch (e) {}
    recargarTodo();
  }, [sede, desde, hasta]);

  async function descargarPDFDia() {
    if (generandoPDF) return;
    setGenerandoPDF(true);
    try {
      const fecha = hoyStr();
      const hoyData = await api.getHoy(sede, fecha);
      await exportarPDFDia({
        sede, fecha,
        arqueos: hoyData.arqueos || [],
        movimientos: hoyData.movimientos || [],
        cierre: hoyData.cierre || null,
        usuario: user?.nombre || '',
      });
    } catch (e) {
      alert('Error al generar el PDF: ' + e.message);
    } finally {
      setGenerandoPDF(false);
    }
  }

  function descargarExcelMes() {
    exportarExcelMes({ sede, desde, hasta, cierres: data?.cierres || [] });
  }

  async function descargarPDFCajero(cajero) {
    setModalCajero(false);
    setGenerandoPDF(true);
    try {
      await exportarPDFCajero({ sede, cajero, desde, hasta, cierres: data?.cierres || [] });
    } catch (e) {
      alert('Error al generar el PDF: ' + e.message);
    } finally {
      setGenerandoPDF(false);
    }
  }

  if (!data) return <div className="loading">Cargando dashboard…</div>;

  const chartVentas = Object.entries(stats?.porDia || {})
    .map(([fecha, v]) => ({ fecha, ventas: v.ventas, diferencias: v.diferencias }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const chartCajeros = Object.entries(stats?.porCajero || {})
    .map(([nombre, v]) => ({ nombre, ventas: v.ventas, turnos: v.turnos }))
    .sort((a, b) => b.ventas - a.ventas);

  const chartTiposMov = Object.entries(stats?.porTipoMov || {})
    .map(([tipo, v]) => ({ tipo, total: v.total, cantidad: v.cantidad }));

  return (
    <div>
      <h2>
        Dashboard · {sede}
        {cargando && <span className="badge-actualizando">actualizando…</span>}
      </h2>

      {/* ---------- FILTROS DE FECHA ---------- */}
      <div className="filtros-fecha">
        <button className={`filtro-btn ${rango === 'hoy' ? 'active' : ''}`} onClick={() => aplicarRango('hoy')}>
          Hoy
        </button>
        <button className={`filtro-btn ${rango === 'semana' ? 'active' : ''}`} onClick={() => aplicarRango('semana')}>
          Esta semana
        </button>
        <button className={`filtro-btn ${rango === 'mes' ? 'active' : ''}`} onClick={() => aplicarRango('mes')}>
          Este mes
        </button>
        <button className={`filtro-btn ${rango === 'personalizado' ? 'active' : ''}`} onClick={() => setRango('personalizado')}>
          Personalizado
        </button>

        {rango === 'personalizado' && (
          <>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
            <span>→</span>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
          </>
        )}
      </div>

      {/* ---------- ACCIONES DE REPORTES ---------- */}
      <div className="acciones-reportes">
        <button className="btn-reporte" onClick={descargarPDFDia} disabled={generandoPDF}>
          {generandoPDF ? '⏳ Generando…' : '📄 Reporte del día (PDF)'}
        </button>
        <button className="btn-reporte" onClick={descargarExcelMes}>
          📊 Reporte del rango (Excel)
        </button>
        <button className="btn-reporte" onClick={() => setModalCajero(true)}>
          👤 Reporte por cajero (PDF)
        </button>
      </div>

      {/* ---------- DESCUADRES PENDIENTES ---------- */}
      {pendientes.length > 0 && (
        <div className="seccion-pendientes">
          <h3>🔴 Descuadres pendientes de revisión ({pendientes.length})</h3>
          {pendientes.map(p => (
            <div key={p.id} className="card-pendiente">
              <div className="card-pendiente-head">
                <span className="cp-fecha">{p.fecha}</span>
                <span className="cp-turno">Turno {p.turno}</span>
                <span className="cp-sede">{p.sede}</span>
                <span className="cp-diferencia">{fmt(p.diferencia)}</span>
              </div>
              <div className="card-pendiente-body">
                <p>👤 {p.usuario_email || '—'} a las {p.hora_cierre || '—'}</p>
                <p>Esperado: <b>{fmt(p.esperado)}</b> · Contado: <b>{fmt(p.contado)}</b></p>
                {p.observaciones && <p className="cp-obs">📝 {p.observaciones}</p>}
              </div>
              <div className="card-pendiente-acciones">
                <button className="btn-accion aprobar" onClick={() => setModal({ cierre: p, accion: 'aprobar' })}>✔ Aprobar</button>
                <button className="btn-accion rechazar" onClick={() => setModal({ cierre: p, accion: 'rechazar' })}>✖ Rechazar</button>
                <button className="btn-accion corregir" onClick={() => setModal({ cierre: p, accion: 'corregir' })}>🔧 Corregir</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------- KPIs ---------- */}
      <div className="cards">
        <div className="card-kpi">
          <span className="kpi-label">Ventas totales</span>
          <span className="kpi-valor">{fmt(stats?.totales.ventas)}</span>
          <span className="kpi-nota">Promedio diario: {fmt(stats?.totales.promedioDiario)}</span>
        </div>
        <div className="card-kpi">
          <span className="kpi-label">Turnos</span>
          <span className="kpi-valor">{stats?.totales.turnos || 0}</span>
          <span className="kpi-nota">{stats?.totales.arqueos || 0} arqueos · {stats?.totales.movimientos || 0} movs</span>
        </div>
        <div className="card-kpi card-kpi-peligro">
          <span className="kpi-label">Descuadres</span>
          <span className="kpi-valor">{stats?.totales.descuadres || 0}</span>
          <span className="kpi-nota">Diferencias: {fmt(stats?.totales.diferencias)}</span>
        </div>
        <div className="card-kpi">
          <span className="kpi-label">Top cajero</span>
          <span className="kpi-valor" style={{ fontSize: 18 }}>
            {chartCajeros[0]?.nombre.split(' ')[0] || '—'}
          </span>
          <span className="kpi-nota">{fmt(chartCajeros[0]?.ventas)} en {chartCajeros[0]?.turnos || 0} turnos</span>
        </div>
      </div>

      {/* ---------- 👥 VENTAS POR CAJERO + 💸 MOVIMIENTOS POR TIPO (arriba) ---------- */}
      <div className="dash-grid-2">
        <div className="dash-chart-box">
          <h3>👥 Ventas por cajero</h3>
          {chartCajeros.length === 0 ? (
            <p className="tabla-vacia">Sin datos en este rango.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartCajeros} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => '$' + (v/1000).toFixed(0) + 'k'} />
                <YAxis type="category" dataKey="nombre" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Bar dataKey="ventas" fill="#1F4A2C" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="dash-chart-box">
          <h3>💸 Movimientos por tipo</h3>
          {chartTiposMov.length === 0 ? (
            <p className="tabla-vacia">Sin movimientos en este rango.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={chartTiposMov}
                  dataKey="total"
                  nameKey="tipo"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(entry) => entry.tipo}
                >
                  {chartTiposMov.map((_, i) => (
                    <Cell key={i} fill={COLORES[i % COLORES.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ---------- 📈 VENTAS Y DIFERENCIAS POR DÍA (abajo) ---------- */}
      <div className="dash-chart-box">
        <h3>📈 Ventas y diferencias por día</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartVentas}>
            <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => fmt(v)} />
            <Legend />
            <Line type="monotone" dataKey="ventas" stroke="#3F7D4F" strokeWidth={2.5} name="Ventas" />
            <Line type="monotone" dataKey="diferencias" stroke="#B4553F" strokeWidth={2} name="Diferencias" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ---------- TOP DIFERENCIAS ---------- */}
      {stats?.topDiferencias?.length > 0 && (
        <div className="dash-chart-box">
          <h3>🔴 Top diferencias del rango</h3>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Turno</th>
                <th>Cajero</th>
                <th style={{ textAlign: 'right' }}>Diferencia</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {stats.topDiferencias.map((d, i) => (
                <tr key={i}>
                  <td className="cell-num">{d.fecha}</td>
                  <td>Turno {d.turno}</td>
                  <td>{d.usuario}</td>
                  <td className="cell-num" style={{
                    textAlign: 'right',
                    color: d.diferencia < 0 ? '#B4553F' : '#4A8B5E',
                    fontWeight: 700
                  }}>
                    {fmt(d.diferencia)}
                  </td>
                  <td>
                    <span className={`badge-estado ${d.estado_revision === 'pendiente' ? 'err' : 'ok'}`}>
                      {d.estado_revision || 'pendiente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ModalRevision
          cierre={modal.cierre}
          accion={modal.accion}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); recargarTodo(); }}
        />
      )}

      {modalCajero && (
        <ModalCajero usuarios={usuarios} onClose={() => setModalCajero(false)} onSelect={descargarPDFCajero} />
      )}
    </div>
  );
}

function ModalRevision({ cierre, accion, onClose, onSuccess }) {
  const [pin, setPin] = useState('');
  const [comentario, setComentario] = useState('');
  const [err, setErr] = useState('');
  const [guardando, setGuardando] = useState(false);

  const titulos = {
    aprobar: '✔ Aprobar descuadre',
    rechazar: '✖ Rechazar descuadre',
    corregir: '🔧 Corregir descuadre',
  };
  const mensajes = {
    aprobar: 'Se aceptará el descuadre como revisado.',
    rechazar: 'Se rechazará el descuadre. Quedará abierto para revisión posterior.',
    corregir: 'Se marcará como corregido. Verifica el cierre en el Sheet.',
  };

  async function confirmar() {
    if (!pin || pin.length < 4) { setErr('Ingresa tu PIN de admin'); return; }
    setErr('');
    setGuardando(true);
    try {
      await api.revisarDescuadre({
        sede: cierre.sede, fecha: cierre.fecha, turno: cierre.turno,
        accion, pin_admin: pin, comentario: comentario || mensajes[accion],
      });
      onSuccess();
    } catch (e) {
      setErr(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{titulos[accion]}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="info">{mensajes[accion]}</p>
          <div className="detalle-item">
            <div className="detalle-item-head">
              <span className="tipo-badge badge-cierre">Turno {cierre.turno}</span>
              <span className="detalle-item-hora">{cierre.fecha} · {cierre.hora_cierre || '—'}</span>
              <span className="detalle-item-total">{fmt(cierre.diferencia)}</span>
            </div>
            <p>👤 {cierre.usuario_email || '—'}</p>
          </div>
          <label>PIN del admin/supervisor</label>
          <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="••••••" />
          <label>Comentario (opcional)</label>
          <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows="3" />
          {err && <p className="err">{err}</p>}
          <div className="acciones-arqueo">
            <button className="btn-secundario" onClick={onClose}>Cancelar</button>
            <button className="btn-guardar" onClick={confirmar} disabled={guardando}>
              {guardando ? 'Validando…' : 'Confirmar con PIN'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalCajero({ usuarios, onClose, onSelect }) {
  const [cajero, setCajero] = useState('');
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>👤 Reporte por cajero</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <label>Cajero</label>
          <select value={cajero} onChange={e => setCajero(e.target.value)}>
            <option value="">Selecciona un cajero…</option>
            {usuarios.map(u => (
              <option key={u.nombre} value={u.nombre}>{u.nombre}</option>
            ))}
          </select>
          <div className="acciones-arqueo">
            <button className="btn-secundario" onClick={onClose}>Cancelar</button>
            <button className="btn-acento" onClick={() => onSelect('')}>📋 Todos los cajeros</button>
            <button className="btn-guardar" disabled={!cajero} onClick={() => onSelect(cajero)}>
              {cajero ? `📄 Descargar de ${cajero}` : '📄 Descargar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}