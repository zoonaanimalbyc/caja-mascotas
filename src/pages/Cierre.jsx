import { useEffect, useState } from 'react';
import { api } from '../api';
import { DENOMS } from '../config';

const hoy = () => new Date().toISOString().slice(0, 10);
const hora = () => new Date().toTimeString().slice(0, 5);
const fmt = n => '$' + Number(n || 0).toLocaleString('es-CO');

const LIMITE_VENTAS = 50000000;

export default function Cierre({ sede, user }) {
  const [estado, setEstado] = useState(null);
  const [load, setLoad] = useState(true);
  const [fase, setFase] = useState('inicio');
  const [turnoActivo, setTurnoActivo] = useState(null);
  const [cant, setCant] = useState({});
  const [contadoApertura, setContadoApertura] = useState('');
  const [ventas, setVentas] = useState('');
  const [obs, setObs] = useState('');
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function recargar() {
    setLoad(true);
    try {
      const e = await api.getEstadoTurnos({ sede, fecha: hoy() });
      setEstado(e);
    } catch (err) {
      console.error(err);
    } finally {
      setLoad(false);
    }
  }

  useEffect(() => { recargar(); }, [sede]);

  // -------- ABRIR TURNO --------
  function iniciarApertura(turno) {
    setTurnoActivo(turno);
    setFase('abrirTurno');
    setContadoApertura('');
    setError('');
  }

  async function confirmarApertura() {
    if (!contadoApertura || Number(contadoApertura) < 0) {
      setError('Ingresa un valor válido');
      return;
    }
    setGuardando(true);
    try {
      await api.abrirTurno({
        sede, fecha: hoy(), turno: turnoActivo,
        hora: hora(),
        usuario: user.nombre || user.email,
        contado: Number(contadoApertura),
        observaciones: '',
      });
      setFase('inicio');
      await recargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  // -------- CERRAR TURNO --------
  function iniciarCierre(turno) {
    setTurnoActivo(turno);
    setFase('cerrarTurno');
    setCant({});
    setVentas('');
    setObs('');
    setRes(null);
    setError('');
  }

  const totalContado = DENOMS.reduce((a, d) => a + (Number(cant[d.valor] || 0) * d.valor), 0);

  const ajustar = (valor, delta) => {
    const actual = Number(cant[valor] || 0);
    const nuevo = Math.max(0, actual + delta);
    setCant({ ...cant, [valor]: nuevo });
  };

  const setValor = (valor, v) => {
    const n = Math.max(0, Number(v) || 0);
    setCant({ ...cant, [valor]: n });
  };

  async function ejecutarCierre() {
    const ventasNum = Number(ventas || 0);
    if (ventasNum < 0) { setError('Las ventas no pueden ser negativas'); return; }
    if (ventasNum > LIMITE_VENTAS) {
      setError(`Las ventas no pueden pasar de ${fmt(LIMITE_VENTAS)}.`);
      return;
    }
    if (totalContado === 0) {
      setError('Debes ingresar al menos una cantidad en el arqueo');
      return;
    }
    setGuardando(true);
    setError('');

    try {
      // 1. Guardar arqueo de cierre
      const arqueoPayload = {
        sede, fecha: hoy(), hora: hora(), tipo: 'cierre',
        usuario_email: user.nombre || user.email,
        observaciones: `Arqueo de cierre turno ${turnoActivo}`,
      };
      DENOMS.forEach(d => arqueoPayload['d' + d.valor] = Number(cant[d.valor] || 0));
      await api.guardarArqueo(arqueoPayload);

      // 2. Guardar cierre del turno
      const r = await api.cerrarDia({
        sede, fecha: hoy(),
        turno: turnoActivo,
        ventas_siigo: ventasNum,
        usuario_email: user.nombre || user.email,
        observaciones: obs,
        hora: hora(),
      });
      setRes(r);

      // 3. Marcar turno como cerrado
      await api.cerrarTurno({
        sede, fecha: hoy(),
        turno: turnoActivo,
        hora: hora(),
        usuario: user.nombre || user.email,
      });

      setFase('resultado');
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  if (load) return <div className="loading">Cargando estado del día…</div>;

  return (
    <div>
      <h2>Cierre del día · {sede} · {hoy()}</h2>

      {fase === 'inicio' && estado && (
        <>
          {/* TURNO 1 */}
          <div className="turno-card">
            <h3>🌅 Turno 1 (mañana)</h3>

            {!estado.turno1.apertura && (
              <>
                <p className="info">Aún no has abierto el turno 1.</p>
                <button className="btn-guardar" onClick={() => iniciarApertura(1)} disabled={guardando}>
                  🔓 Abrir turno 1
                </button>
              </>
            )}

            {estado.turno1.apertura && !estado.turno1.cierre && (
              <>
                <p className="info">
                  Abierto por <b>{estado.turno1.apertura.usuario_apertura}</b> a las {String(estado.turno1.apertura.hora_apertura).replace("'", "")}
                  <br />Saldo inicial: <b>{fmt(estado.turno1.apertura.saldo_inicial)}</b>
                </p>
                <button className="btn-guardar" onClick={() => iniciarCierre(1)} disabled={guardando}>
                  🌙 Cerrar turno 1
                </button>
              </>
            )}

            {estado.turno1.cierre && (
              <div className={`cierre ${estado.turno1.cierre.estado}`}>
                <p><span>Estado</span><b>{estado.turno1.cierre.estado === 'cuadra' ? '🟢 Cuadra' : '🔴 Descuadre'}</b></p>
                <p><span>Contado</span><b>{fmt(estado.turno1.cierre.contado)}</b></p>
                <p><span>Diferencia</span><b>{fmt(estado.turno1.cierre.diferencia)}</b></p>
                <p><span>Cerrado por</span><b>{estado.turno1.cierre.usuario_email}</b></p>
              </div>
            )}
          </div>

          {/* TURNO 2 */}
          <div className="turno-card">
            <h3>🌇 Turno 2 (tarde)</h3>

            {!estado.turno1.cierre && (
              <p className="tabla-vacia">Primero debes cerrar el turno 1.</p>
            )}

            {estado.turno1.cierre && !estado.turno2.apertura && (
              <>
                <p className="info">Recibe el efectivo que dejó el turno 1.</p>
                <button className="btn-guardar" onClick={() => iniciarApertura(2)} disabled={guardando}>
                  🔓 Abrir turno 2
                </button>
              </>
            )}

            {estado.turno2.apertura && !estado.turno2.cierre && (
              <>
                <p className="info">
                  Abierto por <b>{estado.turno2.apertura.usuario_apertura}</b> a las {String(estado.turno2.apertura.hora_apertura).replace("'", "")}
                  <br />Saldo inicial: <b>{fmt(estado.turno2.apertura.saldo_inicial)}</b>
                  {Number(estado.turno2.apertura.diferencia_apertura) !== 0 && (
                    <><br />⚠️ Diferencia al recibir: <b>{fmt(estado.turno2.apertura.diferencia_apertura)}</b></>
                  )}
                </p>
                <button className="btn-guardar" onClick={() => iniciarCierre(2)} disabled={guardando}>
                  🌙 Cerrar turno 2 (= fin del día)
                </button>
              </>
            )}

            {estado.turno2.cierre && (
              <div className={`cierre ${estado.turno2.cierre.estado}`}>
                <p><span>Estado</span><b>{estado.turno2.cierre.estado === 'cuadra' ? '🟢 Cuadra' : '🔴 Descuadre'}</b></p>
                <p><span>Contado</span><b>{fmt(estado.turno2.cierre.contado)}</b></p>
                <p><span>Diferencia</span><b>{fmt(estado.turno2.cierre.diferencia)}</b></p>
                <p className="estado-cierre">✅ Día cerrado completamente.</p>
              </div>
            )}
          </div>
        </>
      )}

      {fase === 'abrirTurno' && (
        <>
          <h3>🔓 Abrir turno {turnoActivo}</h3>
          <p className="info">
            Ingresa el efectivo con el que <b>arrancas</b> este turno.
            {turnoActivo === 1 && ' Para el turno 1, es el saldo del cierre del día anterior.'}
            {turnoActivo === 2 && ' Para el turno 2, es lo que dejó el turno 1.'}
          </p>

          <label>Efectivo inicial (contado)</label>
          <input
            type="number"
            value={contadoApertura}
            onChange={e => setContadoApertura(e.target.value)}
            placeholder="0"
          />
          {contadoApertura && <p className="preview-valor">Se registrará: <b>{fmt(contadoApertura)}</b></p>}

          {error && <p className="err">{error}</p>}

          <div className="acciones-arqueo">
            <button className="btn-secundario" onClick={() => setFase('inicio')}>← Volver</button>
            <button className="btn-guardar" onClick={confirmarApertura} disabled={guardando}>
              {guardando ? 'Abriendo…' : '✔ Confirmar apertura'}
            </button>
          </div>
        </>
      )}

      {fase === 'cerrarTurno' && (
        <>
          <h3>🌙 Cerrar turno {turnoActivo}</h3>

          <p className="info">
            Cuenta el efectivo y luego ingresa las ventas SIIGO. Al confirmar, se guardan el arqueo y el cierre del turno.
          </p>

          <div className="denom-grid">
            <div className="denom-col">
              <h3>💵 Billetes</h3>
              {DENOMS.filter(d => d.tipo === 'billete').map(d => (
                <DenomRow
                  key={d.valor}
                  valor={d.valor}
                  cant={Number(cant[d.valor] || 0)}
                  onAjustar={ajustar}
                  onSet={setValor}
                />
              ))}
            </div>
            <div className="denom-col">
              <h3>🪙 Monedas</h3>
              {DENOMS.filter(d => d.tipo === 'moneda').map(d => (
                <DenomRow
                  key={d.valor}
                  valor={d.valor}
                  cant={Number(cant[d.valor] || 0)}
                  onAjustar={ajustar}
                  onSet={setValor}
                />
              ))}
            </div>
          </div>

          <div className="total-box">
            <span className="total-label">TOTAL CONTADO</span>
            <span className="total-valor">{fmt(totalContado)}</span>
          </div>

          <label>Ventas en efectivo SIIGO (turno {turnoActivo})</label>
          <input
            type="number"
            value={ventas}
            onChange={e => setVentas(e.target.value)}
            placeholder="0"
          />

          <label>Observaciones</label>
          <textarea value={obs} onChange={e => setObs(e.target.value)} rows="2" />

          {error && <p className="err">{error}</p>}

          <div className="acciones-arqueo">
            <button className="btn-secundario" onClick={() => setFase('inicio')}>← Volver</button>
            <button className="btn-guardar" onClick={ejecutarCierre} disabled={guardando}>
              {guardando ? 'Cerrando…' : `🌙 Cerrar turno ${turnoActivo}`}
            </button>
          </div>
        </>
      )}

      {fase === 'resultado' && res && (
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

          <div className="acciones-arqueo">
            <button className="btn-guardar" onClick={() => { setFase('inicio'); setRes(null); }}>
              Volver al inicio
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function DenomRow({ valor, cant, onAjustar, onSet }) {
  const fmt = n => '$' + Number(n || 0).toLocaleString('es-CO');
  return (
    <div className="denom-row">
      <span className="denom-valor">{fmt(valor)}</span>
      <div className="denom-controls">
        <button type="button" className="btn-menos" onClick={() => onAjustar(valor, -1)}>−</button>
        <input
          type="number"
          min="0"
          value={cant || ''}
          onChange={e => onSet(valor, e.target.value)}
          placeholder="0"
        />
        <button type="button" className="btn-mas" onClick={() => onAjustar(valor, +1)}>+</button>
      </div>
      <span className="denom-total">{fmt(cant * valor)}</span>
    </div>
  );
}