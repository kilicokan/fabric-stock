'use client';

import { useState } from 'react';
import TaskList from '@/components/TaskList';

export default function MobileTasksPage() {
  const [userId, setUserId] = useState(''); // Gerçek uygulamada auth'dan gelecek

  return (
    <main className="min-h-screen p-4 bg-gray-50">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-center mb-8">
          İş Emri Takip Sistemi
        </h1>

        {/* Kullanıcı ID girişi (Demo için) */}
        <div className="mb-6 p-4 bg-white rounded shadow">
          <label className="block mb-2 font-medium">Kullanıcı ID'nizi Girin:</label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="örn: mobile_user_1"
            className="w-full p-2 border rounded mb-3"
          />
          <p className="text-sm text-gray-500">
            Web'de iş emri oluştururken bu ID'yi "Atanan Kişi" olarak kullanın.
          </p>
        </div>

        {/* İş Emri Listesi */}
        {userId ? (
          <TaskList userId={userId} />
        ) : (
          <div className="text-center p-8 text-gray-500">
            İş emirlerinizi görmek için kullanıcı ID'nizi girin.
          </div>
        )}
      </div>
    </main>
  );
}
