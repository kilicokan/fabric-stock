"use client"

import { useMemo, useState, useEffect } from "react"
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  Factory,
  Gauge,
  Layers3,
  Maximize2,
  PackageCheck,
  Play,
  Printer,
  RefreshCw,
  Scale,
  Search,
  Settings2,
  Sun,
  UserRound,
  Wifi,
  X,
} from "lucide-react"
import type { WorkOrder, Machine, Operator } from "../../types/cutting-workshop-dashboard"

const steps = ["Sipariş", "Serim", "Tartım", "Teslim"]
type SpreadingMode = "weight-first" | "spread-then-weight"
type RollEntry = { id: string; color: string; rollNumber: number; weightKg: number; calculatedLayers: number; pieceCount: number }

const getAuthHeaders = (): Record<string, string> => {
  const token = typeof window === "undefined" ? null : localStorage.getItem("token")
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "green" | "amber" | "neutral" }) {
  return <span className={`status-pill ${tone}`}><span className="status-dot" />{children}</span>
}

function MetricCard({ icon: Icon, label, value, sub, accent = "blue" }: { icon: typeof Gauge; label: string; value: string; sub: string; accent?: string }) {
  return <div className="metric-card">
    <div className={`metric-icon ${accent}`}><Icon size={19} strokeWidth={2} /></div>
    <div><span className="metric-label">{label}</span><strong>{value}</strong><small>{sub}</small></div>
  </div>
}

