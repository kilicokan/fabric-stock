import { NextApiRequest, NextApiResponse } from "next";
import Sidebar from "./Sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}

export function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json([
    { id: 1, fabricType: "Pamuk", color: "Beyaz", weightKg: 100, lengthMeter: 200 },
    { id: 2, fabricType: "Polyester", color: "Mavi", weightKg: 50, lengthMeter: 120 }
  ]);
}

