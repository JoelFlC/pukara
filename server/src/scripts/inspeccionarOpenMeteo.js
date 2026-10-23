import { ZONA_PILOTO } from '../config/zonaPiloto.js';
import { consultarOpenMeteo } from '../services/openMeteo.js';

/**
 * Script de diagnóstico en vivo para inspeccionar la respuesta real de Open-Meteo
 * para la coordenada piloto de Llojeta / Bajo Llojeta (La Paz).
 */
async function inspeccionar() {
  console.log('='.repeat(70));
  console.log('PUKARA — Diagnóstico en Vivo de Open-Meteo (Sector Llojeta)');
  console.log('='.repeat(70));
  console.log(`Zona Piloto: ${ZONA_PILOTO.nombre}`);
  console.log(`Ubicación: Macrodistrito ${ZONA_PILOTO.macrodistrito}, ${ZONA_PILOTO.municipio}`);
  console.log(`Eje de referencia: ${ZONA_PILOTO.eje_referencia}`);
  console.log(`Coordenada configurada: Lat ${ZONA_PILOTO.latitud}, Lon ${ZONA_PILOTO.longitud}`);
  console.log(`Base URL: ${ZONA_PILOTO.baseUrl}`);
  console.log('-'.repeat(70));
  console.log('Realizando consulta HTTP hacia Open-Meteo API...');

  const inicioMs = Date.now();
  try {
    const data = await consultarOpenMeteo();
    const duracionMs = Date.now() - inicioMs;

    console.log(`✓ Consulta exitosa en ${duracionMs} ms\n`);

    // 1. Coordenadas
    console.log('1. RESOLUCIÓN ESPACIAL Y CELDA DEL MODELO:');
    console.log(`   - Coordenada solicitada:  Lat ${data.coordenada_consultada.latitud}, Lon ${data.coordenada_consultada.longitud}`);
    console.log(`   - Coordenada del modelo:  Lat ${data.coordenada_modelo.latitud}, Lon ${data.coordenada_modelo.longitud}`);
    console.log(`   - Elevación del modelo:   ${data.coordenada_modelo.elevacion_m} msnm`);
    console.log(`   - Nota: Evidencia empírica de la limitación N°3 (resolución de celda de modelo ~11km vs pluviómetro puntual).\n`);

    // 2. Tiempos y Zonas Horarias
    const fechaUtc = new Date(data.observado_en);
    const opcionesLaPaz = {
      timeZone: 'America/La_Paz',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };
    const fechaLaPaz = new Intl.DateTimeFormat('es-BO', opcionesLaPaz).format(fechaUtc);

    console.log('2. TIMESTAMPS Y RESOLUCIÓN TEMPORAL:');
    console.log(`   - Observado en (UTC):       ${data.observado_en}`);
    console.log(`   - Observado en (La Paz):    ${fechaLaPaz} (BOT, UTC-4)`);

    const intervalSegundos = data.intervalo_actual_segundos;
    const intervalMinutos = intervalSegundos / 60;
    console.log(`   - Intervalo bloque current: ${intervalSegundos} s (${intervalMinutos} min)`);

    // Calcular paso horario en serie
    let pasoHorarioMinutos = 'N/A';
    if (data.serie_horaria.tiempos_utc.length >= 2) {
      const t0 = new Date(data.serie_horaria.tiempos_utc[0]).getTime();
      const t1 = new Date(data.serie_horaria.tiempos_utc[1]).getTime();
      pasoHorarioMinutos = (t1 - t0) / (1000 * 60);
    }
    console.log(`   - Paso de serie horaria:    ${pasoHorarioMinutos} min (1 hora)`);
    console.log(`   - Implicación en diseño:    Respalda "separacion_minima_minutos = 15" para muestras independientes y "t_max_minutos = 60" para frescura de lecturas.\n`);

    // 3. Serie Horaria de Precipitación
    const totalHoras = data.serie_horaria.tiempos_utc.length;
    let nulos = 0;
    let noNulos = 0;
    let sumaPrecip = 0;

    for (const val of data.serie_horaria.precipitacion_mm) {
      if (val === null) {
        nulos++;
      } else {
        noNulos++;
        sumaPrecip += val;
      }
    }

    console.log('3. SERIE TEMPORAL HORARIA:');
    console.log(`   - Total horas recibidas:    ${totalHoras} h (~${Math.round(totalHoras / 24)} días)`);
    console.log(`   - Rango de fechas cubierto: ${data.serie_horaria.tiempos_utc[0]} -> ${data.serie_horaria.tiempos_utc[totalHoras - 1]}`);
    console.log(`   - Valores no nulos:         ${noNulos}`);
    console.log(`   - Valores nulos:            ${nulos} (Preservación estricta sin inventar ceros)`);
    console.log(`   - Acumulado total en serie: ${sumaPrecip.toFixed(2)} mm\n`);

    // 4. Condiciones Actuales en Llojeta
    console.log('4. CONDICIONES METEOROLÓGICAS ACTUALES (Llojeta):');
    console.log(`   - Precipitación actual:     ${data.actual.precipitacion_mm ?? 'Sin dato'} mm`);
    console.log(`   - Temperatura (2m):         ${data.actual.temperatura_c ?? 'Sin dato'} °C`);
    console.log(`   - Humedad relativa:         ${data.actual.humedad_pct ?? 'Sin dato'} %`);
    console.log(`   - Viento a 10m:             ${data.actual.viento_kmh ?? 'Sin dato'} km/h`);
    console.log('='.repeat(70));
    console.log('Diagnóstico finalizado exitosamente (Código 0).');
  } catch (error) {
    console.error('\n✗ Error al ejecutar inspección de Open-Meteo:');
    console.error(`  Nombre:   ${error.name}`);
    console.error(`  Código:   ${error.codigo || 'N/A'}`);
    console.error(`  Status:   ${error.statusHttp || 'N/A'}`);
    console.error(`  Mensaje:  ${error.message}`);
    process.exit(1);
  }
}

inspeccionar();