export default function MiraOperatorDashboard() {
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [operators, setOperators] = useState<Operator[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [activeTab, setActiveTab] = useState("İş Emri")
  const [spreadingStarted, setSpreadingStarted] = useState(false)
  const [showDetails, setShowDetails] = useState(true)
  const [dark, setDark] = useState(false)
  const [loading, setLoading] = useState(true)
  const [spreadingRun, setSpreadingRun] = useState<{ status: string; currentLayer: number; layerSet: number; pastelMeter: number } | null>(null)
  const [spreadingMode, setSpreadingMode] = useState<SpreadingMode>("weight-first")
  const [rolls, setRolls] = useState<RollEntry[]>([])
  const [rollColor, setRollColor] = useState("")
  const [rollWeight, setRollWeight] = useState("")
  const [rollLayers, setRollLayers] = useState("")
  const [rollMeters, setRollMeters] = useState("")

  const selected = useMemo(() => orders.find((o) => o.id === selectedId) ?? orders[0], [orders, selectedId])
  const firstMachine = machines[0]

  const fetchData = async () => {
    setLoading(true)
    try {
      const [ordersRes, machinesRes, userRes] = await Promise.all([
        fetch("/api/fason/work-orders?limit=100&processType=KESIM&excludeProcessStatus=TESLIM_EDILDI", {
          headers: getAuthHeaders(),
        }),
        fetch("/api/spreading-machines"),
        fetch("/api/auth/me"),
      ])
      if (!ordersRes.ok) throw new Error(`İş emirleri yüklenemedi (${ordersRes.status})`)
      const ordersPayload = await ordersRes.json()
      const sourceOrders = Array.isArray(ordersPayload) ? ordersPayload : ordersPayload.data ?? []
      const ordersData = sourceOrders.map((order: {
        id: number
        orderNo: string
        productCode: string
        productName: string
        productColor?: string | null
        customerName?: string
        quantity: number
        deliveryDate?: string | null
        status: string
        sewingNotes?: string | null
      }): WorkOrder => ({
        id: String(order.orderNo || order.id),
        apiId: order.id,
        model: order.productCode || "—",
        name: order.productName || "İsimsiz iş emri",
        color: order.productColor || "Belirtilmemiş",
        customer: order.customerName || "Müşteri belirtilmemiş",
        qty: order.quantity || 0,
        deadline: order.deliveryDate
          ? new Date(order.deliveryDate).toLocaleDateString("tr-TR")
          : "Tarih yok",
        status: order.status === "TESLIM_EDILDI" ? "Tamamlandı" : order.status === "BEKLIYOR" ? "Sırada" : "Hazır",
        colorDot: "#9bb7cf",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sewingNotes: order.sewingNotes,
      }))
      const machinesPayload = machinesRes.ok ? await machinesRes.json() : { data: [] }
      const machinesData: Machine[] = (machinesPayload.data ?? []).map((machine: {
        id: number
        name: string
        isActive: boolean
        cuttingTable?: { id: number; name: string }
      }) => ({
        id: String(machine.id),
        name: machine.name,
        status: machine.isActive ? "Hazır" : "Devre dışı",
        type: "Serim",
        cuttingTableId: machine.cuttingTable?.id,
      }))
      const userPayload = userRes.ok ? await userRes.json() : null
      const user = userPayload?.user ?? userPayload
      const operatorsData: Operator[] = user?.id
        ? [{ id: String(user.id), name: user.name || user.email, role: user.role || "Kesim operatörü", avatar: (user.name || user.email).slice(0, 2).toUpperCase() }]
        : []
      setOrders(ordersData)
      setMachines(machinesData)
      setOperators(operatorsData)
      if (ordersData.length > 0 && !selectedId) {
        setSelectedId(ordersData[0].id)
      }
    } catch (e) {
      console.error("Veriler yüklenirken hata oluştu:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (!selected?.apiId) {
      setSpreadingRun(null)
      return
    }
    let cancelled = false
    const fetchSpreadingRun = async () => {
      const response = await fetch(`/api/spreading-runs?orderId=${selected.apiId}`, {
        headers: getAuthHeaders(),
      })
      if (!response.ok) throw new Error(`Serim verisi yüklenemedi (${response.status})`)
      const payload = await response.json()
      if (!cancelled) setSpreadingRun(payload.data ?? null)
    }
    void fetchSpreadingRun().catch((error) => console.error("Serim verisi yüklenirken hata oluştu:", error))
    const timer = window.setInterval(() => {
      void fetchSpreadingRun().catch((error) => console.error("Serim verisi yenilenemedi:", error))
    }, 10000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [selected?.apiId])

  useEffect(() => {
    if (!selected?.sewingNotes) {
      setRolls([])
      setSpreadingMode("weight-first")
      return
    }
    try {
      const parsed = JSON.parse(selected.sewingNotes)
      setSpreadingMode(parsed.spreading?.mode === "spread-then-weight" ? "spread-then-weight" : "weight-first")
      setRolls(Array.isArray(parsed.spreading?.rolls) ? parsed.spreading.rolls : [])
    } catch {
      setRolls([])
    }
  }, [selected?.id, selected?.sewingNotes])

  const saveRolls = async (nextRolls: RollEntry[], mode = spreadingMode) => {
    if (!selected?.apiId) return
    let existing: Record<string, any> = {}
    try {
      existing = selected.sewingNotes ? JSON.parse(selected.sewingNotes) : {}
    } catch {
      existing = {}
    }
    const colorTotals = nextRolls.reduce<Record<string, { rolls: number; weightKg: number; layers: number; meters: number }>>((totals, roll) => {
      const current = totals[roll.color] || { rolls: 0, weightKg: 0, layers: 0, meters: 0 }
      current.rolls += 1
      current.weightKg += roll.weightKg
      current.layers += roll.calculatedLayers
      current.meters += roll.pieceCount
      totals[roll.color] = current
      return totals
    }, {})
    const sewingNotes = JSON.stringify({
      ...existing,
      spreading: {
        ...(existing.spreading || {}),
        mode,
        rolls: nextRolls,
        colorTotals,
        rollTotals: colorTotals,
        totalRolls: nextRolls.length,
        totalRollWeightKg: nextRolls.reduce((sum, roll) => sum + roll.weightKg, 0),
        totalRollLayers: nextRolls.reduce((sum, roll) => sum + roll.calculatedLayers, 0),
      },
    })
    const response = await fetch(`/api/fason/work-orders/${selected.apiId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
      body: JSON.stringify({ sewingNotes }),
    })
    if (!response.ok) throw new Error("Serim/top bilgisi kaydedilemedi")
    setRolls(nextRolls)
  }

  const addRoll = async () => {
    const color = rollColor.trim() || selected?.color || "Renk belirtilmemiş"
    const weightKg = Number(rollWeight)
    const calculatedLayers = Number(rollLayers)
    const pieceCount = Number(rollMeters || 0)
    if (weightKg <= 0 || calculatedLayers <= 0) return
    const nextRoll = { id: `${Date.now()}`, color, rollNumber: rolls.filter(r => r.color === color).length + 1, weightKg, calculatedLayers, pieceCount }
    await saveRolls([...rolls, nextRoll])
    setRollWeight("")
    setRollLayers("")
    setRollMeters("")
  }

  const totalsByColor = rolls.reduce<Record<string, { rolls: number; weightKg: number; layers: number; meters: number }>>((totals, roll) => {
    const current = totals[roll.color] || { rolls: 0, weightKg: 0, layers: 0, meters: 0 }
    current.rolls += 1
    current.weightKg += roll.weightKg
    current.layers += roll.calculatedLayers
    current.meters += roll.pieceCount
    totals[roll.color] = current
    return totals
  }, {})

  const handleSpreadingStart = async () => {
    if (!selected?.apiId || !firstMachine) return
    const response = await fetch("/api/spreading-runs", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({
        orderId: selected.apiId,
        machine: firstMachine.name,
        machineId: Number(firstMachine.id),
        cuttingTableId: firstMachine.cuttingTableId,
        status: "SERİM DEVAM EDİYOR",
      }),
    })
    if (!response.ok) {
      console.error("Serim başlatılamadı:", await response.text())
      return
    }
    setSpreadingStarted(true)
    const payload = await response.json()
    setSpreadingRun(payload.data ?? null)
  }

  if (loading) {
    return <main className={dark ? "app-shell dark-mode" : "app-shell"}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100vh", color: "#697487" }}>
        Yükleniyor...
      </div>
    </main>
  }

  return <main className={dark ? "app-shell dark-mode" : "app-shell"}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Factory size={21} /></div><div><b>MIRAAPP</b><span>ÜRETİM YÖNETİMİ</span></div></div>
      <div className="workshop-card"><span className="eyebrow">AKTİF İSTASYON</span><div className="workshop-name"><span className="live-indicator" />Kesimhane <ChevronDown size={15} /></div><small>Operatör ekranı</small></div>
      <nav className="side-nav" aria-label="Ana menü">
        <p>OPERASYON</p>
        <a className="active"><ClipboardList size={18} />Kesim İş Emirleri</a><a><Layers3 size={18} />Serim Takibi</a><a><Scale size={18} />Tartım & Çıkış</a>
        <p className="nav-spacer">YÖNETİM</p><a><Settings2 size={18} />Ayarlar</a>
      </nav>
      <div className="sidebar-footer"><div className="connection"><Wifi size={15} /><span><b>Bağlantı aktif</b><small>Son senkronizasyon {new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</small></span></div><div className="operator"><div className="avatar">{operators[0]?.avatar ?? "—"}</div><span><b>{operators[0]?.name ?? "Operatör bilgisi yok"}</b><small>{operators[0]?.role ?? "Rol bilgisi yok"}</small></span><ChevronDown size={15} /></div></div>
    </aside>

    <section className="main-area">
      <header className="topbar"><div><span className="breadcrumb">Üretim <ArrowRight size={13} /> Kesimhane</span><h1>Kesim İş Emirleri</h1></div><div className="top-actions"><div className="shift"><span className="shift-dot" />Aktif vardiya</div><button className="icon-btn" aria-label="Bildirimler"><Bell size={19} /></button><button className="icon-btn" aria-label="Ekranı büyüt"><Maximize2 size={18} /></button><button className="icon-btn" onClick={() => setDark(!dark)} aria-label="Tema değiştir"><Sun size={18} /></button></div></header>
      <div className="content">
        <div className="page-heading"><div><h2>Kesim operasyonu <span>●</span></h2><p>İş emri, serim ve tartım işlemlerini aynı ekrandan yönetin.</p></div><div className="date-chip"><Clock3 size={16} /><span>{new Date().toLocaleDateString("tr-TR")}<br /><b>{new Date().toLocaleDateString("tr-TR", { weekday: "long" })}</b></span></div></div>
        <div className="metrics"><MetricCard icon={ClipboardList} label="Bugünkü işler" value={String(orders.length)} sub="Gerçek iş emirleri" /><MetricCard icon={Layers3} label="Toplam kat" value={spreadingRun ? String(spreadingRun.layerSet || spreadingRun.currentLayer) : "—"} sub="Aktif serim" accent="purple" /><MetricCard icon={Scale} label="Serim metresi" value={spreadingRun ? String(spreadingRun.pastelMeter || 0) : "—"} sub="Aktif iş emri" accent="green" /><MetricCard icon={Gauge} label="Serim durumu" value={spreadingRun?.status || "—"} sub="Makine verisi" accent="amber" /></div>

        <div className="workspace-grid">
          <section className="panel order-panel"><div className="panel-header"><div><span className="section-kicker">İŞ EMİRLERİ</span><h3>Kesim sırası</h3></div><button className="outline-btn" onClick={fetchData}><RefreshCw size={15} /> Yenile</button></div><div className="search-box"><Search size={17} /><input placeholder="İş emri, model veya müşteri ara" /></div><div className="order-list">{orders.map((order) => <button key={order.id} className={`order-item ${selectedId === order.id ? "selected" : ""}`} onClick={() => setSelectedId(order.id)}><div className="order-top"><span className="order-id">{order.id}</span><StatusPill tone={order.status === "Hazır" ? "green" : order.status === "Sırada" ? "amber" : "neutral"}>{order.status}</StatusPill></div><div className="order-name"><span className="color-swatch" style={{ background: order.colorDot }} />{order.name}</div><div className="order-meta"><span>{order.model} · {order.color}</span><b>{order.qty} adet</b></div><div className="order-bottom"><span>{order.customer}</span><span className={order.deadline.includes("Bugün") ? "urgent" : ""}><Clock3 size={13} /> {order.deadline}</span></div></button>)}</div><button className="all-orders">Tüm iş emirlerini görüntüle <ArrowRight size={15} /></button></section>

          <section className="panel detail-panel"><div className="detail-tabs">{["İş Emri", "Serim", "Tartım"].map((tab) => <button key={tab} className={activeTab === tab ? "tab-active" : ""} onClick={() => setActiveTab(tab)}>{tab}{tab === "Serim" && spreadingRun && <span className="tab-badge">1</span>}</button>)}</div><div className="detail-content"><div className="detail-heading"><div><span className="section-kicker">SEÇİLİ İŞ EMRİ</span><h2>{selected?.id || "İş emri seçilmedi"}</h2><p>{selected?.name || "Sol listeden bir iş emri seçin"} {selected && <><span>·</span> {selected.model}</>}</p></div>{selected && <StatusPill tone="amber">{spreadingRun?.status || selected.status}</StatusPill>}</div>{selected && <><div className="product-summary"><div className="product-visual"><div className="fabric-roll" /><div><span className="eyebrow">MODEL</span><b>{selected.model}</b><small>Gerçek iş emri verisi</small></div></div><div className="summary-stats"><div><span>RENK</span><b>{selected.color}</b></div><div><span>SİPARİŞ</span><b>{selected.qty} adet</b></div><div><span>TESLİM</span><b>{selected.deadline}</b></div></div></div><div className="workflow"><div className="workflow-label"><span>İŞ AKIŞI</span><b>1 / {steps.length} adım</b></div><div className="stepper">{steps.map((step, i) => <div key={step} className={`step ${i === (activeTab === "Serim" ? 1 : activeTab === "Tartım" ? 2 : 0) ? "current" : ""}`}><div className="step-circle">{i + 1}</div><span>{step}</span>{i < steps.length - 1 && <div className="step-line" />}</div>)}</div></div><div className="instruction"><div className="instruction-icon">{activeTab === "Tartım" ? <Scale size={17} /> : <Play size={17} fill="currentColor" />}</div><div><b>{activeTab === "Tartım" ? "Tartım verisi" : "Serim işlemi"}</b><p>{activeTab === "Tartım" ? "Tartım ve çıkış işlemleri bu ekranda yürütülür." : "Serim makinesi verisini aynı ekrandan takip edin."}</p></div>{activeTab === "Serim" && <button className="primary-btn" onClick={handleSpreadingStart} disabled={!firstMachine}>{spreadingStarted ? <><Check size={16} /> Başlatıldı</> : <><Play size={16} fill="currentColor" /> Serime başla</>}</button>}</div><div className="machine-row"><div className="machine-info"><div className="machine-icon"><Factory size={18} /></div><div><span className="eyebrow">SERİM MAKİNESİ</span><b>{firstMachine?.name || "Makine bulunamadı"}</b></div></div><div><span className="eyebrow">DURUM</span><b>{spreadingRun?.status || firstMachine?.status || "Veri yok"}</b></div></div></>}</div></section>
        </div>
        <section className="panel" style={{ marginTop: 18, padding: 20 }}>
          <div className="panel-header" style={{ padding: 0, marginBottom: 14 }}>
            <div><span className="section-kicker">TOP / TARTI SENKRONİZASYONU</span><h3>Kumaş topları</h3></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className={`outline-btn ${spreadingMode === "weight-first" ? "tab-active" : ""}`} onClick={() => { setSpreadingMode("weight-first"); void saveRolls(rolls, "weight-first") }}>Tartı → Serim</button>
              <button className={`outline-btn ${spreadingMode === "spread-then-weight" ? "tab-active" : ""}`} onClick={() => { setSpreadingMode("spread-then-weight"); void saveRolls(rolls, "spread-then-weight") }}>Serim → Tartı</button>
            </div>
          </div>
          <p style={{ color: "#718093", fontSize: 11, margin: "0 0 14px" }}>
            {spreadingMode === "weight-first" ? "Top tartılır; tartı bilgisi serim makinesindeki kat hesabıyla birlikte kaydedilir." : "Top önce serilir; serim tamamlandığında ölçülen ağırlık aynı kayıtla eşleştirilir."}
          </p>
          {selected && <div style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr .8fr .8fr auto", gap: 8, alignItems: "end" }}>
            <label className="eyebrow">RENK<input value={rollColor} onChange={e => setRollColor(e.target.value)} placeholder={selected.color} /></label>
            <label className="eyebrow">TOP KG<input type="number" min="0" value={rollWeight} onChange={e => setRollWeight(e.target.value)} placeholder="30" /></label>
            <label className="eyebrow">KAT<input type="number" min="0" value={rollLayers} onChange={e => setRollLayers(e.target.value)} placeholder="17" /></label>
            <label className="eyebrow">METRE<input type="number" min="0" value={rollMeters} onChange={e => setRollMeters(e.target.value)} placeholder="—" /></label>
            <button className="primary-btn" onClick={() => void addRoll()}>Top ekle</button>
          </div>}
          {Object.entries(totalsByColor).map(([color, total]) => (
            <div key={color} style={{ marginTop: 14, padding: 12, border: "1px solid #e6ebef", borderRadius: 9 }}>
              <strong style={{ color: "#304259", fontSize: 12 }}>{color}</strong>
              {rolls.filter(roll => roll.color === color).map(roll => <div key={roll.id} style={{ display: "flex", justifyContent: "space-between", color: "#718093", fontSize: 10, paddingTop: 7 }}><span>{roll.rollNumber}. top</span><b>{roll.weightKg} kg · {roll.calculatedLayers} kat</b></div>)}
              <div style={{ marginTop: 8, color: "#1f4c81", fontSize: 11, fontWeight: 700 }}>Toplam {total.rolls} top · {total.weightKg.toFixed(1)} kg · {total.layers} kat</div>
            </div>
          ))}
          {!rolls.length && <div style={{ padding: 18, color: "#9ba5b2", fontSize: 11 }}>Bu iş emri için henüz top/tartı kaydı bulunmuyor.</div>}
        </section>
        <div className="bottom-grid"><div className="alert-banner"><div className="alert-icon"><AlertTriangle size={18} /></div><div><b>Kesim operasyonu</b><p>Serim ve tartım verileri seçili iş emri üzerinden güncellenir.</p></div></div><div className="quick-actions"><button><PackageCheck size={17} /> Çıkış kaydı</button></div></div>
        <footer><span>Mira Üretim Yönetimi <b>·</b> Kesimhane modülü</span><span>v2.8.1 <b>·</b> Yardım & Destek</span></footer>
      </div>
    </section>
  </main>
}
