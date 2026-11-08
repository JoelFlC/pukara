import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import InicioPage from './pages/InicioPage';
import AdminPage from './pages/AdminPage';
import MapaReferencial from './components/MapaReferencial';
import EstadoPwaBanner from './components/EstadoPwaBanner';
import BannerModoOffline from './components/BannerModoOffline';

export { MapaReferencial, EstadoPwaBanner, BannerModoOffline };

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<InicioPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}
