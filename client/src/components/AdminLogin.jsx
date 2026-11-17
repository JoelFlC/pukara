import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AvisoPermanente from './AvisoPermanente';
import { loginAdmin } from '../api/adminApi';

/**
 * Componente AdminLogin
 * Formulario accesible Swiss Grid + Claymorphism para el acceso administrativo institucional de PUKARA.
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
    <div className="min-h-screen bg-[#F6F8FA] p-4 text-[#111C2D] sm:p-6 flex flex-col items-center justify-center overflow-x-hidden max-w-full">
      <main className="clay-card w-full max-w-md space-y-6 p-6 sm:p-8 animate-fade-up">
        {/* Encabezado Institucional */}
        <header className="space-y-2.5 text-center flex flex-col items-center">
          <div className="flex items-center justify-center gap-3.5">
            <img
              src="/logo.png"
              alt="Logo PUKARA"
              className="w-16 h-16 object-contain shrink-0 select-none"
            />
            <img
              src="/pukara.png"
              alt="PUKARA"
              className="h-8 w-auto object-contain select-none"
            />
          </div>

          <span className="clay-pill inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-[#EEF2FF] text-[#3525CD] border border-[#E2DFFF]">
            <span className="h-2 w-2 rounded-full bg-[#3525CD]" aria-hidden="true" />
            Consola de Gestión y Reglas
          </span>

          <h1 className="headline-md text-2xl font-extrabold tracking-tight text-[#111C2D]">
            Acceso Administrativo
          </h1>
          <p className="text-sm sm:text-base text-[#464555] leading-snug">
            PUKARA · Monitoreo y Configuración de Reglas (Sector Llojeta)
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="clay-card-sm border border-[#FECACA] bg-[#FEE2E2] p-4 text-sm sm:text-base text-[#991B1B] space-y-1"
          >
            <p className="font-bold flex items-center gap-1.5">
              <span aria-hidden="true">⚠️</span>{' '}
              {error.codigo === 'DEMASIADOS_INTENTOS'
                ? 'Límite de Intentos Superado'
                : 'No se pudo iniciar sesión'}
            </p>
            <p className="leading-relaxed">{error.mensaje}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Campo Email */}
          <div className="space-y-1.5">
            <label
              htmlFor="admin-email"
              className="block text-sm sm:text-base font-bold text-[#111C2D]"
            >
              Correo Institucional
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#475569] text-base font-bold">
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
                className="clay-input w-full pl-10 pr-4 py-2.5 text-base placeholder-slate-400 disabled:bg-slate-100"
              />
            </div>
          </div>

          {/* Campo Contraseña */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="admin-password"
                className="block text-sm sm:text-base font-bold text-[#111C2D]"
              >
                Contraseña
              </label>
              <button
                type="button"
                onClick={() => setMostrarPassword(!mostrarPassword)}
                className="min-h-[36px] px-2 text-sm text-[#3525CD] hover:text-[#4F46E5] transition-colors font-bold cursor-pointer"
              >
                {mostrarPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#475569] text-base">
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
                className="clay-input w-full pl-10 pr-4 py-2.5 text-base placeholder-slate-400 disabled:bg-slate-100 font-mono"
              />
            </div>
          </div>

          {/* Botón de Autocompletado Rápido para Defensa Académica */}
          <button
            type="button"
            onClick={autocompletarDemo}
            className="clay-btn-secondary clay-interactive min-h-[48px] w-full text-center text-sm font-bold text-[#464555] px-4 py-2 cursor-pointer"
          >
            💡 Autocompletar credenciales de demostración (admin@pukara.bo)
          </button>

          {/* Botón Principal */}
          <button
            type="submit"
            disabled={cargando}
            className="clay-btn-primary clay-interactive w-full min-h-[52px] px-5 py-3 text-base font-bold disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
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
            className="min-h-[48px] inline-flex items-center justify-center gap-2 text-sm sm:text-base font-bold text-[#3525CD] hover:text-[#4F46E5] transition-colors px-4 py-2 rounded-full hover:bg-[#EEF2FF]"
          >
            ← Volver a la Consulta Pública
          </Link>
        </footer>
      </main>
    </div>
  );
}
