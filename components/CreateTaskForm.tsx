'use client';

import { useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CreateTaskForm() {
  const [task, setTask] = useState({
    title: '',
    description: '',
    assignedTo: '',
    priority: 'medium',
    dueDate: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const tasksCollection = collection(db, 'tasks');

      await addDoc(tasksCollection, {
        ...task,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'web-admin', // Kullanıcı bilgisi buraya
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
      });

      alert('İş emri başarıyla oluşturuldu!');

      // Formu temizle
      setTask({
        title: '',
        description: '',
        assignedTo: '',
        priority: 'medium',
        dueDate: ''
      });

    } catch (error) {
      console.error('Hata:', error);
      alert('İş emri oluşturulamadı!');
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-white shadow rounded">
      <h2 className="text-2xl font-bold mb-6">Yeni İş Emri Oluştur</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="title">Başlık</Label>
          <Input
            id="title"
            type="text"
            value={task.title}
            onChange={(e) => setTask({...task, title: e.target.value})}
            required
          />
        </div>

        <div>
          <Label htmlFor="description">Açıklama</Label>
          <Textarea
            id="description"
            value={task.description}
            onChange={(e) => setTask({...task, description: e.target.value})}
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="assignedTo">Atanan Kişi/Kullanıcı ID</Label>
          <Input
            id="assignedTo"
            type="text"
            value={task.assignedTo}
            onChange={(e) => setTask({...task, assignedTo: e.target.value})}
            required
          />
        </div>

        <div>
          <Label htmlFor="priority">Öncelik</Label>
          <Select
            value={task.priority}
            onValueChange={(value) => setTask({...task, priority: value})}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seçin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Düşük</SelectItem>
              <SelectItem value="medium">Orta</SelectItem>
              <SelectItem value="high">Yüksek</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="dueDate">Son Tarih</Label>
          <Input
            id="dueDate"
            type="date"
            value={task.dueDate}
            onChange={(e) => setTask({...task, dueDate: e.target.value})}
          />
        </div>

        <Button type="submit" className="w-full">
          İş Emrini Oluştur
        </Button>
      </form>
    </div>
  );
}
