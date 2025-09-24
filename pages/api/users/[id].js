import { getUserById, updateUser, deleteUser } from '../../../lib/users';

export default function handler(req, res) {
  const { method } = req;
  const { id } = req.query;

  switch (method) {
    case 'GET':
      const user = getUserById(id);
      if (!user) {
        return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
      }
      // Şifreyi gizle
      const { password, ...userWithoutPassword } = user;
      res.status(200).json(userWithoutPassword);
      break;

    case 'PUT':
      // Kullanıcı güncelle
      const { username, email, password, role } = req.body;

      // Kullanıcı var mı?
      const existingUser = getUserById(id);
      if (!existingUser) {
        return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
      }

      // Kullanıcı adı ve email benzersiz olmalı (mevcut kullanıcı hariç)
      const users = getUsers();
      const duplicateUser = users.find(user => 
        user.id !== parseInt(id) && (user.username === username || user.email === email)
      );
      if (duplicateUser) {
        return res.status(400).json({ message: 'Bu kullanıcı adı veya e-posta zaten kullanımda.' });
      }

      const updatedUser = updateUser(id, { username, email, password, role });
      if (!updatedUser) {
        return res.status(400).json({ message: 'Kullanıcı güncellenirken hata oluştu.' });
      }

      // Şifreyi gizle
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.status(200).json(userWithoutPassword);
      break;

    case 'DELETE':
      // Kullanıcı sil
      const deleted = deleteUser(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
      }
      res.status(200).json({ message: 'Kullanıcı silindi.' });
      break;

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}