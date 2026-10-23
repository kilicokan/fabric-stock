import { useEffect, useState } from 'react';
import { DEFAULT_PARAMETER_SETTINGS, readParameterSettings, saveParameterSettings } from '@/lib/parameters';

export default function ParametersPage() {
  const [reportNumberFormat, setReportNumberFormat] = useState(DEFAULT_PARAMETER_SETTINGS.reportNumberFormat);
  const [fasonWorkOrderGroupingMode, setFasonWorkOrderGroupingMode] = useState<"separate" | "combined">(DEFAULT_PARAMETER_SETTINGS.fasonWorkOrderGroupingMode);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loaded = readParameterSettings();
    setReportNumberFormat(loaded.reportNumberFormat);
    setFasonWorkOrderGroupingMode(loaded.fasonWorkOrderGroupingMode);
  }, []);

  const handleSave = () => {
    const normalized = reportNumberFormat.trim().toUpperCase() || DEFAULT_PARAMETER_SETTINGS.reportNumberFormat;
    saveParameterSettings({ 
      reportNumberFormat: normalized,
      fasonWorkOrderGroupingMode
    });
    setReportNumberFormat(normalized);
    setMessage('Parametreler kaydedildi.');
    setTimeout(() => setMessage(''), 2500);
  };

  return (
    <div style={{ maxWidth: 720, margin: '32px auto', padding: 24 }}>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>Parametreler</h1>

      {message && <div style={{ background: '#d4edda', color: '#155724', padding: 12, borderRadius: 8, marginBottom: 16 }}>{message}</div>}

      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Rapor numarası başla</label>
          <input
            value={reportNumberFormat}
            onChange={(e) => setReportNumberFormat(e.target.value.toUpperCase())}
            placeholder="XXX"
            style={{ width: '100%', padding: 12, border: '1px solid #ccd', borderRadius: 8 }}
            aria-label="Rapor numarası formatı"
          />
          <small style={{ color: '#666', display: 'block', marginTop: 8 }}>Örnek: XXX, RPT, RPT-001 veya istediğiniz başlık</small>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Fason İş Emri Oluşturma Modu</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: 12, border: '1px solid #ccd', borderRadius: 8 }}>
              <input
                type="radio"
                name="fasonWorkOrderGroupingMode"
                value="separate"
                checked={fasonWorkOrderGroupingMode === "separate"}
                onChange={() => setFasonWorkOrderGroupingMode("separate")}
              />
              <div>
                <div style={{ fontWeight: 500 }}>Her satır ayrı iş emri</div>
                <small style={{ color: '#666' }}>Her model satırı için ayrı bir iş emri no oluşturulur (Örn: SIP-001-MODEL1, SIP-001-MODEL2)</small>
              </div>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: 12, border: '1px solid #ccd', borderRadius: 8 }}>
              <input
                type="radio"
                name="fasonWorkOrderGroupingMode"
                value="combined"
                checked={fasonWorkOrderGroupingMode === "combined"}
                onChange={() => setFasonWorkOrderGroupingMode("combined")}
              />
              <div>
                <div style={{ fontWeight: 500 }}>Tüm satırlar tek iş emri altında</div>
                <small style={{ color: '#666' }}>Tüm modeller tek bir iş emri no ile oluşturulur (Örn: SIP-001)</small>
              </div>
            </label>
          </div>
        </div>

        <button onClick={handleSave} style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer' }}>
          Kaydet
        </button>
      </div>
    </div>
  );
}
