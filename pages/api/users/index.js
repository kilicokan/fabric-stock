import { getUsers, addUser } from '../../../lib/users';

export default function handler(req, res) {
  const { method } = req;

  switch (method) {
    case 'GET':
      // Tüm kullanıcıları döndür
      const users = getUsers();
      // Şifreleri gizle
      const usersWithoutPassword = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      res.status(200).json(usersWithoutPassword);
      break;

    case 'POST':
      // Yeni kullanıcı ekle
      const { username, email, password, role } = req.body;

      // Gerekli alanların kontrolü
      if (!username || !email || !password) {
        return res.status(400).json({ message: 'Eksik bilgi girdiniz.' });
      }

      // Kullanıcı adı ve email benzersiz olmalı
      const existingUser = getUsers().find(user => user.username === username || user.email === email);
      if (existingUser) {
        return res.status(400).json({ message: 'Bu kullanıcı adı veya e-posta zaten kullanımda.' });
      }

      const newUser = addUser({ username, email, password, role });
      // Şifreyi döndürme
      const { password: _, ...userWithoutPassword } = newUser;
      res.status(201).json(userWithoutPassword);
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}