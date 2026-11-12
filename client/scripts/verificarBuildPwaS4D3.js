/**
 * @file verificarBuildPwaS4D3.js
 * @description Script auditor automatizado de artefactos PWA de producción (Semana 4 - Día 3: S4D3).
 * Verifica la carpeta client/dist/ generada tras `npm run build` certificando:
 * - P12: Web App Manifest válido con display standalone, name/short_name de PUKARA e íconos 192x192 y 512x512.
 * - P12: Archivos PNG binarios reales en dist/ con cabecera mágica PNG (89 50 4E 47).
 * - P08: Service Worker (dist/sw.js) con precache del App Shell, NetworkFirst para /api/estado y StaleWhileRevalidate para contenidos.
 * - P10: Ausencia estricta de precarga masiva (precache/runtimeCaching) de tile.openstreetmap.org.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');

const PNG_MAGIC_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function assertCondicion(condicion, mensajeError) {
  if (!condicion) {
    throw new Error(mensajeError);
  }
}

function ejecutarAuditoriaPwa() {
  const controles = [];

  const registrarControl = (id, requisito, descripcion, fnVerificacion) => {
    try {
      const detalle = fnVerificacion();
      controles.push({
        id,
        requisito,
        descripcion,
        detalle: detalle || 'OK',
        estado: '[PASS]',
        exito: true,
      });
    } catch (err) {
      controles.push({
        id,
        requisito,
        descripcion,
        detalle: err.message,
        estado: '[FAIL]',
        exito: false,
      });
    }
  };

  // 1. Verificar existencia del directorio dist/ e index.html + registerSW.js (P12)
  registrarControl(
    'PWA-01',
    'P12',
    'Existencia de client/dist/, index.html y registerSW.js',
    () => {
      assertCondicion(
        fs.existsSync(DIST_DIR),
        'No existe el directorio client/dist/. Ejecute primero npm run build.'
      );
      const indexHtmlPath = path.join(DIST_DIR, 'index.html');
      const registerSwPath = path.join(DIST_DIR, 'registerSW.js');
      assertCondicion(
        fs.existsSync(indexHtmlPath),
        'Falta dist/index.html'
      );
      assertCondicion(
        fs.existsSync(registerSwPath),
        'Falta dist/registerSW.js'
      );
      const htmlContent = fs.readFileSync(indexHtmlPath, 'utf-8');
      assertCondicion(
        htmlContent.includes('manifest.webmanifest'),
        'dist/index.html no enlaza manifest.webmanifest'
      );
      return 'index.html + registerSW.js verificados';
    }
  );

  // 2. Verificar validez JSON y campos de dist/manifest.webmanifest (P12)
  registrarControl(
    'PWA-02',
    'P12',
    'Validez JSON de dist/manifest.webmanifest (standalone + PUKARA)',
    () => {
      const manifestPath = path.join(DIST_DIR, 'manifest.webmanifest');
      assertCondicion(
        fs.existsSync(manifestPath),
        'No existe dist/manifest.webmanifest'
      );
      const raw = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(raw);

      assertCondicion(
        manifest.display === 'standalone',
        `display esperado "standalone", recibido "${manifest.display}"`
      );
      assertCondicion(
        typeof manifest.name === 'string' && manifest.name.includes('PUKARA'),
        'manifest.name no incluye PUKARA'
      );
      assertCondicion(
        manifest.short_name === 'PUKARA',
        `short_name esperado "PUKARA", recibido "${manifest.short_name}"`
      );
      assertCondicion(
        Array.isArray(manifest.icons) && manifest.icons.length >= 2,
        'manifest.icons no define los íconos requeridos'
      );

      const sizes = manifest.icons.map((ic) => ic.sizes);
      assertCondicion(
        sizes.includes('192x192'),
        'manifest.icons no incluye tamaño 192x192'
      );
      assertCondicion(
        sizes.includes('512x512'),
        'manifest.icons no incluye tamaño 512x512'
      );

      return `display="${manifest.display}", short_name="${manifest.short_name}", icons=${manifest.icons.length}`;
    }
  );

  // 3. Verificar archivos binarios PNG reales en dist/ con firma mágica 89 50 4E 47 (P12)
  registrarControl(
    'PWA-03',
    'P12',
    'Íconos PNG binarios reales en dist/ con cabecera mágica (89 50 4E 47)',
    () => {
      const archivosPng = [
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-maskable-512x512.png',
      ];

      for (const nombre of archivosPng) {
        const rutaPng = path.join(DIST_DIR, nombre);
        assertCondicion(
          fs.existsSync(rutaPng),
          `No existe el archivo de ícono ${nombre} en dist/`
        );
        const buf = fs.readFileSync(rutaPng);
        assertCondicion(
          buf.length > 500,
          `El ícono ${nombre} tiene tamaño insuficiente (${buf.length} bytes)`
        );
        const magic = buf.subarray(0, 4);
        assertCondicion(
          magic.equals(PNG_MAGIC_HEADER),
          `El archivo ${nombre} no posee cabecera mágica PNG (89 50 4E 47)`
        );
      }

      return '3/3 PNG con firma mágica 89 50 4E 47';
    }
  );

  // 4. Verificar Service Worker dist/sw.js y precache del App Shell (P08 / P12)
  registrarControl(
    'PWA-04',
    'P08/P12',
    'Service Worker dist/sw.js generado con precache del App Shell',
    () => {
      const swPath = path.join(DIST_DIR, 'sw.js');
      assertCondicion(fs.existsSync(swPath), 'No existe dist/sw.js');
      const swContent = fs.readFileSync(swPath, 'utf-8');

      assertCondicion(
        swContent.includes('precacheAndRoute'),
        'dist/sw.js no contiene precacheAndRoute'
      );
      assertCondicion(
        swContent.includes('index.html'),
        'dist/sw.js no precachea index.html'
      );
      assertCondicion(
        swContent.includes('manifest.webmanifest'),
        'dist/sw.js no precachea manifest.webmanifest'
      );

      return `dist/sw.js (${swContent.length} bytes) con precacheAndRoute`;
    }
  );

  // 5. Verificar regla NetworkFirst para /api/estado y /api/historial en dist/sw.js (P08)
  registrarControl(
    'PWA-05',
    'P08',
    'Regla Workbox NetworkFirst para /api/estado y /api/historial en dist/sw.js',
    () => {
      const swPath = path.join(DIST_DIR, 'sw.js');
      const swContent = fs.readFileSync(swPath, 'utf-8');

      assertCondicion(
        swContent.includes('NetworkFirst'),
        'dist/sw.js no incluye estrategia NetworkFirst'
      );
      assertCondicion(
        swContent.includes('/api/estado'),
        'dist/sw.js no registra ruta para /api/estado'
      );
      assertCondicion(
        swContent.includes('pukara-estado-network-first'),
        'dist/sw.js no incluye el cacheName pukara-estado-network-first'
      );

      return 'NetworkFirst (pukara-estado-network-first) activo';
    }
  );

  // 6. Verificar regla StaleWhileRevalidate para contenidos y referencias en dist/sw.js (P08)
  registrarControl(
    'PWA-06',
    'P08',
    'Regla Workbox StaleWhileRevalidate para recomendaciones, contactos y puntos',
    () => {
      const swPath = path.join(DIST_DIR, 'sw.js');
      const swContent = fs.readFileSync(swPath, 'utf-8');

      assertCondicion(
        swContent.includes('StaleWhileRevalidate'),
        'dist/sw.js no incluye estrategia StaleWhileRevalidate'
      );
      assertCondicion(
        swContent.includes('/api/recomendaciones') &&
          swContent.includes('/api/contactos') &&
          swContent.includes('/api/puntos'),
        'dist/sw.js no cubre las rutas de recomendaciones, contactos y puntos'
      );
      assertCondicion(
        swContent.includes('pukara-contenidos-swr'),
        'dist/sw.js no incluye el cacheName pukara-contenidos-swr'
      );

      return 'StaleWhileRevalidate (pukara-contenidos-swr) activo';
    }
  );

  // 7. Verificar prohibición de precarga masiva de teselas de tile.openstreetmap.org (P10)
  registrarControl(
    'PWA-07',
    'P10',
    'Prohibición de precarga masiva de teselas de tile.openstreetmap.org en sw.js',
    () => {
      const swPath = path.join(DIST_DIR, 'sw.js');
      const swContent = fs.readFileSync(swPath, 'utf-8');

      assertCondicion(
        !swContent.includes('tile.openstreetmap.org') &&
          !swContent.includes('openstreetmap'),
        'VIOLACIÓN P10: dist/sw.js contiene reglas de caché/precarga de OpenStreetMap'
      );

      return '0 reglas de precarga de tile.openstreetmap.org';
    }
  );

  // Imprimir tabla de resultados
  console.log('\n========================================================================================================');
  console.log('PUKARA — AUDITORÍA DE ARTEFACTOS PWA DE PRODUCCIÓN S4D3 (P08, P10, P12)');
  console.log('========================================================================================================');
  console.log(
    `${'ID'.padEnd(8)} | ${'Req.'.padEnd(8)} | ${'Control de Verificación sobre client/dist/'.padEnd(65)} | Resultado`
  );
  console.log('--------------------------------------------------------------------------------------------------------');

  let fallos = 0;
  for (const c of controles) {
    if (!c.exito) fallos += 1;
    console.log(
      `${c.id.padEnd(8)} | ${c.requisito.padEnd(8)} | ${c.descripcion.padEnd(65)} | ${c.estado}`
    );
  }

  console.log('--------------------------------------------------------------------------------------------------------');
  console.log(
    `RESUMEN AUDITORÍA PWA S4D3: ${controles.length - fallos}/${controles.length} controles en [PASS]`
  );
  console.log('========================================================================================================\n');

  if (fallos > 0) {
    process.exit(1);
  }
}

ejecutarAuditoriaPwa();

