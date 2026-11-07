import React, { useState, useEffect } from 'react';
import AdminLogin from '../components/AdminLogin';
import PanelAdministracion from '../components/PanelAdministracion';
import { obtenerTokenAdmin, obtenerUsuarioAdmin } from '../api/adminApi';

export default function AdminPage() {
  const [autenticado, setAutenticado] = useState(false);
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    const token = obtenerTokenAdmin();
    const user = obtenerUsuarioAdmin();
    if (token && user) {
      setAutenticado(true);
      setUsuario(user);
    } else {
      setAutenticado(false);
      setUsuario(null);
    }
  }, []);

  const handleLogin = (user) => {
    setUsuario(user);
    setAutenticado(true);
  };

  const handleLogout = () => {
    setUsuario(null);
    setAutenticado(false);
  };

  if (!autenticado) {
    return <AdminLogin alIniciarSesion={handleLogin} />;
  }

  return <PanelAdministracion alCerrarSesion={handleLogout} />;
}

