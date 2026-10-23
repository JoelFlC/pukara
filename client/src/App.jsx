import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import InicioPage from './pages/InicioPage';
import AdminPlaceholderPage from './pages/AdminPlaceholderPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<InicioPage />} />
        <Route path="/admin" element={<AdminPlaceholderPage />} />
      </Routes>
    </BrowserRouter>
  );
}
