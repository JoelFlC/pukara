import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AvisoPermanente from '../components/AvisoPermanente';

export default function InicioPage() {
  const [salud, setSalud] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorConexion, setErrorConexion] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function verificarSaludAPI() {
      try {
        setCargando(true);
        const res = await fetch('/api/salud');
        if (!res.ok) {
          throw new Error(`Respuesta no satisfactoria: ${res.status}`);
        }
        const data = await res.json();
        if (!cancelado) {
          setSalud(data);
          setErrorConexion(false);
        }
      } catch (err) {
        if (!cancelado) {
          setErrorConexion(true);
          setSalud(null);
        }
      } finally {
        if (!cancelado) {
          setCargando(false);
        }
      }
    }

    verificarSaludAPI();

    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 flex flex-col items-center">
      <main className="w-full max-w-md space-y-5 bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200">
        {/* Encabezado principal */}
        <header className="space-y-1.5 border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider bg-slate-100 text-slate-600 uppercase">
              Monitoreo Informativo
            </span>
            <Link
              to="/admin"
              className="text-[11px] font-medium text-slate-400 hover:text-slate-700 transition-colors"
              title="Acceso administrativo"
            >
              Acceso Admin →
            </Link>
          </div>
          <h1 className="text-lg md:text-xl font-bold tracking-tight text-slate-900 leading-snug">
            PUKARA — Sector Llojeta / Bajo Llojeta (Prototipo Académico)
          </h1>
          <p className="text-xs text-slate-500">
            Sistema de consulta de condiciones de lluvias intensas y recomendaciones preventivas.
          </p>
        </header>

        {/* Indicador técnico de estado de la API */}
        <section
          aria-label="Estado de conexión con el backend"
          className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">Estado de API Local:</span>
            {cargando ? (
              <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium">
                <span className="h-2 w-2 rounded-full bg-slate-400 animate-pulse" />
                Verificando...
              </span>
            ) : errorConexion ? (
              <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Sin conexión con API local
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Conectado
              </span>
            )}
          </div>

          {salud && (
            <div className="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-200/60 font-mono">
              <p>Servicio: <span className="text-slate-700">{salud.servicio}</span></p>
              <p>Base de datos: <span className="text-slate-700">{salud.base_de_datos}</span></p>
              <p className="truncate">Sincronizado: <span className="text-slate-700">{new Date(salud.timestamp).toLocaleTimeString()}</span></p>
            </div>
          )}
        </section>

        {/* Sección de bienvenida informativa */}
        <section className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-xs text-blue-950 space-y-2">
          <h2 className="font-semibold text-blue-900 text-sm">
            Fase Base Inicial — Semana 1 Día 1
          </h2>
          <p className="text-blue-900/80 leading-relaxed">
            La estructura base del cliente mobile-first está conectada al backend monolítico. En las siguientes fases se integrarán los datos meteorológicos en tiempo real, el mapa referencial del sector Llojeta y el directorio de contactos preventivos.
          </p>
        </section>

        {/* Aviso permanente obligatorio */}
        <AvisoPermanente />
      </main>
    </div>
  );
}
