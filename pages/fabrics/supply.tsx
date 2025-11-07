import React, { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableRow, Paper, Typography, Button } from "@mui/material";
import ExportButtons from "../../components/ExportButtons";
import * as XLSX from "xlsx";
import axios from "axios";

interface Supply {
  id: string;
  supplierName: string;
  fabricType: string;
  color: string;
  arrivalDate: string;
  quantityKg: number;
  quantityMeter: number;
}

function SupplyList() {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/fabrics/supply")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setSupplies(data);
        } else {
          throw new Error("Invalid data format received");
        }
      })
      .catch((err) => {
        console.error("Error fetching supplies:", err);
        setError("Failed to load supplies. Please try again later.");
        setSupplies([]);
      });
  }, []);

  // Import function
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      let parsedData: any[] = [];

      if (fileExtension === 'csv') {
        const text = await file.text();
        parsedData = parseCSV(text);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const buffer = await file.arrayBuffer();
        parsedData = XLSX.utils.sheet_to_json(XLSX.read(buffer, { type: 'array' }).Sheets[XLSX.read(buffer, { type: 'array' }).SheetNames[0]]);
      } else {
        alert('Desteklenmeyen dosya formatı. Lütfen CSV veya Excel dosyası yükleyin.');
        return;
      }

      const response = await axios.post('/api/fabrics/import', { supplies: parsedData });
      alert(response.data.message);
      // Refresh the list
      window.location.reload();
    } catch (error: any) {
      console.error('Import error:', error);
      alert('İçe aktarma sırasında hata oluştu: ' + (error.response?.data?.message || error.message));
    }
  };

  // Helper function to parse CSV
  const parseCSV = (csvContent: string): any[] => {
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1);

    return rows.map(row => {
      const values = row.split(',').map(v => v.trim().replace(/"/g, ''));
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      return obj;
    });
  };

  if (error) {
    return (
      <Paper sx={{ padding: 2, maxWidth: "1000px", margin: "2rem auto" }}>
        <Typography variant="h5" gutterBottom>
          Kumaş Tedarik Dökümü
        </Typography>
        <Typography color="error">{error}</Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ padding: 2, maxWidth: "1000px", margin: "2rem auto" }}>
      <Typography variant="h5" gutterBottom>
        Kumaş Tedarik Dökümü
      </Typography>
      <div style={{ marginBottom: "1rem", display: "flex", gap: "1rem", alignItems: "center" }}>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleImport}
          style={{ display: "none" }}
          id="import-file"
        />
        <label htmlFor="import-file">
          <Button variant="contained" color="success" component="span">
            İçe Aktar
          </Button>
        </label>
        <ExportButtons
          data={supplies.map((supply) => ({
            Tedarikçi: supply.supplierName,
            "Kumaş Tipi": supply.fabricType,
            Renk: supply.color,
            "Geliş Tarihi": new Date(supply.arrivalDate).toLocaleDateString(),
            "Miktar (kg)": supply.quantityKg,
            "Miktar (metre)": supply.quantityMeter,
          }))}
          filename="Kumas_Tedarik_Dokumu"
        />
      </div>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Tedarikçi</TableCell>
            <TableCell>Kumaş Tipi</TableCell>
            <TableCell>Renk</TableCell>
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
              <TableCell>{supply.color}</TableCell>
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