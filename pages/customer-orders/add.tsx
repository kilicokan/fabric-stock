// MiraApp Sipariş Formu - Yeni Taslak
// Kullanıcının ilettiği gereksinimlere uygun temel iskelet oluşturuldu.
// Ürün seçimi modalı, sağ tık menüsü, renk-beden entegrasyonu, iş emri oluşturma butonu eklenebilir altyapı hazırlanmıştır.

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { PlusCircle, Factory, Trash2 } from 'lucide-react'

export default function MiraOrderForm() {
  const [orderLines, setOrderLines] = useState([])
  const [selectedRow, setSelectedRow] = useState(null)
  const [productModalOpen, setProductModalOpen] = useState(false)

  const addEmptyLine = () => {
    setOrderLines(prev => [...prev, {
      id: Date.now(),
      productCode: '',
      productName: '',
      productionOrder: '',
      qty: 0,
      price: 0,
      colors: [],
    }])
  }

  const deleteLine = (id) => {
    setOrderLines(prev => prev.filter(l => l.id !== id))
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Sipariş Formu</h2>
        <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
          <Factory className="w-4 h-4" /> İş Emri Oluştur
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ürün Listesi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-800">
                <TableRow>
                  <TableHead className="text-white w-12">#</TableHead>
                  <TableHead className="text-white">Ürün Kodu</TableHead>
                  <TableHead className="text-white">Ürün Adı</TableHead>
                  <TableHead className="text-white">Üretim No</TableHead>
                  <TableHead className="text-white text-right">Miktar</TableHead>
                  <TableHead className="text-white text-right">Fiyat</TableHead>
                  <TableHead className="text-white">Renk / Beden</TableHead>
                  <TableHead className="text-white w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderLines.map((line, idx) => (
                  <TableRow
                    key={line.id}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setSelectedRow(line.id)
                    }}
                    className={selectedRow === line.id ? 'bg-slate-100' : ''}
                  >
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="font-mono">{line.productCode}</TableCell>
                    <TableCell>{line.productName}</TableCell>
                    <TableCell className="font-mono text-xs">{line.productionOrder}</TableCell>
                    <TableCell className="text-right">{line.qty}</TableCell>
                    <TableCell className="text-right">{line.price}</TableCell>
                    <TableCell>
                      {line.colors.length === 0 ? (
                        <Badge variant="secondary">Renk/Beden Yok</Badge>
                      ) : (
                        <div className="flex gap-1 flex-wrap">
                          {line.colors.map((c, i) => (
                            <Badge key={i} className="text-xs">{c.color}</Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteLine(line.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="pt-4 flex justify-between">
            <Button variant="outline" className="flex items-center gap-2" onClick={() => setProductModalOpen(true)}>
              <PlusCircle className="w-4 h-4" /> Ürün Ekle
            </Button>

            <Button variant="outline" className="flex items-center gap-2" onClick={addEmptyLine}>
              + Boş Satır
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sağ Tık Menü */}
      {selectedRow && (
        <div className="fixed z-50 bg-white shadow-lg rounded p-2 text-sm" style={{ top: 200, left: 300 }}>
          <p className="cursor-pointer hover:bg-gray-100 px-2 py-1" onClick={addEmptyLine}>Satır Ekle</p>
          <p className="cursor-pointer hover:bg-gray-100 px-2 py-1 text-red-500" onClick={() => deleteLine(selectedRow)}>Satırı Sil</p>
        </div>
      )}

      {/* Ürün Seçim Modali */}
      {productModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-4 w-[600px] shadow-xl">
            <h3 className="text-lg font-medium mb-3">Ürün Seç</h3>

            {/* Buraya ürün seçme grid yapısı eklenecek */}
            <div className="grid grid-cols-3 gap-3 max-h-[300px] overflow-y-auto">
              {/* Örnek ürün */}
              <Card onClick={() => {
                setOrderLines(prev => [...prev, {
                  id: Date.now(),
                  productCode: 'MAM.001.00001',
                  productName: 'Örnek T-Shirt',
                  productionOrder: '',
                  qty: 100,
                  price: 150,
                  colors: [
                    { color: 'BEYAZ', s: 30, m: 40, l: 30 },
                  ],
                }])
                setProductModalOpen(false)
              }} className="cursor-pointer hover:shadow-md transition p-4">
                <p className="font-mono text-sm">MAM.001.00001</p>
                <p className="text-sm">Örnek T-Shirt</p>
              </Card>
            </div>

            <div className="text-right mt-4">
              <Button variant="outline" onClick={() => setProductModalOpen(false)}>Kapat</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
