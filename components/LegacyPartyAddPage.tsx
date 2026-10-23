import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import ExportButtons from "./ExportButtons";
import api from "@/lib/api";

type PartyKind = "customer" | "supplier";

type PartyItem = {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
};

type PartyFormState = {
  code: string;
  company: string;
  title: string;
  firstName: string;
  lastName: string;
  personType: "individual" | "company";
  active: boolean;
  cardRole: "customer" | "supplier" | "both";
  group: string;
  seller: string;
  addressReceiver: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  addressPostalCode: string;
  addressCity: string;
  addressCountry: string;
  deliveryReceiver: string;
  deliveryLine1: string;
  deliveryLine2: string;
  deliveryLine3: string;
  deliveryPostalCode: string;
  deliveryCity: string;
  deliveryCountry: string;
  phone: string;
  phone2: string;
  email: string;
  website: string;
  fax: string;
  gsm: string;
  notes: string;
  warning: string;
  deliveryTerms: string;
};

interface LegacyPartyAddPageProps {
  kind: PartyKind;
}

const CARD_TABS = [
  "Adres Bilgileri",
  "İrtibat Bilgileri",
  "Yasal Bilgiler",
  "Diğer Bilgiler",
  "Fiyatlandırma",
  "Satışlar / Alışlar",
  "İstatistikler",
];

const COPY = {
  customer: {
    pageTitle: "Müşteri Kartı",
    addLabel: "Müşteri Ekle",
    listTitle: "Kayıtlı Müşteriler",
    importEndpoint: "/customers/import",
    apiEndpoint: "/customers",
    exportName: "Musteriler_Dokumu",
    nameLabel: "Müşteri Adı",
    emptyState: "Henüz müşteri kaydı yok.",
    successMessage: "Müşteri başarıyla eklendi.",
    listErrorMessage: "Müşteri listesi yüklenemedi.",
    saveErrorMessage: "Müşteri kaydı yapılamadı.",
    importingText: "Müşteri içe aktarılıyor...",
    importButtonText: "Müşteri İçe Aktar",
    summaryPrefix: "M",
    defaultCardRole: "customer" as const,
  },
  supplier: {
    pageTitle: "Tedarikçi Kartı",
    addLabel: "Tedarikçi Ekle",
    listTitle: "Kayıtlı Tedarikçiler",
    importEndpoint: "/suppliers/import",
    apiEndpoint: "/suppliers",
    exportName: "Tedarikciler_Dokumu",
    nameLabel: "Tedarikçi Adı",
    emptyState: "Henüz tedarikçi kaydı yok.",
    successMessage: "Tedarikçi başarıyla eklendi.",
    listErrorMessage: "Tedarikçi listesi yüklenemedi.",
    saveErrorMessage: "Tedarikçi kaydı yapılamadı.",
    importingText: "Tedarikçi içe aktarılıyor...",
    importButtonText: "Tedarikçi İçe Aktar",
    summaryPrefix: "T",
    defaultCardRole: "supplier" as const,
  },
} as const;

