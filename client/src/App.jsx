import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import InicioPage from './pages/InicioPage';
import AdminPage from './pages/AdminPage';
import MapaReferencial from './components/MapaReferencial';

export { MapaReferencial };

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
