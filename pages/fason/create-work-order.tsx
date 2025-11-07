"use client"
import { useState, type ChangeEvent } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Factory, Plus, Save, X } from "lucide-react"
import SewingInstruction from "@/components/sewing-instruction.tsx"

interface ModelInfo {
  id: number
  modelCode: string
  modelName: string
  description: string
  color: string
  currency: string
  currencyPrice: number
  price: number
  packageLot: number
  totalQuantity: number
  totalAmount: number
}

interface Product {
  id: number
  code: string
  name: string
  description: string
}

export default function FasonCreateWorkOrder() {
  const [activeTab, setActiveTab] = useState("genel")
  const [isSealed, setIsSealed] = useState(false)
  const [isSample, setIsSample] = useState(false)
  const [modelInfos, setModelInfos] = useState<ModelInfo[]>([])


  const [formData, setFormData] = useState({
    orderNo: "",
    date: new Date().toISOString().split("T")[0],
    customer: "",
    requestDate: new Date().toISOString().split("T")[0],
    plannedDate: new Date().toISOString().split("T")[0],
    loadingDate: "",
  })

  const [isProductModalOpen, setIsProductModalOpen] = useState(false)

  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState("")
  const [colors, setColors] = useState<{ id: number; name: string }[]>([])

  const [selectedModelIndex, setSelectedModelIndex] = useState<number | null>(null)


  const handleAddModelInfo = () => {
    const newModel: ModelInfo = {
      id: modelInfos.length + 1,
      modelCode: "",
      modelName: "",
      description: "",
      color: "",
      currency: "TRY",
      currencyPrice: 0,
      price: 0,
      packageLot: 0,
      totalQuantity: 0,
      totalAmount: 0,
    }
    setModelInfos([...modelInfos, newModel])
  }



  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleDateChange = (e: ChangeEvent<HTMLInputElement>, field: string) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }))
  }

  const handleCheckboxChange = (checked: boolean, setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(checked)
  }

  const handleSubmit = () => {
    console.log("Form Data:", formData)
    console.log("Model Infos:", modelInfos)

    alert("İş emri başarıyla oluşturuldu!")
  }

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products')
      const data = await response.json()
      setProducts(data)
      setFilteredProducts(data)
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchColors = async () => {
    try {
      const response = await fetch('/api/colors')
      const data = await response.json()
      setColors(data)
    } catch (error) {
      console.error('Error fetching colors:', error)
    }
  }

  const handleProductSearch = (e: ChangeEvent<HTMLInputElement>) => {
    const searchTerm = e.target.value.toLowerCase()
    setProductSearch(searchTerm)
    const filtered = products.filter(product =>
      product.name.toLowerCase().includes(searchTerm) ||
      product.code.toLowerCase().includes(searchTerm)
    )
    setFilteredProducts(filtered)
  }



  const handleModelDoubleClick = (index: number) => {
    setSelectedModelIndex(index)
    fetchProducts()
    setIsProductModalOpen(true)
  }



  const handleProductSelect = (product: Product) => {
    if (selectedModelIndex !== null) {
      const updatedModels = [...modelInfos]
      updatedModels[selectedModelIndex] = {
        ...updatedModels[selectedModelIndex],
        modelCode: product.code,
        modelName: product.name,
        description: product.description,
      }
      setModelInfos(updatedModels)
      setIsProductModalOpen(false)
      setSelectedModelIndex(null)
    }
  }

  const handleModelChange = (index: number, field: keyof ModelInfo, value: string | number) => {
    const updatedModels = [...modelInfos]
    updatedModels[index] = { ...updatedModels[index], [field]: value }

    // Calculate totalAmount if price or totalQuantity changes
    if (field === 'price' || field === 'totalQuantity') {
      updatedModels[index].totalAmount = updatedModels[index].price * updatedModels[index].totalQuantity
    }

    setModelInfos(updatedModels)
  }



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 shadow-lg">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">İş Emri Oluştur</h1>
              <p className="text-blue-100 text-sm mt-1">Sipariş Girişi ve Üretim Planlama</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleSubmit}
                variant="secondary"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                <Save className="w-4 h-4 mr-2" />
                Kaydet
              </Button>
              <Button
                onClick={() => window.history.back()}
                variant="secondary"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                <X className="w-4 h-4 mr-2" />
                İptal
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6">
        <Card className="border-2 border-slate-200 shadow-lg">
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {/* Tab Navigation */}
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="genel" className="text-base">
                  Genel
                </TabsTrigger>
                <TabsTrigger value="detay" className="text-base">
                  Detay
                </TabsTrigger>
                <TabsTrigger value="aciklama" className="text-base">
                  Genel Açıklama
                </TabsTrigger>
                <TabsTrigger value="dikimalati" className="text-base">
                  Dikim Talimatı
                </TabsTrigger>
              </TabsList>

              {/* Genel Tab */}
              <TabsContent value="genel" className="space-y-6">
                {/* Order Header Section */}
                <div className="grid grid-cols-12 gap-4 items-start">
                  {/* Order No Search */}
                  <div className="col-span-3">
                    <Label className="text-sm font-semibold mb-2 block">İş Emri No</Label>
                    <div className="relative">
                      <Input
                        name="orderNo"
                        value={formData.orderNo}
                        onChange={handleInputChange}
                        placeholder="Sipariş numarası"
                        className="pr-8"
                      />
                      <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                  </div>

                  {/* Date and Customer Section */}
                  <div className="col-span-6 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm mb-1.5 block">Tarih</Label>
                        <Input
                          type="date"
                          value={formData.date}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => handleDateChange(e, "date")}
                          className="text-sm"
                        />
                      </div>
                      <div className="flex items-end gap-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="sealed"
                            checked={isSealed}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleCheckboxChange(e.target.checked, setIsSealed)}
                          />
                          <Label htmlFor="sealed" className="text-sm cursor-pointer">
                            Kapalı
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="sample"
                            checked={isSample}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleCheckboxChange(e.target.checked, setIsSample)}
                          />
                          <Label htmlFor="sample" className="text-sm cursor-pointer">
                            Numune
                          </Label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm mb-1.5 block">Müşteri</Label>
                      <div className="relative">
                        <Input
                          name="customer"
                          value={formData.customer}
                          onChange={handleInputChange}
                          placeholder="Müşteri adı"
                          className="pr-8"
                        />
                        <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm mb-1.5 block">İsteme Tarihi</Label>
                        <Input
                          type="date"
                          value={formData.requestDate}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => handleDateChange(e, "requestDate")}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-sm mb-1.5 block">Planlanan / Yükleme</Label>
                        <div className="flex gap-2">
                          <Input
                            type="date"
                            value={formData.plannedDate}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleDateChange(e, "plannedDate")}
                            className="text-sm"
                          />
                          <Input
                            type="date"
                            name="loadingDate"
                            value={formData.loadingDate}
                            onChange={handleInputChange}
                            placeholder="1.01.1900"
                            className="text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Delivery Icon */}
                  <div className="col-span-3 flex justify-end items-start pt-8">
                    <Link href="/production" className="group">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-110 cursor-pointer">
                        <Factory className="w-8 h-8 text-white" />
                      </div>
                    </Link>
                  </div>
                </div>

                {/* Model Bilgileri Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">Model Bilgileri</h3>
                    <Button onClick={handleAddModelInfo} size="sm" variant="outline" className="gap-2 bg-transparent">
                      <Plus className="w-4 h-4" />
                      Yeni Satır
                    </Button>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-100">
                          <TableHead className="font-semibold text-xs">Model Kodu</TableHead>
                          <TableHead className="font-semibold text-xs">Model Adı</TableHead>
                          <TableHead className="font-semibold text-xs">Açıklama</TableHead>
                          <TableHead className="font-semibold text-xs">Renk</TableHead>
                          <TableHead className="font-semibold text-xs">Döviz</TableHead>
                          <TableHead className="font-semibold text-xs">Döviz Fiyat</TableHead>
                          <TableHead className="font-semibold text-xs">Fiyat</TableHead>
                          <TableHead className="font-semibold text-xs">Paket (Lot)</TableHead>
                          <TableHead className="font-semibold text-xs">Toplam Miktar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {modelInfos.map((model, index) => (
                          <TableRow key={model.id} onDoubleClick={() => handleModelDoubleClick(index)}>
                            <TableCell className="text-sm">
                              <Input
                                value={model.modelCode}
                                onChange={(e) => {
                                  const updatedModels = [...modelInfos]
                                  updatedModels[index].modelCode = e.target.value
                                  setModelInfos(updatedModels)
                                }}
                                className="border-none p-0 h-auto"
                              />
                            </TableCell>
                            <TableCell className="text-sm">
                              <Input
                                value={model.modelName}
                                onChange={(e) => {
                                  const updatedModels = [...modelInfos]
                                  updatedModels[index].modelName = e.target.value
                                  setModelInfos(updatedModels)
                                }}
                                className="border-none p-0 h-auto"
                              />
                            </TableCell>
                            <TableCell className="text-sm">
                              <Input
                                value={model.description}
                                onChange={(e) => handleModelChange(index, 'description', e.target.value)}
                                className="border-none p-0 h-auto"
                              />
                            </TableCell>
                            <TableCell className="text-sm">
                              <Select
                                value={model.color}
                                onValueChange={(value) => handleModelChange(index, 'color', value)}
                              >
                                <SelectTrigger className="border-none p-0 h-auto">
                                  <SelectValue placeholder="Renk seçin" />
                                </SelectTrigger>
                                <SelectContent>
                                  {colors.map((color) => (
                                    <SelectItem key={color.id} value={color.name}>
                                      {color.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-sm">
                              <Select
                                value={model.currency}
                                onValueChange={(value) => handleModelChange(index, 'currency', value)}
                              >
                                <SelectTrigger className="border-none p-0 h-auto">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="TRY">TRY</SelectItem>
                                  <SelectItem value="USD">USD</SelectItem>
                                  <SelectItem value="EUR">EUR</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-sm text-right">{model.currencyPrice.toFixed(4)}</TableCell>
                            <TableCell className="text-sm text-right">
                              <Input
                                type="number"
                                value={model.price}
                                onChange={(e) => handleModelChange(index, 'price', parseFloat(e.target.value) || 0)}
                                className="border-none p-0 h-auto text-right"
                              />
                            </TableCell>
                            <TableCell className="text-sm text-right">
                              <Input
                                type="number"
                                value={model.packageLot}
                                onChange={(e) => handleModelChange(index, 'packageLot', parseFloat(e.target.value) || 0)}
                                className="border-none p-0 h-auto text-right"
                              />
                            </TableCell>
                            <TableCell className="text-sm text-right font-semibold">
                              <Input
                                type="number"
                                value={model.totalQuantity}
                                onChange={(e) => handleModelChange(index, 'totalQuantity', parseFloat(e.target.value) || 0)}
                                className="border-none p-0 h-auto text-right font-semibold"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>



                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" className="gap-2 bg-transparent border border-transparent hover:border-slate-200">
                    <X className="w-4 h-4" />
                    İptal
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    className="gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white"
                  >
                    <Save className="w-4 h-4" />
                    Kaydet
                  </Button>
                </div>
              </TabsContent>

              {/* Detay Tab */}
              <TabsContent value="detay">
                <div className="py-12 text-center text-slate-500">
                  <p>Detay sekmesi içeriği buraya gelecek</p>
                </div>
              </TabsContent>

              {/* Genel Açıklama Tab */}
              <TabsContent value="aciklama">
                <div className="py-12 text-center text-slate-500">
                  <p>Genel açıklama sekmesi içeriği buraya gelecek</p>
                </div>
              </TabsContent>

              {/* Dikim Talimatı Tab */}
              <TabsContent value="dikimalati">
                <SewingInstruction />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Product Selection Modal */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Ürün Seçimi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Input
                placeholder="Ürün ara..."
                value={productSearch}
                onChange={handleProductSearch}
                className="pr-8"
              />
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
            <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100">
                    <TableHead className="font-semibold text-xs">Kod</TableHead>
                    <TableHead className="font-semibold text-xs">Ad</TableHead>
                    <TableHead className="font-semibold text-xs">Açıklama</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow
                      key={product.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => handleProductSelect(product)}
                    >
                      <TableCell className="text-sm">{product.code}</TableCell>
                      <TableCell className="text-sm">{product.name}</TableCell>
                      <TableCell className="text-sm">{product.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>


    </div>
  )
}
