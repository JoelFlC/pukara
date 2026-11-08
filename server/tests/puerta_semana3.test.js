/**
 * @file puerta_semana3.test.js
 * @description Suite Automatizada de Certificación de la Puerta de Calidad Semana 3:
 * "Todas las funciones obligatorias implementadas: login, panel, recomendaciones, mapa, offline"
 *
 * Controles de Verificación Formal:
 * - Control 1: Integridad de los 5 Módulos en Consulta Pública (GET /api/estado)
 * - Control 2: Seguridad Transversal y Autorización RBAC (Requisito P07)
 * - Control 3: Ciclo Completo de Administración y Trazabilidad en Bitácora (P05 y P16)
 * - Control 4: Aislamiento de Simulación (P11) y Cambio de Nivel con Recomendación (P06)
 * - Control 5: Exactitud Geoespacial Haversine (P18)
 * - Control 6: Existencia de Artefactos PWA y Documentación de Cierre (Auditoría Semántica)
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { seed } from '../src/db/seed.js';
import { asegurarUsuarioAdministrador } from '../src/db/seedAdmin.js';
import { limpiarRateLimiterLogin } from '../src/middleware/rateLimit.middleware.js';
import { limpiarDatosSimulados } from '../src/services/simulacion.service.js';
import {
  distanciaHaversine,
  LEYENDA_DISTANCIA_HAVERSINE,
} from '../src/engine/haversine.js';
import { generarTokenAcceso } from '../src/services/auth.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

// Mockear Open-Meteo para aislar completamente las pruebas HTTP sin llamadas externas
vi.mock('../src/services/openMeteo.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    consultarOpenMeteo: vi.fn().mockResolvedValue({
      fuente: 'Open-Meteo',
      observado_en: '2026-11-06T18:00:00.000Z',
      intervalo_actual_segundos: 900,
      actual: {
        precipitacion_mm: 1.8,
        temperatura_c: 12.0,
        humedad_pct: 78,
        viento_kmh: 9.0,
      },
      serie_horaria: {
        tiempos_utc: Array.from({ length: 80 }, (_, i) =>
          new Date(Date.parse('2026-11-06T18:00:00.000Z') - (79 - i) * 3600000).toISOString()
        ),
        precipitacion_mm: Array.from({ length: 80 }, () => 0.4),
      },
    }),
  };
});

/**
 * Restaura el estado de la base de datos eliminando datos de prueba.
 */
async function restaurarEstadoBD() {
  await limpiarDatosSimulados();

  // Limpiar bitácora de configuraciones adicionales
  await pool.query(`
    DELETE FROM bitacora_cambios
    WHERE entidad = 'configuraciones_reglas'
      AND entidad_id IN (SELECT id FROM configuraciones_reglas WHERE version > 1);
  `);
  await pool.query(`
    DELETE FROM umbrales
    WHERE configuracion_id IN (SELECT id FROM configuraciones_reglas WHERE version > 1);
  `);
  await pool.query('DELETE FROM configuraciones_reglas WHERE version > 1;');
  await pool.query(`
    UPDATE configuraciones_reglas
    SET estado = 'vigente'
    WHERE version = 1;
  `);

  // Limpiar cambios de prueba en bitácora
  await pool.query(`
    DELETE FROM bitacora_cambios
    WHERE (valor_nuevo::text LIKE '%Test%' OR valor_nuevo::text LIKE '%PuertaSemana3%');
  `);

  // Restaurar recomendaciones a demostración
  await pool.query(`
    UPDATE recomendaciones_preventivas
    SET estado_publicacion = 'publicado',
        origen = 'demostracion'
    WHERE version = 1;
  `);

  // Restaurar capas y zonas modificadas
  await pool.query(`
    DELETE FROM zonas_referencia WHERE id > 2;
    UPDATE zonas_referencia
    SET nombre = 'Sector Piloto Llojeta — Cuenca Media (Referencial)',
        fuente = 'Delimitación académica aproximada sobre cartografía base OpenStreetMap'
    WHERE id = 1;
  `);
}

/**
 * Lista recursivamente archivos con extensiones específicas.
 */
