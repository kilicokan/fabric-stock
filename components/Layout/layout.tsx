import { NextApiRequest, NextApiResponse } from "next";
import Sidebar from "./Sidebar";

type LayoutProps = {
  children: React.ReactNode;
  title?: string;
};

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-secondary-950">
      <Sidebar />
      <main className="flex-1 p-6 overflow-y-auto">{children}</main>
    </div>
  );
}

export function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json([
    { id: 1, fabricType: "Pamuk", color: "Beyaz", weightKg: 100, lengthMeter: 200 },
    { id: 2, fabricType: "Polyester", color: "Mavi", weightKg: 50, lengthMeter: 120 }
  ]);
}
