"use client";

import { useState, useEffect, type ChangeEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Factory, Plus, Save, X } from "lucide-react";
import SewingInstruction from "@/components/sewing-instruction";

interface ModelInfo {
  id: number;
  modelCode: string;
  modelName: string;
  description: string;
  color: string;
  currency: string;
  currencyPrice: number;
  price: number;
  packageLot: number;
  totalQuantity: number;
  totalAmount: number;
}

interface Product {
  id: number;
  code: string;
  name: string;
  description: string;
}

interface Workshop {
  id: number;
  name: string;
  specialization: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  balance: number;
  status: string;
  totalEarnings: number;
  totalPayments: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface WorkOrder {
  id: number;
  orderNo: string;
  productCode: string;
  productName: string;
  quantity: number;
  customerName: string;
  status: string;
  deliveryDate?: string;
  priority: string;
  assignedToMobile: boolean;
  createdAt: string;
}

export default function FasonCreateWorkOrder() {
  const [activeTab, setActiveTab] = useState("genel");
  const [isSealed, setIsSealed] = useState(false);
  const [isSample, setIsSample] = useState(false);
  const [modelInfos, setModelInfos] = useState<ModelInfo[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    orderNo: "",
    date: new Date().toISOString().split("T")[0],
    customer: "",
    requestDate: new Date().toISOString().split("T")[0],
    plannedDate: new Date().toISOString().split("T")[0],
    loadingDate: "",
  });

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");

  const [colors, setColors] = useState<{ id: number; name: string }[]>([]);
  const [selectedModelIndex, setSelectedModelIndex] = useState<number | null>(null);

  const [assignedToMobile, setAssignedToMobile] = useState<boolean | null>(null);
  const [isWorkshopModalOpen, setIsWorkshopModalOpen] = useState(false);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [filteredWorkshops, setFilteredWorkshops] = useState<Workshop[]>([]);
  const [workshopSearch, setWorkshopSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

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
    };
    setModelInfos([...modelInfos, newModel]);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (e: ChangeEvent<HTMLInputElement>, field: string) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleCheckboxChange = (checked: boolean, setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(checked);
  };

