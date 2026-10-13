import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Login({ onLogin }) {
  const [modo, setModo] = useState('cajero');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [admins, setAdmins] = useState([]);
  const [cargandoAdmins, setCargandoAdmins] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const agregar = d => {
    if (pin.length < (modo === 'admin' ? 6 : 4)) setPin(pin + d);
  };
  const borrar = () => setPin(pin.slice(0, -1));

  useEffect(() => {
    if (modo !== 'admin') return;
    setCargandoAdmins(true);
    api.getAdmins()
      .then(lista => setAdmins(lista || []))
      .catch(() => setAdmins([]))
      .finally(() => setCargandoAdmins(false));
  }, [modo]);

  useEffect(() => {
    function onKey(e) {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        agregar(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        borrar();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      } else if (e.key === 'Escape') {
        setModo('cajero');
        setPin('');
        setErr('');
        setEmail('');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pin, modo, email]);

  async function submit() {
    if (pin.length < (modo === 'admin' ? 6 : 4)) return;
    if (modo === 'admin' && !email) {
      setErr('Selecciona tu correo');
      return;
    }
    setErr(''); setLoading(true);
    try {
      const u = await api.login({ pin, email: modo === 'admin' ? email : '' });
      onLogin(u);
    } catch (e) {
      setErr(e.message);
      setPin('');
    } finally { setLoading(false); }
  }

  const teclas = ['1','2','3','4','5','6','7','8','9','←','0','✓'];

  return (
    <div className="login">
      <div className="login-admin-toggle">
        <button
          type="button"
          className={`admin-toggle-btn ${modo === 'admin' ? 'active' : ''}`}
          onClick={() => {
            setModo(modo === 'admin' ? 'cajero' : 'admin');
            setPin('');
            setErr('');
            setEmail('');
          }}
        >
          {modo === 'admin' ? '← Volver a cajero' : '🔑 Soy administrador'}
        </button>
      </div>

      <img src="/caja-mascotas/logo.png" alt="Zoona" className="login-logo" />
      <h1>Arqueos Zoona</h1>

      <p className="login-subtitle">
        {modo === 'cajero'
          ? 'Ingresa tu PIN de 4 dígitos'
          : 'Elige tu correo e ingresa tu PIN de 6 dígitos'}
      </p>

      {modo === 'admin' && (
        <select
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={cargandoAdmins}
          style={{ marginBottom: 12 }}
        >
          <option value="">
            {cargandoAdmins ? 'Cargando administradores…' : 'Selecciona tu correo'}
          </option>
          {admins.map(a => (
            <option key={a.email} value={a.email}>
              {a.nombre} ({a.rol})
            </option>
          ))}
        </select>
      )}

      <div className="pin-display">
        {Array.from({ length: modo === 'admin' ? 6 : 4 }).map((_, i) => (
          <span key={i} className={`dot ${i < pin.length ? 'lleno' : ''}`} />
        ))}
      </div>

      <div className="keypad">
        {teclas.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => t === '←' ? borrar() : t === '✓' ? submit() : agregar(t)}
            disabled={loading}
          >
            {t}
          </button>
        ))}
      </div>

      {err && <p className="err">{err}</p>}

      <p className="login-ayuda">
        💡 Puedes usar el <b>teclado físico</b>: números para el PIN, <b>Enter</b> para confirmar, <b>Backspace</b> para borrar.
      </p>
    </div>
  );
}