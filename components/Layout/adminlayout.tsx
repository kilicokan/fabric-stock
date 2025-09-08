// components/layout/AdminLayout.tsx
import React from "react";
// Update the import path to the correct location of Sidebar
import Sidebar from "../Sidebar"; // <-- Change this path if Sidebar is located elsewhere, e.g. './Sidebar' or '../Sidebar/Sidebar'
import Header from "../Header";

type Props = {
  children: React.ReactNode;
};

export default function AdminLayout({ children }: Props) {
  return (
    <div className="min-h-screen flex bg-gray-100">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header />
        <main className="p-6 pt-6 md:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
