import { app } from './app.js';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`[PUKARA API] Servidor ejecutándose en el puerto ${PORT}`);
  console.log(`[PUKARA API] Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[PUKARA API] Endpoint de salud: http://localhost:${PORT}/api/salud`);
});

export default server;
