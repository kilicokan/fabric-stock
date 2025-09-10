'use client';

import { useState, useEffect } from "react";
import axios from "axios";

export default function FabricEntry() {
  const [formData, setFormData] = useState({
    materialCode: "KUM.001.00000004",
    materialName: "RAŞEL KUMAS DESENLI",
    materialType: "Pamuk",
    materialGroup: "KUM.001",
    fabricProperty: "Desenli kumaş",
    color: "Mavi",
    unit: "metre",
    patternCode: "",
    category: "",
    model: "",
    warehouse: "İstanbul",
    shelfLife: "",
    barcode: "",
    season: "",
    gtip: "",
    taxRate: 10,
    supplierCode: "",
    productCode: "",
    isoDocumentNo: "",
    website: "",
    campaignGroup: "",
    priceGroup: ""
  });
  
  const [fabricTypes, setFabricTypes] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [showAddType, setShowAddType] = useState(false);
  const [newType, setNewType] = useState("");
  const [showAddColor, setShowAddColor] = useState(false);
  const [newColor, setNewColor] = useState("");
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [newWarehouse, setNewWarehouse] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load types/colors/warehouses on mount
  useEffect(() => {
    setFabricTypes(["Pamuk", "Polyester", "İpek", "Keten"]);
    setColors(["Beyaz", "Mavi", "Kırmızı", "Siyah"]);
    setWarehouses(["İstanbul", "Ankara", "İzmir"]);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await axios.post("/api/fabric-entry", formData);
      alert("Kumaş başarıyla kaydedildi!");
      // Reset form except for predefined values
      setFormData({
        ...formData,
        patternCode: "",
        category: "",
        model: "",
        shelfLife: "",
        barcode: "",
        season: "",
        gtip: "",
        supplierCode: "",
        productCode: "",
        isoDocumentNo: "",
        website: "",
        campaignGroup: "",
        priceGroup: ""
      });
    } catch (err) {
      console.error(err);
      alert("Kayıt sırasında hata oluştu!");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add new fabric type
  const handleAddType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newType.trim()) return;
    setFabricTypes((prev) => [...prev, newType]);
    setFormData((prev) => ({ ...prev, materialType: newType }));
    setNewType("");
    setShowAddType(false);
  };

  // Add new color
  const handleAddColor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColor.trim()) return;
    setColors((prev) => [...prev, newColor]);
    setFormData((prev) => ({ ...prev, color: newColor }));
    setNewColor("");
    setShowAddColor(false);
  };

  // Add new warehouse
  const handleAddWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWarehouse.trim()) return;
    setWarehouses((prev) => [...prev, newWarehouse]);
    setFormData((prev) => ({ ...prev, warehouse: newWarehouse }));
    setNewWarehouse("");
    setShowAddWarehouse(false);
  };

  return (
    <div className="container my-4">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-10">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">📥 Kumaş Tanımlama Sayfası</h5>
              <span className="badge bg-light text-dark">Kodu: {formData.materialCode}</span>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="row">
                  {/* Sol Sütun */}
                  <div className="col-md-6">
                    <div className="form-section">
                      <h6 className="section-title">Temel Bilgiler</h6>
                      
                      <div className="mb-3">
                        <label className="form-label required-field">Malzeme Kodu</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          name="materialCode"
                          value={formData.materialCode}
                          onChange={handleChange}
                          required 
                        />
                      </div>
                      
                      <div className="mb-3">
                        <label className="form-label required-field">Malzeme Adı</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          name="materialName"
                          value={formData.materialName}
                          onChange={handleChange}
                          required 
                        />
                      </div>
                      
                      <div className="mb-3">
                        <label className="form-label required-field">Malzeme Türü</label>
                        <div className="d-flex gap-2">
                          <select 
                            className="form-select flex-grow-1" 
                            name="materialType"
                            value={formData.materialType}
                            onChange={handleChange}
                            required
                          >
                            <option value="">Seçiniz</option>
                            {fabricTypes.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                          <button 
                            type="button" 
                            className="btn btn-success"
                            onClick={() => setShowAddType((v) => !v)}
                            style={{ minWidth: '40px' }}
                          >
                            +
                          </button>
                        </div>
                        {showAddType && (
                          <div className="d-flex gap-2 mt-2">
                            <input
                              type="text"
                              className="form-control"
                              value={newType}
                              onChange={e => setNewType(e.target.value)}
                              placeholder="Yeni tür"
                              required
                            />
                            <button 
                              type="button" 
                              className="btn btn-primary"
                              onClick={handleAddType}
                              style={{ minWidth: '70px' }}
                            >
                              Ekle
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div className="mb-3">
                        <label className="form-label required-field">Malzeme Grubu</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          name="materialGroup"
                          value={formData.materialGroup}
                          onChange={handleChange}
                          required 
                        />
                      </div>
                      
                      <div className="mb-3">
                        <label className="form-label required-field">Kumaş Özelliği</label>
                        <textarea 
                          className="form-control" 
                          name="fabricProperty"
                          value={formData.fabricProperty}
                          onChange={handleChange}
                          rows={2} 
                        />
                      </div>

                      <div className="mb-3">
                        <label className="form-label">Birim</label>
                        <select 
                          className="form-select" 
                          name="unit"
                          value={formData.unit}
                          onChange={handleChange}
                        >
                          <option value="metre">Metre</option>
                          <option value="adet">Adet</option>
                          <option value="top">Top</option>
                          <option value="kg">Kilogram</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  {/* Sağ Sütun */}
                  <div className="col-md-6">
                    <div className="form-section">
                      <h6 className="section-title">Renk ve Desen</h6>
                      
                      <div className="mb-3">
                        <label className="form-label required-field">Renk</label>
                        <div className="d-flex gap-2">
                          <select 
                            className="form-select flex-grow-1" 
                            name="color"
                            value={formData.color}
                            onChange={handleChange}
                            required
                          >
                            <option value="">Renk seçiniz</option>
                            {colors.map((color) => (
                              <option key={color} value={color}>{color}</option>
                            ))}
                          </select>
                          <button 
                            type="button" 
                            className="btn btn-success"
                            onClick={() => setShowAddColor((v) => !v)}
                            style={{ minWidth: '40px' }}
                          >
                            +
                          </button>
                        </div>
                        {showAddColor && (
                          <div className="d-flex gap-2 mt-2">
                            <input
                              type="text"
                              className="form-control"
                              value={newColor}
                              onChange={e => setNewColor(e.target.value)}
                              placeholder="Yeni renk"
                              required
                            />
                            <button 
                              type="button" 
                              className="btn btn-primary"
                              onClick={handleAddColor}
                              style={{ minWidth: '70px' }}
                            >
                              Ekle
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div className="mb-3">
                        <label className="form-label">Desen Kodu</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          name="patternCode"
                          value={formData.patternCode}
                          onChange={handleChange}
                        />
                      </div>
                      
                      <div className="mb-3">
                        <label className="form-label">Kategori</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          name="category"
                          value={formData.category}
                          onChange={handleChange}
                        />
                      </div>
                      
                      <div className="mb-3">
                        <label className="form-label">Model</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          name="model"
                          value={formData.model}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="row mt-3">
                  <div className="col-md-6">
                    <div className="form-section">
                      <h6 className="section-title">Tedarikçi Bilgileri</h6>
                      
                      <div className="mb-3">
                        <label className="form-label">Tedarikçi Kodu</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          name="supplierCode"
                          value={formData.supplierCode}
                          onChange={handleChange}
                        />
                      </div>
                      
                      <div className="mb-3">
                        <label className="form-label">Ürün Kodu</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          name="productCode"
                          value={formData.productCode}
                          onChange={handleChange}
                        />
                      </div>
                      
                      <div className="mb-3">
                        <label className="form-label">ISO Doküman No</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          name="isoDocumentNo"
                          value={formData.isoDocumentNo}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-md-6">
                    <div className="form-section">
                      <h6 className="section-title">Depo ve Diğer Bilgiler</h6>
                      
                      <div className="mb-3">
                        <label className="form-label">Depo</label>
                        <div className="d-flex gap-2">
                          <select 
                            className="form-select flex-grow-1" 
                            name="warehouse"
                            value={formData.warehouse}
                            onChange={handleChange}
                          >
                            {warehouses.map((warehouse) => (
                              <option key={warehouse} value={warehouse}>{warehouse}</option>
                            ))}
                          </select>
                          <button 
                            type="button" 
                            className="btn btn-success"
                            onClick={() => setShowAddWarehouse((v) => !v)}
                            style={{ minWidth: '40px' }}
                          >
                            +
                          </button>
                        </div>
                        {showAddWarehouse && (
                          <div className="d-flex gap-2 mt-2">
                            <input
                              type="text"
                              className="form-control"
                              value={newWarehouse}
                              onChange={e => setNewWarehouse(e.target.value)}
                              placeholder="Yeni depo"
                              required
                            />
                            <button 
                              type="button" 
                              className="btn btn-primary"
                              onClick={handleAddWarehouse}
                              style={{ minWidth: '70px' }}
                            >
                              Ekle
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div className="mb-3">
                        <label className="form-label">Raf Ömrü (Gün)</label>
                        <input 
                          type="number" 
                          className="form-control" 
                          name="shelfLife"
                          value={formData.shelfLife}
                          onChange={handleChange}
                        />
                      </div>
                      
                      <div className="mb-3">
                        <label className="form-label">Barkod</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          name="barcode"
                          value={formData.barcode}
                          onChange={handleChange}
                        />
                      </div>

                      <div className="mb-3">
                        <label className="form-label">Web Sayfası</label>
                        <input 
                          type="url" 
                          className="form-control" 
                          name="website"
                          value={formData.website}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="form-section mt-4">
                  <h6 className="section-title">Ek Bilgiler</h6>
                  <div className="row">
                    <div className="col-md-3 mb-3">
                      <label className="form-label">Sezon</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        name="season"
                        value={formData.season}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="col-md-3 mb-3">
                      <label className="form-label">GTIP No</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        name="gtip"
                        value={formData.gtip}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="col-md-3 mb-3">
                      <label className="form-label">KDV Oranı</label>
                      <div className="input-group">
                        <input 
                          type="number" 
                          className="form-control" 
                          name="taxRate"
                          value={formData.taxRate}
                          onChange={handleChange}
                        />
                        <span className="input-group-text">%</span>
                      </div>
                    </div>
                    <div className="col-md-3 mb-3">
                      <label className="form-label">Kampanya Grubu</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        name="campaignGroup"
                        value={formData.campaignGroup}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="col-md-3 mb-3">
                      <label className="form-label">Fiyat Grubu</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        name="priceGroup"
                        value={formData.priceGroup}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="d-grid gap-2 d-md-flex justify-content-md-end mt-4">
                  <button type="reset" className="btn btn-secondary me-md-2">Temizle</button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Kaydediliyor...
                      </>
                    ) : (
                      "Kaydet"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .card {
          border-radius: 10px;
          box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
          margin-bottom: 20px;
        }
        .card-header {
          background-color: #4e73df;
          color: white;
          border-radius: 10px 10px 0 0 !important;
          font-weight: bold;
        }
        .form-section {
          margin-bottom: 15px;
        }
        .section-title {
          border-bottom: 2px solid #4e73df;
          padding-bottom: 5px;
          margin-bottom: 15px;
          color: #4e73df;
          font-weight: bold;
        }
        .required-field::after {
          content: " *";
          color: red;
        }
        .form-control, .form-select {
          border-radius: 5px;
          border: 1px solid #ddd;
          padding: 10px;
        }
        .form-label {
          font-weight: 500;
          margin-bottom: 5px;
        }
        .btn-primary {
          background-color: #4e73df;
          border-color: #4e73df;
          border-radius: 5px;
          padding: 10px 20px;
          font-weight: 500;
        }
        .btn-primary:hover {
          background-color: #2e59d9;
          border-color: #2e59d9;
        }
        .btn-success {
          background-color: #1cc88a;
          border-color: #1cc88a;
          border-radius: 5px;
          font-weight: 500;
        }
        .btn-success:hover {
          background-color: #17a673;
          border-color: #17a673;
        }
        .btn-secondary {
          border-radius: 5px;
          padding: 10px 20px;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}