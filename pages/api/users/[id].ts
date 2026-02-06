import { getUserById, getUsers, updateUser, deleteUser } from '../../../lib/users';

export default async function handler(req, res) {
  const { method } = req;
  const { id } = req.query;

  // ID validasyonu
  const userId = parseInt(id);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Geçersiz kullanıcı ID.' });
  }

  switch (method) {
    case 'GET':
      {
        try {
          const user = await getUserById(userId);
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
          const { username, email, password: newPassword, role, stockAccess, fasonAccess, mobileAccess } = req.body;

          // Validasyon
          if (!username || !email) {
            return res.status(400).json({ error: 'Kullanıcı adı ve email zorunludur.' });
          }

          // Kullanıcı var mı?
          const existingUser = await getUserById(userId);
          if (!existingUser) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
          }

          // Kullanıcı adı ve email benzersiz olmalı
          const users = await getUsers();
          const usernameTaken = users.some(
            (u) => u.name === username && u.id !== userId
          );
          const emailTaken = users.some(
            (u) => u.email === email && u.id !== userId
          );

          if (usernameTaken) {
            return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' });
          }
          if (emailTaken) {
            return res.status(400).json({ error: 'Bu email zaten kullanılıyor.' });
          }

          // Güncellenecek veriler
          const updatedData = { 
            name: username, // username'i name olarak kaydet
            email, 
            role, 
            stockAccess, 
            fasonAccess,
            mobileAccess
          };
          
          if (newPassword) {
            updatedData.password = newPassword;
          }

          // Kullanıcıyı güncelle
          const updatedUser = await updateUser(userId, updatedData);

          // Şifreyi gizle ve name'i username'e çevir
          const { password: pwd, name, ...userWithoutPassword } = updatedUser;
          return res.status(200).json({ 
            message: 'Kullanıcı güncellendi.', 
            user: { ...userWithoutPassword, username: name } 
          });
        } catch (error) {
          console.error('Error updating user:', error);
          return res.status(500).json({ error: 'Kullanıcı güncellenirken hata oluştu.' });
        }
      }

    case 'DELETE':
      {
        try {
          const existingUser = await getUserById(userId);
          if (!existingUser) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
          }

          await deleteUser(userId);
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