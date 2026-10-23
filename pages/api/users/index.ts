import type { NextApiRequest, NextApiResponse } from "next";
import { addUser, getUsers } from "../../../lib/users";
import { withCors } from "../../../lib/cors";
import { requireApiAuth } from "@/lib/api-auth";

type CreateUserBody = {
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
  name: string | null;
  phone: string | null;
  stockAccess: boolean;
  fasonAccess: boolean;
  mobileAccess: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const auth = await requireApiAuth(req, res, {
    requiredRole: "ADMIN",
    requireLicense: true,
  });
  if (!auth) return;

  if (req.method === "GET") {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    try {
      const users = await getUsers();
      const usersWithoutPassword: PublicUser[] = users.map(({ password: _password, ...safeUser }) => safeUser);

      const isMobileRequest = req.query.format === "mobile";

      if (isMobileRequest) {
        return res.status(200).json({
          success: true,
          data: usersWithoutPassword.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
          })),
        });
      }

      return res.status(200).json(usersWithoutPassword);
    } catch (error: unknown) {
      console.error("Error fetching users:", error);
      return res.status(500).json({
        error: "Kullanicilar yuklenirken hata olustu.",
        success: false,
      });
    }
  }

  if (req.method === "POST") {
    try {
      const { username, email, password, role, stockAccess, fasonAccess, mobileAccess, isActive } =
        (req.body || {}) as CreateUserBody;

      if (!username || !email || !password) {
        return res.status(400).json({ error: "Eksik bilgi girdiniz." });
      }

      const users = await getUsers();
      const existingUser = users.find((user) => user.email === email);
      if (existingUser) {
        return res.status(400).json({ error: "Bu e-posta adresi zaten kullanimda." });
      }

      const newUser = await addUser({
        username,
        email,
        password,
        role,
        stockAccess,
        fasonAccess,
        mobileAccess,
        isActive,
      });

      return res.status(201).json({
        ...newUser,
        username: newUser.name || "",
      });
    } catch (error: unknown) {
      console.error("Error adding user:", error);
      const errorMessage =
        process.env.NODE_ENV === "development" && error instanceof Error
          ? error.message
          : "Kullanici eklenirken hata olustu.";
      return res.status(500).json({ error: errorMessage });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
};

export default withCors(handler);
