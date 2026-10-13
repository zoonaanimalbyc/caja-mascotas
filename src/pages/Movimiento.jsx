import { useState } from 'react';
import { api } from '../api';
import { TIPOS_MOV } from '../config';

const hoy = () => new Date().toISOString().slice(0, 10);
const hora = () => new Date().toTimeString().slice(0, 5);
const fmt = n => '$' + Number(n || 0).toLocaleString('es-CO');

export default function Movimiento({ sede, user }) {
  const [tipo, setTipo] = useState('EGRESO');
  const [descripcion, setDesc] = useState('');
  const [valor, setValor] = useState('');
  const [responsable, setResp] = useState('');
  const [msg, setMsg] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
  if (!valor || Number(valor) <= 0) {
    setMsg('❌ Debes ingresar un valor mayor a 0');
    return;
  }
  if (guardando) return;
  setGuardando(true);
  setMsg('Guardando…');

  // Timeout de seguridad: si en 15s no hay respuesta, avisa
  const timeout = setTimeout(() => {
    if (guardando) {
      setGuardando(false);
      setMsg('⚠️ El servidor tardó demasiado, pero puede haberse guardado. Revisa la pestaña "Hoy" antes de reintentar.');
    }
  }, 15000);

  try {
    await api.guardarMovimiento({
      sede, fecha: hoy(), hora: hora(), tipo, descripcion,
      valor: Number(valor), responsable,
      usuario_email: user.email || user.nombre,
    });
    clearTimeout(timeout);
    setMsg('✅ Movimiento guardado');
    setDesc(''); setValor(''); setResp('');
    setTimeout(() => setMsg(''), 3000);
  } catch (e) {
    clearTimeout(timeout);
    setMsg('❌ ' + e.message);
  } finally {
    clearTimeout(timeout);
    setGuardando(false);
  }
}

  return (
    <div>
      <h2>Movimiento de caja · {sede}</h2>

      <div className="tipo-mov-grid">
        {TIPOS_MOV.map(t => (
          <button
            key={t.id}
            type="button"
            className={`tipo-mov-btn ${tipo === t.id ? 'active' : ''}`}
            onClick={() => setTipo(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <details className="section" open>
        <summary>📋 Detalles del movimiento</summary>
        <div className="section-body">
          <label>Descripción</label>
          <input
            value={descripcion}
            onChange={e => setDesc(e.target.value)}
            placeholder="Ej: Pago proveedor, venta especial, etc."
          />

          <label>Valor</label>
          <input
            type="number"
            min="0"
            value={valor}
            onChange={e => setValor(e.target.value)}
            placeholder="0"
          />
          {valor && Number(valor) > 0 && (
            <p className="preview-valor">Se registrará: <b>{fmt(valor)}</b></p>
          )}

          <label>Responsable</label>
          <input
            value={responsable}
            onChange={e => setResp(e.target.value)}
            placeholder="Ej: Cristian"
          />
        </div>
      </details>

      <div className="acciones-arqueo">
        <button type="button" className="btn-guardar" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando...' : '💾 Guardar movimiento'}
        </button>
      </div>

      {msg && <p className={`mensaje ${msg.startsWith('✅') ? 'ok' : 'err'}`}>{msg}</p>}
    </div>
  );
}