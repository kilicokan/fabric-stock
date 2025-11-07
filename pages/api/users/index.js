require('dotenv').config({ path: '../../../.env' });
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
const { getUsers, addUser } = require('../../../lib/users');

export default async function handler(req, res) {
  const { method } = req;

  switch (method) {
    case 'GET':
      // Tüm kullanıcıları döndür
      try {
        const users = await getUsers();
        // Şifreleri gizle ve name'i username'e çevir
        const usersWithoutPassword = users.map(user => {
          const { password, name, ...userWithoutPassword } = user;
          return { ...userWithoutPassword, username: name };
        });
        res.status(200).json(usersWithoutPassword);
      } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Kullanıcılar yüklenirken hata oluştu.' });
      }
      break;

    case 'POST':
      // Yeni kullanıcı ekle
      try {
        const { username, email, password, role, stockAccess, fasonAccess } = req.body;

        // Gerekli alanların kontrolü
        if (!username || !email || !password) {
          return res.status(400).json({ error: 'Eksik bilgi girdiniz.' });
        }

        // Kullanıcı adı ve email benzersiz olmalı
        const users = await getUsers();
        const existingUser = users.find(user => user.name === username || user.email === email);
        if (existingUser) {
          return res.status(400).json({ error: 'Bu kullanıcı adı veya e-posta zaten kullanımda.' });
        }

        const newUser = await addUser({ username, email, password, role, stockAccess, fasonAccess });
        // Şifreyi döndürme ve name'i username'e çevir
        const { password: _, name, ...userWithoutPassword } = newUser;
        res.status(201).json({ ...userWithoutPassword, username: name });
      } catch (error) {
        console.error('Error adding user:', error);
        res.status(500).json({ error: 'Kullanıcı eklenirken hata oluştu.' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}
