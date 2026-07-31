import React, { useState } from 'react';
import { Key } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function ApiKeyModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { geminiApiKey, setGeminiApiKey } = useStore();
  const [key, setKey] = useState(geminiApiKey || '');

  if (!isOpen) return null;

  const handleSave = () => {
    setGeminiApiKey(key);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-emerald-100">
        <div className="flex items-center gap-3 text-emerald-700 mb-4">
          <Key className="w-8 h-8" />
          <h2 className="text-xl font-bold">Pengaturan API Key Gemini</h2>
        </div>
        <p className="text-slate-600 mb-6 text-sm leading-relaxed">
          Karena aplikasi ini berjalan sepenuhnya secara offline dan lokal (tanpa server backend), Anda memerlukan API Key Gemini pribadi Anda untuk fitur generasi AI (Pembuatan Prota & Modul Ajar).
        </p>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="AIzaSy..."
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 mb-6"
        />
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-lg shadow-emerald-200"
          >
            Simpan Key
          </button>
        </div>
      </div>
    </div>
  );
}