const buildInitialForm = (kind: PartyKind): PartyFormState => ({
  code: "(otomatik)",
  company: "",
  title: "",
  firstName: "",
  lastName: "",
  personType: "company",
  active: true,
  cardRole: COPY[kind].defaultCardRole,
  group: "",
  seller: "",
  addressReceiver: "",
  addressLine1: "",
  addressLine2: "",
  addressLine3: "",
  addressPostalCode: "",
  addressCity: "",
  addressCountry: "TÜRKİYE",
  deliveryReceiver: "",
  deliveryLine1: "",
  deliveryLine2: "",
  deliveryLine3: "",
  deliveryPostalCode: "",
  deliveryCity: "",
  deliveryCountry: "TÜRKİYE",
  phone: "",
  phone2: "",
  email: "",
  website: "",
  fax: "",
  gsm: "",
  notes: "",
  warning: "",
  deliveryTerms: "",
});

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
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
  return lines.slice(1).map((row) => {
    const values = parseCSVLine(row);
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

export default function LegacyPartyAddPage({ kind }: LegacyPartyAddPageProps) {
  const text = COPY[kind];
  const [form, setForm] = useState<PartyFormState>(() => buildInitialForm(kind));
  const [activeTab, setActiveTab] = useState<string>(CARD_TABS[0]);
  const [list, setList] = useState<PartyItem[]>([]);
  const [loading, setLoading] = useState({ submit: false, list: false });
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [recordsViewMode, setRecordsViewMode] = useState<"card" | "list">("card");

  const fileInputId = useMemo(() => `${kind}-party-import-input`, [kind]);

  const load = useCallback(async () => {
    try {
      setLoading((current) => ({ ...current, list: true }));
      const { data } = await api.get<PartyItem[]>(text.apiEndpoint);
      setList(data);
    } catch {
      setError(text.listErrorMessage);
    } finally {
      setLoading((current) => ({ ...current, list: false }));
    }
  }, [text.apiEndpoint, text.listErrorMessage]);

  useEffect(() => {
    void load();
  }, [load]);

  const setField = <T extends keyof PartyFormState>(field: T, value: PartyFormState[T]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const buildName = (): string => {
    const companyName = form.company.trim();
    const personalName = `${form.firstName} ${form.lastName}`.trim();
    return companyName || personalName;
  };

  const buildPhone = (): string => {
    return [form.phone, form.gsm, form.phone2, form.fax]
      .map((value) => value.trim())
      .find((value) => value.length > 0) || "";
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const name = buildName();
    if (!name) {
      setError("Kurum alanı veya ad-soyad zorunludur.");
      return;
    }

    const phone = buildPhone();
    const email = form.email.trim();

    try {
      setLoading((current) => ({ ...current, submit: true }));

      if (kind === "customer") {
        await api.post(text.apiEndpoint, {
          name,
          contact: phone || null,
          address: email || null,
        });
      } else {
        await api.post(text.apiEndpoint, {
          name,
          phone: phone || null,
          email: email || null,
        });
      }

      setSuccess(text.successMessage);
      setForm(buildInitialForm(kind));
      await load();
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, text.saveErrorMessage));
    } finally {
      setLoading((current) => ({ ...current, submit: false }));
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setImporting(true);
    setError("");
    setSuccess("");

    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      let parsedData: Record<string, unknown>[] = [];

      if (extension === "csv") {
        const textContent = await file.text();
        parsedData = parseCSV(textContent);
      } else if (extension === "xlsx" || extension === "xls") {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        parsedData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as Record<
          string,
          unknown
        >[];
      } else {
        alert("Desteklenmeyen dosya formatı. Lütfen CSV veya Excel dosyası seçin.");
        return;
      }

      const payloadKey = kind === "customer" ? "customers" : "suppliers";
      const response = await api.post(text.importEndpoint, {
        [payloadKey]: parsedData,
      });
      alert(response.data?.message || "İçe aktarma tamamlandı.");
      await load();
    } catch (importError: unknown) {
      alert(`İçe aktarma sırasında hata oluştu: ${getErrorMessage(importError, "Bilinmeyen hata")}`);
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const exportRows = list.map((item) => ({
    [text.nameLabel]: item.name,
    Telefon: item.phone || "",
    "E-posta": item.email || "",
  }));

  return (
    <div className="legacyPage">
      <div className="toolbarBand">
        <div className="toolbarTitle">{text.pageTitle}</div>
        <div className="toolbarMeta">En son değişiklik: -</div>
      </div>

      {error && <div className="message messageError">{error}</div>}
      {success && <div className="message messageSuccess">{success}</div>}

      <form onSubmit={submit}>
        <section className="mainCard">
          <div className="identityGrid">
            <div className="fieldGroup compact">
              <label>Kodu</label>
              <input value={form.code} readOnly className="fieldInput readOnlyInput" />
            </div>

            <div className="fieldGroup grow">
              <label>Kurum</label>
              <input
                value={form.company}
                onChange={(event) => setField("company", event.target.value)}
                className="fieldInput"
                placeholder={text.addLabel}
              />
            </div>

            <div className="roleRadios">
              <label className="inlineRadio">
                <input
                  type="radio"
                  name={`${kind}-cardRole`}
                  checked={form.cardRole === "customer"}
                  onChange={() => setField("cardRole", "customer")}
                />
                Müşteri
              </label>
              <label className="inlineRadio">
                <input
                  type="radio"
                  name={`${kind}-cardRole`}
                  checked={form.cardRole === "supplier"}
                  onChange={() => setField("cardRole", "supplier")}
                />
                Tedarikçi
              </label>
              <label className="inlineRadio">
                <input
                  type="radio"
                  name={`${kind}-cardRole`}
                  checked={form.cardRole === "both"}
                  onChange={() => setField("cardRole", "both")}
                />
                Her ikisi
              </label>
            </div>
          </div>

          <div className="identityGrid secondRow">
            <div className="personTypeCol">
              <label className="inlineRadio">
                <input
                  type="radio"
                  checked={form.personType === "individual"}
                  onChange={() => setField("personType", "individual")}
                />
                Bireysel
              </label>
              <label className="inlineRadio">
                <input
                  type="radio"
                  checked={form.personType === "company"}
                  onChange={() => setField("personType", "company")}
                />
                Şirket
              </label>
              <label className="inlineCheckbox">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setField("active", event.target.checked)}
                />
                Aktif
              </label>
            </div>

            <div className="nameRow">
              <div className="fieldGroup">
                <label>Unvanı</label>
                <input
                  value={form.title}
                  onChange={(event) => setField("title", event.target.value)}
                  className="fieldInput"
                />
              </div>
              <div className="fieldGroup">
                <label>Soyadı</label>
                <input
                  value={form.lastName}
                  onChange={(event) => setField("lastName", event.target.value)}
                  className="fieldInput"
                />
              </div>
              <div className="fieldGroup">
                <label>Adı</label>
                <input
                  value={form.firstName}
                  onChange={(event) => setField("firstName", event.target.value)}
                  className="fieldInput"
                />
              </div>
            </div>
          </div>

          <div className="identityGrid thirdRow">
            <div className="fieldGroup">
              <label>Grup</label>
              <input
                value={form.group}
                onChange={(event) => setField("group", event.target.value)}
                className="fieldInput"
              />
            </div>
            <div className="fieldGroup">
              <label>Satıcı</label>
              <input
                value={form.seller}
                onChange={(event) => setField("seller", event.target.value)}
                className="fieldInput"
              />
            </div>
          </div>
        </section>

        <section className="tabBar">
          {CARD_TABS.map((tabName) => (
            <button
              key={tabName}
              type="button"
              onClick={() => setActiveTab(tabName)}
              className={activeTab === tabName ? "tabButton activeTab" : "tabButton"}
            >
              {tabName}
            </button>
          ))}
        </section>

        <section className="detailsPanel">
          <div className="leftColumn">
            <fieldset>
              <legend>Adres</legend>
              <div className="fieldGroup">
                <label>Alıcı</label>
                <input
                  value={form.addressReceiver}
                  onChange={(event) => setField("addressReceiver", event.target.value)}
                  className="fieldInput"
                />
              </div>
              <input
                value={form.addressLine1}
                onChange={(event) => setField("addressLine1", event.target.value)}
                className="fieldInput"
              />
              <input
                value={form.addressLine2}
                onChange={(event) => setField("addressLine2", event.target.value)}
                className="fieldInput"
              />
              <input
                value={form.addressLine3}
                onChange={(event) => setField("addressLine3", event.target.value)}
                className="fieldInput"
              />
              <div className="twoCol">
                <div className="fieldGroup">
                  <label>Posta Kodu</label>
                  <input
                    value={form.addressPostalCode}
                    onChange={(event) => setField("addressPostalCode", event.target.value)}
                    className="fieldInput"
                  />
                </div>
                <div className="fieldGroup">
                  <label>Şehir</label>
                  <input
                    value={form.addressCity}
                    onChange={(event) => setField("addressCity", event.target.value)}
                    className="fieldInput"
                  />
                </div>
              </div>
              <div className="fieldGroup">
                <label>Ülke</label>
                <input
                  value={form.addressCountry}
                  onChange={(event) => setField("addressCountry", event.target.value)}
                  className="fieldInput"
                />
              </div>
            </fieldset>

            <fieldset>
              <legend>Teslim edilecek yer</legend>
              <div className="fieldGroup">
                <label>Alıcı</label>
                <input
                  value={form.deliveryReceiver}
                  onChange={(event) => setField("deliveryReceiver", event.target.value)}
                  className="fieldInput"
                />
              </div>
              <input
                value={form.deliveryLine1}
                onChange={(event) => setField("deliveryLine1", event.target.value)}
                className="fieldInput"
              />
              <input
                value={form.deliveryLine2}
                onChange={(event) => setField("deliveryLine2", event.target.value)}
                className="fieldInput"
              />
              <input
                value={form.deliveryLine3}
                onChange={(event) => setField("deliveryLine3", event.target.value)}
                className="fieldInput"
              />
              <div className="twoCol">
                <div className="fieldGroup">
                  <label>Posta Kodu</label>
                  <input
                    value={form.deliveryPostalCode}
                    onChange={(event) => setField("deliveryPostalCode", event.target.value)}
                    className="fieldInput"
                  />
                </div>
                <div className="fieldGroup">
                  <label>Şehir</label>
                  <input
                    value={form.deliveryCity}
                    onChange={(event) => setField("deliveryCity", event.target.value)}
                    className="fieldInput"
                  />
                </div>
              </div>
              <div className="fieldGroup">
                <label>Ülke</label>
                <input
                  value={form.deliveryCountry}
                  onChange={(event) => setField("deliveryCountry", event.target.value)}
                  className="fieldInput"
                />
              </div>
            </fieldset>
          </div>

          <div className="rightColumn">
            <div className="contactGrid">
              <div className="fieldGroup">
                <label>Telefon</label>
                <input
                  value={form.phone}
                  onChange={(event) => setField("phone", event.target.value)}
                  className="fieldInput"
                />
              </div>
              <div className="fieldGroup">
                <label>E-posta</label>
                <input
                  value={form.email}
                  onChange={(event) => setField("email", event.target.value)}
                  className="fieldInput"
                  type="email"
                />
              </div>
              <div className="fieldGroup">
                <label>Telefon 2</label>
                <input
                  value={form.phone2}
                  onChange={(event) => setField("phone2", event.target.value)}
                  className="fieldInput"
                />
              </div>
              <div className="fieldGroup">
                <label>Web sitesi</label>
                <input
                  value={form.website}
                  onChange={(event) => setField("website", event.target.value)}
                  className="fieldInput"
                />
              </div>
              <div className="fieldGroup">
                <label>Faks</label>
                <input
                  value={form.fax}
                  onChange={(event) => setField("fax", event.target.value)}
                  className="fieldInput"
                />
              </div>
              <div className="fieldGroup">
                <label>GSM</label>
                <input
                  value={form.gsm}
                  onChange={(event) => setField("gsm", event.target.value)}
                  className="fieldInput"
                />
              </div>
            </div>

            <div className="fieldGroup">
              <label>Notlar</label>
              <textarea
                value={form.notes}
                onChange={(event) => setField("notes", event.target.value)}
                className="textArea notesArea"
              />
            </div>
            <div className="fieldGroup">
              <label>Uyarı</label>
              <textarea
                value={form.warning}
                onChange={(event) => setField("warning", event.target.value)}
                className="textArea warningArea"
              />
            </div>
            <div className="fieldGroup">
              <label>Teslimat Şartları</label>
              <textarea
                value={form.deliveryTerms}
                onChange={(event) => setField("deliveryTerms", event.target.value)}
                className="textArea termsArea"
              />
            </div>
          </div>
        </section>

        <section className="actions">
          <button type="submit" className="saveButton" disabled={loading.submit}>
            {loading.submit ? "Kaydediliyor..." : "Kaydet"}
          </button>

          <input
            type="file"
            id={fileInputId}
            accept=".csv,.xlsx,.xls"
            onChange={handleImport}
            style={{ display: "none" }}
            disabled={importing}
          />
          <label htmlFor={fileInputId} className={importing ? "importButton disabledLabel" : "importButton"}>
            {importing ? text.importingText : text.importButtonText}
          </label>

          <ExportButtons data={exportRows} filename={text.exportName} className="legacyExports" />
        </section>
      </form>

      <section className="recordsSection">
        <div className="recordsHeader">
          <h2>{text.listTitle}</h2>
          {kind === "supplier" ? (
            <div className="recordsViewToggle">
              <button
                type="button"
                className={recordsViewMode === "list" ? "recordsViewButton active" : "recordsViewButton"}
                onClick={() => setRecordsViewMode("list")}
              >
                Liste Gorunumu
              </button>
              <button
                type="button"
                className={recordsViewMode === "card" ? "recordsViewButton active" : "recordsViewButton"}
                onClick={() => setRecordsViewMode("card")}
              >
                Kart Gorunumu
              </button>
            </div>
          ) : null}
        </div>
        {loading.list ? (
          <div className="loadingState">Yukleniyor...</div>
        ) : list.length === 0 ? (
          <div className="emptyState">{text.emptyState}</div>
        ) : kind === "supplier" && recordsViewMode === "list" ? (
          <div className="recordsList">
            {list.map((item) => (
              <article key={item.id} className="recordListItem">
                <div className="recordListMain">
                  <div className="recordCode">
                    {text.summaryPrefix}.{String(item.id).padStart(4, "0")}
                  </div>
                  <div className="recordName">{item.name}</div>
                </div>
                <div className="recordListMeta">
                  <span className="recordListLabel">Telefon</span>
                  <span className="recordListValue">{item.phone || "-"}</span>
                </div>
                <div className="recordListMeta">
                  <span className="recordListLabel">E-posta</span>
                  <span className="recordListValue">{item.email || "-"}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="recordsGrid">
            {list.map((item) => (
              <article key={item.id} className="recordCard">
                <div className="recordCode">
                  {text.summaryPrefix}.{String(item.id).padStart(4, "0")}
                </div>
                <div className="recordName">{item.name}</div>
                <div className="recordMeta">{item.phone || "-"}</div>
                <div className="recordMeta">{item.email || "-"}</div>
              </article>
            ))}
          </div>
        )}
      </section>

      <style jsx>{`
        .legacyPage {
          --surface: var(--fs-color-surface);
          --surface-muted: var(--fs-color-bg);
          --surface-soft: var(--fs-color-surface-soft);
          --border: var(--fs-color-border);
          --border-strong: var(--fs-color-border-strong);
          --text: var(--fs-color-text);
          --text-muted: var(--fs-color-text-muted);
          --accent: var(--fs-color-primary);
          --accent-soft: var(--fs-color-primary-soft);
          background: linear-gradient(180deg, var(--fs-color-surface) 0%, var(--fs-color-bg) 100%);
          border: none;
          border-radius: 0;
          overflow: hidden;
          font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          color: var(--text);
          margin: 0;
          width: 100%;
          max-width: 100%;
          min-height: 100vh;
          box-shadow: none;
          box-sizing: border-box;
        }

        .toolbarBand {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          padding: 14px 18px;
          border-bottom: 1px solid var(--border);
          background: var(--surface);
          font-size: 13px;
          font-weight: 600;
        }

        .toolbarTitle {
          font-size: 17px;
          font-weight: 700;
        }

        .toolbarMeta {
          font-weight: 500;
          color: var(--text-muted);
          font-size: 12px;
        }

        .message {
          margin: 14px 18px 0;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid;
          font-size: 13px;
        }

        .messageError {
          background: #fef2f2;
          border-color: #fecaca;
          color: #b91c1c;
        }

        .messageSuccess {
          background: #ecfdf3;
          border-color: #a7f3d0;
          color: #047857;
        }

        .mainCard {
          margin: 14px 18px 0;
          padding: 16px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
        }

        .identityGrid {
          display: grid;
          grid-template-columns: minmax(120px, 150px) minmax(320px, 1fr) minmax(240px, 280px);
          gap: 12px;
          align-items: end;
        }

        .secondRow {
          margin-top: 12px;
          grid-template-columns: minmax(120px, 150px) minmax(620px, 1fr);
          align-items: start;
        }

        .thirdRow {
          margin-top: 12px;
          grid-template-columns: minmax(320px, 1fr) minmax(220px, 240px);
        }

        .fieldGroup {
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 0;
        }

        .fieldGroup label {
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 600;
        }

        .fieldGroup.compact {
          max-width: 140px;
        }

        .fieldGroup.grow {
          width: 100%;
        }

        .fieldInput,
        .textArea {
          width: 100%;
          border: 1px solid var(--border-strong);
          border-radius: 10px;
          background: var(--surface-muted);
          font-size: 13px;
          color: var(--text);
          box-sizing: border-box;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
        }

        .fieldInput {
          min-height: 38px;
          padding: 4px 8px;
        }

        .fieldInput:focus,
        .textArea:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
          background: #ffffff;
        }

        .textArea {
          resize: vertical;
          min-height: 100px;
          padding: 10px;
        }

        .readOnlyInput {
          background: #f3f4f6;
          color: #6b7280;
          font-style: normal;
        }

        .roleRadios,
        .personTypeCol {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-top: 2px;
        }

        .inlineRadio,
        .inlineCheckbox {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--text);
          font-weight: 500;
        }

        .nameRow {
          display: grid;
          grid-template-columns: repeat(3, minmax(120px, 1fr));
          gap: 12px;
        }

        .tabBar {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 14px 18px 0;
          padding: 0;
        }

        .tabButton {
          border: 1px solid var(--border-strong);
          border-radius: 999px;
          background: #ffffff;
          color: #374151;
          font-size: 13px;
          font-weight: 600;
          padding: 8px 14px;
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
        }

        .tabButton:hover {
          border-color: #93c5fd;
          color: #1d4ed8;
          background: #eff6ff;
        }

        .activeTab {
          border-color: var(--accent);
          background: var(--accent);
          color: #ffffff;
        }

        .detailsPanel {
          display: grid;
          grid-template-columns: minmax(280px, 360px) minmax(440px, 1fr);
          gap: 16px;
          margin: 14px 18px 0;
          padding: 0;
          background: transparent;
        }

        .leftColumn,
        .rightColumn {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        fieldset {
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
          margin: 0;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        legend {
          font-size: 12px;
          color: #334155;
          font-style: normal;
          font-weight: 600;
          padding: 0 6px;
        }

        .twoCol {
          display: grid;
          grid-template-columns: repeat(2, minmax(120px, 1fr));
          gap: 10px;
        }

        .contactGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(220px, 1fr));
          gap: 10px 12px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 12px;
        }

        .notesArea {
          min-height: 130px;
        }

        .warningArea {
          min-height: 120px;
        }

        .termsArea {
          min-height: 110px;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
          margin: 14px 18px 0;
          padding: 14px 0 0;
          border-top: 1px solid var(--border);
        }

        .saveButton,
        .importButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          border: 1px solid transparent;
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          border-radius: 10px;
          padding: 0 16px;
        }

        .saveButton {
          border-color: #1d4ed8;
          background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
          cursor: pointer;
        }

        .saveButton:hover:not(:disabled) {
          filter: brightness(0.97);
        }

        .saveButton:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .importButton {
          border-color: #93c5fd;
          background: #eff6ff;
          color: #1d4ed8;
          cursor: pointer;
        }

        .importButton:hover {
          border-color: #60a5fa;
          background: #dbeafe;
        }

        .disabledLabel {
          background: #f1f5f9;
          border-color: #cbd5e1;
          color: #64748b;
          cursor: not-allowed;
        }

        .actions :global(.export-buttons) {
          display: inline-flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .actions :global(.export-buttons .btn) {
          min-height: 38px;
          border: 1px solid var(--border-strong);
          background: #ffffff;
          color: #1f2937;
          font-size: 13px;
          font-weight: 600;
          padding: 0 14px;
          border-radius: 10px;
          cursor: pointer;
          transition: border-color 0.2s ease, background-color 0.2s ease;
        }

        .actions :global(.export-buttons .btn:hover:not(:disabled)) {
          border-color: #93c5fd;
          background: #eff6ff;
        }

        .actions :global(.export-buttons .btn:disabled) {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .recordsSection {
          border-top: 1px solid var(--border);
          background: var(--surface);
          margin: 14px 18px 18px;
          padding: 14px;
          border: 1px solid var(--border);
          border-radius: 14px;
        }

        .recordsSection h2 {
          margin: 0;
          color: #1f2937;
          font-size: 16px;
        }

        .recordsHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .recordsViewToggle {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .recordsViewButton {
          border: 1px solid var(--border-strong);
          background: #f8fafc;
          color: #334155;
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .recordsViewButton.active {
          background: #2563eb;
          border-color: #1d4ed8;
          color: #ffffff;
        }

        .recordsGrid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 10px;
        }

        .recordsList {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .recordListItem {
          border: 1px solid var(--border);
          background: var(--surface-soft);
          border-radius: 12px;
          padding: 12px;
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
        }

        .recordListMain {
          min-width: 220px;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .recordListMeta {
          min-width: 180px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .recordListLabel {
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .recordListValue {
          font-size: 13px;
          color: #1f2937;
          font-weight: 600;
          word-break: break-word;
        }

        .recordCard {
          border: 1px solid var(--border);
          background: var(--surface-soft);
          border-radius: 12px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .recordCode {
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
        }

        .recordName {
          font-size: 14px;
          font-weight: 700;
          color: #111827;
        }

        .recordMeta {
          font-size: 12px;
          color: #475569;
          word-break: break-word;
        }

        .loadingState,
        .emptyState {
          border: 1px dashed var(--border-strong);
          border-radius: 12px;
          background: var(--surface-muted);
          color: #64748b;
          padding: 18px;
          font-size: 13px;
        }

        @media (max-width: 1200px) {
          .identityGrid {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .secondRow,
          .thirdRow {
            grid-template-columns: 1fr;
          }

          .personTypeCol {
            flex-direction: row;
            gap: 14px;
            flex-wrap: wrap;
          }

          .roleRadios {
            flex-direction: row;
            gap: 14px;
            flex-wrap: wrap;
          }

          .nameRow {
            grid-template-columns: 1fr;
          }

          .detailsPanel {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .toolbarBand {
            flex-direction: column;
            align-items: flex-start;
          }

          .mainCard,
          .tabBar,
          .detailsPanel,
          .actions,
          .recordsSection,
          .message {
            margin-left: 12px;
            margin-right: 12px;
          }

          .contactGrid {
            grid-template-columns: 1fr;
          }

          .twoCol {
            grid-template-columns: 1fr;
          }

          .tabButton {
            width: 100%;
            text-align: left;
          }

          .recordsHeader {
            flex-direction: column;
            align-items: flex-start;
          }

          .recordListItem {
            align-items: flex-start;
            flex-direction: column;
          }

          .recordListMeta {
            width: 100%;
            min-width: 0;
          }
        }
      `}</style>
    </div>
  );
}
