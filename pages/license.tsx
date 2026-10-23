import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/components/AuthContext";

type LicenseSnapshot = {
  id: number;
  key: string | null;
  plan: string | null;
  status: string;
  expiresAt: string | null;
  graceUntil: string | null;
  maxUsers: number | null;
  features: Record<string, unknown> | null;
  lastValidatedAt: string | null;
};

type LicenseStatusResponse = {
  ok: boolean;
  mode: "off" | "warn" | "enforce";
  status: string;
  reason: string;
  checkedAt: string;
  requestedFeature: string | null;
  license: LicenseSnapshot | null;
};

type LicenseEventItem = {
  id: number;
  eventType: string;
  message: string | null;
  payload: Record<string, unknown> | null;
  createdBy: number | null;
  createdAt: string;
  license: {
    key: string;
    plan: string | null;
    status: string;
  } | null;
};

type EventFilters = {
  key: string;
  eventType: string;
  status: string;
  createdBy: string;
  from: string;
  to: string;
  limit: string;
};

type LicenseEventsResponse = {
  events: LicenseEventItem[];
  count: number;
  total: number;
  limit: number;
  page: number;
  pageSize: number;
  offset: number;
  hasMore: boolean;
  totalPages: number;
};

const FEATURE_LIST = ["stock", "fason", "mobile"] as const;
const EVENT_TYPES = ["ACTIVATE", "REVOKE", "RENEW"] as const;
const LICENSE_STATUSES = ["ACTIVE", "TRIAL", "GRACE", "EXPIRED", "REVOKED", "SUSPENDED"] as const;

const formatDate = (value: string | null): string =>
  value ? new Date(value).toLocaleString("tr-TR") : "-";

const toneByStatus = (status: string): string => {
  const normalized = status.toUpperCase();
  if (normalized === "ACTIVE" || normalized === "TRIAL" || normalized === "GRACE") return "#0f766e";
  if (normalized === "NONE" || normalized === "UNKNOWN") return "#92400e";
  return "#b91c1c";
};

const downloadTextFile = (content: string, mime: string, filename: string) => {
  const blob = new Blob([content], { type: mime });
  const fileUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = fileUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(fileUrl);
};

const toCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) return "\"\"";

  let raw = "";
  if (typeof value === "string") raw = value;
  else if (typeof value === "number" || typeof value === "boolean") raw = String(value);
  else raw = JSON.stringify(value);

  return `"${raw.replace(/"/g, "\"\"")}"`;
};

const validateCreatedByFilter = (raw: string): string | null => {
  const value = raw.trim();
  if (!value) return null;
  if (!/^\d+$/.test(value)) {
    return "CreatedBy filtre degeri 0 veya pozitif tam sayi olmali.";
  }
  return null;
};

