import { useEffect, useState } from 'react';
import { api } from '../api';
import { DENOMS, TIPOS_MOV } from '../config';
import { useRecordatorioArqueo, pedirPermisoNotificaciones, mostrarNotificacion } from '../utils/recordatorios';
import { hoyLocal, horaLocal } from '../utils/fechas';

const hoy = () => hoyLocal();
const hora = () => horaLocal();
const fmt = n => '$' + Number(n || 0).toLocaleString('es-CO');
const LIMITE_VENTAS = 50000000;

export default function Operar({ sede, user }) {
  const [estado, setEstado] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [arqueosHoy, setArqueosHoy] = useState([]);
  const [movimientosHoy, setMovimientosHoy] = useState([]);
  const [load, setLoad] = useState(true);
  const [vista, setVista] = useState('menu');
  const [turnoActivo, setTurnoActivo] = useState(null);

  const [cant, setCant] = useState({});
  const [movTipo, setMovTipo] = useState('EGRESO');
  const [movDesc, setMovDesc] = useState('');
  const [movValor, setMovValor] = useState('');
  const [ventas, setVentas] = useState('');
  const [obs, setObs] = useState('');
  const [ventasSiigo, setVentasSiigo] = useState('');

  const [pinModalAbierto, setPinModalAbierto] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [guardandoPin, setGuardandoPin] = useState(false);

  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [pendientesModal, setPendientesModal] = useState(null);

  const t1 = estado?.turno1 || {};
  const t2 = estado?.turno2 || {};
  const diaCerrado = estado?.diaCerrado || false;

  const tipoEstado =
    diaCerrado ? 'diaCerrado' :
    (!t1.apertura && !t2.apertura) ? 'sinTurno' :
    'turnoActivo';

  const recordatorio = useRecordatorioArqueo(arqueosHoy, tipoEstado);
  const totalContado = DENOMS.reduce((a, d) => a + (Number(cant[d.valor] || 0) * d.valor), 0);

  const estadoTurno = (() => {
    let turnoData = null;
    if (t1.apertura && !t1.cierre) turnoData = t1.apertura;
    else if (t2.apertura && !t2.cierre) turnoData = t2.apertura;
    else return null;

    const horaApertura = String(turnoData.hora_apertura || '').replace("'", '').slice(0, 5);
    const ahora = hora();
    const saldoInicial = Number(turnoData.contado_apertura) || 0;

    const movsTurno = movimientosHoy.filter(m => {
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

    const arqueosTurno = arqueosHoy.filter(a => {
      if (a.tipo === 'cierre') return false;
      const h = String(a.hora || '').replace("'", '').slice(0, 5);
      if (!horaApertura) return true;
      return h >= horaApertura && h <= ahora;
    });

    const ultimoArqueo = arqueosTurno.length > 0 ? arqueosTurno[arqueosTurno.length - 1] : null;
    const ventasSiigoActual = ultimoArqueo ? (Number(ultimoArqueo.ventas_siigo) || 0) : 0;
    const contadoActual = ultimoArqueo ? (Number(ultimoArqueo.total) || 0) : saldoInicial;

    const esperado = saldoInicial + ventasSiigoActual + total_ingresos - total_egresos - total_fletes - total_spa;
    const diferencia = contadoActual - esperado;

    return {
      usuario: turnoData.usuario_apertura, horaApertura, saldoInicial, ventasSiigoActual,
      total_ingresos, total_egresos, total_fletes, total_spa, esperado, contadoActual,
      diferencia, ultimoArqueo, tieneArqueoParcial: !!ultimoArqueo,
    };
  })();

  // CARGA INICIAL (Solo se ejecuta al entrar a la pantalla o al cambiar de sede)
  useEffect(() => {
    async function cargar() {
      setLoad(true);
      try {
        const [e, h] = await Promise.all([
          api.getEstadoTurnos({ sede, fecha: hoy() }),
          api.getHoy(sede, hoy()).catch(() => ({ arqueos: [], movimientos: [] })),
        ]);
        setEstado(e);
        setArqueosHoy(h.arqueos || []);
        setMovimientosHoy(h.movimientos || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoad(false);
      }
      api.getUsuarios().then(setUsuarios).catch(() => {});
    }
    cargar();
  }, [sede]);

  // RECARGA SILENCIOSA (Para después de guardar, sin poner la pantalla en "Cargando...")
  async function recargarSilencioso() {
    try {
      const [e, h] = await Promise.all([
        api.getEstadoTurnos({ sede, fecha: hoy() }),
        api.getHoy(sede, hoy()).catch(() => ({ arqueos: [], movimientos: [] })),
      ]);
      setEstado(e);
      setArqueosHoy(h.arqueos || []);
      setMovimientosHoy(h.movimientos || []);
    } catch (err) {
      console.error("Error en recarga silenciosa", err);
    }
  }

  useEffect(() => {
    pedirPermisoNotificaciones();
  }, []);

  useEffect(() => {
    if (recordatorio && recordatorio.urgente) {
      mostrarNotificacion('⏰ Arqueo pendiente', recordatorio.mensaje);
    }
  }, [recordatorio?.mensaje]);

  useEffect(() => {
    if (!pinModalAbierto) return;
    function onKey(e) {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        setPin(p => p.length < 6 ? p + e.key : p);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setPin(p => p.slice(0, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        confirmarPin();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cerrarPinModal();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pinModalAbierto, pin]);

  const ajustar = (valor, delta) => {
    const actual = Number(cant[valor] || 0);
    const nuevo = Math.max(0, actual + delta);
    setCant({ ...cant, [valor]: nuevo });
  };

  const setValor = (valor, v) => {
    const n = Math.max(0, Number(v) || 0);
    setCant({ ...cant, [valor]: n });
  };

  const resetForms = () => {
    setCant({}); setMovDesc(''); setMovValor(''); setVentas(''); setObs('');
    setVentasSiigo(''); setError(''); setMsg(''); setPin(''); setPinError('');
  };

  function intentarGuardarMovimiento() {
    if (guardandoPin) return;
    if (!movTipo) { setError('⚠️ Debes elegir un tipo de movimiento'); return; }
    if (!movDesc || !movDesc.trim()) { setError('⚠️ La descripción es obligatoria'); return; }
    const v = Number(movValor || 0);
    if (!movValor || v <= 0) { setError('⚠️ Debes ingresar un valor mayor a 0'); return; }
    setError(''); setPin(''); setPinError(''); setPinModalAbierto(true);
  }

  function cerrarPinModal() { setPinModalAbierto(false); setPin(''); setPinError(''); }

  async function confirmarPin() {
    if (guardandoPin) return;
    if (!pin || pin.length < 4) { setPinError('Ingresa tu PIN'); return; }
    setGuardandoPin(true); setPinError('');
    try {
      const v = Number(movValor || 0);
      const r = await api.guardarMovimiento({
        sede, fecha: hoy(), hora: hora(), tipo: movTipo,
        descripcion: movDesc.trim(), valor: v,
        usuario_app: user.nombre || user.email,
        pin_usuario: pin, usuario_email: user.nombre || user.email,
      });
      cerrarPinModal(); resetForms(); setVista('menu');
      setMsg(`✅ Movimiento guardado por ${r.registrado_por || 'usuario'}`);
      setTimeout(() => setMsg(''), 3000);
      
      // Actualiza los datos en segundo plano
      recargarSilencioso();
    } catch (e) {
      setPinError(e.message); setPin('');
    } finally { setGuardandoPin(false); }
  }

  async function abrirTurno() {
    if (guardando) return;
    if (totalContado === 0) { setError('Debes contar al menos un billete o moneda'); return; }
    setGuardando(true);
    try {
      const pendientes = await api.getTurnosPendientes({ sede }).catch(() => []);
      if (pendientes && pendientes.length > 0) {
        setPendientesModal({ pendientes });
        setGuardando(false);
        return;
      }
      await ejecutarApertura(false, null);
    } catch (e) { 
      setError(e.message); 
      setGuardando(false); 
    }
  }

  async function ejecutarApertura(conPendiente, turnoPendienteId) {
    setGuardando(true);
    try {
      const arqueoPayload = {
        sede, fecha: hoy(), hora: hora(), tipo: 'apertura',
        usuario_email: user.nombre || user.email,
        observaciones: `Apertura turno ${turnoActivo}`, ventas_siigo: 0,
      };
      DENOMS.forEach(d => arqueoPayload['d' + d.valor] = Number(cant[d.valor] || 0));
      await api.guardarArqueo(arqueoPayload);
      
      await api.abrirTurno({
        sede, fecha: hoy(), turno: turnoActivo,
        hora: hora(), usuario: user.nombre || user.email,
        contado: totalContado, observaciones: '',
        apertura_con_pendiente: conPendiente,
        turno_pendiente_id: turnoPendienteId,
      });
      
      setPendientesModal(null);
      resetForms(); 
      setVista('menu'); 
      
      // Actualiza en segundo plano sin bloquear la pantalla
      recargarSilencioso();
      
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  function continuarConPendiente() {
    const turnoPendienteId = pendientesModal.pendientes[0]?.turno_id;
    setPendientesModal(null);
    ejecutarApertura(true, turnoPendienteId);
  }

  async function guardarArqueo() {
    if (guardando) return;
    if (totalContado === 0) { setError('Debes ingresar al menos una cantidad'); return; }
    setGuardando(true);
    try {
      const payload = {
        sede, fecha: hoy(), hora: hora(), tipo: '2h',
        usuario_email: user.nombre || user.email,
        observaciones: obs, ventas_siigo: Number(ventasSiigo) || 0,
      };
      DENOMS.forEach(d => payload['d' + d.valor] = Number(cant[d.valor] || 0));
      await api.guardarArqueo(payload);
      
      resetForms(); setVista('menu');
      setMsg('✅ Arqueo guardado');
      setTimeout(() => setMsg(''), 3000);
      
      recargarSilencioso();
    } catch (e) { setError(e.message); }
    finally { setGuardando(false); }
  }

  async function cerrarTurno() {
    if (guardando) return;
    const ventasNum = Number(ventas || 0);
    if (ventasNum < 0) { setError('Las ventas no pueden ser negativas'); return; }
    if (ventasNum > LIMITE_VENTAS) { setError(`Las ventas no pueden pasar de ${fmt(LIMITE_VENTAS)}.`); return; }
    if (totalContado === 0) { setError('Debes ingresar el arqueo'); return; }
    setGuardando(true); setError('');
    try {
      const arqueoPayload = {
        sede, fecha: hoy(), hora: hora(), tipo: 'cierre',
        usuario_email: user.nombre || user.email,
        observaciones: `Cierre turno ${turnoActivo}`, ventas_siigo: ventasNum,
      };
      DENOMS.forEach(d => arqueoPayload['d' + d.valor] = Number(cant[d.valor] || 0));
      await api.guardarArqueo(arqueoPayload);
      const r = await api.cerrarDia({
        sede, fecha: hoy(), turno: turnoActivo, ventas_siigo: ventasNum,
        usuario_email: user.nombre || user.email, observaciones: obs, hora: hora(),
      });
      setRes(r);

      const turnoIdActual = turnoActivo === 1 ? t1.apertura?.id : t2.apertura?.id;

      await api.cerrarTurno({
        sede, fecha: hoy(), turno: turnoActivo,
        hora: hora(), usuario: user.nombre || user.email,
        turno_id: turnoIdActual,
      });
      
      setVista('resultado');
    } catch (e) { setError(e.message); }
    finally { setGuardando(false); }
  }

  if (load) return <div className="loading">Cargando estado del día…</div>;

  return (
    <div>
      <h2>Registrar · {sede} · {hoy()}</h2>

      {msg && <p className="mensaje ok">{msg}</p>}

      {vista === 'menu' && (
        <>
          {recordatorio && tipoEstado === 'turnoActivo' && (
            <div className={`aviso-recordatorio ${recordatorio.urgente ? 'urgente' : ''}`}>
              <div className="aviso-icono">⏰</div>
              <div className="aviso-texto">
                <strong>Recuerda hacer arqueo</strong>
                <span>{recordatorio.mensaje}</span>
              </div>
              <button className="aviso-btn" onClick={() => { setVista('arqueo'); resetForms(); }}>
                💵 Hacer ahora
              </button>
            </div>
          )}

          {diaCerrado && (
            <div className="card-estado card-ok">
              <h3>✅ Día cerrado</h3>
              <p>Ambos turnos quedaron registrados. El día está completo.</p>
            </div>
          )}

          {!t1.apertura && (
            <div className="card-estado card-accion">
              <h3>🌅 Es hora de abrir el turno 1</h3>
              <p>Cuenta los billetes y monedas con los que arranca el día.</p>
              <button className="btn-guardar" disabled={guardando}
                onClick={() => { setTurnoActivo(1); resetForms(); setVista('abrir'); }}>
                🔓 Abrir turno 1
              </button>
            </div>
          )}

          {t1.apertura && !t1.cierre && estadoTurno && (
            <div className="card-estado card-activo">
              <h3>☀️ Turno 1 en curso</h3>
              <p>Abierto por <b>{estadoTurno.usuario}</b> a las {estadoTurno.horaApertura}</p>
              <EstadoTurno estado={estadoTurno} />
              <div className="grid-botones">
                <button disabled={guardando} onClick={() => { setVista('arqueo'); resetForms(); }}>💵 Arqueo parcial</button>
                <button disabled={guardando} onClick={() => { setVista('movimiento'); resetForms(); }}>💸 Movimiento</button>
                <button className="btn-acento" disabled={guardando}
                  onClick={() => { setTurnoActivo(1); resetForms(); setVista('cerrar'); }}>
                  🌙 Cerrar turno 1
                </button>
              </div>
            </div>
          )}

          {t1.cierre && !t2.apertura && (
            <div className="card-estado card-accion">
              <h3>🌇 Es hora de abrir el turno 2</h3>
              <p>Cuenta el efectivo que recibiste del turno 1. Debería ser: <b>{fmt(t1.cierre.contado)}</b></p>
              <button className="btn-guardar" disabled={guardando}
                onClick={() => { setTurnoActivo(2); resetForms(); setVista('abrir'); }}>
                🔓 Abrir turno 2
              </button>
            </div>
          )}

          {t2.apertura && !t2.cierre && estadoTurno && (
            <div className="card-estado card-activo">
              <h3>🌆 Turno 2 en curso</h3>
              <p>Abierto por <b>{estadoTurno.usuario}</b> a las {estadoTurno.horaApertura}</p>
              {Number(t2.apertura.diferencia_apertura) !== 0 && (
                <AlertaDiferencia monto={Number(t2.apertura.diferencia_apertura)} />
              )}
              <EstadoTurno estado={estadoTurno} />
              <div className="grid-botones">
                <button disabled={guardando} onClick={() => { setVista('arqueo'); resetForms(); }}>💵 Arqueo parcial</button>
                <button disabled={guardando} onClick={() => { setVista('movimiento'); resetForms(); }}>💸 Movimiento</button>
                <button className="btn-acento" disabled={guardando}
                  onClick={() => { setTurnoActivo(2); resetForms(); setVista('cerrar'); }}>
                  🌙 Cerrar turno 2 (fin del día)
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {vista === 'abrir' && (
        <>
          <h3>🔓 Abrir turno {turnoActivo}</h3>
          <p className="info">
            {turnoActivo === 1
              ? 'Cuenta los billetes y monedas con los que arranca el día.'
              : 'Cuenta el efectivo que recibiste del turno 1.'}
          </p>
          <div className="denom-grid">
            <div className="denom-col">
              <h3>💵 Billetes</h3>
              {DENOMS.filter(d => d.tipo === 'billete').map(d => (
                <DenomRow key={d.valor} valor={d.valor} cant={Number(cant[d.valor] || 0)}
                  onAjustar={ajustar} onSet={setValor} />
              ))}
            </div>
            <div className="denom-col">
              <h3>🪙 Monedas</h3>
              {DENOMS.filter(d => d.tipo === 'moneda').map(d => (
                <DenomRow key={d.valor} valor={d.valor} cant={Number(cant[d.valor] || 0)}
                  onAjustar={ajustar} onSet={setValor} />
              ))}
            </div>
          </div>
          <div className="total-box">
            <span className="total-label">TOTAL CONTADO</span>
            <span className="total-valor">{fmt(totalContado)}</span>
          </div>
          {error && <p className="err">{error}</p>}
          <div className="acciones-arqueo">
            <button className="btn-secundario" disabled={guardando} onClick={() => setVista('menu')}>← Volver</button>
            <button className="btn-guardar" onClick={abrirTurno} disabled={guardando}>
              {guardando ? '⏳ Abriendo… espera' : `✔ Abrir turno ${turnoActivo} con ${fmt(totalContado)}`}
            </button>
          </div>
        </>
      )}

      {vista === 'arqueo' && (
        <>
          <h3>💵 Arqueo parcial</h3>
          <p className="info">Cuenta rápida para verificar. No cierra el turno.</p>
          <div className="denom-grid">
            <div className="denom-col">
              <h3>💵 Billetes</h3>
              {DENOMS.filter(d => d.tipo === 'billete').map(d => (
                <DenomRow key={d.valor} valor={d.valor} cant={Number(cant[d.valor] || 0)}
                  onAjustar={ajustar} onSet={setValor} />
              ))}
            </div>
            <div className="denom-col">
              <h3>🪙 Monedas</h3>
              {DENOMS.filter(d => d.tipo === 'moneda').map(d => (
                <DenomRow key={d.valor} valor={d.valor} cant={Number(cant[d.valor] || 0)}
                  onAjustar={ajustar} onSet={setValor} />
              ))}
            </div>
          </div>
          <div className="total-box">
            <span className="total-label">TOTAL CONTADO</span>
            <span className="total-valor">{fmt(totalContado)}</span>
          </div>
          <label>Ventas en efectivo SIIGO acumuladas del turno</label>
          <input type="number" value={ventasSiigo}
            onChange={e => setVentasSiigo(e.target.value)} placeholder="0" />
          <p className="info" style={{ marginTop: 8 }}>
            Consulta en SIIGO el total de ventas en efectivo del turno y escríbelo aquí.
          </p>
          <label>Observaciones (opcional)</label>
          <textarea value={obs} onChange={e => setObs(e.target.value)} rows="2" />
          {error && <p className="err">{error}</p>}
          <div className="acciones-arqueo">
            <button className="btn-secundario" disabled={guardando} onClick={() => setVista('menu')}>← Volver</button>
            <button className="btn-guardar" onClick={guardarArqueo} disabled={guardando}>
              {guardando ? '⏳ Guardando… espera' : '💾 Guardar arqueo'}
            </button>
          </div>
        </>
      )}

      {vista === 'movimiento' && (
        <>
          <h3>💸 Movimiento de caja</h3>
          <p className="info">Todos los campos son obligatorios. Al guardar se pedirá tu PIN.</p>
          <label>Tipo de movimiento <span style={{ color: '#B4553F' }}>*</span></label>
          <select value={movTipo} onChange={e => setMovTipo(e.target.value)}>
            {TIPOS_MOV.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <label>Descripción <span style={{ color: '#B4553F' }}>*</span></label>
          <input value={movDesc} onChange={e => setMovDesc(e.target.value)}
            placeholder="Ej: Pago proveedor, venta especial" />
          <label>Valor <span style={{ color: '#B4553F' }}>*</span></label>
          <input type="number" value={movValor}
            onChange={e => setMovValor(e.target.value)} placeholder="0" />
          {movValor && Number(movValor) > 0 && (
            <p className="preview-valor">Se registrará: <b>{fmt(movValor)}</b></p>
          )}
          {error && <p className="err">{error}</p>}
          <div className="acciones-arqueo">
            <button className="btn-secundario" disabled={guardandoPin} onClick={() => setVista('menu')}>← Volver</button>
            <button className="btn-guardar" onClick={intentarGuardarMovimiento} disabled={guardandoPin}>
              💾 Guardar movimiento
            </button>
          </div>
        </>
      )}

      {vista === 'cerrar' && (
        <>
          <h3>🌙 Cerrar turno {turnoActivo}</h3>
          <p className="info">Cuenta el efectivo y las ventas SIIGO. Al confirmar, se guardan el arqueo y el cierre.</p>
          <div className="denom-grid">
            <div className="denom-col">
              <h3>💵 Billetes</h3>
              {DENOMS.filter(d => d.tipo === 'billete').map(d => (
                <DenomRow key={d.valor} valor={d.valor} cant={Number(cant[d.valor] || 0)}
                  onAjustar={ajustar} onSet={setValor} />
              ))}
            </div>
            <div className="denom-col">
              <h3>🪙 Monedas</h3>
              {DENOMS.filter(d => d.tipo === 'moneda').map(d => (
                <DenomRow key={d.valor} valor={d.valor} cant={Number(cant[d.valor] || 0)}
                  onAjustar={ajustar} onSet={setValor} />
              ))}
            </div>
          </div>
          <div className="total-box">
            <span className="total-label">TOTAL CONTADO</span>
            <span className="total-valor">{fmt(totalContado)}</span>
          </div>
          <label>Ventas en efectivo SIIGO (turno {turnoActivo})</label>
          <input type="number" value={ventas} onChange={e => setVentas(e.target.value)} placeholder="0" />
          <label>Observaciones (opcional)</label>
          <textarea value={obs} onChange={e => setObs(e.target.value)} rows="2" />
          {error && <p className="err">{error}</p>}
          <div className="acciones-arqueo">
            <button className="btn-secundario" disabled={guardando} onClick={() => setVista('menu')}>← Volver</button>
            <button className="btn-guardar" onClick={cerrarTurno} disabled={guardando}>
              {guardando ? '⏳ Cerrando… espera' : `🌙 Cerrar turno ${turnoActivo}`}
            </button>
          </div>
        </>
      )}

      {vista === 'resultado' && res && (
        <>
          <div className={`cierre ${res.estado}`}>
            <h3>📊 Resultado del turno {res.turno}</h3>
            <p><span>Saldo inicial</span><b>{fmt(res.saldo_inicial)}</b></p>
            <p><span>Ventas SIIGO</span><b>{fmt(res.ventas_siigo)}</b></p>
            <p><span>+ Ingresos</span><b>{fmt(res.total_ingresos)}</b></p>
            <p><span>− Egresos</span><b>{fmt(res.total_egresos)}</b></p>
            <p><span>− Fletes</span><b>{fmt(res.total_fletes)}</b></p>
            <p><span>− SPA</span><b>{fmt(res.total_spa)}</b></p>
            <p style={{ borderTop: '1px dashed rgba(0,0,0,0.2)', paddingTop: 8 }}>
              <span>Esperado</span><b>{fmt(res.esperado)}</b>
            </p>
            <p><span>Contado</span><b>{fmt(res.contado)}</b></p>
            <p><span>Diferencia</span><b>{fmt(res.diferencia)}</b></p>
            <p className="estado-cierre">
              {res.estado === 'cuadra' ? '🟢 Cuadra' : '🔴 Descuadre'}
            </p>
          </div>
          {res.estado === 'descuadre' && (
            <div className="info info-alerta">
              📧 <b>Descuadre registrado como "pendiente de revisión".</b>
              <br />El administrador recibió el aviso y puede revisarlo desde el Dashboard.
            </div>
          )}
          <div className="acciones-arqueo">
            <button className="btn-guardar"
              onClick={() => { resetForms(); setRes(null); setVista('menu'); recargarSilencioso(); }}>
              Volver al inicio
            </button>
          </div>
        </>
      )}

      {pinModalAbierto && (
        <div className="modal-overlay" onClick={cerrarPinModal}>
          <div className="modal-box modal-pin" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>🔐 Confirma con tu PIN</h3>
              <button className="modal-close" onClick={cerrarPinModal}>✕</button>
            </div>
            <div className="modal-body">
              <p className="info">Ingresa tu PIN para registrar el movimiento. Quedará guardado con tu nombre.</p>
              <div className="pin-display" style={{ margin: '20px 0' }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <span key={i} className={`dot ${i < pin.length ? 'lleno' : ''}`} />
                ))}
              </div>
              <div className="keypad">
                {['1','2','3','4','5','6','7','8','9','←','0','✓'].map(t => (
                  <button key={t} type="button"
                    onClick={() => {
                      if (t === '←') setPin(pin.slice(0, -1));
                      else if (t === '✓') confirmarPin();
                      else if (pin.length < 6) setPin(pin + t);
                    }}
                    disabled={guardandoPin}
                  >{t}</button>
                ))}
              </div>
              {pinError && <p className="err">{pinError}</p>}
              {guardandoPin && <p className="info">⏳ Validando PIN… espera</p>}
            </div>
          </div>
        </div>
      )}

      {pendientesModal && (
        <div className="modal-overlay">
          <div className="modal-box modal-pendientes" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>⚠️ Turno sin cerrar</h3>
            </div>
            <div className="modal-body">
              <p className="info">
                Antes de abrir un nuevo turno, ten en cuenta que hay
                {pendientesModal.pendientes.length === 1 ? ' un turno' : ` ${pendientesModal.pendientes.length} turnos`} sin cerrar:
              </p>
              <ul style={{ textAlign: 'left', margin: '12px 0', paddingLeft: 20 }}>
                {pendientesModal.pendientes.map(p => (
                  <li key={p.turno_id} style={{ marginBottom: 8 }}>
                    <b>Turno {p.turno}</b> del <b>{p.fecha}</b>
                    <br />
                    <small>
                      Abierto por {p.usuario_apertura} a las {p.hora_apertura}
                      <br />
                      ID: <code style={{ fontSize: 11 }}>{p.turno_id}</code>
                    </small>
                  </li>
                ))}
              </ul>
              <p className="info" style={{ fontSize: 13, color: '#B4553F' }}>
                Se notificará al administrador. Puedes continuar con la apertura normal.
              </p>
            </div>
            <div className="acciones-arqueo">
              <button className="btn-secundario" onClick={() => setPendientesModal(null)}>
                Cancelar
              </button>
              <button className="btn-guardar" onClick={continuarConPendiente} disabled={guardando}>
                {guardando ? '⏳ Abriendo…' : 'Continuar de todos modos'}
              </button>
            </div>
          </div>
        </div>
      )}

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
      <div className="estado-turno-titulo">📊 Estado en vivo del turno</div>
      <div className="estado-turno-body">
        <div className="estado-linea"><span>Saldo inicial (contado apertura)</span><b>{fmtLocal(estado.saldoInicial)}</b></div>
        <div className="estado-linea"><span>Ventas SIIGO {estado.tieneArqueoParcial ? '(último arqueo)' : '(sin arqueo aún)'}</span><b>+{fmtLocal(estado.ventasSiigoActual)}</b></div>
        <div className="estado-linea"><span>+ Ingresos</span><b>+{fmtLocal(estado.total_ingresos)}</b></div>
        <div className="estado-linea"><span>− Egresos</span><b>−{fmtLocal(estado.total_egresos)}</b></div>
        <div className="estado-linea"><span>− Fletes</span><b>−{fmtLocal(estado.total_fletes)}</b></div>
        <div className="estado-linea"><span>− SPA</span><b>−{fmtLocal(estado.total_spa)}</b></div>
        <div className="estado-linea estado-linea-total"><span>ESPERADO AHORA</span><b>{fmtLocal(estado.esperado)}</b></div>
        <div className="estado-linea">
          <span>{estado.tieneArqueoParcial ? `Último arqueo (${String(estado.ultimoArqueo.hora).replace("'", '').slice(0, 5)})` : 'Contado apertura'}</span>
          <b>{fmtLocal(estado.contadoActual)}</b>
        </div>
        <div className={`estado-linea estado-linea-dif ${clase}`}>
          <span>DIFERENCIA</span>
          <b>{cuadra ? '🟢 $0' : (diferencia < 0 ? '🔴 ' : '🟡 +') + fmtLocal(diferencia)}</b>
        </div>
      </div>
    </div>
  );
}

function AlertaDiferencia({ monto, referencia }) {
  const fmtLocal = n => '$' + Number(n || 0).toLocaleString('es-CO');
  const abs = Math.abs(monto);
  const falta = monto < 0;
  return (
    <div className={`alerta-recibo ${falta ? 'falta' : 'sobra'}`}>
      <strong>{falta ? '🔴 FALTA DINERO' : '🟡 SOBRA DINERO'}</strong>
      <span>{falta ? 'Faltan' : 'Sobran'} <b>{fmtLocal(abs)}</b>{referencia && <> respecto a: <b>{referencia}</b></>}</span>
      <small>{abs > 50000 ? '⚠️ Diferencia alta — notifica al administrador' : 'Registra una observación si es necesario'}</small>
    </div>
  );
}

function DenomRow({ valor, cant, onAjustar, onSet }) {
  const fmtLocal = n => '$' + Number(n || 0).toLocaleString('es-CO');
  return (
    <div className="denom-row">
      <span className="denom-valor">{fmtLocal(valor)}</span>
      <div className="denom-controls">
        <button type="button" className="btn-menos" onClick={() => onAjustar(valor, -1)}>−</button>
        <input type="number" min="0" value={cant || ''}
          onChange={e => onSet(valor, e.target.value)} placeholder="0" />
        <button type="button" className="btn-mas" onClick={() => onAjustar(valor, +1)}>+</button>
      </div>
      <span className="denom-total">{fmtLocal(cant * valor)}</span>
    </div>
  );
}