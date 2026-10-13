import { useEffect, useState } from 'react';
import { api } from '../api';
import { DENOMS } from '../config';

const hoy = () => new Date().toISOString().slice(0, 10);
const hora = () => new Date().toTimeString().slice(0, 5);
const fmt = n => '$' + Number(n || 0).toLocaleString('es-CO');

export default function Arqueo({ sede, user }) {
  const [tipo, setTipo] = useState('apertura');
  const [cant, setCant] = useState({});
  const [saldoIni, setSaldoIni] = useState(null);
  const [obs, setObs] = useState('');
  const [msg, setMsg] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.getSaldoInicial(sede, hoy()).then(setSaldoIni).catch(() => {});
  }, [sede]);

  const total = DENOMS.reduce((a, d) => a + (Number(cant[d.valor] || 0) * d.valor), 0);

  const billetes = DENOMS.filter(d => d.tipo === 'billete');
  const monedas = DENOMS.filter(d => d.tipo === 'moneda');

  const ajustar = (valor, delta) => {
    const actual = Number(cant[valor] || 0);
    const nuevo = Math.max(0, actual + delta);
    setCant({ ...cant, [valor]: nuevo });
  };

  const setValor = (valor, v) => {
    const n = Math.max(0, Number(v) || 0);
    setCant({ ...cant, [valor]: n });
  };

  const limpiar = () => {
    if (!Object.values(cant).some(v => Number(v) > 0)) return;
    if (!confirm('¿Borrar todas las cantidades ingresadas?')) return;
    setCant({});
  };

 async function guardar() {
  if (guardando) return;
  setGuardando(true);
  setMsg('');
  try {
    const payload = {
      sede, fecha: hoy(), hora: hora(), tipo,
      usuario_email: user.email || user.nombre,
      observaciones: obs,
    };
    DENOMS.forEach(d => payload['d' + d.valor] = Number(cant[d.valor] || 0));
    await api.guardarArqueo(payload);
    setMsg('✅ Arqueo guardado correctamente');
    setCant({});
    setObs('');
    // 👇 Redirige a "Hoy" después de 1.2 segundos
    setTimeout(() => {
      window.location.href = '#/';
    }, 1200);
  } catch (e) {
    setMsg('❌ ' + e.message);
    setGuardando(false);
  }
}

  return (
    <div>
      <h2>Arqueo · {sede}</h2>

      {saldoIni && saldoIni.origen !== 'sin_historial' && (
        <p className="info">
          Saldo inicial esperado: <b>{fmt(saldoIni.saldo_inicial)}</b>
          <small> (cierre del {saldoIni.origen})</small>
        </p>
      )}
      {saldoIni && saldoIni.origen === 'sin_historial' && (
        <p className="info">
          Primer arqueo del sistema — no hay cierre previo. El saldo inicial es <b>$0</b>.
        </p>
      )}

      <div className="row">
        <label>Tipo:</label>
        <div className="tipo-selector">
          {[
            { id: 'apertura', label: '🌅 Apertura' },
            { id: '2h',       label: '⏰ Cada 2h' },
            { id: 'cierre',   label: '🌙 Cierre' },
          ].map(t => (
            <button
              key={t.id}
              type="button"
              className={`tipo-btn ${tipo === t.id ? 'active' : ''}`}
              onClick={() => setTipo(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="hora-actual">🕐 {hora()}</span>
      </div>

      <div className="denom-grid">
        <div className="denom-col">
          <h3>💵 Billetes</h3>
          {billetes.map(d => (
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
          {monedas.map(d => (
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
        <span className="total-valor">{fmt(total)}</span>
      </div>

      <details className="section">
        <summary>📝 Observaciones (opcional)</summary>
        <div className="section-body">
          <textarea
            value={obs}
            onChange={e => setObs(e.target.value)}
            placeholder="Ej: billetes arrugados, monedas faltantes, etc."
            rows="3"
          />
        </div>
      </details>

      <div className="acciones-arqueo">
        <button type="button" className="btn-secundario" onClick={limpiar}>
          🗑 Limpiar
        </button>
        <button type="button" className="btn-guardar" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando...' : '💾 Guardar arqueo'}
        </button>
      </div>

      {msg && <p className={`mensaje ${msg.startsWith('✅') ? 'ok' : 'err'}`}>{msg}</p>}
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