import type { NextApiRequest, NextApiResponse } from "next";
import { deleteUser, getUserById, getUsers, updateUser } from "../../../lib/users";
import { withCors } from "../../../lib/cors";
import { requireApiAuth } from "@/lib/api-auth";

type UpdateUserBody = {
  username?: string;
  email?: string;
  password?: string;
  role?: string;
  stockAccess?: boolean;
  fasonAccess?: boolean;
  mobileAccess?: boolean;
  isActive?: boolean;
};

type PublicUser = {
  id: number;
  email: string;
  role: string;
  phone: string | null;
  stockAccess: boolean;
  fasonAccess: boolean;
  mobileAccess: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  username: string;
};

type GetResponse = PublicUser | { error: string };
type PutResponse = { message: string; user: PublicUser } | { error: string };
type DeleteResponse = { message: string } | { error: string };

const toPublicUser = (user: {
  id: number;
  email: string;
  role: string;
  name: string | null;
  phone: string | null;
  stockAccess: boolean;
  fasonAccess: boolean;
  mobileAccess: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PublicUser => ({
  id: user.id,
  email: user.email,
  role: user.role,
  phone: user.phone,
  stockAccess: user.stockAccess,
  fasonAccess: user.fasonAccess,
  mobileAccess: user.mobileAccess,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  username: user.name || "",
});

const parseUserId = (raw: string | string[] | undefined): number | null => {
  if (!raw || Array.isArray(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const handler = async (req: NextApiRequest, res: NextApiResponse<GetResponse | PutResponse | DeleteResponse>) => {
  const auth = await requireApiAuth(req, res, {
    requiredRole: "ADMIN",
    requireLicense: true,
  });
  if (!auth) return;

  const userId = parseUserId(req.query.id);
  if (!userId) {
    return res.status(400).json({ error: "Gecersiz kullanici ID." });
  }

  if (req.method === "GET") {
    try {
      const user = await getUserById(String(userId));
      if (!user) {
        return res.status(404).json({ error: "Kullanici bulunamadi." });
      }

      return res.status(200).json(toPublicUser(user));
    } catch (error: unknown) {
      console.error("Error fetching user:", error);
      return res.status(500).json({ error: "Kullanici getirilirken hata olustu." });
    }
  }

  if (req.method === "PUT") {
    try {
      const {
        username,
        email,
        password: newPassword,
        role,
        stockAccess,
        fasonAccess,
        mobileAccess,
        isActive,
      } = (req.body || {}) as UpdateUserBody;

      for (const [key, value] of Object.entries({ stockAccess, fasonAccess, mobileAccess, isActive })) {
        if (value !== undefined && typeof value !== "boolean") {
          const label = key === "mobileAccess" ? "Mobil erişim" : key === "stockAccess" ? "Stok erişimi" : key === "fasonAccess" ? "Fason erişimi" : "Aktif durumu";
          return res.status(400).json({
            error: `${label} boolean olmalıdır.`,
          });
        }
      }

      if (
        username === undefined &&
        email === undefined &&
        newPassword === undefined &&
        role === undefined &&
        stockAccess === undefined &&
        fasonAccess === undefined &&
        mobileAccess === undefined &&
        isActive === undefined
      ) {
        return res.status(400).json({ error: "Guncellenecek en az bir alan belirtilmelidir." });
      }

      if (username !== undefined && !username.trim()) {
        return res.status(400).json({ error: "Kullanici adi bos olamaz." });
      }
      if (email !== undefined && !email.trim()) {
        return res.status(400).json({ error: "Email bos olamaz." });
      }

      const existingUser = await getUserById(String(userId));
      if (!existingUser) {
        return res.status(404).json({ error: "Kullanici bulunamadi." });
      }

      const users = await getUsers();
      const usernameTaken =
        username !== undefined && users.some((u) => (u.name || "") === username && u.id !== userId);
      const emailTaken = email !== undefined && users.some((u) => u.email === email && u.id !== userId);

      if (usernameTaken) {
        return res.status(400).json({ error: "Bu kullanici adi zaten kullaniliyor." });
      }
      if (emailTaken) {
        return res.status(400).json({ error: "Bu email zaten kullaniliyor." });
      }

      const updatedData: UpdateUserBody = {
        username,
        email,
        role,
        stockAccess,
        fasonAccess,
        mobileAccess,
        isActive,
      };

      if (newPassword) {
        updatedData.password = newPassword;
      }

      await updateUser(String(userId), updatedData);
      const persistedUser = await getUserById(String(userId));
      if (!persistedUser) {
        return res.status(500).json({
          error: "Kullanici guncellendi ancak veritabani degisikligi dogrulanamadi.",
        });
      }

      const normalizedAccessValues = {
        stockAccess: stockAccess !== undefined ? stockAccess : persistedUser.stockAccess,
        fasonAccess: fasonAccess !== undefined ? fasonAccess : persistedUser.fasonAccess,
        mobileAccess: mobileAccess !== undefined ? mobileAccess : persistedUser.mobileAccess,
        isActive: isActive !== undefined ? isActive : persistedUser.isActive,
      };

      if (
        persistedUser.stockAccess !== normalizedAccessValues.stockAccess ||
        persistedUser.fasonAccess !== normalizedAccessValues.fasonAccess ||
        persistedUser.mobileAccess !== normalizedAccessValues.mobileAccess ||
        persistedUser.isActive !== normalizedAccessValues.isActive
      ) {
        console.error("User access update did not persist:", {
          userId,
          requested: normalizedAccessValues,
          persisted: {
            stockAccess: persistedUser.stockAccess,
            fasonAccess: persistedUser.fasonAccess,
            mobileAccess: persistedUser.mobileAccess,
            isActive: persistedUser.isActive,
          },
        });
        return res.status(500).json({
          error: "Kullanici erişim izinleri veritabanında doğrulanamadı.",
        });
      }

      return res.status(200).json({
        message: "Kullanici guncellendi.",
        user: toPublicUser(persistedUser),
      });
    } catch (error: unknown) {
      console.error("Error updating user:", error);
      return res.status(500).json({ error: "Kullanici guncellenirken hata olustu." });
    }
  }

  if (req.method === "DELETE") {
    try {
      const existingUser = await getUserById(String(userId));
      if (!existingUser) {
        return res.status(404).json({ error: "Kullanici bulunamadi." });
      }

      await deleteUser(String(userId));
      return res.status(200).json({ message: "Kullanici silindi." });
    } catch (error: unknown) {
      console.error("Error deleting user:", error);
      return res.status(500).json({ error: "Kullanici silinirken hata olustu." });
    }
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  return res.status(405).json({ error: "Method not allowed" });
};

export default withCors(handler);
