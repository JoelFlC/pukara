import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Evita colisiones en la base de datos PostgreSQL compartida en pruebas de integración
    fileParallelism: false,
  },
});
