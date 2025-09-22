import { useEffect, useState, useRef } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

type PlanningRow = {
  id: number;
  fabricType: string;
  tableName: string;
  quantityKg: number;
  quantityMeter: number;
  exitDate: string;
};

export default function FabricsPlanningPage() {
  const [rows, setRows] = useState<PlanningRow[]>([]);
  const [filteredRows, setFilteredRows] = useState<PlanningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    fabricType: "",
    tableName: "",
    minKg: "",
    maxKg: "",
    minMeter: "",
    maxMeter: "",
    startDate: "",
    endDate: ""
  });
  const [sortConfig, setSortConfig] = useState({
    key: "",
    direction: "asc"
  });
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Örnek veri
        const data: PlanningRow[] = [
          {
            id: 1,
            fabricType: "Pamuk",
            tableName: "Masa 1",
            quantityKg: 25,
            quantityMeter: 60,
            exitDate: "2025-09-10"
          },
          {
            id: 2,
            fabricType: "Polyester",
            tableName: "Masa 2",
            quantityKg: 40,
            quantityMeter: 100,
            exitDate: "2025-09-11"
          },
          {
            id: 3,
            fabricType: "Keten",
            tableName: "Masa 1",
            quantityKg: 30,
            quantityMeter: 75,
            exitDate: "2025-09-12"
          },
          {
            id: 4,
            fabricType: "Pamuk",
            tableName: "Masa 3",
            quantityKg: 20,
            quantityMeter: 50,
            exitDate: "2025-09-13"
          },
          {
            id: 5,
            fabricType: "İpek",
            tableName: "Masa 2",
            quantityKg: 15,
            quantityMeter: 45,
            exitDate: "2025-09-14"
          },
          {
            id: 6,
            fabricType: "Polyester",
            tableName: "Masa 4",
            quantityKg: 35,
            quantityMeter: 85,
            exitDate: "2025-09-15"
          }
        ];
        setRows(data);
        setFilteredRows(data);
      } catch (err) {
        setRows([]);
        setFilteredRows([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filtreleme işlevi
  useEffect(() => {
    let result = rows.filter(row => {
      return (
        (filters.fabricType === "" || row.fabricType.toLowerCase().includes(filters.fabricType.toLowerCase())) &&
        (filters.tableName === "" || row.tableName.toLowerCase().includes(filters.tableName.toLowerCase())) &&
        (filters.minKg === "" || row.quantityKg >= Number(filters.minKg)) &&
        (filters.maxKg === "" || row.quantityKg <= Number(filters.maxKg)) &&
        (filters.minMeter === "" || row.quantityMeter >= Number(filters.minMeter)) &&
        (filters.maxMeter === "" || row.quantityMeter <= Number(filters.maxMeter)) &&
        (filters.startDate === "" || new Date(row.exitDate) >= new Date(filters.startDate)) &&
        (filters.endDate === "" || new Date(row.exitDate) <= new Date(filters.endDate))
      );
    });

    // Sıralama uygula
    if (sortConfig.key) {
      result.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if ( > b[sortConfig.key]) {a[sortConfig.key]
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }

    setFilteredRows(result);
  }, [rows, filters, sortConfig]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSort = (key: string) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const resetFilters = () => {
    setFilters({
      fabricType: "",
      tableName: "",
      minKg: "",
      maxKg: "",
      minMeter: "",
      maxMeter: "",
      startDate: "",
      endDate: ""
    });
    setSortConfig({ key: "", direction: "asc" });
  };

  // Excel'e aktarma
  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kumaş Çıkış Planı");
    XLSX.writeFile(workbook, "kumas_cikis_plani.xlsx");
  };

  // PDF'e aktarma
  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Başlık
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text("Kumaş Çıkış Planı Raporu", 14, 15);
    
    // Tarih
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Oluşturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 22);
    
    // Toplam kayıt
    doc.text(`Toplam Kayıt: ${filteredRows.length}`, 14, 28);
    
    // Tablo
    const tableColumn = ["Kumaş Tipi", "Masa", "Miktar (kg)", "Miktar (metre)", "Çıkış Tarihi"];
    const tableRows: any[] = [];
    
    filteredRows.forEach(row => {
      const rowData = [
        row.fabricType,
        row.tableName,
        `${row.quantityKg} kg`,
        `${row.quantityMeter} m`,
        new Date(row.exitDate).toLocaleDateString('tr-TR')
      ];
      tableRows.push(rowData);
    });
    
    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [240, 240, 240]
      }
    });
    
    doc.save("kumas_cikis_plani.pdf");
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Kumaş Çıkış Planı</h1>
        <div className="flex space-x-2">
          <button
            onClick={exportToExcel}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Excel'e Aktar
          </button>
          <button
            onClick={exportToPDF}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            PDF'e Aktar
          </button>
        </div>
      </div>
      
      {/* Filtreleme Paneli */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kumaş Tipi</label>
            <input
              type="text"
              name="fabricType"
              value={filters.fabricType}
              onChange={handleFilterChange}
              placeholder="Kumaş tipi ara..."
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Masa Adı</label>
            <input
              type="text"
              name="tableName"
              value={filters.tableName}
              onChange={handleFilterChange}
              placeholder="Masa adı ara..."
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kg Aralığı</label>
            <div className="flex space-x-2">
              <input
                type="number"
                name="minKg"
                value={filters.minKg}
                onChange={handleFilterChange}
                placeholder="Min"
                className="w-1/2 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="number"
                name="maxKg"
                value={filters.maxKg}
                onChange={handleFilterChange}
                placeholder="Max"
                className="w-1/2 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Metre Aralığı</label>
            <div className="flex space-x-2">
              <input
                type="number"
                name="minMeter"
                value={filters.minMeter}
                onChange={handleFilterChange}
                placeholder="Min"
                className="w-1/2 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="number"
                name="maxMeter"
                value={filters.maxMeter}
                onChange={handleFilterChange}
                placeholder="Max"
                className="w-1/2 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tarih Aralığı</label>
            <div className="flex space-x-2">
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
                className="w-1/2 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
                className="w-1/2 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex items-end space-x-2">
            <button
              onClick={resetFilters}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
            >
              Filtreleri Sıfırla
            </button>
          </div>
        </div>
      </div>

      {/* Tablo */}
      <div className="bg-white rounded-lg shadow overflow-hidden" ref={tableRef}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("fabricType")}
                >
                  <div className="flex items-center">
                    <span>Kumaş Tipi</span>
                    {sortConfig.key === "fabricType" && (
                      <span className="ml-1">{sortConfig.direction === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("tableName")}
                >
                  <div className="flex items-center">
                    <span>Masa</span>
                    {sortConfig.key === "tableName" && (
                      <span className="ml-1">{sortConfig.direction === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("quantityKg")}
                >
                  <div className="flex items-center">
                    <span>Miktar (kg)</span>
                    {sortConfig.key === "quantityKg" && (
                      <span className="ml-1">{sortConfig.direction === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("quantityMeter")}
                >
                  <div className="flex items-center">
                    <span>Miktar (metre)</span>
                    {sortConfig.key === "quantityMeter" && (
                      <span className="ml-1">{sortConfig.direction === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("exitDate")}
                >
                  <div className="flex items-center">
                    <span>Çıkış Tarihi</span>
                    {sortConfig.key === "exitDate" && (
                      <span className="ml-1">{sortConfig.direction === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                      <span className="ml-2">Yükleniyor...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    Filtreleme kriterlerinize uygun kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredRows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {row.fabricType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{row.tableName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md font-medium">
                        {row.quantityKg} kg
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-md font-medium">
                        {row.quantityMeter} m
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {new Date(row.exitDate).toLocaleDateString('tr-TR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filteredRows.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 text-sm text-gray-500">
            Toplam {filteredRows.length} kayıt bulundu
          </div>
        )}
      </div>
    </div>
  );
}