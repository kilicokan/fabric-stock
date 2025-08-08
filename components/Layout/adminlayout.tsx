// components/layout/AdminLayout.tsx
import React from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

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
