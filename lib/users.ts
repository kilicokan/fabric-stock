import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import prisma from './prisma';
import bcrypt from 'bcryptjs';
import { Prisma, Role } from '@prisma/client';

interface UserData {
  username: string;
  email: string;
  password: string;
  role?: string;
  stockAccess?: boolean;
  fasonAccess?: boolean;
  mobileAccess?: boolean;
}

interface UpdateData {
  username?: string;
  email?: string;
  password?: string;
  role?: string;
  stockAccess?: boolean;
  fasonAccess?: boolean;
  mobileAccess?: boolean;
}

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
        mobileAccess: true,
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

async function getUserById(id: string) {
  try {
    const userId = parseInt(id);
    if (isNaN(userId)) {
      throw new Error('Geçersiz kullanıcı ID');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        name: true,
        phone: true,
        stockAccess: true,
        fasonAccess: true,
        mobileAccess: true,
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

async function addUser(userData: UserData) {
  try {
    const { username, email, password, role, stockAccess, fasonAccess, mobileAccess } = userData;

    // Validate required fields
    if (!username || !email || !password) {
      throw new Error('Username, email, and password are required');
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Geçersiz email formatı');
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { name: username }
        ]
      }
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new Error('Bu email zaten kullanılıyor');
      }
      if (existingUser.name === username) {
        throw new Error('Bu kullanıcı adı zaten kullanılıyor');
      }
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12); // Salt rounds 12'ye çıkarıldı

    // Map role to enum values with proper validation
    let mappedRole: Role = Role.OPERATOR; // default
    if (role) {
      const upperRole = role.toUpperCase();
      if (upperRole in Role) {
        mappedRole = upperRole as Role;
      } else {
        // Geçersiz rol için varsayılan ata
        mappedRole = Role.OPERATOR;
        console.warn(`Geçersiz rol: ${role}, varsayılan OPERATOR atandı`);
      }
    }

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: mappedRole,
        name: username,
        stockAccess: stockAccess || false,
        fasonAccess: fasonAccess || false,
        mobileAccess: mobileAccess || false
      },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        phone: true,
        stockAccess: true,
        fasonAccess: true,
        mobileAccess: true,
        createdAt: true,
        updatedAt: true
        // Password'ü response'tan çıkardık
      }
    });

    return newUser;
  } catch (error) {
    console.error('Error adding user:', error);
    throw error;
  }
}

async function updateUser(id: string, userData: UpdateData) {
  try {
    const userId = parseInt(id);
    if (isNaN(userId)) {
      throw new Error('Geçersiz kullanıcı ID');
    }

    const { username, email, password, role, stockAccess, fasonAccess, mobileAccess } = userData;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      throw new Error('Kullanıcı bulunamadı');
    }

    // Email validation if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Geçersiz email formatı');
      }
    }

    // Check for duplicate username or email
    if (username || email) {
      const duplicateCondition: any = {
        NOT: { id: userId }
      };

      const orConditions = [];
      if (username) orConditions.push({ name: username });
      if (email) orConditions.push({ email: email });

      if (orConditions.length > 0) {
        duplicateCondition.OR = orConditions;

        const duplicateUser = await prisma.user.findFirst({
          where: duplicateCondition
        });

        if (duplicateUser) {
          if (duplicateUser.name === username) {
            throw new Error('Bu kullanıcı adı zaten kullanılıyor');
          }
          if (duplicateUser.email === email) {
            throw new Error('Bu email zaten kullanılıyor');
          }
        }
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (username) updateData.name = username;
    if (email) updateData.email = email;
    
    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }
    
    if (role) {
      const upperRole = role.toUpperCase();
      if (upperRole in Role) {
        updateData.role = upperRole as Role;
      } else {
        console.warn(`Geçersiz rol: ${role}, rol değiştirilmedi`);
        // Rol geçersizse, mevcut rolü koru
      }
    }
    
    if (stockAccess !== undefined) updateData.stockAccess = stockAccess;
    if (fasonAccess !== undefined) updateData.fasonAccess = fasonAccess;
    if (mobileAccess !== undefined) updateData.mobileAccess = mobileAccess;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        phone: true,
        stockAccess: true,
        fasonAccess: true,
        mobileAccess: true,
        createdAt: true,
        updatedAt: true
        // Password'ü response'tan çıkardık
      }
    });

    return updatedUser;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

async function deleteUser(id: string) {
  try {
    const userId = parseInt(id);
    if (isNaN(userId)) {
      throw new Error('Geçersiz kullanıcı ID');
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      throw new Error('Kullanıcı bulunamadı');
    }

    await prisma.user.delete({
      where: { id: userId }
    });
    return true;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

export {
  getUsers,
  getUserById,
  addUser,
  updateUser,
  deleteUser
};