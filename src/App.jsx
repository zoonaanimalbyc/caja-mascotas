import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Hoy from './pages/Hoy';
import Operar from './pages/Operar';
import Historial from './pages/Historial';
import Dashboard from './pages/Dashboard';
import { api } from './api';
import { detectarSede } from './utils/geo';

const hoyStr = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const [sede, setSede] = useState(() => localStorage.getItem('sede') || 'Retiro');
  const [geoStatus, setGeoStatus] = useState(null);
  const [bloqueoSede, setBloqueoSede] = useState(null);
  const [cambiando, setCambiando] = useState(false);
  const nav = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(user));
    else localStorage.removeItem('user');
  }, [user]);

  useEffect(() => { localStorage.setItem('sede', sede); }, [sede]);

  useEffect(() => {
    if (!user) return;
    setGeoStatus('detectando');
    detectarSede()
      .then(res => {
        if (res.ok) { setSede(res.sede); setGeoStatus('ok'); }
        else setGeoStatus('manual');
      })
      .catch(() => setGeoStatus('manual'));
  }, [user]);

  async function verificarSedeBloqueada(sedeActual) {
    try {
      const estado = await api.getEstadoTurnos({ sede: sedeActual, fecha: hoyStr() });
      const abierto =
        (estado.turno1 && estado.turno1.apertura && !estado.turno1.cierre) ||
        (estado.turno2 && estado.turno2.apertura && !estado.turno2.cierre);
      if (abierto) {
        return { sede: sedeActual, motivo: 'Turno abierto en ' + sedeActual };
      }
      return null;
    } catch (e) {
      console.error('Error verificando bloqueo:', e);
      return null;
    }
  }

  useEffect(() => {
    if (!user) return;
    verificarSedeBloqueada(sede).then(r => setBloqueoSede(r));
  }, [sede, user]);

  async function intentarCambiarSede(nuevaSede) {
    if (nuevaSede === sede) return;
    setCambiando(true);
    const bloqueo = await verificarSedeBloqueada(sede);
    setCambiando(false);
    if (bloqueo) {
      setBloqueoSede(bloqueo);
      alert('⚠️ Tienes un turno abierto en ' + sede + '. Ciérralo antes de cambiar de sede.');
      return;
    }
    setSede(nuevaSede);
    setGeoStatus('manual');
  }

  if (!user) return <Login onLogin={setUser} />;

   const tabClass = (path) => {
   let activo;
   if (path === '/registrar') activo = location.pathname === '/' || location.pathname.startsWith('/registrar');
   else activo = location.pathname.startsWith(path);
   return `tab-link ${activo ? 'tab-active' : ''}`;
}

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/caja-mascotas/logo.png" alt="Zoona" className="brand-logo" />
          <span>Arqueos Zoona</span>
        </div>

        <select
          value={sede}
          onChange={e => intentarCambiarSede(e.target.value)}
          disabled={cambiando}
          title={bloqueoSede ? 'Bloqueado: turno abierto' : ''}
        >
          <option>Palmas</option>
          <option>Retiro</option>
        </select>

        {bloqueoSede && (
          <span className="geo-badge geo-bloqueo" title={bloqueoSede.motivo}>
            🔒 Turno abierto
          </span>
        )}

        {geoStatus === 'detectando' && <span className="geo-badge geo-detectando">📍 Detectando sede…</span>}
        {geoStatus === 'ok' && <span className="geo-badge geo-ok">📍 Ubicación confirmada</span>}
        {geoStatus === 'manual' && <span className="geo-badge geo-manual">📍 Selección manual</span>}

        <div className="user">
          {user.nombre} · {(user.roles || [user.rol || '']).join(', ')}
          <button onClick={() => { setUser(null); setGeoStatus(null); setBloqueoSede(null); nav('/'); }}>Salir</button>
        </div>
      </header>

      <nav className="tabs">
        <Link to="/hoy" className={tabClass('/hoy')}>🏠 Hoy</Link>
        <Link to="/registrar" className={tabClass('/registrar')}>⭐ Registrar</Link>
        <Link to="/historial" className={tabClass('/historial')}>📜 Historial</Link>
        <Link to="/dashboard" className={tabClass('/dashboard')}>📊 Dashboard</Link>
      </nav>

      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/registrar" replace />} />
          <Route path="/hoy" element={<Hoy sede={sede} user={user} />} />
          <Route path="/registrar"  element={<Operar sede={sede} user={user} />} />
          <Route path="/historial"  element={<Historial sede={sede} user={user} />} />
          <Route path="/dashboard"  element={<Dashboard sede={sede} user={user} />} />
          <Route path="/operar"     element={<Navigate to="/registrar" replace />} />
          <Route path="*"           element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}