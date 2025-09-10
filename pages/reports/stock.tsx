"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
// import ExportButtons from '../../components/ui/ExportButtons'; // Ensure this path is correct, or update to the correct path if needed
import ExportButtons from '../../components/ExportButtons'; // Update this path to the correct location of ExportButtons
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { Card, CardContent } from '../../components/ui/card'; // Ensure this path is correct, or update to the correct path if needed

type StockTotal = {
  fabricTypeId: string | number;
  fabricType: string;
  totalEntry: number;
  totalUsed: number;
  totalRemaining: number;
};

type ConsumptionTable = {
  cuttingTable: string;
  totalUsed: number;
};

export default function StockReport() {
  const [totals, setTotals] = useState<StockTotal[]>([]);
  const [consumptionByTable, setConsumptionByTable] = useState<ConsumptionTable[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchData = async () => {
    try {
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const [stockRes, usageRes] = await Promise.all([
        axios.get("/api/fabric-entry/remaining-stock/by-fabric-type", { params }),
        axios.get("/api/fabric-entry/usage/by-table", { params })
      ]);

      setTotals(stockRes.data);
      setConsumptionByTable(usageRes.data);
    } catch (err) {
      console.error("Rapor verileri alınamadı:", err);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ✅ Excel Çıkışı
  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(totals);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stok Raporu");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, `stok-raporu-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ✅ PDF Çıkışı
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Kumaş Stok Raporu", 14, 10);

    const tableData = totals.map((item) => [
      item.fabricType,
      item.totalEntry,
      item.totalUsed,
      item.totalRemaining
    ]);

    (doc as any).autoTable({
      head: [["Kumaş Türü", "Toplam Giriş", "Toplam Kullanım", "Kalan Stok"]],
      body: tableData,
    });

    doc.save(`stok-raporu-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6 text-sm md:text-base">
      <h1 className="text-xl font-bold mb-4">📊 Stok Raporu</h1>

    {/* Butonlar */}
    <ExportButtons exportExcel={exportToExcel} exportPDF={exportToPDF} />

    {/* Tarih Filtreleri */}
    <div className="flex flex-col sm:flex-row gap-3 items-center mb-4">
      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="sm:w-auto border rounded px-2 py-1" />
      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="sm:w-auto border rounded px-2 py-1" />
      <button onClick={fetchData} className="px-4 py-2 bg-blue-500 text-white rounded">Filtrele</button>
    </div>

    {/* Grafik: Stok Durumu */}
    <div className="h-[250px] md:h-[350px] bg-white border rounded shadow">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={totals} margin={{ top: 20, right: 10, left: -10, bottom: 40 }}>
          <XAxis dataKey="fabricType" angle={-20} textAnchor="end" interval={0} tick={{ fontSize: 12 }} height={70} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="totalEntry" fill="#60a5fa" name="Toplam Giriş" />
          <Bar dataKey="totalUsed" fill="#f87171" name="Toplam Kullanım" />
          <Bar dataKey="totalRemaining" fill="#34d399" name="Kalan Stok" />
        </BarChart>
      </ResponsiveContainer>
    </div>

    {/* Detay Kartları */}
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
      {totals.map((item: any) => (
        <Card key={item.fabricTypeId} className="shadow">
          <CardContent>
            <p><strong>Tür:</strong> {item.fabricType}</p>
            <p>Giriş: {item.totalEntry} kg</p>
            <p>Kullanım: {item.totalUsed} kg</p>
            <p>Kalan: {item.totalRemaining} kg</p>
          </CardContent>
        </Card>
      ))}
    </div>

    {/* Kesim Masası Grafiği */}
    <h2 className="text-2xl font-bold mt-8">🧵 Kesim Masası Bazlı Tüketim</h2>
    <div className="h-[250px] md:h-[350px] bg-white border rounded shadow">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={consumptionByTable} margin={{ top: 20, right: 10, left: -10, bottom: 40 }}>
          <XAxis dataKey="cuttingTable" angle={-20} textAnchor="end" interval={0} tick={{ fontSize: 12 }} height={70} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="totalUsed" fill="#facc15" name="Kullanım (kg)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);
