import { useCallback, useEffect, useState } from "react";
import axios from "axios";

type Supplier = {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
};

type SupplierForm = {
  name: string;
  phone: string;
  email: string;
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

export default function SupplierEditPage() {
  const [form, setForm] = useState<SupplierForm>({ name: "", phone: "", email: "" });
  const [list, setList] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState({ submit: false, list: false });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "card">("list");

  const load = useCallback(async () => {
    try {
      setLoading((current) => ({ ...current, list: true }));
      const { data } = await axios.get<Supplier[]>("/api/suppliers");
      setList(data);
    } catch {
      setError("Tedarikci listesi yuklenemedi.");
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
    setForm({ name: "", phone: "", email: "" });
    setEditingId(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    try {
      setLoading((current) => ({ ...current, submit: true }));

      if (editingId) {
        await axios.put("/api/suppliers", { id: editingId, ...form });
        setSuccess("Tedarikci basariyla guncellendi.");
      } else {
        await axios.post("/api/suppliers", form);
        setSuccess("Tedarikci basariyla eklendi.");
      }

      resetForm();
      await load();
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, "Islem basarisiz."));
    } finally {
      setLoading((current) => ({ ...current, submit: false }));
    }
  };

  const editSupplier = (supplier: Supplier) => {
    setForm({
      name: supplier.name,
      phone: supplier.phone || "",
      email: supplier.email || "",
    });
    setEditingId(supplier.id);
  };

  const deleteSupplier = async (id: number) => {
    if (!confirm("Bu tedarikciyi silmek istediginizden emin misiniz?")) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await axios.delete("/api/suppliers", { data: { id } });
      setSuccess("Tedarikci basariyla silindi.");
      await load();
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, "Silme islemi basarisiz."));
    }
  };

  return (
    <div className="fs-entity-shell">
      <h1 className="fs-entity-title">Tedarikci Yonetimi</h1>

      {error ? <div className="fs-message fs-message-error">{error}</div> : null}
      {success ? <div className="fs-message fs-message-success">{success}</div> : null}

      <form onSubmit={submit} className="fs-entity-form">
        <div className="fs-field-group">
          <label className="fs-field-label">Tedarikci Adi *</label>
          <input
            className="fs-field-input"
            name="name"
            value={form.name}
            onChange={onFieldChange}
            placeholder="Tedarikci adi"
            required
          />
        </div>

        <div className="fs-field-group">
          <label className="fs-field-label">Telefon</label>
          <input
            className="fs-field-input"
            name="phone"
            value={form.phone}
            onChange={onFieldChange}
            placeholder="Telefon numarasi"
          />
        </div>

        <div className="fs-field-group">
          <label className="fs-field-label">E-posta</label>
          <input
            className="fs-field-input"
            name="email"
            type="email"
            value={form.email}
            onChange={onFieldChange}
            placeholder="E-posta adresi"
          />
        </div>

        <div className="fs-form-actions">
          {editingId ? (
            <button type="button" className="fs-btn fs-btn-secondary" onClick={resetForm}>
              Iptal
            </button>
          ) : null}
          <button type="submit" className="fs-btn fs-btn-primary" disabled={loading.submit}>
            {loading.submit ? "Kaydediliyor..." : editingId ? "Guncelle" : "Kaydet"}
          </button>
        </div>
      </form>

      <h2 className="fs-entity-subtitle">Tedarikci Listesi</h2>

      <div className="fs-view-toggle">
        <button
          type="button"
          className={`fs-btn ${viewMode === "list" ? "fs-btn-primary" : "fs-btn-secondary"}`}
          onClick={() => setViewMode("list")}
        >
          Liste Gorunumu
        </button>
        <button
          type="button"
          className={`fs-btn ${viewMode === "card" ? "fs-btn-primary" : "fs-btn-secondary"}`}
          onClick={() => setViewMode("card")}
        >
          Kart Gorunumu
        </button>
      </div>

      {loading.list ? (
        <div className="fs-loading-text">Yukleniyor...</div>
      ) : list.length === 0 ? (
        <div className="fs-loading-text">Henuz tedarikci kaydi yok.</div>
      ) : viewMode === "list" ? (
        <div className="fs-entity-list">
          {list.map((supplier) => (
            <div key={supplier.id} className="fs-entity-item">
              <div className="fs-entity-main">
                <p className="fs-entity-name">{supplier.name}</p>
                <div className="fs-entity-meta">
                  {supplier.phone || "-"} {supplier.email ? `- ${supplier.email}` : ""}
                </div>
              </div>
              <div className="fs-entity-actions">
                <button
                  type="button"
                  className="fs-btn fs-btn-warning"
                  onClick={() => editSupplier(supplier)}
                  disabled={editingId === supplier.id}
                >
                  Duzenle
                </button>
                <button type="button" className="fs-btn fs-btn-danger" onClick={() => deleteSupplier(supplier.id)}>
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="fs-supplier-card-grid">
          {list.map((supplier) => (
            <div key={supplier.id} className="fs-supplier-card">
              <div className="fs-supplier-card-main">
                <p className="fs-entity-name">{supplier.name}</p>
                <div className="fs-supplier-card-meta">
                  <div className="fs-supplier-card-meta-row">
                    <span>Telefon</span>
                    <strong>{supplier.phone || "-"}</strong>
                  </div>
                  <div className="fs-supplier-card-meta-row">
                    <span>E-posta</span>
                    <strong>{supplier.email || "-"}</strong>
                  </div>
                </div>
              </div>

              <div className="fs-supplier-card-actions">
                <button
                  type="button"
                  className="fs-btn fs-btn-warning"
                  onClick={() => editSupplier(supplier)}
                  disabled={editingId === supplier.id}
                >
                  Duzenle
                </button>
                <button type="button" className="fs-btn fs-btn-danger" onClick={() => deleteSupplier(supplier.id)}>
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
