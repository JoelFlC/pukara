/**
 * @file verificarDespliegue.js
 * @description Script de inspección y prueba de humo (smoke test) para certificar en vivo
 * la Puerta de Calidad de la Semana 1, tanto en entorno local como en despliegue remoto (Render/Railway).
 *
 * Uso:
 *   node src/scripts/verificarDespliegue.js [URL_BASE]
 * Ejemplo:
 *   node src/scripts/verificarDespliegue.js https://pukara-api.onrender.com
 *   node src/scripts/verificarDespliegue.js (por defecto: http://localhost:3000)
 */

import { performance } from 'perf_hooks';

const urlArg = process.argv[2] || process.env.DEPLOY_API_URL || 'http://localhost:3000';
const baseUrl = urlArg.trim().replace(/\/+$/, '');

async function realizarPeticion(ruta) {
  const urlCompleta = `${baseUrl}${ruta}`;
  const t0 = performance.now();
  let res;
  try {
    res = await fetch(urlCompleta, {
      headers: {
        'User-Agent': 'PUKARA-SmokeTest/1.0',
        Accept: 'application/json',
      },
    });
  } catch (err) {
    throw new Error(`Imposible conectar con ${urlCompleta}: ${err.message}`);
  }

  const duracionMs = Math.round(performance.now() - t0);
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Respuesta de ${ruta} no es JSON válido (HTTP ${res.status})`);
  }

  return { status: res.status, data, duracionMs };
}

async function ejecutar() {
  console.log('================================================================');
  console.log(' PUKARA — Verificación de Pre-Despliegue y Puerta Semana 1');
  console.log(` Destino evaluado: ${baseUrl}`);
  console.log(` Timestamp:        ${new Date().toISOString()}`);
  console.log('================================================================\n');

  const inicioTotal = performance.now();

  try {
    // ------------------------------------------------------------------------
    // PASO 1: Verificación del endpoint de salud y base de datos
    // ------------------------------------------------------------------------
    process.stdout.write('[1/3] Comprobando GET /api/salud... ');
    const salud = await realizarPeticion('/api/salud');

    if (salud.status !== 200) {
      throw new Error(`/api/salud retornó HTTP ${salud.status} en lugar de 200`);
    }

    if (salud.data?.base_de_datos !== 'conectado') {
      throw new Error(
        `Base de datos no conectada según /api/salud: ${JSON.stringify(salud.data)}`
      );
    }
    console.log(`✓ OK (${salud.duracionMs} ms) — BD: ${salud.data.base_de_datos}`);

    // ------------------------------------------------------------------------
    // PASO 2: Primera llamada a GET /api/estado (v1)
    // ------------------------------------------------------------------------
    process.stdout.write('[2/3] Comprobando primera consulta GET /api/estado (v1)... ');
    const estado1 = await realizarPeticion('/api/estado');

    if (estado1.status !== 200) {
      throw new Error(`/api/estado retornó HTTP ${estado1.status} en lugar de 200`);
    }

    const payload1 = estado1.data;
    if (!payload1.ok || payload1.version_esquema_api !== 'v1') {
      throw new Error(
        `Payload de estado no cumple contrato v1: ok=${payload1.ok}, version=${payload1.version_esquema_api}`
      );
    }

    // Validar Aviso Permanente obligatorio
    if (
      !payload1.aviso_permanente ||
      !payload1.aviso_permanente.includes('niveles informativos de lluvia') ||
      !payload1.aviso_permanente.includes('umbrales académicos')
    ) {
      throw new Error('Aviso Permanente incompleto o ausente en /api/estado');
    }

    // Validar capas geográficas de demostración (2 zonas y 6 puntos)
    const numZonas = payload1.capas_referencia?.zonas?.length ?? 0;
    const numPuntos = payload1.capas_referencia?.puntos?.length ?? 0;
    if (numZonas !== 2 || numPuntos !== 6) {
      throw new Error(
        `Capas incompletas: se esperaban 2 zonas y 6 puntos, recibidas ${numZonas} zonas y ${numPuntos} puntos`
      );
    }

    // Validar lectura meteorológica
    const met1 = payload1.meteorologia;
    if (!met1 || !met1.disponible || !met1.lectura) {
      throw new Error(
        `Lectura meteorológica no disponible en /api/estado: ${JSON.stringify(met1)}`
      );
    }

    const lectura1 = met1.lectura;
    console.log(
      `✓ OK (${estado1.duracionMs} ms)\n` +
      `      - Lectura ID: ${lectura1.id} (observado_en: ${lectura1.observado_en})\n` +
      `      - Capas: ${numZonas} zonas, ${numPuntos} puntos de orientación\n` +
      `      - Origen respuesta: ${met1.origen_respuesta}`
    );

    // ------------------------------------------------------------------------
    // PASO 3: Segunda llamada inmediata para comprobar caché e idempotencia
    // ------------------------------------------------------------------------
    process.stdout.write('[3/3] Comprobando segunda llamada inmediata (Caché en servidor)... ');
    const estado2 = await realizarPeticion('/api/estado');

    if (estado2.status !== 200) {
      throw new Error(`Segunda llamada a /api/estado retornó HTTP ${estado2.status}`);
    }

    const payload2 = estado2.data;
    const met2 = payload2.meteorologia;

    if (met2?.origen_respuesta !== 'cache_servidor') {
      console.warn(
        `\n      [AVISO] Se esperaba origen 'cache_servidor' pero se recibió '${met2?.origen_respuesta}'`
      );
    }

    if (met2?.lectura?.id !== lectura1.id) {
      throw new Error(
        `Discrepancia en ID de lectura entre llamadas consecutivas: primero=${lectura1.id}, segundo=${met2?.lectura?.id}. Posible fallo de idempotencia o duplicación.`
      );
    }

    console.log(
      `✓ OK (${estado2.duracionMs} ms) — Respuesta desde '${met2.origen_respuesta}', ID idéntico ${lectura1.id}`
    );

    const duracionTotal = Math.round(performance.now() - inicioTotal);
    console.log('\n================================================================');
    console.log(` [OK] PUERTA SEMANA 1 VERIFICADA EXITOSAMENTE EN: ${baseUrl}`);
    console.log(` Tiempo total de inspección: ${duracionTotal} ms`);
    console.log('================================================================\n');
    process.exit(0);
  } catch (error) {
    console.error(`\n\n[ERROR] FALLO EN PUERTA SEMANA 1: ${error.message}\n`);
    process.exit(1);
  }
}

ejecutar();
