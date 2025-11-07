import { useState } from 'react';
import axios from 'axios';
import AuthGuard from '../../components/AuthGuard';

export default function AddUser() {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'user'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/admin/users', formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      alert('Kullanıcı başarıyla eklendi');
    } catch (err) {
      console.error(err);
      alert('Kullanıcı eklenirken hata oluştu');
    }
  };

  return (
    <AuthGuard requiredRole="admin">
      <div>
        <h1>Yeni Kullanıcı Ekle</h1>
        <form onSubmit={handleSubmit}>
          {/* Form alanları */}
        </form>
      </div>
    </AuthGuard>
  );
}