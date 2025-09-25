import { getUserById, getUsers, updateUser, deleteUser } from '../../../lib/users';

export default function handler(req, res) {
  const { method } = req;
  const { id } = req.query;

  switch (method) {
    case 'GET':
      {
        const user = getUserById(id);
        if (!user) {
          return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }
        // Şifreyi gizle
        const { password: userPassword, ...userWithoutPassword } = user;
        return res.status(200).json(userWithoutPassword);
      }

    case 'PUT':
      {
        const { username, email, password: newPassword, role } = req.body;

        // Kullanıcı var mı?
        const existingUser = getUserById(id);
        if (!existingUser) {
          return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        // Kullanıcı adı ve email benzersiz olmalı (mevcut kullanıcı hariç)
        const users = getUsers();
        const usernameTaken = users.some(
          (u) => u.username === username && u.id !== id
        );
        const emailTaken = users.some(
          (u) => u.email === email && u.id !== id
        );

        if (usernameTaken) {
          return res.status(400).json({ message: 'Bu kullanıcı adı zaten kullanılıyor.' });
        }
        if (emailTaken) {
          return res.status(400).json({ message: 'Bu email zaten kullanılıyor.' });
        }

        // Güncellenecek veriler
        const updatedData = { username, email, role };
        if (newPassword) {
          updatedData.password = newPassword; // sadece girilmişse
        }

        // Kullanıcıyı güncelle
        const updatedUser = updateUser(id, updatedData);

        // Şifreyi gizle
        const { password: pwd, ...userWithoutPassword } = updatedUser;

        return res.status(200).json({ message: 'Kullanıcı güncellendi.', user: userWithoutPassword });
      }

    case 'DELETE':
      {
        const existingUser = getUserById(id);
        if (!existingUser) {
          return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        deleteUser(id);
        return res.status(200).json({ message: 'Kullanıcı silindi.' });
      }

    default:
      return res.status(405).json({ message: 'Method not allowed' });
  }
}
