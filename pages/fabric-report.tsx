import { useEffect, useState } from "react";
import axios from "axios";

export default function Reports() {
  const [stock, setStock] = useState<any[]>([]);

  useEffect(() => {
    axios.get("/api/reports/stock").then((res) => setStock(res.data));
  }, []);

  return (
    <div>
      <h1>Stok Raporu</h1>
      <table border={1} cellPadding={5}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Kumaş Türü</th>
            <th>Renk</th>
            <th>Ağırlık (Kg)</th>
            <th>Uzunluk (Metre)</th>
          </tr>
        </thead>
        <tbody>
          {stock.map((item) => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>{item.fabricType}</td>
              <td>{item.color}</td>
              <td>{item.weightKg}</td>
              <td>{item.lengthMeter}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
