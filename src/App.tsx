import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AdminPanel from './pages/AdminPanel';
import Player from './pages/Player';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminPanel />} />
        <Route path="/player/:screenId" element={<Player />} />
      </Routes>
    </BrowserRouter>
  );
}
