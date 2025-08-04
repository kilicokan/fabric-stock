import React, { useState } from 'react';
import axios from 'axios';

export default function FabricEntryForm() {
  const [fabricType, setFabricType] = useState('');
  const [color, setColor] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await axios.post('/api/fabric-entry', { fabricType, color, weightKg: Number(weightKg) });
      setMessage('Kumaş girişi kaydedildi.');
      setFabricType('');
      setColor('');
      setWeightKg('');
    } catch {
      setMessage('Hata oluştu, tekrar deneyin.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-4 border rounded space-y-4">
      <h2 className="text-xl mb-4">Kumaş Girişi</h2>
      {message && <p>{message}</p>}
      <input
        className="border p-2 w-full"
        placeholder="Kumaş Türü"
        value={fabricType}
        onChange={e => setFabricType(e.target.value)}
        required
      />
      <input
        className="border p-2 w-full"
        placeholder="Renk"
        value={color}
        onChange={e => setColor(e.target.value)}
        required
      />
      <input
        type="number"
        className="border p-2 w-full"
        placeholder="Kg"
        value={weightKg}
        onChange={e => setWeightKg(e.target.value)}
        min="0"
        required
      />
      <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded w-full">
        Kaydet
      </button>
    </form>
  );
}
