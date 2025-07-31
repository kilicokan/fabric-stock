import { useEffect, useState } from "react";
import axios from "axios";

type Entry = {
  id: number;
  name: string;
  color: string;
  weightKg: number | null;
  lengthMeter: number | null;
  createdAt: string;
};

export default function FabricEntries() {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    axios.get("/api/fabric-entry/list").then((res) => {
      setEntries(res.data);
    });
  }, []);

  return (
    <div className="max-w-2xl mx-auto mt-10 px-4">
      <h1 className="text-xl font-bold mb-4">Kumaş Giriş Listesi</h1>

      <div className="space-y-4">
        {entries.map((entry) => (
          <div key={entry.id} className="border rounded p-4 shadow-sm bg-white">
            <p><strong>Kumaş Türü:</strong> {entry.name}</p>
            <p><strong>Renk:</strong> {entry.color}</p>
            {entry.weightKg !== null && (
              <p><strong>Ağırlık:</strong> {entry.weightKg} kg</p>
            )}
            {entry.lengthMeter !== null && (
              <p><strong>Uzunluk:</strong> {entry.lengthMeter} m</p>
            )}
            <p className="text-xs text-gray-500">
              Giriş Tarihi: {new Date(entry.createdAt).toLocaleString("tr-TR")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
