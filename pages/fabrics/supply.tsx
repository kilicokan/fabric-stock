import React, { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableRow, Paper, Typography, Button } from "@mui/material";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Supply {
  id: string;
  supplierName: string;
  fabricType: string;
  arrivalDate: string;
  quantityKg: number;
  quantityMeter: number;
}

function SupplyList() {
  const [supplies, setSupplies] = useState<Supply[]>([]);

  useEffect(() => {
    fetch("/api/fabrics/supply")
      .then((res) => res.json())
      .then((data) => setSupplies(data))
      .catch((err) => console.error("Error fetching supplies:", err));
  }, []);

  // Excel export function
  const exportToExcel = () => {
    const worksheetData = supplies.map((supply) => ({
      Tedarikçi: supply.supplierName,
      "Kumaş Tipi": supply.fabricType,
      "Geliş Tarihi": new Date(supply.arrivalDate).toLocaleDateString(),
      "Miktar (kg)": supply.quantityKg,
      "Miktar (metre)": supply.quantityMeter,
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kumaş Tedarik");
    XLSX.writeFile(workbook, "Kumas_Tedarik_Dokumu.xlsx");
  };

  // PDF export function
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Kumaş Tedarik Dökümü", 14, 10);

    autoTable(doc, {
      head: [["Tedarikçi", "Kumaş Tipi", "Geliş Tarihi", "Miktar (kg)", "Miktar (metre)"]],
      body: supplies.map((supply) => [
        supply.supplierName,
        supply.fabricType,
        new Date(supply.arrivalDate).toLocaleDateString(),
        supply.quantityKg,
        supply.quantityMeter,
      ]),
      startY: 20,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [66, 165, 245], textColor: [255, 255, 255] },
    });

    doc.save("Kumas_Tedarik_Dokumu.pdf");
  };

  return (
    <Paper sx={{ padding: 2, maxWidth: "1000px", margin: "2rem auto" }}>
      <Typography variant="h5" gutterBottom>
        Kumaş Tedarik Dökümü
      </Typography>
      <div style={{ marginBottom: "1rem" }}>
        <Button
          variant="contained"
          color="primary"
          onClick={exportToExcel}
          sx={{ marginRight: 1 }}
        >
          Excel'e Aktar
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={exportToPDF}
        >
          PDF'e Aktar
        </Button>
      </div>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Tedarikçi</TableCell>
            <TableCell>Kumaş Tipi</TableCell>
            <TableCell>Geliş Tarihi</TableCell>
            <TableCell>Miktar (kg)</TableCell>
            <TableCell>Miktar (metre)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {supplies.map((supply) => (
            <TableRow key={supply.id}>
              <TableCell>{supply.supplierName}</TableCell>
              <TableCell>{supply.fabricType}</TableCell>
              <TableCell>{new Date(supply.arrivalDate).toLocaleDateString()}</TableCell>
              <TableCell>{supply.quantityKg}</TableCell>
              <TableCell>{supply.quantityMeter}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

export default SupplyList;