import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AvisoPermanente from './AvisoPermanente';
import { loginAdmin } from '../api/adminApi';

/**
 * Componente AdminLogin
 * Formulario accesible, estilizado y refinado para el acceso administrativo institucional de PUKARA.
 *
 * @param {Object} props
 * @param {Function} props.alIniciarSesion Callback ejecutado tras autenticación exitosa
 */
export default function AdminLogin({ alIniciarSesion }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
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

  const autocompletarDemo = () => {
    setEmail('admin@pukara.bo');
    setPassword('PukaraAdmin2026!');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] p-4 text-slate-800 md:p-6 flex flex-col items-center justify-center">
      <main className="w-full max-w-md space-y-6 bg-white p-7 sm:p-8 rounded-3xl shadow-md border border-slate-200/80">
        {/* Encabezado Institucional */}
        <header className="space-y-2 text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-[#0F172A] text-teal-400 flex items-center justify-center shadow-xs">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-900" aria-hidden="true" />
            Consola de Gestión y Reglas
          </span>

          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Acceso Administrativo
          </h1>
          <p className="text-xs text-slate-500 leading-snug">
            PUKARA · Monitoreo y Configuración de Reglas (Sector Llojeta)
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-900 space-y-1 shadow-2xs"
          >
            <p className="font-semibold flex items-center gap-1.5">
              <span>⚠️</span>{' '}
              {error.codigo === 'DEMASIADOS_INTENTOS'
                ? 'Límite de Intentos Superado'
                : 'No se pudo iniciar sesión'}
            </p>
            <p className="text-red-800/90 leading-relaxed">{error.mensaje}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Campo Email */}
          <div className="space-y-1.5">
            <label
              htmlFor="admin-email"
              className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
            >
              Correo Institucional
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">
                @
              </span>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@pukara.bo"
                required
                autoComplete="email"
                disabled={cargando}
                className="w-full rounded-xl border border-slate-300 bg-slate-50/80 pl-9 pr-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors disabled:bg-slate-100"
              />
            </div>
          </div>

          {/* Campo Contraseña */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >
                Contraseña
              </label>
              <button
                type="button"
                onClick={() => setMostrarPassword(!mostrarPassword)}
                className="text-[11px] text-slate-500 hover:text-slate-800 transition-colors font-medium"
              >
                {mostrarPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">
                🔒
              </span>
              <input
                id="admin-password"
                type={mostrarPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete="current-password"
                disabled={cargando}
                className="w-full rounded-xl border border-slate-300 bg-slate-50/80 pl-9 pr-10 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors disabled:bg-slate-100 font-mono"
              />
            </div>
          </div>

          {/* Botón de Autocompletado Rápido para Defensa Académica */}
          <button
            type="button"
            onClick={autocompletarDemo}
            className="w-full text-center text-[11px] text-slate-500 hover:text-slate-900 bg-slate-100/70 hover:bg-slate-100 border border-slate-200 py-1.5 px-3 rounded-lg transition-colors cursor-pointer"
          >
            💡 Autocompletar credenciales de demostración (admin@pukara.bo)
          </button>

          {/* Botón Principal */}
          <button
            type="submit"
            disabled={cargando}
            className="w-full min-h-[44px] rounded-xl bg-[#0F172A] px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-slate-800 active:bg-slate-950 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {cargando ? (
              <>
                <span className="animate-spin inline-block" aria-hidden="true">
                  🔄
                </span>
                <span>Iniciando sesión...</span>
              </>
            ) : (
              <span>Iniciar Sesión Institucional</span>
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
