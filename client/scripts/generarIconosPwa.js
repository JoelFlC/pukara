/**
 * @file generarIconosPwa.js
 * @description Generador puro en Node.js de íconos PNG y favicon SVG para la PWA de PUKARA.
 * Crea archivos PNG binarios reales con firma válida IHDR/IDAT/IEND y dimensiones exactas
 * (192x192, 512x512 y 512x512 maskable) para validación estricta de Web App Manifest en Chrome/Android.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '../public');

// Tabla CRC32 para chunks PNG
const CRC_TABLE = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? -306674912 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c;
}

function calcularCrc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function crearChunk(tipo, datos) {
  const longitudBuf = Buffer.alloc(4);
  longitudBuf.writeUInt32BE(datos.length, 0);

  const tipoYDatos = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(calcularCrc32(tipoYDatos), 0);

  return Buffer.concat([longitudBuf, tipoYDatos, crcBuf]);
}

/**
 * Genera un buffer PNG binario RGBA válido con un diseño estilizado de PUKARA
 * (fondo pizarra oscuro #0f172a, lluvia / montaña estilizada en celeste #38bdf8).
 *
 * @param {number} ancho
 * @param {number} alto
 * @param {boolean} [esMaskable=false]
 * @returns {Buffer}
 */
function generarBufferPngPukara(ancho, alto, esMaskable = false) {
  const firmaPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // Chunk IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // Profundidad de 8 bits
  ihdr[9] = 6; // Color RGBA (4 canales)
  ihdr[10] = 0; // Compresión estándar
  ihdr[11] = 0; // Filtro estándar
  ihdr[12] = 0; // Sin entrelazado
  const chunkIhdr = crearChunk('IHDR', ihdr);

  // Paleta sobria PUKARA
  const COLOR_FONDO = [15, 23, 42]; // #0f172a
  const COLOR_CELESTE = [56, 189, 248]; // #38bdf8
  const COLOR_BLANCO = [248, 250, 252]; // #f8fafc

  const rowSize = 1 + ancho * 4;
  const rawData = Buffer.alloc(rowSize * alto);

  const cx = ancho / 2;
  const cy = alto / 2;
  const radioBase = (Math.min(ancho, alto) / 2) * (esMaskable ? 0.65 : 0.85);

  for (let y = 0; y < alto; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filtro None

    for (let x = 0; x < ancho; x++) {
      const px = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Color base de fondo
      let r = COLOR_FONDO[0];
      let g = COLOR_FONDO[1];
      let b = COLOR_FONDO[2];

      // 1. Círculo exterior sutil
      if (dist <= radioBase && dist >= radioBase - Math.max(2, ancho * 0.02)) {
        r = COLOR_CELESTE[0];
        g = COLOR_CELESTE[1];
        b = COLOR_CELESTE[2];
      }

      // 2. Silueta de montaña / cuenca (triángulo inferior)
      const baseMontañaY = cy + radioBase * 0.55;
      const picoMontañaY = cy - radioBase * 0.2;
      const pendiente = (baseMontañaY - picoMontañaY) / (radioBase * 0.65);

      if (y >= picoMontañaY && y <= baseMontañaY) {
        const anchoPermitido = (y - picoMontañaY) / pendiente;
        if (Math.abs(dx) <= anchoPermitido) {
          // Relleno de montaña
          r = Math.round(COLOR_CELESTE[0] * 0.85);
          g = Math.round(COLOR_CELESTE[1] * 0.85);
          b = Math.round(COLOR_CELESTE[2] * 0.85);

          // Línea divisoria central
          if (Math.abs(dx) <= Math.max(1, ancho * 0.015)) {
            r = COLOR_BLANCO[0];
            g = COLOR_BLANCO[1];
            b = COLOR_BLANCO[2];
          }
        }
      }

      // 3. Gotas estilizadas de lluvia en la parte superior
      const enGota1 =
        Math.abs(x - (cx - radioBase * 0.35)) < ancho * 0.03 &&
        y > cy - radioBase * 0.65 &&
        y < cy - radioBase * 0.35;
      const enGota2 =
        Math.abs(x - cx) < ancho * 0.035 &&
        y > cy - radioBase * 0.75 &&
        y < cy - radioBase * 0.4;
      const enGota3 =
        Math.abs(x - (cx + radioBase * 0.35)) < ancho * 0.03 &&
        y > cy - radioBase * 0.65 &&
        y < cy - radioBase * 0.35;

      if (enGota1 || enGota2 || enGota3) {
        r = COLOR_CELESTE[0];
        g = COLOR_CELESTE[1];
        b = COLOR_CELESTE[2];
      }

      rawData[px] = r;
      rawData[px + 1] = g;
      rawData[px + 2] = b;
      rawData[px + 3] = 255; // Opaco
    }
  }

  const comprimido = zlib.deflateSync(rawData);
  const chunkIdat = crearChunk('IDAT', comprimido);
  const chunkIend = crearChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([firmaPng, chunkIhdr, chunkIdat, chunkIend]);
}

/**
 * Genera el SVG del Favicon con la paleta de PUKARA (#0f172a y #38bdf8).
 *
 * @returns {string}
 */
function generarSvgFavicon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <rect width="512" height="512" rx="112" fill="#0f172a" />
  <circle cx="256" cy="256" r="190" fill="none" stroke="#38bdf8" stroke-width="12" stroke-opacity="0.4" />
  
  <!-- Nube y lluvia estilizadas -->
  <g fill="#38bdf8">
    <ellipse cx="200" cy="220" rx="60" ry="45" />
    <ellipse cx="270" cy="190" rx="75" ry="60" />
    <ellipse cx="330" cy="225" rx="55" ry="45" />
    <rect x="180" y="215" width="170" height="45" rx="10" />
    
    <!-- Gotas de lluvia -->
    <path d="M190 285 L180 320 A8 8 0 0 0 196 320 Z" />
    <path d="M256 285 L246 330 A9 9 0 0 0 264 330 Z" />
    <path d="M320 285 L310 320 A8 8 0 0 0 326 320 Z" />
  </g>
  
  <!-- Silueta montañosa / cuenca de Llojeta -->
  <path d="M110 400 L210 320 L270 365 L360 295 L415 400 Z" fill="#1e293b" />
  <path d="M210 320 L270 365 L360 295" fill="none" stroke="#38bdf8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
</svg>
`;
}

// Ejecución
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// 1. Icono 192x192
const png192 = generarBufferPngPukara(192, 192, false);
fs.writeFileSync(path.join(PUBLIC_DIR, 'pwa-192x192.png'), png192);
console.log(`[PWA] Generado pwa-192x192.png (${png192.length} bytes)`);

// 2. Icono 512x512
const png512 = generarBufferPngPukara(512, 512, false);
fs.writeFileSync(path.join(PUBLIC_DIR, 'pwa-512x512.png'), png512);
console.log(`[PWA] Generado pwa-512x512.png (${png512.length} bytes)`);

// 3. Icono 512x512 maskable (margen de seguridad para iconos adaptativos)
const pngMaskable512 = generarBufferPngPukara(512, 512, true);
fs.writeFileSync(path.join(PUBLIC_DIR, 'pwa-maskable-512x512.png'), pngMaskable512);
console.log(`[PWA] Generado pwa-maskable-512x512.png (${pngMaskable512.length} bytes)`);

// 4. Favicon SVG
const svgFavicon = generarSvgFavicon();
fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.svg'), svgFavicon, 'utf-8');
console.log(`[PWA] Generado favicon.svg (${svgFavicon.length} bytes)`);

export {
  generarBufferPngPukara,
  generarSvgFavicon,
};