function listarArchivosRecursivo(dir, extensiones = ['.js', '.jsx']) {
  let resultados = [];
  if (!fs.existsSync(dir)) return resultados;

  const entradas = fs.readdirSync(dir, { withFileTypes: true });
  for (const entrada of entradas) {
    const rutaCompleta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (
        entrada.name !== 'node_modules' &&
        entrada.name !== 'dist' &&
        entrada.name !== '.git'
      ) {
        resultados = resultados.concat(
          listarArchivosRecursivo(rutaCompleta, extensiones)
        );
      }
    } else if (extensiones.some((ext) => entrada.name.endsWith(ext))) {
      resultados.push(rutaCompleta);
    }
  }
  return resultados;
}

/**
 * Remueve comentarios para auditar cadenas y código ejecutable.
 */
function removerComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');
}

describe('PUERTA DE CALIDAD SEMANA 3 (S3D7 - Fase B): Cierre Integral de Módulos 1 a 5 y Feature Freeze', () => {
  let adminToken;
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@pukara.bo';
  const adminPassword = process.env.ADMIN_PASSWORD || 'PukaraAdmin2026!';

  beforeAll(async () => {
    await seed();
    await asegurarUsuarioAdministrador();
  });

  beforeEach(async () => {
    limpiarRateLimiterLogin();
    await restaurarEstadoBD();

    const resLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: adminPassword });

    if (resLogin.status === 200 && resLogin.body.token) {
      adminToken = resLogin.body.token;
    } else {
      adminToken = generarTokenAcceso({
        id: 1,
        email: adminEmail,
        nombre: 'Administrador PUKARA',
        rol: 'administrador',
      });
    }
  });

  afterEach(async () => {
    limpiarRateLimiterLogin();
    await restaurarEstadoBD();
  });

  afterAll(async () => {
    limpiarRateLimiterLogin();
    await restaurarEstadoBD();
  });

  // =========================================================================
  // CONTROL 1: Integridad de los 5 Módulos en Consulta Pública (GET /api/estado)
  // =========================================================================
  describe('Control 1: Integridad de los 5 Módulos en Consulta Pública (GET /api/estado)', () => {
    it('entrega en una sola llamada no autenticada el contrato público unificado con los 5 módulos integrados', async () => {
      const res = await request(app).get('/api/estado');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      // Módulo 2: Nivel informativo y estado del motor
      expect(res.body.nivel_vigente).toBeDefined();
      expect(['NORMAL', 'PRECAUCION', 'ALERTA', 'EMERGENCIA']).toContain(
        res.body.nivel_vigente
      );
      expect(res.body.estado_sistema).toBeDefined();

      // Aviso legal permanente inalterable
      expect(res.body.aviso_permanente).toContain(
        'niveles informativos de lluvia'
      );
      expect(res.body.aviso_permanente).toContain('umbrales académicos');
      expect(res.body.aviso_permanente).toContain(
        'No sustituyen alertas ni instrucciones de las autoridades oficiales'
      );

      // Módulo 1: Datos pluviométricos y meteorología
      expect(res.body.meteorologia).toBeDefined();
      expect(res.body.meteorologia.disponible).toBe(true);
      expect(res.body.meteorologia.lectura.fuente).toBe('Open-Meteo');

      // Módulo 3: Recomendaciones preventivas con etiqueta de origen
      expect(res.body.recomendacion).toBeDefined();
      expect(res.body.recomendacion.nivel).toBe(res.body.nivel_vigente);
      expect(['demostracion', 'institucional_verificada']).toContain(
        res.body.recomendacion.origen
      );
      expect(Array.isArray(res.body.recomendaciones_publicadas)).toBe(true);
      expect(res.body.recomendaciones_publicadas.length).toBeGreaterThanOrEqual(4);

      // Módulo 3: Contactos de emergencia y auxilio ciudadano
      expect(Array.isArray(res.body.contactos_emergencia)).toBe(true);
      expect(res.body.contactos_emergencia.length).toBeGreaterThanOrEqual(2);
      for (const contacto of res.body.contactos_emergencia) {
        expect(contacto.nombre).toBeDefined();
        expect(contacto.telefono).toBeDefined();
        expect(contacto.fuente).toBeDefined();
      }

      // Módulo 4: Capas cartográficas y puntos de referencia en Llojeta
      expect(Array.isArray(res.body.zonas_referencia)).toBe(true);
      expect(res.body.zonas_referencia.length).toBeGreaterThanOrEqual(2);
      expect(res.body.zonas_referencia[0].advertencia).toContain(
        'referencia de demostración, no validada'
      );

      expect(Array.isArray(res.body.puntos_referencia)).toBe(true);
      expect(res.body.puntos_referencia.length).toBeGreaterThanOrEqual(2);
      expect(res.body.puntos_referencia[0].latitud).toBeDefined();
      expect(res.body.puntos_referencia[0].longitud).toBeDefined();
    });
  });

  // =========================================================================
  // CONTROL 2: Seguridad Transversal y Autorización RBAC (Requisito P07)
  // =========================================================================
  describe('Control 2: Seguridad Transversal y Autorización RBAC (Requisito P07)', () => {
    it('protege las rutas administrativas rechazando accesos no autenticados (401) y roles públicos (403)', async () => {
      // 1. Acceso sin token -> 401
      const resSinToken = await request(app).get('/api/admin/configuraciones');
      expect(resSinToken.status).toBe(401);
      expect(resSinToken.body.error.codigo).toBe('TOKEN_FALTANTE');

      // 2. Acceso con rol 'publico' -> 403
      const tokenPublico = generarTokenAcceso({
        id: 99,
        email: 'vecino@llojeta.bo',
        rol: 'publico',
      });
      const resRolPublico = await request(app)
        .get('/api/admin/configuraciones')
        .set('Authorization', `Bearer ${tokenPublico}`);
      expect(resRolPublico.status).toBe(403);
      expect(resRolPublico.body.error.codigo).toBe('ROL_INSUFICIENTE');
    });

    it('autentica satisfactoriamente al administrador mediante POST /api/auth/login y devuelve JWT con expiración', async () => {
      const resLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: adminEmail, password: adminPassword });

      expect(resLogin.status).toBe(200);
      expect(resLogin.body.ok).toBe(true);
      expect(resLogin.body.token).toBeDefined();
      expect(resLogin.body.usuario.rol).toBe('administrador');
      expect(resLogin.body.expira_en).toBeDefined();
    });
  });

  // =========================================================================
  // CONTROL 3: Ciclo Completo de Administración y Trazabilidad en Bitácora (P05/P16)
  // =========================================================================
  describe('Control 3: Ciclo Completo de Administración y Trazabilidad en Bitácora (P05 y P16)', () => {
    it('valida coherencia matemática (P16), versiona umbrales (P05), edita entidades y audita en bitacora_cambios', async () => {
      // 1. Rechazo de configuración incoherente (P16)
      const configIncoherente = {
        motivo: 'Intento de umbrales incoherentes PuertaSemana3',
        activar: false,
        umbrales: [
          { variable: 'intensidad_mm_h', nivel: 'PRECAUCION', valor: 10.0 },
          { variable: 'intensidad_mm_h', nivel: 'ALERTA', valor: 5.0 }, // Incoherente: PRECAUCION > ALERTA
          { variable: 'intensidad_mm_h', nivel: 'EMERGENCIA', valor: 15.0 },
          { variable: 'acum_24h_mm', nivel: 'PRECAUCION', valor: 10.0 },
          { variable: 'acum_24h_mm', nivel: 'ALERTA', valor: 25.0 },
          { variable: 'acum_24h_mm', nivel: 'EMERGENCIA', valor: 40.0 },
          { variable: 'acum_72h_mm', nivel: 'PRECAUCION', valor: 25.0 },
          { variable: 'acum_72h_mm', nivel: 'ALERTA', valor: 60.0 },
          { variable: 'acum_72h_mm', nivel: 'EMERGENCIA', valor: 90.0 },
        ],
      };

      const resInvalida = await request(app)
        .post('/api/admin/configuraciones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(configIncoherente);

      expect(resInvalida.status).toBe(400);
      expect(resInvalida.body.error.codigo).toBe('CONFIGURACION_INVALIDA');

      // 2. Creación y activación de versión 2 coherente (P05)
      const configValida = {
        motivo: 'Ajuste de umbrales preventivos PuertaSemana3',
        activar: true,
        umbrales: [
          { variable: 'intensidad_mm_h', nivel: 'PRECAUCION', valor: 3.0 },
          { variable: 'intensidad_mm_h', nivel: 'ALERTA', valor: 7.0 },
          { variable: 'intensidad_mm_h', nivel: 'EMERGENCIA', valor: 14.0 },
          { variable: 'acum_24h_mm', nivel: 'PRECAUCION', valor: 12.0 },
          { variable: 'acum_24h_mm', nivel: 'ALERTA', valor: 28.0 },
          { variable: 'acum_24h_mm', nivel: 'EMERGENCIA', valor: 45.0 },
          { variable: 'acum_72h_mm', nivel: 'PRECAUCION', valor: 30.0 },
          { variable: 'acum_72h_mm', nivel: 'ALERTA', valor: 65.0 },
          { variable: 'acum_72h_mm', nivel: 'EMERGENCIA', valor: 95.0 },
        ],
      };

      const resCrear = await request(app)
        .post('/api/admin/configuraciones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(configValida);

      expect(resCrear.status).toBe(201);
      expect(resCrear.body.configuracion.version).toBeGreaterThan(1);
      expect(resCrear.body.configuracion.estado).toBe('vigente');

      // 3. Modificación de recomendación preventiva con origen institucional
      const resRec = await request(app)
        .put('/api/admin/recomendaciones/3')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          titulo: 'Alerta Preventiva Institucional PuertaSemana3',
          contenido: 'Mantenerse alejado de ríos y verificar taludes.',
          origen: 'institucional_verificada',
          fuente: 'Secretaría Municipal de Riesgos GAMLP',
        });
      expect(resRec.status).toBe(200);

      // 4. Inmutabilidad cartográfica: actualización de atributos sin tocar geometría
      const resZona = await request(app)
        .put('/api/admin/zonas/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nombre: 'Sector Pasajahuira Actualizado PuertaSemana3',
          fuente: 'Levantamiento Oficial GAMLP',
          geometria: { type: 'Point', coordinates: [0, 0] }, // Intento ilegal de cambiar geometría
        });
      expect(resZona.status).toBe(200);

      // Comprobar que la geometría original GeoJSON de la zona no fue alterada
      const checkZona = await pool.query(
        'SELECT geometria FROM zonas_referencia WHERE id = 1;'
      );
      expect(checkZona.rows[0].geometria.type).not.toBe('Point');

      // 5. Trazabilidad en Bitácora de Cambios
      const resBitacora = await request(app)
        .get('/api/admin/bitacora')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resBitacora.status).toBe(200);
      expect(Array.isArray(resBitacora.body.registros)).toBe(true);
      expect(resBitacora.body.registros.length).toBeGreaterThanOrEqual(2);

      const entidadesAuditadas = resBitacora.body.registros.map((i) => i.entidad);
      expect(entidadesAuditadas).toContain('configuraciones_reglas');
      expect(entidadesAuditadas).toContain('recomendaciones_preventivas');
    });
  });

  // =========================================================================
  // CONTROL 4: Aislamiento de Simulación (P11) y Cambio de Nivel (P06)
  // =========================================================================
  describe('Control 4: Aislamiento de Simulación (P11) y Cambio de Nivel con Recomendación (P06)', () => {
    it('garantiza la separación absoluta entre simulación y tiempo real, entregando la recomendación asociada al nivel simulado', async () => {
      // Inyectar lectura simulada de nivel EMERGENCIA
      const lecturaEmergencia = {
        observado_en: '2026-11-06T20:00:00.000Z',
        intensidad_mm_h: 15.0,
        acum_24h_mm: 50.0,
        acum_72h_mm: 100.0,
        motivo: 'Simulación de prueba extrema PuertaSemana3',
      };

      const resInyectar = await request(app)
        .post('/api/simulacion/lectura')
        .send(lecturaEmergencia);

      expect(resInyectar.status).toBe(201);
      expect(resInyectar.body.evaluacion.nivel_vigente).toBe('EMERGENCIA');

      // Consulta en modalidad simulada -> debe reflejar EMERGENCIA y su recomendación
      const resSim = await request(app).get('/api/estado?modalidad=simulada');
      expect(resSim.status).toBe(200);
      expect(resSim.body.modalidad).toBe('simulada');
      expect(resSim.body.nivel_vigente).toBe('EMERGENCIA');
      expect(resSim.body.recomendacion.nivel).toBe('EMERGENCIA');

      // Consulta en modalidad real -> debe permanecer intacta en su nivel base
      const resReal = await request(app).get('/api/estado?modalidad=real');
      expect(resReal.status).toBe(200);
      expect(resReal.body.modalidad).toBe('real');
      expect(resReal.body.nivel_vigente).not.toBe('EMERGENCIA');
    });
  });

  // =========================================================================
  // CONTROL 5: Exactitud Geoespacial Haversine (Requisito P18)
  // =========================================================================
  describe('Control 5: Exactitud Geoespacial Haversine (Requisito P18)', () => {
    it('calcula distancias en línea recta con precisión calibrada e incluye la leyenda institucional obligatoria', () => {
      const centroPiloto = { latitud: -16.5235, longitud: -68.1425 };
      const plazaMurillo = { latitud: -16.4957, longitud: -68.1335 };

      // Caso P18.1: Distancia a sí mismo (0 m)
      const resCero = distanciaHaversine(centroPiloto, centroPiloto);
      expect(resCero.metros).toBe(0);
      expect(resCero.distanciaCorta).toBe('0 m');
      expect(resCero.leyenda).toBe(LEYENDA_DISTANCIA_HAVERSINE);

      // Caso P18.2: Distancia calibrada Centro Llojeta a Plaza Murillo (~3234 m ± 25 m)
      const resMurillo = distanciaHaversine(centroPiloto, plazaMurillo);
      expect(Math.abs(resMurillo.metros - 3234)).toBeLessThanOrEqual(25);
      expect(resMurillo.leyenda).toBe(
        'distancia aproximada en línea recta (no es recomendación de ruta ni indica seguridad)'
      );
    });
  });

  // =========================================================================
  // CONTROL 6: Artefactos PWA, Documentación y Auditoría Semántica Estricta
  // =========================================================================
  describe('Control 6: Artefactos PWA, Documentación y Auditoría Semántica Estricta', () => {
    it('confirma la existencia de la documentación de cierre y los íconos binarios de la PWA instalable', () => {
      const rutaCierre = path.join(REPO_ROOT, 'docs/cierre-semana-3.md');
      const rutaGuia = path.join(REPO_ROOT, 'docs/guia-pwa-android-s3.md');
      const rutaIcono192 = path.join(REPO_ROOT, 'client/public/pwa-192x192.png');
      const rutaIcono512 = path.join(REPO_ROOT, 'client/public/pwa-512x512.png');
      const rutaMaskable = path.join(
        REPO_ROOT,
        'client/public/pwa-maskable-512x512.png'
      );

      expect(fs.existsSync(rutaCierre)).toBe(true);
      expect(fs.existsSync(rutaGuia)).toBe(true);
      expect(fs.existsSync(rutaIcono192)).toBe(true);
      expect(fs.existsSync(rutaIcono512)).toBe(true);
      expect(fs.existsSync(rutaMaskable)).toBe(true);

      // Verificar cabeceras PNG binarias reales (\x89PNG)
      const header192 = fs.readFileSync(rutaIcono192).subarray(0, 4);
      expect(header192[0]).toBe(0x89);
      expect(header192[1]).toBe(0x50); // 'P'
      expect(header192[2]).toBe(0x4e); // 'N'
      expect(header192[3]).toBe(0x47); // 'G'
    });

    it('audita estáticamente que ningún archivo de código ejecutable contenga términos de la lista negra', () => {
      const directoriosAuditar = [
        path.join(REPO_ROOT, 'server/src'),
        path.join(REPO_ROOT, 'client/src'),
      ];

      const archivos = directoriosAuditar.flatMap((dir) =>
        listarArchivosRecursivo(dir)
      );
      expect(archivos.length).toBeGreaterThan(15);

      const terminosProhibidos = [
        'alerta ' + 'oficial',
        'orden de ' + 'evacuación',
        'ruta ' + 'segura',
        'zona ' + 'segura',
        'refugio ' + 'verificado',
        'maps.google' + '.com',
        'waze' + '.com',
        'c' + 'ómo llegar',
      ];

      const violaciones = [];

      for (const archivo of archivos) {
        const contenido = fs.readFileSync(archivo, 'utf-8');
        const codigoLimpio = removerComentarios(contenido).toLowerCase();

        for (const termino of terminosProhibidos) {
          if (codigoLimpio.includes(termino)) {
            violaciones.push({
              archivo: path.relative(REPO_ROOT, archivo),
              termino,
            });
          }
        }
      }

      expect(violaciones).toEqual([]);
    });
  });
});
