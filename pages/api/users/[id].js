require('dotenv').config({ path: '../../../.env' });
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
const { getUserById, getUsers, updateUser, deleteUser } = require('../../../lib/users');

export default async function handler(req, res) {
  const { method } = req;
  const { id } = req.query;

  switch (method) {
    case 'GET':
      {
        try {
          const user = await getUserById(id);
          if (!user) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
          }
          // Şifreyi gizle ve name'i username'e çevir
          const { password: userPassword, name, ...userWithoutPassword } = user;
          return res.status(200).json({ ...userWithoutPassword, username: name });
        } catch (error) {
          console.error('Error fetching user:', error);
          return res.status(500).json({ error: 'Kullanıcı getirilirken hata oluştu.' });
        }
      }

    case 'PUT':
      {
        try {
          const { username, email, password: newPassword, role, stockAccess, fasonAccess } = req.body;

          // Kullanıcı var mı?
          const existingUser = await getUserById(id);
          if (!existingUser) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
          }

          // Kullanıcı adı ve email benzersiz olmalı (mevcut kullanıcı hariç)
          const users = await getUsers();
          const usernameTaken = users.some(
            (u) => u.name === username && u.id !== parseInt(id)
          );
          const emailTaken = users.some(
            (u) => u.email === email && u.id !== parseInt(id)
          );

          if (usernameTaken) {
            return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' });
          }
          if (emailTaken) {
            return res.status(400).json({ error: 'Bu email zaten kullanılıyor.' });
          }

          // Güncellenecek veriler
          const updatedData = { username, email, role, stockAccess, fasonAccess };
          if (newPassword) {
            updatedData.password = newPassword; // sadece girilmişse
          }

          // Kullanıcıyı güncelle
          const updatedUser = await updateUser(id, updatedData);

          // Şifreyi gizle ve name'i username'e çevir
          const { password: pwd, name, ...userWithoutPassword } = updatedUser;

          return res.status(200).json({ message: 'Kullanıcı güncellendi.', user: { ...userWithoutPassword, username: name } });
        } catch (error) {
          console.error('Error updating user:', error);
          return res.status(500).json({ error: 'Kullanıcı güncellenirken hata oluştu.' });
        }
      }

    case 'DELETE':
      {
        try {
          const existingUser = await getUserById(id);
          if (!existingUser) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
          }

          await deleteUser(id);
          return res.status(200).json({ message: 'Kullanıcı silindi.' });
        } catch (error) {
          console.error('Error deleting user:', error);
          return res.status(500).json({ error: 'Kullanıcı silinirken hata oluştu.' });
        }
      }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
