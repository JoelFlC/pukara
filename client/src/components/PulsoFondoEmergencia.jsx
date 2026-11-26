import React from 'react';

/**
 * Capa visual de pulso blanco ↔ rojo para reforzar el estado de EMERGENCIA
 * (informativo/preventivo), segura ante fotosensibilidad (< 3 Hz) y
 * respetuosa con `prefers-reduced-motion`.
 *
 * @param {Object} [props]
 * @param {boolean} [props.activo=false]
 * @param {boolean} [props.intenso=false]
 */
export default function PulsoFondoEmergencia({
  activo = false,
  intenso = false,
}) {
  if (!activo) {
    return null;
  }

  const claseVelocidad = intenso ? 'emergencia-pulso-rapido' : '';
  const intensidad = intenso ? 'alta' : 'continua';

  return (
    <>
      <div
        data-testid="fondo-pulso-emergencia"
        data-intensidad={intensidad}
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-0 emergencia-fondo-pulso ${claseVelocidad}`}
      />
      <div
        data-testid="borde-pulso-emergencia"
        data-intensidad={intensidad}
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-30 emergencia-borde-pulso ${claseVelocidad}`}
      />
    </>
  );
}
