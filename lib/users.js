// Basit bir bellek içi depolama
let users = [
  { id: 1, username: 'admin', email: 'admin@example.com', password: 'admin123', role: 'admin' },
  { id: 2, username: 'user1', email: 'user1@example.com', password: 'user1123', role: 'user' }
];

let nextId = 3;

export const getUsers = () => users;

export const getUserById = (id) => users.find(user => user.id === parseInt(id));

export const addUser = (user) => {
  const newUser = {
    id: nextId++,
    username: user.username,
    email: user.email,
    password: user.password, // Gerçek uygulamada şifre hash'lenmeli!
    role: user.role || 'user'
  };
  users.push(newUser);
  return newUser;
};

export const updateUser = (id, updatedData) => {
  const userIndex = users.findIndex(user => user.id === parseInt(id));
  if (userIndex === -1) return null;

  // Şifre değiştirilmek istenmiyorsa, mevcut şifreyi koru
  if (!updatedData.password) {
    delete updatedData.password;
  }

  users[userIndex] = { ...users[userIndex], ...updatedData };
  return users[userIndex];
};

export const deleteUser = (id) => {
  const userIndex = users.findIndex(user => user.id === parseInt(id));
  if (userIndex === -1) return false;
  users.splice(userIndex, 1);
  return true;
};