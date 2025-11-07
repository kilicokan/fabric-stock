const prisma = require('./prisma');
const bcrypt = require('bcryptjs');

async function getUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        name: true,
        phone: true,
        stockAccess: true,
        fasonAccess: true,
        createdAt: true,
        updatedAt: true
      }
    });
    return users;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

async function getUserById(id) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        name: true,
        phone: true,
        stockAccess: true,
        fasonAccess: true,
        createdAt: true,
        updatedAt: true
      }
    });
    return user;
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    throw error;
  }
}

async function addUser(userData) {
  try {
    const { username, email, password, role, stockAccess, fasonAccess } = userData;

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Map role to enum values
    let mappedRole = 'OPERATOR'; // default
    if (role) {
      if (role.toLowerCase() === 'admin') mappedRole = 'ADMIN';
      else if (role.toLowerCase() === 'user') mappedRole = 'OPERATOR';
      else mappedRole = role.toUpperCase(); // for other roles like STOCK_MANAGER, FASON_TRACKER
    }

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: mappedRole,
        name: username,
        stockAccess: stockAccess || false,
        fasonAccess: fasonAccess || false
      },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        name: true,
        phone: true,
        stockAccess: true,
        fasonAccess: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return newUser;
  } catch (error) {
    console.error('Error adding user:', error);
    throw error;
  }
}

async function updateUser(id, userData) {
  try {
    const { username, email, password, role, stockAccess, fasonAccess } = userData;

    const updateData = {};
    if (username) updateData.name = username;
    if (email) updateData.email = email;
    if (password) {
      // Hash the new password if provided
      updateData.password = await bcrypt.hash(password, 10);
    }
    if (role) {
      let mappedRole = role.toUpperCase();
      if (role.toLowerCase() === 'admin') mappedRole = 'ADMIN';
      else if (role.toLowerCase() === 'user') mappedRole = 'OPERATOR';
      updateData.role = mappedRole;
    }
    if (stockAccess !== undefined) updateData.stockAccess = stockAccess;
    if (fasonAccess !== undefined) updateData.fasonAccess = fasonAccess;

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        name: true,
        phone: true,
        stockAccess: true,
        fasonAccess: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return updatedUser;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

async function deleteUser(id) {
  try {
    await prisma.user.delete({
      where: { id: parseInt(id) }
    });
    return true;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

module.exports = {
  getUsers,
  getUserById,
  addUser,
  updateUser,
  deleteUser
};
