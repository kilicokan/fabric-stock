import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import ExportButtons from "../../components/ExportButtons";
import api from "@/lib/api";

type Customer = {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
};

type CustomerForm = {
  name: string;
  contact: string;
  address: string;
};

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
};

const parseCSV = (csvContent: string): Record<string, string>[] => {
  const lines = csvContent.split("\n").filter((line) => line.trim());
  if (lines.length < 2) {
    return [];
  }

  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const mapped: Record<string, string> = {};
    headers.forEach((header, index) => {
      mapped[header] = values[index] || "";
    });
    return mapped;
  });
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallback;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
};

export default function CustomerListPage() {
  const [form, setForm] = useState<CustomerForm>({ name: "", contact: "", address: "" });
  const [list, setList] = useState<Customer[]>([]);
  const [loading, setLoading] = useState({ submit: false, list: false, import: false });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fileInputId = "customer-import-input";

  const load = useCallback(async () => {
    try {
      setLoading((current) => ({ ...current, list: true }));
      const { data } = await api.get<Customer[]>("/customers");
      setList(data);
    } catch {
      setError("Müşteri listesi yüklenemedi.");
    } finally {
      setLoading((current) => ({ ...current, list: false }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const resetForm = () => {
    setForm({ name: "", contact: "", address: "" });
    setEditingId(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    try {
      setLoading((current) => ({ ...current, submit: true }));

      if (editingId) {
        await api.put("/customers", { id: editingId, ...form });
        setSuccess("Müşteri başarıyla güncellendi.");
      } else {
        await api.post("/customers", form);
        setSuccess("Müşteri başarıyla eklendi.");
      }

      resetForm();
      await load();
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, "İşlem başarısız."));
    } finally {
      setLoading((current) => ({ ...current, submit: false }));
    }
  };

  const editCustomer = (customer: Customer) => {
    setForm({
      name: customer.name,
      contact: customer.phone || "",
      address: customer.email || "",
    });
    setEditingId(customer.id);
  };

  const deleteCustomer = async (id: number) => {
    if (!confirm("Bu müşteriyi silmek istediğinizden emin misiniz?")) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await api.delete("/customers", { data: { id } });
      setSuccess("Müşteri başarıyla silindi.");
      await load();
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, "Silme işlemi başarısız."));
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setLoading((current) => ({ ...current, import: true }));
      const extension = file.name.split(".").pop()?.toLowerCase();
      let parsedData: Record<string, unknown>[] = [];

      if (extension === "csv") {
        parsedData = parseCSV(await file.text());
      } else if (extension === "xlsx" || extension === "xls") {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        parsedData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as Record<
          string,
          unknown
        >[];
      } else {
        alert("Desteklenmeyen dosya formatı. Lütfen CSV veya Excel dosyası yükleyin.");
        return;
      }

      const response = await api.post("/customers/import", { customers: parsedData });
      alert(response.data?.message || "İçe aktarma tamamlandı.");
      await load();
    } catch (importError: unknown) {
      alert(`İçe aktarma sırasında hata oluştu: ${getErrorMessage(importError, "Bilinmeyen hata")}`);
    } finally {
      setLoading((current) => ({ ...current, import: false }));
      event.target.value = "";
    }
  };

  const exportRows = useMemo(
    () =>
      list.map((customer) => ({
        "Müşteri Adı": customer.name,
        Telefon: customer.phone || "",
        "E-posta": customer.email || "",
      })),
    [list]
  );

  return (
    <div className="fs-entity-shell">
      <h1 className="fs-entity-title">Müşteri Yönetimi</h1>

      {error ? <div className="fs-message fs-message-error">{error}</div> : null}
      {success ? <div className="fs-message fs-message-success">{success}</div> : null}

      <form onSubmit={submit} className="fs-entity-form">
        <div className="fs-field-group">
          <label className="fs-field-label">Müşteri Adı *</label>
          <input
            className="fs-field-input"
            name="name"
            value={form.name}
            onChange={onFieldChange}
            placeholder="Müşteri adı"
            required
          />
        </div>

        <div className="fs-field-group">
          <label className="fs-field-label">Telefon</label>
          <input
            className="fs-field-input"
            name="contact"
            value={form.contact}
            onChange={onFieldChange}
            placeholder="Telefon numarası"
          />
        </div>

        <div className="fs-field-group">
          <label className="fs-field-label">E-posta</label>
          <input
            className="fs-field-input"
            name="address"
            type="email"
            value={form.address}
            onChange={onFieldChange}
            placeholder="E-posta adresi"
          />
        </div>

        <div className="fs-form-actions">
          {editingId ? (
            <button type="button" className="fs-btn fs-btn-secondary" onClick={resetForm}>
              İptal
            </button>
          ) : null}
          <button type="submit" className="fs-btn fs-btn-primary" disabled={loading.submit}>
            {loading.submit ? "Kaydediliyor..." : editingId ? "Güncelle" : "Kaydet"}
          </button>
        </div>
      </form>

      <div className="fs-toolbar">
        <input
          id={fileInputId}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleImport}
          style={{ display: "none" }}
          disabled={loading.import}
        />
        <label htmlFor={fileInputId} className="fs-btn fs-btn-secondary">
          {loading.import ? "İçe aktarılıyor..." : "İçe Aktar"}
        </label>
        <div className="fs-export-wrap">
          <ExportButtons data={exportRows} filename="Musteriler_Dokumu" />
        </div>
      </div>

      <h2 className="fs-entity-subtitle">Müşteri Listesi</h2>

      {loading.list ? (
        <div className="fs-loading-text">Yükleniyor...</div>
      ) : (
        <div className="fs-entity-list">
          {list.map((customer) => (
            <div key={customer.id} className="fs-entity-item">
              <div className="fs-entity-main">
                <p className="fs-entity-name">{customer.name}</p>
                <div className="fs-entity-meta">
                  {customer.phone || "-"} {customer.email ? `• ${customer.email}` : ""}
                </div>
              </div>
              <div className="fs-entity-actions">
                <button
                  type="button"
                  className="fs-btn fs-btn-warning"
                  onClick={() => editCustomer(customer)}
                  disabled={editingId === customer.id}
                >
                  Düzenle
                </button>
                <button type="button" className="fs-btn fs-btn-danger" onClick={() => deleteCustomer(customer.id)}>
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
