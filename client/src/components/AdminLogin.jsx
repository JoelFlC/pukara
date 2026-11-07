import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AvisoPermanente from './AvisoPermanente';
import { loginAdmin } from '../api/adminApi';

/**
 * Componente AdminLogin
 * Formulario accesible para el inicio de sesión del personal administrativo de PUKARA.
 *
 * @param {Object} props
 * @param {Function} props.alIniciarSesion Callback ejecutado tras autenticación exitosa
 */
export default function AdminLogin({ alIniciarSesion }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError({
        mensaje: 'Debe ingresar su correo electrónico y su contraseña.',
      });
      return;
    }

    try {
      setCargando(true);
      const res = await loginAdmin(email.trim(), password);
      if (alIniciarSesion) {
        alIniciarSesion(res.usuario);
      }
    } catch (err) {
      if (err.status === 429) {
        setError({
          codigo: 'DEMASIADOS_INTENTOS',
          mensaje:
            'Demasiados intentos fallidos de inicio de sesión. Por seguridad, el acceso se encuentra bloqueado temporalmente. Intente nuevamente en unos minutos.',
        });
      } else if (err.status === 401) {
        setError({
          codigo: 'CREDENCIALES_INVALIDAS',
          mensaje: 'Credenciales inválidas. Verifique su correo y contraseña.',
        });
      } else {
        setError({
          mensaje:
            err.message || 'Error al comunicarse con el servicio de autenticación.',
        });
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 text-slate-800 md:p-6 flex flex-col items-center justify-center">
      <main className="w-full max-w-md space-y-6 bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200">
        <header className="space-y-1.5 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white text-xl shadow-xs mb-2">
            🔐
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Acceso Administrativo
          </h1>
          <p className="text-xs text-slate-500">
            PUKARA · Monitoreo y Reglas de Demostración (Sector Llojeta)
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-900 space-y-1 shadow-xs"
          >
            <p className="font-semibold flex items-center gap-1.5">
              <span>⚠️</span> {error.codigo === 'DEMASIADOS_INTENTOS' ? 'Límite de Intentos Superado' : 'No se pudo iniciar sesión'}
            </p>
            <p className="text-red-800/90 leading-relaxed">{error.mensaje}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label
              htmlFor="admin-email"
              className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
            >
              Correo Institucional
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@pukara.bo"
              required
              autoComplete="email"
              disabled={cargando}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors disabled:bg-slate-50"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="admin-password"
              className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
            >
              Contraseña
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              autoComplete="current-password"
              disabled={cargando}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors disabled:bg-slate-50"
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full min-h-[44px] rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-slate-800 active:bg-slate-950 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {cargando ? (
              <>
                <span className="animate-spin inline-block" aria-hidden="true">
                  🔄
                </span>
                <span>Iniciando sesión...</span>
              </>
            ) : (
              <span>Iniciar Sesión</span>
            )}
          </button>
        </form>

        <AvisoPermanente />

        <footer className="text-center pt-2 border-t border-slate-100">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors py-1 px-2"
          >
            ← Volver a la Consulta Pública
          </Link>
        </footer>
      </main>
    </div>
  );
}

