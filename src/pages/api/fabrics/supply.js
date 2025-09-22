export default function handler(req, res) {
  // Örnek veri, veritabanı bağlantısı yerine kullanılabilir
  const supplies = [
    {
      id: 1,
      supplierName: "Tedarikçi A",
      fabricType: "Pamuk",
      arrivalDate: "2025-09-10T00:00:00.000Z",
      quantityKg: 120,
      quantityMeter: 300
    },
    {
      id: 2,
      supplierName: "Tedarikçi B",
      fabricType: "Polyester",
      arrivalDate: "2025-09-08T00:00:00.000Z",
      quantityKg: 80,
      quantityMeter: 200
    }
  ];
  res.status(200).json(supplies);
}