import React from 'react';
import { Link } from 'react-router-dom';
import AvisoPermanente from '../components/AvisoPermanente';

export default function AdminPlaceholderPage() {
  return (
    <div className="min-h-screen bg-slate-100 p-4 text-slate-800 md:p-6 flex flex-col items-center">
      <main className="w-full max-w-md space-y-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <header className="space-y-1 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 mb-2">
            🔒
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Panel de Administración
          </h1>
          <p className="text-xs text-slate-500">
            PUKARA — Sector Llojeta (Prototipo Académico)
          </p>
        </header>

        <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center space-y-2">
          <p className="text-sm font-medium text-slate-700">
            Módulo en Construcción
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            El panel administrativo protegido con autenticación JWT, gestión de versiones de umbrales, recomendaciones y modo simulación se habilitará en el <strong>Módulo 5</strong> del cronograma.
          </p>
        </section>

        <AvisoPermanente />

        <div className="pt-2 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 underline underline-offset-4 transition-colors"
          >
            ← Volver a la Vista Principal
          </Link>
        </div>
      </main>
    </div>
  );
}
