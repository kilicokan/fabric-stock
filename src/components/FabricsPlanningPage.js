import { useEffect, useState } from "react";
import { useProducts } from "../context/ProductContext";

// TypeScript tiplerini kaldır veya jsx dosyası yap
export default function FabricsPlanningPage() {
  const [rows, setRows] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    productId: "",
    fabricType: "",
    tableName: "",
    minKg: "",
    maxKg: "",
    minMeter: "",
    maxMeter: "",
    startDate: "",
    endDate: ""
  });
  
  const { products } = useProducts();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Örnek veri
        const data = [
          {
            id: 1,
            productId: 1,
            fabricType: "Pamuk",
            tableName: "Masa 1",
            quantityKg: 25,
            quantityMeter: 60,
            exitDate: "2025-09-10"
          },
          {
            id: 2,
            productId: 2,
            fabricType: "Polyester",
            tableName: "Masa 2",
            quantityKg: 40,
            quantityMeter: 100,
            exitDate: "2025-09-11"
          }
        ];
        setRows(data);
        setFilteredRows(data);
      } catch (err) {
        console.error("Veri yükleme hatası:", err);
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
        (filters.productId === "" || row.productId === Number(filters.productId)) &&
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

    setFilteredRows(result);
  }, [rows, filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId);
    return product ? `${product.name} (${product.code})` : "Bilinmeyen Ürün";
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px' }}>Kumaş Çıkış Planı</h1>
      
      {/* Basit Filtreleme */}
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>Filtreler</h3>
        <select name="productId" value={filters.productId} onChange={handleFilterChange} style={{ marginRight: '10px', padding: '5px' }}>
          <option value="">Tüm Ürünler</option>
          {products.map(product => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
        
        <input 
          type="text" 
          name="fabricType" 
          value={filters.fabricType} 
          onChange={handleFilterChange}
          placeholder="Kumaş tipi ara..."
          style={{ marginRight: '10px', padding: '5px' }}
        />
      </div>

      {/* Basit Tablo */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5' }}>
            <th style={{ padding: '10px', border: '1px solid #ddd' }}>Ürün</th>
            <th style={{ padding: '10px', border: '1px solid #ddd' }}>Kumaş Tipi</th>
            <th style={{ padding: '10px', border: '1px solid #ddd' }}>Masa</th>
            <th style={{ padding: '10px', border: '1px solid #ddd' }}>Miktar (kg)</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={4} style={{ padding: '20px', textAlign: 'center' }}>Yükleniyor...</td>
            </tr>
          ) : filteredRows.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: '20px', textAlign: 'center' }}>Kayıt bulunamadı</td>
            </tr>
          ) : (
            filteredRows.map(row => (
              <tr key={row.id}>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>{getProductName(row.productId)}</td>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>{row.fabricType}</td>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>{row.tableName}</td>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>{row.quantityKg} kg</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}