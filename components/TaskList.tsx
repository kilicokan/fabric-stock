'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Task } from '@/shared/types/task';

export default function TaskList({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    // Bu kullanıcıya atanan görevleri dinle
    const tasksQuery = query(
      collection(db, 'tasks'),
      where('assignedTo', '==', userId),
      orderBy('createdAt', 'desc')
    );

    // Real-time dinleme
    const unsubscribe = onSnapshot(tasksQuery, (snapshot) => {
      const tasksData: Task[] = [];
      snapshot.forEach((doc) => {
        tasksData.push({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
          dueDate: doc.data().dueDate?.toDate(),
        } as Task);
      });

      setTasks(tasksData);
      setLoading(false);
    }, (error) => {
      console.error('Dinleme hatası:', error);
      setLoading(false);
    });

    // Cleanup
    return () => unsubscribe();
  }, [userId]);

  if (loading) {
    return <div>Yükleniyor...</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Size Atanan İş Emirleri</h2>

      {tasks.length === 0 ? (
        <p className="text-gray-500">Atanmış iş emri bulunmuyor.</p>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="p-4 border rounded-lg shadow-sm bg-white"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg">{task.title}</h3>
                <span className={`px-2 py-1 text-xs rounded ${
                  task.priority === 'high' ? 'bg-red-100 text-red-800' :
                  task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {task.priority === 'high' ? 'YÜKSEK' :
                   task.priority === 'medium' ? 'ORTA' : 'DÜŞÜK'}
                </span>
              </div>

              <p className="text-gray-600 mb-3">{task.description}</p>

              <div className="flex justify-between text-sm text-gray-500">
                <span>Durum: {task.status}</span>
                <span>{task.createdAt?.toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
