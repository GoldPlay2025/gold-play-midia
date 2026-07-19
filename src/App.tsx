import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AdminPanel from './pages/AdminPanel';
import Player from './pages/Player';
import CampanhaPlayer from './pages/CampanhaPlayer';
import AppView from './pages/AppView';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminPanel />} />
        <Route path="/player/:screenId" element={<Player />} />
        <Route path="/campanha/:midiaId" element={<CampanhaPlayer />} />
        <Route path="/player" element={<AppView />} />
        <Route path="/app-view" element={<AppView />} />
      </Routes>
    </BrowserRouter>
  );
}
