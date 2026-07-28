import React from 'react';
import { GestaoPanel } from '../../src/components/GestaoPanel';

export default function GestaoPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto">
        <GestaoPanel />
      </div>
    </div>
  );
}
