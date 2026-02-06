import { getUsers, addUser } from '../../../lib/users';

export default async function handler(req, res) {
  const { method } = req;

  switch (method) {
    case 'GET':
      // Tüm kullanıcıları döndür
      try {
        const users = await getUsers();
        // Şifreleri gizle, name'i koru
        const usersWithoutPassword = users.map(user => {
          const { password, ...userWithoutPassword } = user;
          return userWithoutPassword;
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
        const { username, email, password, role, stockAccess, fasonAccess, mobileAccess } = req.body;

        // Gerekli alanların kontrolü
        if (!username || !email || !password) {
          return res.status(400).json({ error: 'Eksik bilgi girdiniz.' });
        }

        // Email benzersiz olmalı
        const users = await getUsers();
        const existingUser = users.find(user => user.email === email);
        if (existingUser) {
          return res.status(400).json({ error: 'Bu e-posta adresi zaten kullanımda.' });
        }

        const newUser = await addUser({ username, email, password, role, stockAccess, fasonAccess, mobileAccess });
        // Şifreyi döndürme ve name'i username'e çevir
        const { password: _, name, ...userWithoutPassword } = newUser;
        res.status(201).json({ ...userWithoutPassword, username: name });
      } catch (error) {
        console.error('Error adding user:', error);
        const errorMessage = process.env.NODE_ENV === 'development' ? error.message : 'Kullanıcı eklenirken hata oluştu.';
        res.status(500).json({ error: errorMessage });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}