  const fetchWorkOrders = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/fason/work-orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setWorkOrders(data.workOrders || []);
    } catch (error) {
      console.error("Error fetching work orders:", error);
    }
  };

  const handleSubmit = async () => {
    if (!formData.orderNo.trim()) {
      alert("İş emri no zorunludur!");
      return;
    }
    if (modelInfos.length === 0) {
      alert("En az bir model bilgisi eklenmelidir!");
      return;
    }

    const invalidModels: string[] = [];
    modelInfos.forEach((model, index) => {
      if (!model.modelCode?.trim()) invalidModels.push(`Model ${index + 1}: Model kodu eksik`);
      if (!model.modelName?.trim()) invalidModels.push(`Model ${index + 1}: Model adı eksik`);
      if (!model.totalQuantity || model.totalQuantity <= 0)
        invalidModels.push(`Model ${index + 1}: Toplam miktar 0'dan büyük olmalıdır`);
    });

    if (invalidModels.length > 0) {
      alert("Lütfen aşağıdaki hataları düzeltin:\n\n" + invalidModels.join("\n"));
      return;
    }

    setLoading(true);

    try {
      const createdOrders = [];
      const failedOrders: string[] = [];

      for (const model of modelInfos) {
        const workOrderData = {
          orderNo: `${formData.orderNo}-${model.modelCode}`,
          productCode: model.modelCode,
          productName: model.modelName,
          quantity: model.totalQuantity,
          customerName: formData.customer,
          deliveryDate: formData.plannedDate,
          notes: model.description,
          assignedToMobile: assignedToMobile ?? false,
        };

        try {
          const token = localStorage.getItem("token");
          const response = await fetch("/api/fason/work-orders", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(workOrderData),
          });

          if (response.ok) {
            const createdOrder = await response.json();
            createdOrders.push(createdOrder);
          } else {
            const errorData = await response.json();
            failedOrders.push(`${model.modelCode}: ${errorData.error || "Bilinmeyen hata"}`);
          }
        } catch (fetchError) {
          failedOrders.push(`${model.modelCode}: Bağlantı hatası`);
        }
      }

      if (createdOrders.length > 0) {
        let message = `${createdOrders.length} iş emri başarıyla oluşturuldu!`;
        if (failedOrders.length > 0) {
          message += `\n\nBaşarısız olanlar:\n${failedOrders.join("\n")}`;
        }
        alert(message);

        // Send message to mobile user if assigned to mobile
        if (assignedToMobile) {
          try {
            const token = localStorage.getItem("token");
            const userResponse = await fetch("/api/users", {
              headers: { Authorization: `Bearer ${token}` },
            });
            const users = await userResponse.json();
            const mobileUser = users.find((u: any) => u.role === "FASON_TRACKER");
            if (mobileUser) {
              const messageContent = `Yeni iş emri atandı: ${createdOrders
                .map((o) => o.orderNo)
                .join(", ")}`;
              await fetch("/api/messages", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  recipientId: mobileUser.id,
                  content: messageContent,
                }),
              });
            }
          } catch (error) {
            console.error("Error sending message:", error);
          }
        }

        // Reset form
        setFormData({
          orderNo: "",
          date: new Date().toISOString().split("T")[0],
          customer: "",
          requestDate: new Date().toISOString().split("T")[0],
          plannedDate: new Date().toISOString().split("T")[0],
          loadingDate: "",
        });
        setModelInfos([]);
        fetchWorkOrders();
      } else {
        alert(`İş emri oluşturulamadı!\n\nHatalar:\n${failedOrders.join("\n")}`);
      }
    } catch (error) {
      console.error("Error creating work orders:", error);
      alert("İş emri oluşturulurken beklenmeyen bir hata oluştu!");
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/products");
      const data = await response.json();
      setProducts(data);
      setFilteredProducts(data);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const fetchColors = async () => {
    try {
      const response = await fetch("/api/colors");
      const data = await response.json();
      setColors(data);
    } catch (error) {
      console.error("Error fetching colors:", error);
    }
  };

  const fetchWorkshops = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/fason/workshops", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setWorkshops(data);
      setFilteredWorkshops(data);
    } catch (error) {
      console.error("Error fetching workshops:", error);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
    fetchColors();
    fetchWorkshops();
  }, []);

  const handleProductSearch = (e: ChangeEvent<HTMLInputElement>) => {
    const searchTerm = e.target.value.toLowerCase();
    setProductSearch(searchTerm);
    const filtered = products.filter(
      (product) =>
        product.name.toLowerCase().includes(searchTerm) ||
        product.code.toLowerCase().includes(searchTerm)
    );
    setFilteredProducts(filtered);
  };

  const handleModelDoubleClick = (index: number) => {
    setSelectedModelIndex(index);
    fetchProducts();
    setIsProductModalOpen(true);
  };

  const handleProductSelect = (product: Product) => {
    if (selectedModelIndex === null) return;

    const codeMatch = product.name.match(/^([A-Za-z]+-\d+)/);
    const extractedCode = codeMatch ? codeMatch[1] : product.name;

    const updatedModels = [...modelInfos];
    updatedModels[selectedModelIndex] = {
      ...updatedModels[selectedModelIndex],
      modelCode: extractedCode,
      modelName: product.name,
      description: product.description,
    };

    setModelInfos(updatedModels);
    setIsProductModalOpen(false);
    setSelectedModelIndex(null);
  };

  const handleWorkshopSearch = (e: ChangeEvent<HTMLInputElement>) => {
    const searchTerm = e.target.value.toLowerCase();
    setWorkshopSearch(searchTerm);
    const filtered = workshops.filter(
      (workshop) =>
        workshop.name.toLowerCase().includes(searchTerm) ||
        workshop.contactPerson.toLowerCase().includes(searchTerm)
    );
    setFilteredWorkshops(filtered);
  };

  const handleWorkshopSelect = (workshop: Workshop) => {
    if (selectedOrderId) {
      handleWorkshopAssign(selectedOrderId);
      setSelectedOrderId(null);
    } else {
      setAssignedToMobile(true);
    }
    setIsWorkshopModalOpen(false);
  };

  const handleModalClose = () => {
    setSelectedOrderId(null);
    setIsWorkshopModalOpen(false);
  };

  const handleCellClick = (order: WorkOrder) => {
    if (!order.assignedToMobile) {
      setSelectedOrderId(order.id);
      setIsWorkshopModalOpen(true);
    }
  };

  const handleWorkshopAssign = async (orderId: number) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/fason/work-orders/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ assignedToMobile: true }),
      });

      if (response.ok) {
        setWorkOrders((prev) =>
          prev.map((order) =>
            order.id === orderId ? { ...order, assignedToMobile: true } : order
          )
        );
      }
    } catch (error) {
      console.error("Error updating mobile assignment:", error);
    }
  };

  const handleModelChange = (
    index: number,
    field: keyof ModelInfo,
    value: string | number
  ) => {
    const updatedModels = [...modelInfos];
    updatedModels[index] = { ...updatedModels[index], [field]: value };

    if (field === "modelName") {
      const modelName = value as string;
      const codeMatch = modelName.match(/^([A-Za-z]+-\d+)/);
      updatedModels[index].modelCode = codeMatch ? codeMatch[1] : modelName;
    }

    if (field === "price" || field === "totalQuantity") {
      updatedModels[index].totalAmount =
        (updatedModels[index].price as number) * (updatedModels[index].totalQuantity as number);
    }

    setModelInfos(updatedModels);
  };

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">İş Emri Oluştur</h1>
          <p className="text-muted-foreground">Sipariş Girişi ve Üretim Planlama</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => window.history.back()}>
            İptal
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="genel">Genel</TabsTrigger>
          <TabsTrigger value="detay">Detay</TabsTrigger>
          <TabsTrigger value="aciklama">Genel Açıklama</TabsTrigger>
          <TabsTrigger value="dikim">Dikim Talimatı</TabsTrigger>
        </TabsList>

        <TabsContent value="genel" className="space-y-6">
          {/* Order Header Section */}
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <Label htmlFor="orderNo">İş Emri No</Label>
                  <Input
                    id="orderNo"
                    name="orderNo"
                    value={formData.orderNo}
                    onChange={handleInputChange}
                    placeholder="Örn: SIP-2025-001"
                  />
                </div>

                <div>
                  <Label>Tarih</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleDateChange(e, "date")}
                  />
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sealed"
                      checked={isSealed}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        handleCheckboxChange(e.target.checked, setIsSealed)
                      }
                    />
                    <Label htmlFor="sealed">Kapalı</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sample"
                      checked={isSample}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        handleCheckboxChange(e.target.checked, setIsSample)
                      }
                    />
                    <Label htmlFor="sample">Numune</Label>
                  </div>
                </div>

                <div>
                  <Label>Müşteri</Label>
                  <Input
                    name="customer"
                    value={formData.customer}
                    onChange={handleInputChange}
                    placeholder="Müşteri adı / firma"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label>İsteme Tarihi</Label>
                  <Input
                    type="date"
                    value={formData.requestDate}
                    onChange={(e) => handleDateChange(e, "requestDate")}
                  />
                </div>
                <div>
                  <Label>Planlanan / Yükleme Tarihi</Label>
                  <Input
                    type="date"
                    value={formData.plannedDate}
                    onChange={(e) => handleDateChange(e, "plannedDate")}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="assignToMobile"
                    checked={assignedToMobile || false}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setAssignedToMobile(e.target.checked)
                    }
                  />
                  <Label htmlFor="assignToMobile">Mobil Takibe Ata</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Model Bilgileri */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Model Bilgileri</h2>
                <Button onClick={handleAddModelInfo} variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Yeni Satır
                </Button>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model Kodu</TableHead>
                      <TableHead>Model Adı</TableHead>
                      <TableHead>Açıklama</TableHead>
                      <TableHead>Renk</TableHead>
                      <TableHead>Döviz</TableHead>
                      <TableHead>Döviz Fiyat</TableHead>
                      <TableHead>Fiyat</TableHead>
                      <TableHead>Paket (Lot)</TableHead>
                      <TableHead>Toplam Miktar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelInfos.map((model, index) => (
                      <TableRow key={model.id} className="hover:bg-muted/50">
                        <TableCell
                          className="cursor-pointer"
                          onDoubleClick={() => handleModelDoubleClick(index)}
                        >
                          <Input
                            value={model.modelCode}
                            onChange={(e) =>
                              handleModelChange(index, "modelCode", e.target.value)
                            }
                            className="border-none p-0 h-auto focus:ring-0"
                          />
                        </TableCell>
                        <TableCell
                          className="cursor-pointer"
                          onDoubleClick={() => handleModelDoubleClick(index)}
                        >
                          <Input
                            value={model.modelName}
                            onChange={(e) =>
                              handleModelChange(index, "modelName", e.target.value)
                            }
                            className="border-none p-0 h-auto focus:ring-0"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={model.description}
                            onChange={(e) =>
                              handleModelChange(index, "description", e.target.value)
                            }
                            className="border-none p-0 h-auto focus:ring-0"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={model.color}
                            onValueChange={(val) => handleModelChange(index, "color", val)}
                          >
                            <SelectTrigger className="border-none p-0 h-auto focus:ring-0">
                              <SelectValue placeholder="Seç" />
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
                        <TableCell>
                          <Select
                            value={model.currency}
                            onValueChange={(val) => handleModelChange(index, "currency", val)}
                          >
                            <SelectTrigger className="border-none p-0 h-auto focus:ring-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="TRY">TRY</SelectItem>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="EUR">EUR</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          {model.currencyPrice.toFixed(4)}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={model.price}
                            onChange={(e) =>
                              handleModelChange(index, "price", parseFloat(e.target.value) || 0)
                            }
                            className="border-none p-0 h-auto text-right focus:ring-0"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={model.packageLot}
                            onChange={(e) =>
                              handleModelChange(index, "packageLot", parseFloat(e.target.value) || 0)
                            }
                            className="border-none p-0 h-auto text-right focus:ring-0"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={model.totalQuantity}
                            onChange={(e) =>
                              handleModelChange(index, "totalQuantity", parseFloat(e.target.value) || 0)
                            }
                            className="border-none p-0 h-auto text-right font-semibold focus:ring-0"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detay">
          <Card>
            <CardContent className="pt-6">
              <p>Detay sekmesi içeriği buraya gelecek</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aciklama">
          <Card>
            <CardContent className="pt-6">
              <p>Genel açıklama sekmesi içeriği buraya gelecek</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dikim">
          <Card>
            <CardContent className="pt-6">
              <SewingInstruction />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Work Orders List */}
      <Card className="mt-8">
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">
            Oluşturulan İş Emirleri ({workOrders.length})
          </h2>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>İş Emri No</TableHead>
                  <TableHead>Ürün Kodu</TableHead>
                  <TableHead>Ürün Adı</TableHead>
                  <TableHead>Miktar</TableHead>
                  <TableHead>Müşteri</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Mobil Atanmış</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>{order.orderNo}</TableCell>
                    <TableCell>{order.productCode}</TableCell>
                    <TableCell>{order.productName}</TableCell>
                    <TableCell>{order.quantity}</TableCell>
                    <TableCell>{order.customerName}</TableCell>
                    <TableCell>{order.status.replace("_", " ")}</TableCell>
                    <TableCell
                      className="cursor-pointer"
                      onClick={() => handleCellClick(order)}
                    >
                      {order.assignedToMobile ? (
                        <span className="text-green-600">Mobile atanmış</span>
                      ) : (
                        <span className="text-amber-600">Mobile atanmamış</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Product Selection Modal */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Ürün Seçimi</DialogTitle>
          </DialogHeader>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ürün kodu veya adı ile ara..."
              className="pl-10"
              value={productSearch}
              onChange={handleProductSearch}
            />
          </div>

          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kod</TableHead>
                  <TableHead>Ad</TableHead>
                  <TableHead>Açıklama</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow
                    key={product.id}
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => handleProductSelect(product)}
                  >
                    <TableCell>{product.code}</TableCell>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Workshop Selection Modal */}
      <Dialog open={isWorkshopModalOpen} onOpenChange={setIsWorkshopModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Fason Atölye Seçimi</DialogTitle>
          </DialogHeader>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Atölye adı veya yetkili ile ara..."
              className="pl-10"
              value={workshopSearch}
              onChange={handleWorkshopSearch}
            />
          </div>

          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad</TableHead>
                  <TableHead>Uzmanlık</TableHead>
                  <TableHead>Yetkili</TableHead>
                  <TableHead>Telefon</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkshops.map((workshop) => (
                  <TableRow
                    key={workshop.id}
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => handleWorkshopSelect(workshop)}
                  >
                    <TableCell>{workshop.name}</TableCell>
                    <TableCell>{workshop.specialization}</TableCell>
                    <TableCell>{workshop.contactPerson}</TableCell>
                    <TableCell>{workshop.phone}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}