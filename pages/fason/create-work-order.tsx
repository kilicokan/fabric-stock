"use client";

import { useState, useEffect, useCallback, type ChangeEvent } from "react";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Factory, Plus, Save, Users, Boxes, ClipboardCheck, X, Trash2 } from "lucide-react";
import SewingInstruction, { defaultSewingNotes, type SewingNotesData } from "@/components/sewing-instruction";
import { readParameterSettings } from "@/lib/parameters";
import styles from "./create-work-order.module.css";

const getAuthHeader = (): HeadersInit => {
  const token = localStorage.getItem("token") || localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

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
  modelNo?: string;
  name: string;
  description: string;
  image?: string;
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

interface CuttingTable {
  id: number;
  name: string;
  assignedUserId: number | null;
  assignedUser: { id: number; name: string | null; email: string; role?: string } | null;
}

interface FasonTracking {
  processType: string;
  workshopId: number | null;
  workshop: { id: number; name: string } | null;
  cuttingTableId: number | null;
  cuttingTable: { id: number; name: string } | null;
  status: string;
}

interface Customer {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
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
  createdAt: string;
  fasonTrackings?: FasonTracking[];
}

export default function FasonCreateWorkOrder() {
  const [activeTab, setActiveTab] = useState("genel");
  const [isSealed, setIsSealed] = useState(false);
  const [isSample, setIsSample] = useState(false);
  const [modelInfos, setModelInfos] = useState<ModelInfo[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [groupingMode] = useState<"separate" | "combined">(() => readParameterSettings().fasonWorkOrderGroupingMode);

  const [formData, setFormData] = useState({
    orderNo: "",
    date: new Date().toISOString().split("T")[0],
    customerNames: [] as string[],
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

  const [isFasonCutting, setIsFasonCutting] = useState(false);
  const [selectedWorkshopId, setSelectedWorkshopId] = useState("");
  const [sewingNotes, setSewingNotes] = useState<SewingNotesData>(defaultSewingNotes());
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [cuttingTables, setCuttingTables] = useState<CuttingTable[]>([]);
  const [isCuttingTableModalOpen, setIsCuttingTableModalOpen] = useState(false);
  const [assigningCuttingTable, setAssigningCuttingTable] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

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

  const handleModelRemove = (index: number) => {
    if (window.confirm("Bu satırı silmek istediğinizden emin misiniz?")) {
      setModelInfos((prev) => prev.filter((_, i) => i !== index));
    }
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

  const fetchWorkOrders = useCallback(async () => {
    try {
      const pageSize = 100;
      const allWorkOrders: WorkOrder[] = [];
      let page = 1;
      let total = Number.POSITIVE_INFINITY;

      while (allWorkOrders.length < total) {
        const response = await fetch(`/api/fason/work-orders?page=${page}&limit=${pageSize}`, {
          headers: getAuthHeader(),
        });
        if (!response.ok) {
          throw new Error(`Work orders request failed: ${response.status}`);
        }
        const payload = await response.json();
        if (!Array.isArray(payload.data)) {
          throw new Error("Work orders response did not contain a data array");
        }
        allWorkOrders.push(...payload.data);
        total = Number(payload.pagination?.total ?? allWorkOrders.length);
        page += 1;
        if (payload.data.length < pageSize) break;
      }

      setWorkOrders(allWorkOrders);
    } catch (error) {
      console.error("Error fetching work orders:", error);
    }
  }, []);

  const fetchCuttingTables = useCallback(async () => {
    try {
      const response = await fetch("/api/cutting-tables", { headers: getAuthHeader() });
      if (!response.ok) throw new Error(`Cutting tables request failed: ${response.status}`);
      const payload = await response.json();
      setCuttingTables(Array.isArray(payload.data) ? payload.data : []);
    } catch (error) {
      console.error("Error fetching cutting tables:", error);
    }
  }, []);

  const handleSubmit = async () => {
    if (!formData.orderNo.trim()) {
      alert("İş emri no zorunludur!");
      return;
    }
    if (modelInfos.length === 0) {
      alert("En az bir model bilgisi eklenmelidir!");
      return;
    }
    if (isFasonCutting && !selectedWorkshopId) {
      alert("Fason kesim için kesim atölyesi seçilmelidir.");
      return;
    }

    const invalidModels: string[] = [];
    const modelCodes = modelInfos.map((m) => m.modelCode?.trim()).filter(Boolean);
    const duplicateCodes = modelCodes.filter((code, index) => modelCodes.indexOf(code) !== index);
    if (duplicateCodes.length > 0) {
      // Check if duplicates have different colors - if so, it's allowed
      const uniqueDuplicates = [...new Set(duplicateCodes)];
      const hasColorConflict = uniqueDuplicates.some((code) => {
        const modelsWithCode = modelInfos.filter((m) => m.modelCode?.trim() === code);
        const colors = modelsWithCode.map((m) => m.color?.trim()).filter(Boolean);
        const uniqueColors = [...new Set(colors)];
        // If there are duplicates with the same color, it's a conflict
        return uniqueColors.length < modelsWithCode.length;
      });
      if (hasColorConflict) {
        invalidModels.push(`Aynı model kodu ve renk kombinasyonu tekrar edemez: ${uniqueDuplicates.join(", ")}`);
      }
    }

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

      if (groupingMode === "combined") {
        // Combined mode: Create single work order with all models
        const totalQuantity = modelInfos.reduce((sum, m) => sum + (m.totalQuantity || 0), 0);
        const totalAmount = modelInfos.reduce((sum, m) => sum + (m.totalAmount || 0), 0);
        const modelDescriptions = modelInfos
          .map((m) => `${m.modelCode} - ${m.modelName} (${m.color || "Renk yok"}) x${m.totalQuantity}`)
          .join("\n");

        const workOrderData = {
          orderNo: formData.orderNo,
          productCode: modelInfos.map((m) => m.modelCode).join(", "),
          productName: modelInfos.map((m) => m.modelName).join(", "),
          quantity: totalQuantity,
          customerName: formData.customerNames.join(", "),
          customerNames: formData.customerNames,
          deliveryDate: formData.plannedDate,
          notes: `Modeller:\n${modelDescriptions}\n\nToplam Tutar: ${totalAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`,
          fasonCutting: isFasonCutting,
          workshopId: isFasonCutting ? Number(selectedWorkshopId) : null,
          sewingNotes: JSON.stringify(sewingNotes),
        };

        try {
          const response = await fetch("/api/fason/work-orders", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeader(),
            },
            body: JSON.stringify(workOrderData),
          });

          if (response.ok) {
            const apiResponse = await response.json();
            createdOrders.push(apiResponse.data || apiResponse);
          } else {
            const errorData = await response.json();
            failedOrders.push(`Tek iş emri: ${errorData.error || "Bilinmeyen hata"}`);
          }
        } catch {
          failedOrders.push("Tek iş emri: Bağlantı hatası");
        }
      } else {
        // Separate mode: Create separate work order for each model
        for (const model of modelInfos) {
          // Include color in orderNo if there are multiple models with same modelCode
          const sameCodeModels = modelInfos.filter((m) => m.modelCode?.trim() === model.modelCode?.trim());
          const orderNoSuffix = sameCodeModels.length > 1 && model.color?.trim()
            ? `${model.modelCode}-${model.color}`
            : model.modelCode;

          const workOrderData = {
            orderNo: `${formData.orderNo}-${orderNoSuffix}`,
            productCode: model.modelCode,
            productName: model.modelName,
            quantity: model.totalQuantity,
            customerName: formData.customerNames.join(", "),
            customerNames: formData.customerNames,
            deliveryDate: formData.plannedDate,
            notes: model.description,
            fasonCutting: isFasonCutting,
            workshopId: isFasonCutting ? Number(selectedWorkshopId) : null,
            sewingNotes: JSON.stringify(sewingNotes),
          };

          try {
            const response = await fetch("/api/fason/work-orders", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...getAuthHeader(),
              },
              body: JSON.stringify(workOrderData),
            });

            if (response.ok) {
              const apiResponse = await response.json();
              createdOrders.push(apiResponse.data || apiResponse);
            } else {
              const errorData = await response.json();
              failedOrders.push(`${model.modelCode}: ${errorData.error || "Bilinmeyen hata"}`);
            }
          } catch {
            failedOrders.push(`${model.modelCode}: Bağlantı hatası`);
          }
        }
      }

      if (createdOrders.length > 0) {
        let message = `${createdOrders.length} iş emri başarıyla oluşturuldu!`;
        if (failedOrders.length > 0) {
          message += `\n\nBaşarısız olanlar:\n${failedOrders.join("\n")}`;
        }
        alert(message);

        // Reset form
        setFormData({
          orderNo: "",
          date: new Date().toISOString().split("T")[0],
          customerNames: [],
          requestDate: new Date().toISOString().split("T")[0],
          plannedDate: new Date().toISOString().split("T")[0],
          loadingDate: "",
        });
        setSelectedCustomers([]);
        setCustomerSearch("");
        setFilteredCustomers(customers);
        setModelInfos([]);
        setIsFasonCutting(false);
        setSelectedWorkshopId("");
        setSewingNotes(defaultSewingNotes());
        await fetchWorkOrders();
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
      const response = await fetch("/api/products", {
        headers: getAuthHeader(),
      });
      if (!response.ok) {
        throw new Error(`Products request failed: ${response.status}`);
      }
      const responseData = await response.json();
      const data = responseData.data || responseData;
      const normalizedProducts: Product[] = (Array.isArray(data) ? data : [])
        .map((item) => {
          const source = item as {
            id?: unknown;
            code?: unknown;
            modelNo?: unknown;
            name?: unknown;
            description?: unknown;
            image?: unknown;
          };
          return {
            id: Number(source.id) || 0,
            code: String(source.code || source.modelNo || "").trim(),
            modelNo: String(source.modelNo || "").trim() || undefined,
            name: String(source.name || "").trim(),
            description: String(source.description || "").trim(),
            image: typeof source.image === "string" ? source.image : undefined,
          };
        })
        .filter((product) => product.id > 0 && (product.code || product.name));
      setProducts(normalizedProducts);
      setFilteredProducts(normalizedProducts);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const fetchColors = useCallback(async () => {
    try {
      const response = await fetch("/api/colors");
      const data = await response.json();
      setColors(data);
    } catch (error) {
      console.error("Error fetching colors:", error);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      const response = await fetch("/api/customers", {
        headers: getAuthHeader(),
      });
      if (!response.ok) {
        throw new Error(`Customers request failed: ${response.status}`);
      }
      const data = await response.json();
      const customerList = Array.isArray(data) ? data : [];
      setCustomers(customerList);
      setFilteredCustomers(customerList);
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  }, []);

  const fetchWorkshops = useCallback(async () => {
    try {
      const response = await fetch("/api/fason/workshops", {
        headers: getAuthHeader(),
      });
      if (!response.ok) throw new Error(`Workshops request failed: ${response.status}`);
      const { data } = await response.json();
      setWorkshops(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching workshops:", error);
    }
  }, []);

  useEffect(() => {
    fetchWorkOrders();
    fetchCuttingTables();
    fetchColors();
    fetchWorkshops();
    fetchCustomers();
  }, [fetchWorkOrders, fetchCuttingTables, fetchColors, fetchWorkshops, fetchCustomers]);

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

    const extractedCode = product.code || product.modelNo || product.name;

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

    setSewingNotes((prev) => ({
      ...prev,
      modelInfo: {
        ...prev.modelInfo,
        productCode: extractedCode,
        productName: product.name,
        productImage: product.image || prev.modelInfo.productImage,
        modelNo: extractedCode,
        modelName: product.name,
      },
    }))
  };

  const syncCustomerNames = (names: string[]) => {
    setFormData((prev) => ({ ...prev, customerNames: names }));
  };

  const handleCustomerSearch = (e: ChangeEvent<HTMLInputElement>) => {
    const searchTerm = e.target.value;
    const normalizedSearch = searchTerm.trim().toLowerCase();
    setCustomerSearch(searchTerm);

    setFilteredCustomers(
      customers.filter((customer) => {
        const alreadySelected = selectedCustomers.some((selected) => selected.id === customer.id);
        if (alreadySelected) return false;
        if (!normalizedSearch) return true;

        return (
          customer.name.toLowerCase().includes(normalizedSearch) ||
          customer.phone?.includes(searchTerm) ||
          customer.email?.toLowerCase().includes(normalizedSearch)
        );
      })
    );
  };

  const openCustomerModal = () => {
    setCustomerSearch("");
    setFilteredCustomers(
      customers.filter(
        (customer) => !selectedCustomers.some((selected) => selected.id === customer.id)
      )
    );
    setIsCustomerModalOpen(true);
  };

  const handleCustomerSelect = (customer: Customer) => {
    if (selectedCustomers.some((selected) => selected.id === customer.id)) {
      return;
    }

    const updatedCustomers = [...selectedCustomers, customer];
    setSelectedCustomers(updatedCustomers);
    syncCustomerNames(updatedCustomers.map((item) => item.name));
    setCustomerSearch("");
    setFilteredCustomers(
      customers.filter((item) => !updatedCustomers.some((selected) => selected.id === item.id))
    );
    setIsCustomerModalOpen(false);
  };

  const handleCustomerRemove = (customerName: string) => {
    const updatedCustomers = selectedCustomers.filter((customer) => customer.name !== customerName);
    setSelectedCustomers(updatedCustomers);
    syncCustomerNames(updatedCustomers.map((item) => item.name));

    const normalizedSearch = customerSearch.trim().toLowerCase();
    setFilteredCustomers(
      customers.filter((customer) => {
        const alreadySelected = updatedCustomers.some((selected) => selected.id === customer.id);
        if (alreadySelected) return false;
        if (!normalizedSearch) return true;

        return (
          customer.name.toLowerCase().includes(normalizedSearch) ||
          customer.phone?.includes(customerSearch) ||
          customer.email?.toLowerCase().includes(normalizedSearch)
        );
      })
    );
  };

  const handleCustomerAdd = () => {
    const customName = customerSearch.trim();
    if (!customName) return;

    if (formData.customerNames.some((name) => name.toLowerCase() === customName.toLowerCase())) {
      setCustomerSearch("");
      return;
    }

    const customCustomer: Customer = {
      id: Date.now(),
      name: customName,
      phone: null,
      email: null,
    };

    const updatedCustomers = [...selectedCustomers, customCustomer];
    setSelectedCustomers(updatedCustomers);
    syncCustomerNames(updatedCustomers.map((item) => item.name));
    setCustomerSearch("");
    setFilteredCustomers(
      customers.filter((item) => !updatedCustomers.some((selected) => selected.id === item.id))
    );
  };

  const handleCuttingTableModalClose = () => {
    setSelectedOrderId(null);
    setIsCuttingTableModalOpen(false);
  };

  const handleCellClick = (order: WorkOrder) => {
    const cuttingTracking = order.fasonTrackings?.find((tracking) => tracking.processType === "KESIM");
    if (cuttingTracking?.workshopId || cuttingTracking?.cuttingTableId) return;
    setSelectedOrderId(order.id);
    setIsCuttingTableModalOpen(true);
  };

  const handleCuttingTableAssign = async (cuttingTableId: number) => {
    if (!selectedOrderId) return;

    try {
      setAssigningCuttingTable(true);
      const response = await fetch(`/api/fason/work-orders/${selectedOrderId}/cutting-assignment`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ cuttingTableId }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || payload.message || "Kesim masası atanamadı.");
      }

      await fetchWorkOrders();
      handleCuttingTableModalClose();
    } catch (error) {
      console.error("Error assigning cutting table:", error);
      alert(error instanceof Error ? error.message : "Kesim masası atanamadı.");
    } finally {
      setAssigningCuttingTable(false);
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

  const totalModelQuantity = modelInfos.reduce((total, model) => {
    const quantity = Number.isFinite(model.totalQuantity) ? model.totalQuantity : 0;
    return total + quantity;
  }, 0);

  const totalModelAmount = modelInfos.reduce((total, model) => {
    const amount = Number.isFinite(model.totalAmount) ? model.totalAmount : 0;
    return total + amount;
  }, 0);

  const cuttingWorkshops = workshops.filter(
    (workshop) => workshop.isActive && ["KESIM", "TUM"].includes(workshop.specialization)
  );
  const selectedOrder = workOrders.find((order) => order.id === selectedOrderId) || null;
  const availableCuttingTables = cuttingTables.filter(
    (table) => table.assignedUserId !== null && table.assignedUser !== null
  );

  return (
    <div className={`${styles.pageShell} min-h-screen`}>
      <div className="w-full space-y-6 px-4 py-6 md:px-6 lg:px-8">
        {/* Header */}
        <Card className={`${styles.heroCard} overflow-hidden text-white`}>
          <CardContent className={`${styles.heroContent} p-5 md:p-6`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`${styles.heroPill} inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium`}
                  >
                    <Factory className="h-3.5 w-3.5" />
                    Dış Kaynak Üretim
                  </div>
                  <div className={`${styles.versionBadge} rounded-full px-3 py-1 text-xs font-semibold`}>
                    Tasarım v2
                  </div>
                </div>
                <h1 className={`${styles.heroTitle} text-2xl font-bold tracking-tight md:text-3xl`}>
                  İş Emri Oluştur
                </h1>
                <p className={`${styles.heroSubtitle} text-sm md:text-base`}>
                  Sipariş girişini tamamlayıp üretim planını tek ekranda yönetin.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                  onClick={() => window.history.back()}
                >
                  İptal
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="bg-white text-slate-900 hover:bg-slate-200"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {loading ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className={`${styles.statsGrid} grid grid-cols-1 gap-3 md:grid-cols-3`}>
          <Card className={`${styles.statCard} border-slate-200/80 bg-white/90 shadow-sm`}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Model Satırı</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{modelInfos.length}</p>
              </div>
              <div className="rounded-full bg-sky-100 p-2.5 text-sky-600">
                <Boxes className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
          <Card className={`${styles.statCard} border-slate-200/80 bg-white/90 shadow-sm`}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Toplam Miktar
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {totalModelQuantity.toLocaleString("tr-TR")}
                </p>
              </div>
              <div className="rounded-full bg-emerald-100 p-2.5 text-emerald-600">
                <ClipboardCheck className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
          <Card className={`${styles.statCard} border-slate-200/80 bg-white/90 shadow-sm`}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Seçili Müşteri
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {formData.customerNames.length}
                </p>
              </div>
              <div className="rounded-full bg-amber-100 p-2.5 text-amber-600">
                <Users className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={`${styles.tabList} grid h-auto w-full grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm md:grid-cols-4`}>
            <TabsTrigger
              value="genel"
              className={`${styles.tabTrigger} rounded-lg py-2 text-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white`}
            >
              Genel
            </TabsTrigger>
            <TabsTrigger
              value="detay"
              className={`${styles.tabTrigger} rounded-lg py-2 text-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white`}
            >
              Detay
            </TabsTrigger>
            <TabsTrigger
              value="aciklama"
              className={`${styles.tabTrigger} rounded-lg py-2 text-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white`}
            >
              Genel Açıklama
            </TabsTrigger>
            <TabsTrigger
              value="dikim"
              className={`${styles.tabTrigger} rounded-lg py-2 text-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white`}
            >
              Dikim Talimatı
            </TabsTrigger>
          </TabsList>

          <TabsContent value="genel" className="space-y-6">
          {/* Order Header Section */}
            <Card className={`${styles.sectionCard} border-slate-200/80 bg-white/95 shadow-sm`}>
              <CardContent className="space-y-6 p-5 md:p-6">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
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

                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5">
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
                  <Label>Müşteriler</Label>
                  <div className="space-y-3">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={openCustomerModal}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openCustomerModal();
                        }
                      }}
                      className="flex min-h-[48px] w-full flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:bg-slate-50"
                    >
                      {formData.customerNames.length > 0 ? (
                        formData.customerNames.map((customerName) => (
                          <span
                            key={customerName}
                            className={`${styles.customerChip} inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ring-1`}
                          >
                            {customerName}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCustomerRemove(customerName);
                              }}
                              className="text-slate-500 transition-colors hover:text-slate-800"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Bir veya birden fazla müşteri seçin
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        value={customerSearch}
                        onChange={handleCustomerSearch}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleCustomerAdd();
                          }
                        }}
                        placeholder="Müşteri ara veya yeni isim yazın"
                      />
                      <Button type="button" variant="outline" onClick={openCustomerModal} className="sm:w-auto">
                        Müşteri Listesinden Seç
                      </Button>
                    </div>

                    {filteredCustomers.length > 0 && (
                      <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                        {filteredCustomers.slice(0, 8).map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => handleCustomerSelect(customer)}
                            className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50"
                          >
                            <span className="font-medium text-slate-800">{customer.name}</span>
                            <span className="text-xs text-slate-500">
                              {customer.phone || customer.email || "Kayıtlı müşteri"}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
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
                  <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="fasonCutting"
                        checked={isFasonCutting}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          setIsFasonCutting(e.target.checked);
                          if (!e.target.checked) setSelectedWorkshopId("");
                        }}
                      />
                      <Label htmlFor="fasonCutting">Fason Kesim</Label>
                    </div>
                    {isFasonCutting && (
                      <div className="space-y-2">
                        <Label htmlFor="cuttingWorkshop">Kesim Atölyesi</Label>
                        <Select value={selectedWorkshopId} onValueChange={setSelectedWorkshopId}>
                          <SelectTrigger id="cuttingWorkshop">
                            <SelectValue placeholder="Kesim atölyesi seçin" />
                          </SelectTrigger>
                          <SelectContent>
                            {cuttingWorkshops.map((workshop) => (
                              <SelectItem key={workshop.id} value={String(workshop.id)}>
                                {workshop.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {cuttingWorkshops.length === 0 && (
                          <p className="text-xs text-red-600">Aktif kesim atölyesi bulunamadı.</p>
                        )}
                      </div>
                    )}
                </div>
              </div>
              </CardContent>
          </Card>

          {/* Model Bilgileri */}
          <Card className={`${styles.sectionCard} border-slate-200/80 bg-white/95 shadow-sm`}>
            <CardContent className="p-5 md:p-6">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Model Bilgileri</h2>
                  <p className="text-sm text-slate-500">
                    Toplam Tutar: {totalModelAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <Button onClick={handleAddModelInfo} variant="outline" size="sm" className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" /> Yeni Satır
                </Button>
              </div>

              <div className={`${styles.tableWrap} overflow-x-auto rounded-lg border border-slate-200`}>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="font-semibold text-slate-700">Model Kodu</TableHead>
                      <TableHead className="font-semibold text-slate-700">Model Adı</TableHead>
                      <TableHead className="font-semibold text-slate-700">Açıklama</TableHead>
                      <TableHead className="font-semibold text-slate-700">Renk</TableHead>
                      <TableHead className="font-semibold text-slate-700">Döviz</TableHead>
                      <TableHead className="font-semibold text-slate-700">Döviz Fiyat</TableHead>
                      <TableHead className="font-semibold text-slate-700">Fiyat</TableHead>
                      <TableHead className="font-semibold text-slate-700">Paket (Lot)</TableHead>
                      <TableHead className="font-semibold text-slate-700">Toplam Miktar</TableHead>
                      <TableHead className="font-semibold text-slate-700">İşlemler</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelInfos.map((model, index) => (
                      <TableRow key={`model-${index}-${model.modelCode}`} className="hover:bg-slate-50">
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
                              {colors.map((color, idx) => (
                                <SelectItem key={`color-${index}-${idx}`} value={color.name}>
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
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => handleModelRemove(index)}
                            className="text-slate-400 hover:text-red-600 transition-colors"
                            title="Satırı sil"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {modelInfos.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="py-8 text-center text-sm text-slate-500">
                          Henüz model satırı eklenmedi. Yeni Satır ile başlayabilirsiniz.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detay" className="space-y-6">
          <Card className={`${styles.sectionCard} border-slate-200/80 bg-white/95 shadow-sm`}>
            <CardContent className="p-5 md:p-6">
              <p>Detay sekmesi içeriği buraya gelecek</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aciklama" className="space-y-6">
          <Card className={`${styles.sectionCard} border-slate-200/80 bg-white/95 shadow-sm`}>
            <CardContent className="p-5 md:p-6">
              <p>Genel açıklama sekmesi içeriği buraya gelecek</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dikim" className="space-y-6">
          <Card className={`${styles.sectionCard} border-slate-200/80 bg-white/95 shadow-sm`}>
            <CardContent className="p-5 md:p-6">
              <SewingInstruction
              value={sewingNotes}
              onChange={setSewingNotes}
              currentUser="admin"
              productImage={sewingNotes.modelInfo.productImage}
              productCode={sewingNotes.modelInfo.productCode}
              productName={sewingNotes.modelInfo.productName}
            />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Work Orders List - Compact Card Grid */}
        <Card className={`${styles.sectionCard} border-slate-200/80 bg-white/95 shadow-sm`}>
          <CardContent className="p-5 md:p-6">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Oluşturulan İş Emirleri ({workOrders.length})
              </h2>
              <span className="text-sm text-slate-500">
                Tüm iş emirleri kesim aşamasında başlar
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {workOrders.map((order) => {
                const cuttingTracking = order.fasonTrackings?.find((tracking) => tracking.processType === "KESIM");
                const isCuttingAssigned = Boolean(cuttingTracking?.workshopId || cuttingTracking?.cuttingTableId);

                return (
                  <div
                    key={order.orderNo}
                    className={`${styles.workOrderCard} ${isCuttingAssigned ? "" : "cursor-pointer"} rounded-xl border border-slate-200 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md`}
                    onClick={() => handleCellClick(order)}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-sky-700">{order.orderNo}</p>
                        <p className="text-xs text-slate-600">{order.productCode}</p>
                      </div>
                      <span
                        className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                          isCuttingAssigned
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {cuttingTracking?.workshop
                          ? `Fason: ${cuttingTracking.workshop.name}`
                          : cuttingTracking?.cuttingTable
                            ? `Masa: ${cuttingTracking.cuttingTable.name}`
                            : "Kesim masası seç"}
                      </span>
                    </div>
                    <p className="mb-1 line-clamp-1 text-xs text-slate-700">{order.productName}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">Miktar: {order.quantity}</span>
                      <span className="text-slate-500">{order.status.replace("_", " ")}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-600">Müşteri: {order.customerName}</p>
                  </div>
                );
              })}
            </div>

            {workOrders.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 py-10 text-center text-sm text-slate-500">
                Henüz iş emri oluşturulmamıştır
              </div>
            )}
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
                {(filteredProducts || []).map((product) => (
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

      <Dialog
        open={isCuttingTableModalOpen}
        onOpenChange={(open) => {
          if (!open && !assigningCuttingTable) handleCuttingTableModalClose();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Kesim Masası Seçimi</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            {selectedOrder ? `${selectedOrder.orderNo} için kesim masasını seçin.` : "İş emri seçilmedi."}
            {" "}Masa kullanıcısı otomatik olarak atanır.
          </p>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {availableCuttingTables.map((table) => (
              <button
                key={table.id}
                type="button"
                disabled={assigningCuttingTable}
                onClick={() => handleCuttingTableAssign(table.id)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
              >
                <span className="font-medium text-slate-800">{table.name}</span>
                <span className="text-sm text-slate-500">
                  {table.assignedUser?.name || table.assignedUser?.email || "Atanmış kullanıcı"}
                </span>
              </button>
            ))}
            {availableCuttingTables.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                Kesim masalarına kullanıcı atanmamış. Önce Kesim Masaları ayarlarından masaları fason takipçi kullanıcılarına bağlayın.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCustomerModalOpen} onOpenChange={setIsCustomerModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Müşteri Listesi</DialogTitle>
          </DialogHeader>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Müşteri adı ile ara..."
              className="pl-10"
              value={customerSearch}
              onChange={handleCustomerSearch}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filteredCustomers.length === 0) {
                  e.preventDefault();
                  handleCustomerAdd();
                }
              }}
            />
          </div>

          <div className="max-h-96 overflow-y-auto rounded-md border">
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => handleCustomerSelect(customer)}
                  className="flex w-full items-center justify-between border-b px-3 py-3 text-left last:border-b-0 hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-800">{customer.name}</span>
                  <span className="text-xs text-slate-500">
                    {customer.phone || customer.email || "Kayıtlı müşteri"}
                  </span>
                </button>
              ))
            ) : (
              <div className="space-y-3 p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Aramaya uygun müşteri bulunamadı.
                </p>
                <Button type="button" variant="outline" onClick={handleCustomerAdd}>
                  Yazılı Müşteriyi Ekle
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
