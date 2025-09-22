import { useState } from "react";
import { Dialog } from "@headlessui/react";

type Document = {
  id: number;
  type: string;
  number: string;
  date: string;
  customer: string;
  warehouse: string;
  total: number;
};

type LineItem = {
  id: number;
  material: string;
  qty: number;
  unit: string;
  price: number;
  note?: string;
};

export default function FabricDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([
    {
      id: 1,
      type: "İrsaliye",
      number: "IRS-001",
      date: "2025-09-10",
      customer: "ABC Tekstil",
      warehouse: "Ana Depo",
      total: 1200,
    },
    {
      id: 2,
      type: "Fatura",
      number: "FAT-045",
      date: "2025-09-11",
      customer: "XYZ Tekstil",
      warehouse: "Üretim Depo",
      total: 3400,
    },
  ]);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    doc: Document | null;
  } | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [currentDoc, setCurrentDoc] = useState<Document | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // Sağ tık menüsü
  const handleContextMenu = (e: React.MouseEvent, doc: Document) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, doc });
  };

  const handleNew = () => {
    setCurrentDoc(null);
    setLineItems([]);
    setShowForm(true);
    setContextMenu(null);
  };

  const handleCopy = () => {
    if (!contextMenu?.doc) return;
    const copy = { ...contextMenu.doc, id: Date.now() };
    setCurrentDoc(copy);
    setLineItems([]);
    setShowForm(true);
    setContextMenu(null);
  };

  const handleDelete = () => {
    if (!contextMenu?.doc) return;
    setDocuments(docs => docs.filter(d => d.id !== contextMenu.doc!.id));
    setContextMenu(null);
  };

  const handleSave = () => {
    if (currentDoc) {
      setDocuments(docs => {
        const exists = docs.find(d => d.id === currentDoc.id);
        if (exists) {
          return docs.map(d => (d.id === currentDoc.id ? currentDoc : d));
        }
        return [...docs, currentDoc];
      });
    }
    setShowForm(false);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">📑 Kumaş İrsaliye / Fatura Listesi</h1>

      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2 border">Fiş Tipi</th>
            <th className="p-2 border">Fiş No</th>
            <th className="p-2 border">Tarih</th>
            <th className="p-2 border">Cari Hesap</th>
            <th className="p-2 border">Depo</th>
            <th className="p-2 border text-right">Tutar</th>
          </tr>
        </thead>
        <tbody>
          {documents.map(doc => (
            <tr
              key={doc.id}
              onContextMenu={(e) => handleContextMenu(e, doc)}
              className="hover:bg-gray-50 cursor-pointer"
            >
              <td className="p-2 border">{doc.type}</td>
              <td className="p-2 border">{doc.number}</td>
              <td className="p-2 border">{doc.date}</td>
              <td className="p-2 border">{doc.customer}</td>
              <td className="p-2 border">{doc.warehouse}</td>
              <td className="p-2 border text-right">{doc.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Sağ tık menüsü */}
      {contextMenu && (
        <ul
          className="absolute bg-white border rounded shadow-md"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer" onClick={handleNew}>
            ➕ Yeni
          </li>
          <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer" onClick={handleCopy}>
            📄 Kopyala
          </li>
          <li className="px-4 py-2 hover:bg-red-100 cursor-pointer" onClick={handleDelete}>
            🗑️ Sil
          </li>
        </ul>
      )}

      {/* Modal Form */}
      <Dialog open={showForm} onClose={() => setShowForm(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-lg shadow-lg p-6 w-full max-w-3xl">
            <Dialog.Title className="text-lg font-bold mb-4">
              {currentDoc ? "📝 İrsaliye / Fatura Düzenle" : "➕ Yeni Fiş"}
            </Dialog.Title>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <input
                className="border p-2 rounded"
                placeholder="Fiş Tipi"
                value={currentDoc?.type || ""}
                onChange={e => setCurrentDoc(d => ({
                  ...(d || {
                    id: Date.now(),
                    type: "",
                    number: "",
                    date: "",
                    customer: "",
                    warehouse: "",
                    total: 0
                  }),
                  type: e.target.value
                }))}
              />
              <input
                className="border p-2 rounded"
                placeholder="Fiş No"
                value={currentDoc?.number || ""}
                onChange={e => setCurrentDoc(d => ({ 
                  ...(d || { 
                    id: Date.now(), 
                    type: "", 
                    number: "", 
                    date: "", 
                    customer: "", 
                    warehouse: "", 
                    total: 0 
                  }), 
                  number: e.target.value 
                }))}
              />
              <input
                type="date"
                className="border p-2 rounded"
                value={currentDoc?.date || ""}
                onChange={e => setCurrentDoc(d => ({
                  ...(d || {
                    id: Date.now(),
                    type: "",
                    number: "",
                    date: "",
                    customer: "",
                    warehouse: "",
                    total: 0
                  }),
                  date: e.target.value
                }))}
              />
              <input
                className="border p-2 rounded"
                placeholder="Cari Hesap"
                value={currentDoc?.customer || ""}
                onChange={e => setCurrentDoc(d => ({
                  ...(d || {
                    id: Date.now(),
                    type: "",
                    number: "",
                    date: "",
                    customer: "",
                    warehouse: "",
                    total: 0
                  }),
                  customer: e.target.value
                }))}
              />
              <input
                className="border p-2 rounded"
                placeholder="Depo"
                value={currentDoc?.warehouse || ""}
                onChange={e => setCurrentDoc(d => ({
                  ...(d || {
                    id: Date.now(),
                    type: "",
                    number: "",
                    date: "",
                    customer: "",
                    warehouse: "",
                    total: 0
                  }),
                  warehouse: e.target.value
                }))}
              />
              <input
                type="number"
                className="border p-2 rounded"
                placeholder="Toplam"
                value={currentDoc?.total || 0}
                onChange={e => setCurrentDoc(d => ({
                  ...(d || {
                    id: Date.now(),
                    type: "",
                    number: "",
                    date: "",
                    customer: "",
                    warehouse: "",
                    total: 0
                  }),
                  total: parseFloat(e.target.value)
                }))}
              />
            </div>

            <div className="mb-4">
              <h3 className="font-semibold mb-2">Satırlar</h3>
              {lineItems.map(item => (
                <div key={item.id} className="flex gap-2 mb-2">
                  <input className="border p-1 flex-1" value={item.material} readOnly />
                  <input className="border p-1 w-20" value={item.qty} readOnly />
                  <input className="border p-1 w-20" value={item.price} readOnly />
                </div>
              ))}
              <button
                type="button"
                className="bg-blue-500 text-white px-3 py-1 rounded mt-2"
                onClick={() =>
                  setLineItems(items => [
                    ...items,
                    { id: Date.now(), material: "Kumaş", qty: 10, unit: "m", price: 50 },
                  ])
                }
              >
                ➕ Satır Ekle
              </button>
            </div>

            <div className="flex justify-end gap-2">
              <button
                className="bg-gray-300 px-4 py-2 rounded"
                onClick={() => setShowForm(false)}
              >
                Vazgeç
              </button>
              <button
                className="bg-green-600 text-white px-4 py-2 rounded"
                onClick={handleSave}
              >
                Kaydet
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}