export default function LicensePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseStatus, setBaseStatus] = useState<LicenseStatusResponse | null>(null);
  const [featureStatuses, setFeatureStatuses] = useState<Record<string, LicenseStatusResponse>>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [events, setEvents] = useState<LicenseEventItem[]>([]);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<LicenseEventItem | null>(null);
  const [payloadCopyMessage, setPayloadCopyMessage] = useState<string | null>(null);
  const [eventPage, setEventPage] = useState(1);
  const [eventMeta, setEventMeta] = useState({
    total: 0,
    page: 1,
    pageSize: 25,
    offset: 0,
    hasMore: false,
    totalPages: 1,
  });
  const [eventFilters, setEventFilters] = useState<EventFilters>({
    key: "",
    eventType: "",
    status: "",
    createdBy: "",
    from: "",
    to: "",
    limit: "25",
  });
  const [form, setForm] = useState({
    key: "",
    plan: "PRO",
    status: "ACTIVE",
    maxUsers: "25",
    expiresAt: "",
    graceUntil: "",
  });
  const [renewForm, setRenewForm] = useState({
    extendDays: "30",
    expiresAt: "",
    graceDays: "7",
    status: "ACTIVE",
  });

  const fetchEvents = async (token: string, overrides?: Partial<EventFilters>, pageOverride?: number) => {
    if (user?.role !== "ADMIN") {
      setEvents([]);
      setEventPage(1);
      setEventMeta({
        total: 0,
        page: 1,
        pageSize: 25,
        offset: 0,
        hasMore: false,
        totalPages: 1,
      });
      return;
    }

    try {
      setEventsLoading(true);
      setEventsError(null);

      const merged: EventFilters = {
        ...eventFilters,
        ...(overrides || {}),
      };
      const createdByValidationError = validateCreatedByFilter(merged.createdBy);
      if (createdByValidationError) {
        setEventsError(createdByValidationError);
        return;
      }
      const requestedPage = pageOverride && pageOverride > 0 ? pageOverride : eventPage;
      const params = new URLSearchParams();
      params.set("limit", merged.limit || "25");
      params.set("page", String(requestedPage));
      if (merged.key.trim()) params.set("key", merged.key.trim());
      if (merged.eventType.trim()) params.set("eventType", merged.eventType.trim().toUpperCase());
      if (merged.status.trim()) params.set("status", merged.status.trim().toUpperCase());
      if (merged.createdBy.trim()) params.set("createdBy", merged.createdBy.trim());
      if (merged.from.trim()) params.set("from", merged.from.trim());
      if (merged.to.trim()) params.set("to", merged.to.trim());

      const response = await axios.get<LicenseEventsResponse>(`/api/license/events?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const receivedEvents = response.data.events || [];
      const receivedPage = response.data.page || requestedPage;
      const receivedPageSize = response.data.pageSize || Number(merged.limit) || 25;
      const receivedTotal = response.data.total || receivedEvents.length;
      const receivedTotalPages = response.data.totalPages || Math.max(1, Math.ceil(receivedTotal / receivedPageSize));
      const receivedHasMore =
        typeof response.data.hasMore === "boolean" ? response.data.hasMore : receivedPage < receivedTotalPages;
      const receivedOffset = response.data.offset ?? (receivedPage - 1) * receivedPageSize;

      setEvents(receivedEvents);
      setEventPage(receivedPage);
      setEventMeta({
        total: receivedTotal,
        page: receivedPage,
        pageSize: receivedPageSize,
        offset: receivedOffset,
        hasMore: receivedHasMore,
        totalPages: receivedTotalPages,
      });
    } catch (eventError) {
      const message =
        axios.isAxiosError(eventError) && eventError.response?.data?.message
          ? String(eventError.response.data.message)
          : "Lisans event gecmisi alinamadi.";
      setEventsError(message);
    } finally {
      setEventsLoading(false);
    }
  };

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("token");
      if (!token) {
        setError("Oturum bulunamadi.");
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      const [base, ...featureResponses] = await Promise.all([
        axios.get<LicenseStatusResponse>("/api/license/status", { headers }),
        ...FEATURE_LIST.map((feature) =>
          axios.get<LicenseStatusResponse>(`/api/license/status?feature=${feature}`, { headers })
        ),
      ]);

      setBaseStatus(base.data);
      const currentKey = base.data.license?.key || "";
      if (currentKey && !form.key) {
        setForm((prev) => ({ ...prev, key: currentKey }));
      }
      if (currentKey && !eventFilters.key) {
        setEventFilters((prev) => ({ ...prev, key: currentKey }));
      }
      await fetchEvents(
        token,
        {
          key: currentKey || eventFilters.key,
        },
        1
      );

      const nextFeatureStatuses: Record<string, LicenseStatusResponse> = {};
      featureResponses.forEach((response) => {
        const feature = response.data.requestedFeature || "unknown";
        nextFeatureStatuses[feature] = response.data;
      });
      setFeatureStatuses(nextFeatureStatuses);
    } catch (requestError) {
      const message =
        axios.isAxiosError(requestError) && requestError.response?.data?.message
          ? String(requestError.response.data.message)
          : "Lisans bilgisi alinamadi.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStatus();
  }, [user?.role]);

  useEffect(() => {
    setPayloadCopyMessage(null);
  }, [selectedEvent]);

  const handleActivate = async () => {
    setActionError(null);
    setActionMessage(null);

    const key = form.key.trim();
    if (!key) {
      setActionError("Lisans anahtari zorunludur.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setActionError("Oturum bulunamadi.");
      return;
    }

    try {
      setActionLoading(true);
      await axios.post(
        "/api/license/activate",
        {
          key,
          plan: form.plan || "PRO",
          status: form.status || "ACTIVE",
          maxUsers: form.maxUsers ? Number(form.maxUsers) : null,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
          graceUntil: form.graceUntil ? new Date(form.graceUntil).toISOString() : null,
          features: {
            stock: true,
            fason: true,
            mobile: true,
          },
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setActionMessage("Lisans basariyla aktif edildi/guncellendi.");
      await fetchStatus();
    } catch (actionErr) {
      const message =
        axios.isAxiosError(actionErr) && actionErr.response?.data?.message
          ? String(actionErr.response.data.message)
          : "Lisans aktivasyonunda hata olustu.";
      setActionError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = async () => {
    setActionError(null);
    setActionMessage(null);

    const key = form.key.trim() || baseStatus?.license?.key || "";
    if (!key) {
      setActionError("Revoke icin lisans anahtari gerekli.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setActionError("Oturum bulunamadi.");
      return;
    }

    try {
      setActionLoading(true);
      await axios.post(
        "/api/license/revoke",
        {
          key,
          status: "REVOKED",
          reason: "Manual revoke from license page",
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setActionMessage("Lisans revoke edildi.");
      await fetchStatus();
    } catch (actionErr) {
      const message =
        axios.isAxiosError(actionErr) && actionErr.response?.data?.message
          ? String(actionErr.response.data.message)
          : "Lisans revoke isleminde hata olustu.";
      setActionError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRenew = async () => {
    setActionError(null);
    setActionMessage(null);

    const key = form.key.trim() || baseStatus?.license?.key || "";
    if (!key) {
      setActionError("Yenileme icin lisans anahtari gerekli.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setActionError("Oturum bulunamadi.");
      return;
    }

    const extendDays = renewForm.extendDays.trim() ? Number(renewForm.extendDays) : null;
    const graceDays = renewForm.graceDays.trim() ? Number(renewForm.graceDays) : null;
    const hasAbsoluteDate = Boolean(renewForm.expiresAt.trim());

    if (!hasAbsoluteDate && (!extendDays || extendDays <= 0)) {
      setActionError("Yenileme icin bitis tarihi veya pozitif gun uzatma degeri girin.");
      return;
    }

    try {
      setActionLoading(true);
      await axios.post(
        "/api/license/renew",
        {
          key,
          extendDays: hasAbsoluteDate ? null : extendDays,
          expiresAt: hasAbsoluteDate ? new Date(renewForm.expiresAt).toISOString() : null,
          graceDays: graceDays && graceDays > 0 ? graceDays : null,
          status: renewForm.status || "ACTIVE",
          plan: form.plan || "PRO",
          maxUsers: form.maxUsers ? Number(form.maxUsers) : null,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setActionMessage("Lisans yenileme islemi basarili.");
      await fetchStatus();
    } catch (actionErr) {
      const message =
        axios.isAxiosError(actionErr) && actionErr.response?.data?.message
          ? String(actionErr.response.data.message)
          : "Lisans yenileme isleminde hata olustu.";
      setActionError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const refreshEvents = async (overrides?: Partial<EventFilters>, nextPage?: number) => {
    const token = localStorage.getItem("token");
    if (!token) {
      setEventsError("Oturum bulunamadi.");
      return;
    }
    await fetchEvents(token, overrides, nextPage);
  };

  const handleApplyEventFilters = async () => {
    setEventPage(1);
    await refreshEvents(undefined, 1);
  };

  const handleResetEventFilters = async () => {
    const fallbackKey = baseStatus?.license?.key || "";
    const resetFilters: EventFilters = {
      key: fallbackKey,
      eventType: "",
      status: "",
      createdBy: "",
      from: "",
      to: "",
      limit: "25",
    };
    setEventFilters(resetFilters);
    setEventPage(1);
    await refreshEvents(resetFilters, 1);
  };

  const handlePrevPage = async () => {
    if (eventsLoading || eventPage <= 1) return;
    await refreshEvents(undefined, eventPage - 1);
  };

  const handleNextPage = async () => {
    if (eventsLoading || !eventMeta.hasMore) return;
    await refreshEvents(undefined, eventPage + 1);
  };

  const handleCopyKey = async () => {
    setCopyMessage(null);
    const key = baseStatus?.license?.key || form.key.trim();
    if (!key) {
      setCopyMessage("Kopyalanacak lisans anahtari bulunamadi.");
      return;
    }

    try {
      await navigator.clipboard.writeText(key);
      setCopyMessage("Lisans anahtari kopyalandi.");
      setTimeout(() => setCopyMessage(null), 2000);
    } catch {
      setCopyMessage("Kopyalama basarisiz.");
    }
  };

  const handleCopyPayload = async () => {
    setPayloadCopyMessage(null);
    if (!selectedEvent?.payload) {
      setPayloadCopyMessage("Kopyalanacak payload yok.");
      return;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(selectedEvent.payload, null, 2));
      setPayloadCopyMessage("Payload kopyalandi.");
      setTimeout(() => setPayloadCopyMessage(null), 2000);
    } catch {
      setPayloadCopyMessage("Payload kopyalanamadi.");
    }
  };

  const handleExportEventsJson = () => {
    if (events.length === 0) {
      setEventsError("Export icin event bulunamadi.");
      return;
    }

    const payload = events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      message: event.message,
      createdBy: event.createdBy,
      createdAt: event.createdAt,
      licenseKey: event.license?.key || null,
      plan: event.license?.plan || null,
      status: event.license?.status || null,
      payload: event.payload,
    }));

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadTextFile(
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8",
      `license-events-${stamp}.json`
    );
  };

  const handleExportEventsCsv = () => {
    if (events.length === 0) {
      setEventsError("Export icin event bulunamadi.");
      return;
    }

    const headers = [
      "id",
      "eventType",
      "message",
      "createdBy",
      "createdAt",
      "licenseKey",
      "plan",
      "status",
      "payload",
    ];

    const activeFilters: Record<string, string> = {
      key: eventFilters.key.trim() || "-",
      eventType: eventFilters.eventType.trim() || "ALL",
      status: eventFilters.status.trim() || "ALL",
      createdBy: eventFilters.createdBy.trim() || "ALL",
      from: eventFilters.from || "-",
      to: eventFilters.to || "-",
      limit: eventFilters.limit || "25",
      page: String(eventPage),
      total: String(eventMeta.total),
    };

    const lines = [
      `${toCsvValue("filter_key")},${toCsvValue("filter_value")}`,
      ...Object.entries(activeFilters).map(([key, value]) => `${toCsvValue(key)},${toCsvValue(value)}`),
      "",
      headers.map((value) => toCsvValue(value)).join(","),
    ];

    events.forEach((event) => {
      const row = [
        event.id,
        event.eventType,
        event.message || "",
        event.createdBy ?? "",
        event.createdAt,
        event.license?.key || "",
        event.license?.plan || "",
        event.license?.status || "",
        event.payload ? JSON.stringify(event.payload) : "",
      ];
      lines.push(row.map((value) => toCsvValue(value)).join(","));
    });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadTextFile(lines.join("\n"), "text/csv;charset=utf-8", `license-events-${stamp}.csv`);
  };

  const statusColor = useMemo(() => toneByStatus(baseStatus?.status || "UNKNOWN"), [baseStatus?.status]);

  return (
    <AuthGuard requireAuth>
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Lisans Durumu</h1>
        <p style={{ color: "#4b5563", marginBottom: 20 }}>
          Sistem lisans dogrulama sonucu ve modul bazli erisim durumu.
        </p>
        <button
          onClick={() => void fetchStatus()}
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 8,
            padding: "8px 12px",
            background: "#fff",
            cursor: "pointer",
            marginBottom: 14,
          }}
        >
          Yenile
        </button>

        {loading ? <p>Yukleniyor...</p> : null}
        {error ? (
          <div
            style={{
              border: "1px solid #fecaca",
              backgroundColor: "#fef2f2",
              color: "#991b1b",
              padding: 12,
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        ) : null}

        {actionMessage ? (
          <div
            style={{
              border: "1px solid #a7f3d0",
              backgroundColor: "#ecfdf5",
              color: "#065f46",
              padding: 12,
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            {actionMessage}
          </div>
        ) : null}

        {actionError ? (
          <div
            style={{
              border: "1px solid #fecaca",
              backgroundColor: "#fef2f2",
              color: "#991b1b",
              padding: 12,
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            {actionError}
          </div>
        ) : null}

        {!loading && !error && baseStatus ? (
          <>
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 16,
                marginBottom: 18,
                background: "#fff",
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Genel Lisans</h2>
              <p style={{ marginTop: 10, marginBottom: 8 }}>
                Durum:{" "}
                <strong style={{ color: statusColor }}>
                  {baseStatus.status}
                </strong>
              </p>
              <p style={{ margin: "4px 0" }}>Mod: {baseStatus.mode}</p>
              <p style={{ margin: "4px 0" }}>Neden: {baseStatus.reason}</p>
              <p style={{ margin: "4px 0" }}>Kontrol: {formatDate(baseStatus.checkedAt)}</p>
            </div>

            {user?.role === "ADMIN" ? (
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 18,
                  background: "#fff",
                }}
              >
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Lisans Yonetimi (Admin)</h2>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                  <input
                    placeholder="Lisans anahtari"
                    value={form.key}
                    onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value }))}
                    style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
                  />
                  <input
                    placeholder="Plan (PRO, ENTERPRISE)"
                    value={form.plan}
                    onChange={(e) => setForm((prev) => ({ ...prev, plan: e.target.value }))}
                    style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
                  />
                  <input
                    placeholder="Durum (ACTIVE, TRIAL...)"
                    value={form.status}
                    onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                    style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
                  />
                  <input
                    placeholder="Max kullanici"
                    value={form.maxUsers}
                    onChange={(e) => setForm((prev) => ({ ...prev, maxUsers: e.target.value }))}
                    style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
                  />
                  <input
                    placeholder="Bitis tarihi (YYYY-MM-DD)"
                    value={form.expiresAt}
                    onChange={(e) => setForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                    style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
                  />
                  <input
                    placeholder="Grace tarihi (YYYY-MM-DD)"
                    value={form.graceUntil}
                    onChange={(e) => setForm((prev) => ({ ...prev, graceUntil: e.target.value }))}
                    style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
                  />
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button
                    onClick={() => void handleActivate()}
                    disabled={actionLoading}
                    style={{
                      border: "1px solid #0f766e",
                      color: "#0f766e",
                      borderRadius: 8,
                      padding: "8px 12px",
                      background: "#fff",
                      cursor: actionLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    {actionLoading ? "Isleniyor..." : "Aktif Et / Guncelle"}
                  </button>
                  <button
                    onClick={() => void handleRevoke()}
                    disabled={actionLoading}
                    style={{
                      border: "1px solid #b91c1c",
                      color: "#b91c1c",
                      borderRadius: 8,
                      padding: "8px 12px",
                      background: "#fff",
                      cursor: actionLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    {actionLoading ? "Isleniyor..." : "Revoke"}
                  </button>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    border: "1px dashed #d1d5db",
                    borderRadius: 8,
                    padding: 12,
                    background: "#fcfcfd",
                  }}
                >
                  <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Lisans Yenileme</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <input
                      placeholder="Gun uzatma (or: 30)"
                      value={renewForm.extendDays}
                      onChange={(e) => setRenewForm((prev) => ({ ...prev, extendDays: e.target.value }))}
                      style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
                    />
                    <input
                      type="date"
                      value={renewForm.expiresAt}
                      onChange={(e) => setRenewForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                      style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
                    />
                    <input
                      placeholder="Grace gunu (or: 7)"
                      value={renewForm.graceDays}
                      onChange={(e) => setRenewForm((prev) => ({ ...prev, graceDays: e.target.value }))}
                      style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
                    />
                    <select
                      value={renewForm.status}
                      onChange={(e) => setRenewForm((prev) => ({ ...prev, status: e.target.value }))}
                      style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="TRIAL">TRIAL</option>
                      <option value="GRACE">GRACE</option>
                    </select>
                  </div>
                  <button
                    onClick={() => void handleRenew()}
                    disabled={actionLoading}
                    style={{
                      marginTop: 10,
                      border: "1px solid #2563eb",
                      color: "#2563eb",
                      borderRadius: 8,
                      padding: "8px 12px",
                      background: "#fff",
                      cursor: actionLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    {actionLoading ? "Isleniyor..." : "Yenile"}
                  </button>
                </div>

                <div style={{ marginTop: 16 }}>
                  <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Event Gecmisi</h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    <input
                      placeholder="Key filtre"
                      value={eventFilters.key}
                      onChange={(e) => setEventFilters((prev) => ({ ...prev, key: e.target.value }))}
                      style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
                    />
                    <select
                      value={eventFilters.eventType}
                      onChange={(e) => setEventFilters((prev) => ({ ...prev, eventType: e.target.value }))}
                      style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
                    >
                      <option value="">Tum Eventler</option>
                      {EVENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    <select
                      value={eventFilters.status}
                      onChange={(e) => setEventFilters((prev) => ({ ...prev, status: e.target.value }))}
                      style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
                    >
                      <option value="">Tum Statusler</option>
                      {LICENSE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      placeholder="CreatedBy (user id)"
                      value={eventFilters.createdBy}
                      onChange={(e) => setEventFilters((prev) => ({ ...prev, createdBy: e.target.value }))}
                      style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
                    />
                    <input
                      placeholder="Limit"
                      value={eventFilters.limit}
                      onChange={(e) => setEventFilters((prev) => ({ ...prev, limit: e.target.value }))}
                      style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
                    />
                    <input
                      type="date"
                      value={eventFilters.from}
                      onChange={(e) => setEventFilters((prev) => ({ ...prev, from: e.target.value }))}
                      style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
                    />
                    <input
                      type="date"
                      value={eventFilters.to}
                      onChange={(e) => setEventFilters((prev) => ({ ...prev, to: e.target.value }))}
                      style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => void handleApplyEventFilters()}
                        disabled={eventsLoading}
                        style={{
                          border: "1px solid #0f766e",
                          color: "#0f766e",
                          borderRadius: 8,
                          padding: "8px 10px",
                          background: "#fff",
                          cursor: eventsLoading ? "not-allowed" : "pointer",
                        }}
                      >
                        Filtrele
                      </button>
                      <button
                        onClick={() => void handleResetEventFilters()}
                        disabled={eventsLoading}
                        style={{
                          border: "1px solid #9ca3af",
                          color: "#374151",
                          borderRadius: 8,
                          padding: "8px 10px",
                          background: "#fff",
                          cursor: eventsLoading ? "not-allowed" : "pointer",
                        }}
                      >
                        Sifirla
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <button
                      onClick={handleExportEventsJson}
                      style={{
                        border: "1px solid #2563eb",
                        color: "#2563eb",
                        borderRadius: 8,
                        padding: "8px 10px",
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      Event Export (JSON)
                    </button>
                    <button
                      onClick={handleExportEventsCsv}
                      style={{
                        border: "1px solid #7c3aed",
                        color: "#7c3aed",
                        borderRadius: 8,
                        padding: "8px 10px",
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      Event Export (CSV)
                    </button>
                  </div>
                  {eventsLoading ? <p>Eventler yukleniyor...</p> : null}
                  {eventsError ? (
                    <p style={{ color: "#991b1b", margin: "6px 0" }}>{eventsError}</p>
                  ) : null}
                  {!eventsLoading && !eventsError ? (
                    <>
                      <div style={{ border: "1px solid #f3f4f6", borderRadius: 8 }}>
                        {events.length === 0 ? (
                          <p style={{ margin: 0, padding: 10, color: "#6b7280" }}>Event bulunamadi.</p>
                        ) : (
                          <div style={{ maxHeight: 260, overflowY: "auto" }}>
                            {events.map((event) => (
                              <div
                                key={event.id}
                                style={{
                                  borderBottom: "1px solid #f3f4f6",
                                  padding: 10,
                                  background: "#fff",
                                  cursor: "pointer",
                                }}
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedEvent(event)}
                                onKeyDown={(eventKey) => {
                                  if (eventKey.key === "Enter" || eventKey.key === " ") {
                                    eventKey.preventDefault();
                                    setSelectedEvent(event);
                                  }
                                }}
                              >
                                <p style={{ margin: 0, fontWeight: 600 }}>{event.eventType}</p>
                                <p style={{ margin: "4px 0", color: "#4b5563" }}>
                                  {event.message || "-"}
                                </p>
                                <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                                  {formatDate(event.createdAt)} | Key: {event.license?.key || "-"} | By:{" "}
                                  {event.createdBy ?? "-"}
                                </p>
                                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>
                                  Detay icin tikla
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: 10,
                          gap: 8,
                        }}
                      >
                        <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                          Toplam: {eventMeta.total} | Sayfa: {eventMeta.page}/{eventMeta.totalPages}
                        </p>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => void handlePrevPage()}
                            disabled={eventsLoading || eventPage <= 1}
                            style={{
                              border: "1px solid #9ca3af",
                              color: "#374151",
                              borderRadius: 8,
                              padding: "6px 10px",
                              background: "#fff",
                              cursor: eventsLoading || eventPage <= 1 ? "not-allowed" : "pointer",
                            }}
                          >
                            Onceki
                          </button>
                          <button
                            onClick={() => void handleNextPage()}
                            disabled={eventsLoading || !eventMeta.hasMore}
                            style={{
                              border: "1px solid #2563eb",
                              color: "#2563eb",
                              borderRadius: 8,
                              padding: "6px 10px",
                              background: "#fff",
                              cursor: eventsLoading || !eventMeta.hasMore ? "not-allowed" : "pointer",
                            }}
                          >
                            Sonraki
                          </button>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 16,
                marginBottom: 18,
                background: "#fff",
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Lisans Detayi</h2>
              <p style={{ margin: "10px 0 4px" }}>
                Anahtar: {baseStatus.license?.key || "-"}
                <button
                  onClick={() => void handleCopyKey()}
                  style={{
                    marginLeft: 8,
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    padding: "2px 8px",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Kopyala
                </button>
              </p>
              {copyMessage ? <p style={{ margin: "2px 0", color: "#065f46" }}>{copyMessage}</p> : null}
              <p style={{ margin: "4px 0" }}>Plan: {baseStatus.license?.plan || "-"}</p>
              <p style={{ margin: "4px 0" }}>Bitis: {formatDate(baseStatus.license?.expiresAt || null)}</p>
              <p style={{ margin: "4px 0" }}>Grace: {formatDate(baseStatus.license?.graceUntil || null)}</p>
              <p style={{ margin: "4px 0" }}>Maks Kullanici: {baseStatus.license?.maxUsers ?? "-"}</p>
              <p style={{ margin: "4px 0" }}>
                Son Dogrulama: {formatDate(baseStatus.license?.lastValidatedAt || null)}
              </p>
            </div>

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 16,
                background: "#fff",
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Modul Bazli Durum</h2>
              <div style={{ marginTop: 10 }}>
                {FEATURE_LIST.map((feature) => {
                  const featureStatus = featureStatuses[feature];
                  return (
                    <div
                      key={feature}
                      style={{
                        border: "1px solid #f3f4f6",
                        borderRadius: 8,
                        padding: 10,
                        marginBottom: 8,
                        background: "#f9fafb",
                      }}
                    >
                      <p style={{ margin: 0, fontWeight: 600 }}>{feature.toUpperCase()}</p>
                      <p style={{ margin: "4px 0" }}>
                        Sonuc:{" "}
                        <strong style={{ color: toneByStatus(featureStatus?.status || "UNKNOWN") }}>
                          {featureStatus ? (featureStatus.ok ? "IZINLI" : "ENGELLI") : "BILINMIYOR"}
                        </strong>
                      </p>
                      <p style={{ margin: "4px 0" }}>Durum: {featureStatus?.status || "-"}</p>
                      <p style={{ margin: "4px 0" }}>Neden: {featureStatus?.reason || "-"}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedEvent ? (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(17, 24, 39, 0.6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 16,
                  zIndex: 1000,
                }}
                onClick={() => setSelectedEvent(null)}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: 760,
                    maxHeight: "80vh",
                    overflowY: "auto",
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                    padding: 16,
                  }}
                  onClick={(eventClick) => eventClick.stopPropagation()}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: 18 }}>Event Detayi</h3>
                    <button
                      onClick={() => setSelectedEvent(null)}
                      style={{
                        border: "1px solid #d1d5db",
                        borderRadius: 8,
                        padding: "6px 10px",
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      Kapat
                    </button>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <p style={{ margin: "4px 0" }}>ID: {selectedEvent.id}</p>
                    <p style={{ margin: "4px 0" }}>Type: {selectedEvent.eventType}</p>
                    <p style={{ margin: "4px 0" }}>Mesaj: {selectedEvent.message || "-"}</p>
                    <p style={{ margin: "4px 0" }}>Tarih: {formatDate(selectedEvent.createdAt)}</p>
                    <p style={{ margin: "4px 0" }}>License Key: {selectedEvent.license?.key || "-"}</p>
                    <p style={{ margin: "4px 0" }}>Plan: {selectedEvent.license?.plan || "-"}</p>
                    <p style={{ margin: "4px 0" }}>Status: {selectedEvent.license?.status || "-"}</p>
                    <p style={{ margin: "4px 0" }}>Created By: {selectedEvent.createdBy ?? "-"}</p>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <p style={{ margin: 0, fontWeight: 600 }}>Payload</p>
                      <button
                        onClick={() => void handleCopyPayload()}
                        style={{
                          border: "1px solid #d1d5db",
                          borderRadius: 8,
                          padding: "4px 8px",
                          background: "#fff",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        Payload Kopyala
                      </button>
                    </div>
                    {payloadCopyMessage ? (
                      <p style={{ margin: "0 0 6px", color: "#065f46", fontSize: 12 }}>{payloadCopyMessage}</p>
                    ) : null}
                    <pre
                      style={{
                        margin: 0,
                        padding: 12,
                        borderRadius: 8,
                        background: "#111827",
                        color: "#e5e7eb",
                        fontSize: 12,
                        overflowX: "auto",
                      }}
                    >
                      {selectedEvent.payload ? JSON.stringify(selectedEvent.payload, null, 2) : "-"}
                    </pre>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </AuthGuard>
  );
}
