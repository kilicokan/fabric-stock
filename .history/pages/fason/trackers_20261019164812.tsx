import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
    Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
    InputAdornment, LinearProgress, Menu, MenuItem, TextField, Tooltip, Collapse, Snackbar, Alert, Tabs, Tab
} from '@mui/material';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
    Plus, Search, Download, Truck, Calendar, Building, PackageCheck, MoreVertical,
    ChevronDown, ChevronRight, Pencil, Trash2, UserPlus, Smartphone, AlertTriangle, X, Wallet, PackageOpen
} from 'lucide-react';

/* ───────── Types ───────── */
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
interface SizeRow { color: string; sizes: Record<string, number> }
interface OrderNote { id: number; text: string; author?: string; createdAt: string }

interface FasonTracking {
    id: number; workOrderId: number; workshopId: number;
    workshop?: { id: number; name: string; specialization: string };
    assignedQuantity: number; receivedQuantity?: number; defectQuantity?: number; paidAmount?: number; dueDate?: string; unitPrice: number; totalPrice: number;
    processType: string; status: string; notes?: string; createdAt: string;
}
interface WorkOrder {
    id: number; orderNo: string; productCode: string; productName: string; quantity: number;
    customerName: string; status: string; deliveryDate: string; priority: Priority;
    assignedToMobile: boolean; assignedUserId?: number;
    assignedUser?: { id: number; name: string; email: string };
    createdAt: string; centralWarehouseReceived?: boolean; fasonTrackings?: FasonTracking[];
    orderDate?: string; shippingAddress?: string; sizeMatrix?: SizeRow[];
}
interface Workshop { id: number; name: string; specialization: string; contactPerson: string; phone: string; balance: number; isActive: boolean }
interface FasonTracker { id: number; name: string; email: string; phone?: string }
type ApiErrorLike = { response?: { status?: number; data?: { error?: string; message?: string } } };

/* ───────── Design tokens ───────── */
const C = {
    bg: '#F4F6F7', surface: '#FFFFFF', line: '#E2E7EA', ink: '#17262E', muted: '#62737D',
    accent: '#0B6E6E', accentSoft: '#E1F1F0', warn: '#B45309', warnSoft: '#FEF3C7',
    danger: '#B42318', dangerSoft: '#FEE4E2', ok: '#17803D', okSoft: '#DCF5E4', info: '#1D4ED8', infoSoft: '#E3ECFF'
};
const FONT = '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif';

const STATUS: Record<string, { label: string; fg: string; bg: string }> = {
    BEKLIYOR: { label: 'Bekliyor', fg: C.muted, bg: '#ECEFF1' },
    ALINDI: { label: 'Alındı', fg: C.info, bg: C.infoSoft },
    'ATÖLYEDE': { label: 'Atölyede', fg: C.warn, bg: C.warnSoft },
    HAZIR: { label: 'Hazır', fg: C.accent, bg: C.accentSoft },
    TESLIM_EDILDI: { label: 'Teslim edildi', fg: C.ok, bg: C.okSoft },
    SORUN_VAR: { label: 'Sorun var', fg: C.danger, bg: C.dangerSoft }
};
const PRIORITY: Record<Priority, { label: string; color: string }> = {
    LOW: { label: 'Düşük', color: '#8AA39B' }, MEDIUM: { label: 'Orta', color: '#D79A1E' },
    HIGH: { label: 'Yüksek', color: '#E0661A' }, URGENT: { label: 'Acil', color: C.danger }
};
const PROCESS_LABEL: Record<string, string> = { KESIM: 'Kesim', DIKIM: 'Dikim', BASKI_NAKIS: 'Baskı/Nakış', UTU: 'Ütü' };
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const rowTotal = (r: SizeRow) => SIZES.reduce((a, z) => a + (Number(r.sizes?.[z]) || 0), 0);
const matrixTotal = (m?: SizeRow[]) => (m || []).reduce((s, r) => s + rowTotal(r), 0);
const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('tr-TR') : '—');
const money = (n: number) => `${(n || 0).toLocaleString('tr-TR')} ₺`;
const STAGES = [{ key: 'KESIM', label: 'Kesim' }, { key: 'DIKIM', label: 'Dikim' }, { key: 'UTU', label: 'Ütü' }];
const MOBILE_TRACKER_URL = process.env.NEXT_PUBLIC_MOBILE_TRACKER_URL || '';

const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: '8px', backgroundColor: C.surface, fontFamily: FONT } };

const FasonTrackers: React.FC = () => {
    const router = useRouter();
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [fasonTrackers, setFasonTrackers] = useState<FasonTracker[]>([]);
    const [workshops, setWorkshops] = useState<Workshop[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');
    const [mobileFilter, setMobileFilter] = useState('');
    const [quick, setQuick] = useState<'all' | 'active' | 'late' | 'warehouse' | 'done'>('all');

    const [expanded, setExpanded] = useState<number | null>(null);
    const [menu, setMenu] = useState<{ el: HTMLElement; order: WorkOrder; mode: 'main' | 'user' } | null>(null);

    const [openDialog, setOpenDialog] = useState(false);
    const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
    const [openAssign, setOpenAssign] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
    const [tab, setTab] = useState<'workshops' | 'matrix' | 'notes'>('workshops');
    const [notesByOrder, setNotesByOrder] = useState<Record<number, OrderNote[]>>({});
    const [noteText, setNoteText] = useState('');
    const [receiveDlg, setReceiveDlg] = useState<{ order: WorkOrder; t: FasonTracking } | null>(null);
    const [receiveForm, setReceiveForm] = useState({ received: 0, defect: 0 });
    const [payDlg, setPayDlg] = useState<{ order: WorkOrder; t: FasonTracking } | null>(null);
    const [payForm, setPayForm] = useState({ amount: 0, note: '' });

    const emptyForm = { orderNo: '', productCode: '', productName: '', quantity: 1, customerName: '', status: 'BEKLIYOR', deliveryDate: '', priority: 'MEDIUM' as Priority,
        orderDate: new Date().toISOString().slice(0, 10), shippingAddress: '', sizeMatrix: [] as SizeRow[] };
    const [formData, setFormData] = useState(emptyForm);
    const [assignForm, setAssignForm] = useState({ workshopId: '', assignedQuantity: 1, unitPrice: 0, processType: 'DIKIM', notes: '', dueDate: '' });

    /* ───────── Helpers ───────── */
    const errMsg = (e: unknown, fb: string) => {
        const c = (typeof e === 'object' && e !== null ? (e as ApiErrorLike) : {}).response?.data;
        return c?.error || c?.message || fb;
    };
    const errStatus = (e: unknown) => (typeof e === 'object' && e !== null ? (e as ApiErrorLike).response?.status : undefined);
    const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    const handle401 = (e: unknown) => {
        if (errStatus(e) === 401) { localStorage.removeItem('token'); router.push('/login'); return true; }
        return false;
    };
    const notify = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type });

    const isClosed = (o: WorkOrder) => o.status === 'TESLIM_EDILDI';
    const doneQty = (o: WorkOrder, p: string) =>
        (o.fasonTrackings || []).filter(t => t.processType === p && t.status === 'TESLIM_EDILDI')
            .reduce((s, t) => s + (t.receivedQuantity ?? t.assignedQuantity ?? 0) + (t.defectQuantity || 0), 0);
    const stageDone = (o: WorkOrder, p: string) => doneQty(o, p) >= o.quantity;
    const stageStarted = (o: WorkOrder, p: string) => (o.fasonTrackings || []).some(t => t.processType === p);
    const ironingDone = (o: WorkOrder) => stageDone(o, 'UTU');
    const canClose = (o: WorkOrder) => ironingDone(o) && !!o.centralWarehouseReceived;
    const assignedQty = (o: WorkOrder) => (o.fasonTrackings || []).reduce((s, t) => s + t.assignedQuantity, 0);
    const costOf = (o: WorkOrder) => (o.fasonTrackings || []).reduce((s, t) => s + (t.totalPrice || 0), 0);
    const paidOf = (o: WorkOrder) => (o.fasonTrackings || []).reduce((s, t) => s + (t.paidAmount || 0), 0);
    const debtOf = (o: WorkOrder) => costOf(o) - paidOf(o);
    const progress = (o: WorkOrder) => (isClosed(o) ? 100 : STAGES.filter(s => stageDone(o, s.key)).length * 25);

    const daysLeft = (d: string) => {
        if (!d) return null;
        const diff = Math.ceil((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
        return Number.isNaN(diff) ? null : diff;
    };
    const isLate = (o: WorkOrder) => !isClosed(o) && (daysLeft(o.deliveryDate) ?? 1) < 0;
    const needsWarehouse = (o: WorkOrder) => ironingDone(o) && !o.centralWarehouseReceived && !isClosed(o);

    /* ───────── Data ───────── */
    useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 350); return () => clearTimeout(t); }, [search]);

    const fetchWorkOrders = useCallback(async () => {
        try {
            setLoading(true); setError('');
            if (!localStorage.getItem('token')) { router.push('/login'); return; }
            const params = new URLSearchParams({ page: '1', limit: '50' });
            if (debouncedSearch) params.append('search', debouncedSearch);
            if (statusFilter) params.append('status', statusFilter);
            const res = await axios.get(`/api/fason/work-orders?${params}`, { ...auth(), timeout: 15000 });
            setWorkOrders(Array.isArray(res.data.data) ? res.data.data : []);
        } catch (e) {
            if (handle401(e)) return;
            setError(errMsg(e, 'İş emirleri yüklenemedi.')); setWorkOrders([]);
        } finally { setLoading(false); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, statusFilter]);

    useEffect(() => { fetchWorkOrders(); }, [fetchWorkOrders]);

    const fetchLookups = async () => {
        try {
            const [t, w] = await Promise.all([
                axios.get('/api/fason/users/fason-trackers', auth()),
                axios.get('/api/fason/workshops', auth())
            ]);
            setFasonTrackers(t.data.data || []);
            setWorkshops((w.data.data || []).filter((x: Workshop) => x.isActive));
        } catch (e) { handle401(e); }
    };
    useEffect(() => { fetchLookups(); /* eslint-disable-next-line */ }, []);

    /* ───────── Filtering ───────── */
    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return workOrders.filter(o =>
            (!q || [o.orderNo, o.productCode, o.productName, o.customerName].some(v => v?.toLowerCase().includes(q))) &&
            (!priorityFilter || o.priority === priorityFilter) &&
            (!mobileFilter || (mobileFilter === 'assigned' ? o.assignedToMobile : !o.assignedToMobile)) &&
            (quick === 'all' ||
                (quick === 'active' && !isClosed(o)) || (quick === 'late' && isLate(o)) ||
                (quick === 'warehouse' && needsWarehouse(o)) || (quick === 'done' && isClosed(o)))
        );
    }, [workOrders, search, priorityFilter, mobileFilter, quick]);

    const counts = useMemo(() => ({
        all: workOrders.length,
        active: workOrders.filter(o => !isClosed(o)).length,
        late: workOrders.filter(isLate).length,
        warehouse: workOrders.filter(needsWarehouse).length,
        done: workOrders.filter(isClosed).length
    }), [workOrders]);

    /* ───────── Actions ───────── */
    const putOrder = (id: number, body: object) => axios.put(`/api/fason/work-orders/${id}`, body, auth());

    const openCreate = () => { setEditingOrder(null); setFormData(emptyForm); setOpenDialog(true); };
    const openEdit = (o: WorkOrder) => {
        setEditingOrder(o);
        setFormData({ orderNo: o.orderNo, productCode: o.productCode, productName: o.productName, quantity: o.quantity,
            customerName: o.customerName, status: o.status, deliveryDate: o.deliveryDate?.slice(0, 10) || '', priority: o.priority,
            orderDate: o.orderDate?.slice(0, 10) || '', shippingAddress: o.shippingAddress || '', sizeMatrix: o.sizeMatrix || [] });
        setOpenDialog(true);
    };

    const saveOrder = async () => {
        try {
            if (editingOrder) {
                if (formData.status === 'TESLIM_EDILDI' && !canClose(editingOrder)) {
                    notify('İş emri, tüm süreçler bitip Merkez Depo\'ya teslim alındıktan sonra kapatılabilir.', 'error'); return;
                }
                await putOrder(editingOrder.id, { ...formData, quantity: matrixTotal(formData.sizeMatrix) || formData.quantity });
            } else await axios.post('/api/fason/work-orders', { ...formData, quantity: matrixTotal(formData.sizeMatrix) || formData.quantity }, auth());
            setOpenDialog(false); fetchWorkOrders(); notify('İş emri kaydedildi.');
        } catch (e) { if (!handle401(e)) notify(errMsg(e, 'İş emri kaydedilemedi.'), 'error'); }
    };

    const deleteOrder = async (o: WorkOrder) => {
        if (!window.confirm(`${o.orderNo} numaralı iş emri silinsin mi?`)) return;
        try { await axios.delete(`/api/fason/work-orders/${o.id}`, auth()); fetchWorkOrders(); notify('İş emri silindi.'); }
        catch (e) { if (!handle401(e)) notify(errMsg(e, 'İş emri silinemedi.'), 'error'); }
    };

    const receiveAtWarehouse = async (o: WorkOrder) => {
        if (!window.confirm('Ütü aşaması tamam. Merkez Depo\'ya teslim alındı olarak işaretlensin mi?')) return;
        try { await putOrder(o.id, { status: 'TESLIM_EDILDI', centralWarehouseReceived: true }); fetchWorkOrders(); notify('Depoya teslim alındı.'); }
        catch (e) { if (!handle401(e)) notify(errMsg(e, 'Depo teslimi kaydedilemedi.'), 'error'); }
    };

    const notifyMobile = async (orderId: number, isAssigned: boolean) => {
        if (!MOBILE_TRACKER_URL) return;
        try {
            await fetch(`${MOBILE_TRACKER_URL}/api/assign`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, isAssigned, timestamp: new Date().toISOString() })
            });
        } catch { /* mobil sunucu kapalı olabilir; kritik değil */ }
    };

    const toggleMobile = async (o: WorkOrder) => {
        if (isClosed(o)) { notify('Kapatılmış iş emrinde mobil atama değiştirilemez.', 'error'); return; }
        try {
            const next = !o.assignedToMobile;
            await putOrder(o.id, { assignedToMobile: next, status: o.status });
            await notifyMobile(o.id, next); fetchWorkOrders();
            notify(next ? 'Mobile atandı.' : 'Mobil atama kaldırıldı.');
        } catch (e) { if (!handle401(e)) notify(errMsg(e, 'Mobil atama güncellenemedi.'), 'error'); }
    };

    const assignUser = async (o: WorkOrder, userId: number | null) => {
        setMenu(null);
        if (isClosed(o)) { notify('Kapatılmış iş emrinde kullanıcı atanamaz.', 'error'); return; }
        try { await putOrder(o.id, { assignedUserId: userId, status: o.status }); fetchWorkOrders(); notify('Kullanıcı ataması güncellendi.'); }
        catch (e) { if (!handle401(e)) notify(errMsg(e, 'Kullanıcı atanamadı.'), 'error'); }
    };

    const openAssignDialog = (o: WorkOrder) => {
        setSelectedOrder(o);
        setAssignForm({ workshopId: '', assignedQuantity: Math.max(1, o.quantity - assignedQty(o)), unitPrice: 0, processType: 'DIKIM', notes: '', dueDate: o.deliveryDate?.slice(0, 10) || '' });
        setOpenAssign(true);
    };

    const saveAssignment = async () => {
        if (!selectedOrder) return;
        const remaining = selectedOrder.quantity - assignedQty(selectedOrder);
        if (!assignForm.workshopId) return notify('Lütfen bir atölye seçin.', 'error');
        if (!(assignForm.assignedQuantity > 0)) return notify('Adet 0\'dan büyük olmalı.', 'error');
        if (!(assignForm.unitPrice >= 0)) return notify('Birim fiyat 0 veya daha büyük olmalı.', 'error');
        if (assignForm.assignedQuantity > remaining) return notify(`Adet, kalan miktarı (${remaining}) aşamaz.`, 'error');
        try {
            await axios.post('/api/fason/assignments', { workOrderId: selectedOrder.id, ...assignForm, workshopId: parseInt(assignForm.workshopId) }, auth());
            setOpenAssign(false); fetchWorkOrders(); fetchLookups(); notify('Atölye ataması kaydedildi.');
        } catch (e) { if (!handle401(e)) notify(errMsg(e, 'Atama kaydedilemedi.'), 'error'); }
    };

    const toggleExpand = async (id: number) => {
        if (expanded === id) { setExpanded(null); return; }
        setExpanded(id); setTab('workshops'); setNoteText('');
        try {
            const res = await axios.get(`/api/fason/work-orders/${id}/notes`, auth());
            setNotesByOrder(p => ({ ...p, [id]: Array.isArray(res.data.data) ? res.data.data : [] }));
        } catch (e) { handle401(e); }
    };

    const addNote = async (o: WorkOrder) => {
        const text = noteText.trim();
        if (!text) return;
        try {
            const res = await axios.post(`/api/fason/work-orders/${o.id}/notes`, { text }, auth());
            const created: OrderNote = res.data.data || { id: Date.now(), text, createdAt: new Date().toISOString() };
            setNotesByOrder(p => ({ ...p, [o.id]: [created, ...(p[o.id] || [])] }));
            setNoteText('');
        } catch (e) { if (!handle401(e)) notify(errMsg(e, 'Not eklenemedi.'), 'error'); }
    };

    const remainOf = (t: FasonTracking) => t.assignedQuantity - (t.receivedQuantity || 0) - (t.defectQuantity || 0);

    const openReceive = (order: WorkOrder, t: FasonTracking) => { setReceiveDlg({ order, t }); setReceiveForm({ received: remainOf(t), defect: 0 }); };
    const saveReceive = async () => {
        if (!receiveDlg) return;
        const { t } = receiveDlg; const { received, defect } = receiveForm; const remain = remainOf(t);
        if (received < 0 || defect < 0 || received + defect <= 0) return notify('Teslim alınan veya fire adedi girin.', 'error');
        if (received + defect > remain) return notify(`Toplam, kalan miktarı (${remain}) aşamaz.`, 'error');
        try {
            await axios.put(`/api/fason/assignments/${t.id}/receive`, { receivedQuantity: received, defectQuantity: defect }, auth());
            setReceiveDlg(null); fetchWorkOrders();
            notify(received + defect < remain ? 'Kısmi teslim kaydedildi.' : 'Teslim alındı.');
        } catch (e) { if (!handle401(e)) notify(errMsg(e, 'Teslim kaydedilemedi.'), 'error'); }
    };

    const openPay = (order: WorkOrder, t: FasonTracking) => { setPayDlg({ order, t }); setPayForm({ amount: (t.totalPrice || 0) - (t.paidAmount || 0), note: '' }); };
    const savePay = async () => {
        if (!payDlg) return;
        const { t } = payDlg; const debt = (t.totalPrice || 0) - (t.paidAmount || 0);
        if (!(payForm.amount > 0)) return notify('Ödeme tutarı 0\'dan büyük olmalı.', 'error');
        if (payForm.amount > debt) return notify(`Ödeme, kalan borcu (${money(debt)}) aşamaz.`, 'error');
        try {
            await axios.post(`/api/fason/assignments/${t.id}/payments`, payForm, auth());
            setPayDlg(null); fetchWorkOrders(); fetchLookups(); notify('Ödeme kaydedildi.');
        } catch (e) { if (!handle401(e)) notify(errMsg(e, 'Ödeme kaydedilemedi.'), 'error'); }
    };

    const exportExcel = () => {
        if (!filtered.length) return notify('Dışa aktarılacak kayıt yok.', 'error');
        const fit = (ws: XLSX.WorkSheet, rows: Record<string, unknown>[]) => {
            ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: Math.min(40, Math.max(k.length, ...rows.map(r => String(r[k] ?? '').length)) + 2) }));
        };
        const orders = filtered.map(o => ({
            'İş Emri No': o.orderNo, 'Ürün Kodu': o.productCode, 'Ürün Adı': o.productName, 'Müşteri': o.customerName, 'Adet': o.quantity,
            'Durum': STATUS[o.status]?.label || o.status, 'Öncelik': PRIORITY[o.priority].label, 'Sipariş Tarihi': fmtDate(o.orderDate),
            'Teslim Tarihi': fmtDate(o.deliveryDate), 'Sevk Adresi': o.shippingAddress || '', 'Takipçi': o.assignedUser?.name || '',
            'Mobile Atanmış': o.assignedToMobile ? 'Evet' : 'Hayır', 'Atölyeye Verilen': assignedQty(o), 'İlerleme %': progress(o),
            'Toplam Maliyet (₺)': costOf(o), 'Ödenen (₺)': paidOf(o), 'Kalan Borç (₺)': debtOf(o)
        }));
        const assigns = filtered.flatMap(o => (o.fasonTrackings || []).map(t => ({
            'İş Emri No': o.orderNo, 'Atölye': t.workshop?.name || '', 'İşlem': PROCESS_LABEL[t.processType] || t.processType,
            'Termin': fmtDate(t.dueDate), 'Verilen': t.assignedQuantity, 'Teslim Alınan': t.receivedQuantity || 0, 'Fire': t.defectQuantity || 0,
            'Kalan': remainOf(t), 'Birim Fiyat (₺)': t.unitPrice, 'Tutar (₺)': t.totalPrice || 0, 'Ödenen (₺)': t.paidAmount || 0,
            'Kalan Borç (₺)': (t.totalPrice || 0) - (t.paidAmount || 0), 'Durum': STATUS[t.status]?.label || t.status
        })));
        const matrix = filtered.flatMap(o => (o.sizeMatrix || []).map(r => ({
            'İş Emri No': o.orderNo, 'Ürün': o.productName, 'Renk': r.color,
            ...Object.fromEntries(SIZES.map(z => [z, r.sizes?.[z] || 0])), 'Toplam': rowTotal(r)
        })));
        const wb = XLSX.utils.book_new();
        ([['İş Emirleri', orders], ['Atölye Atamaları', assigns], ['Beden-Renk', matrix]] as [string, Record<string, unknown>[]][])
            .forEach(([name, rows]) => { if (rows.length) { const ws = XLSX.utils.json_to_sheet(rows); fit(ws, rows); XLSX.utils.book_append_sheet(wb, ws, name); } });
        XLSX.writeFile(wb, `is-emirleri-${new Date().toISOString().slice(0, 10)}.xlsx`);
        notify(`${orders.length} iş emri Excel'e aktarıldı.`);
    };

    /* ───────── UI pieces ───────── */
    const StageTrack = ({ o }: { o: WorkOrder }) => {
        const steps = [
            ...STAGES.map(s => ({ label: s.label, done: stageDone(o, s.key), active: stageStarted(o, s.key) })),
            { label: 'Depo', done: !!o.centralWarehouseReceived, active: ironingDone(o) }
        ];
        return (
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                {steps.map((s) => (
                    <Tooltip key={s.label} title={`${s.label}: ${s.done ? 'tamam' : s.active ? 'devam ediyor' : 'başlamadı'}`}>
                        <Box sx={{ flex: 1, minWidth: 44 }}>
                            <Box sx={{ height: 6, borderRadius: 3, bgcolor: s.done ? C.ok : s.active ? '#E3B341' : C.line }} />
                            <Box sx={{ fontSize: 11, mt: 0.5, color: s.done ? C.ok : C.muted, fontWeight: s.done ? 600 : 400 }}>{s.label}</Box>
                        </Box>
                    </Tooltip>
                ))}
            </Box>
        );
    };

    const DueDate = ({ o }: { o: WorkOrder }) => {
        const d = daysLeft(o.deliveryDate);
        const late = isLate(o);
        return (
            <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 13, color: C.ink }}>
                    <Calendar size={14} color={C.muted} />
                    {o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString('tr-TR') : '—'}
                </Box>
                {d !== null && !isClosed(o) && (
                    <Box sx={{ fontSize: 12, mt: 0.25, fontWeight: 600, color: late ? C.danger : d <= 3 ? C.warn : C.muted }}>
                        {late ? `${-d} gün gecikti` : d === 0 ? 'Bugün' : `${d} gün kaldı`}
                    </Box>
                )}
            </Box>
        );
    };

    const th = { fontSize: 12, color: C.muted, fontWeight: 600 };
    const WS_COLS = '1.4fr 0.9fr 1.2fr 0.9fr 1.2fr 150px';

    const renderWorkshops = (o: WorkOrder) => {
        const rows = o.fasonTrackings || [];
        if (!rows.length) return <Box sx={{ fontSize: 13, color: C.muted, py: 1 }}>Bu iş emri henüz bir atölyeye verilmedi.</Box>;
        return (
            <Box sx={{ border: `1px solid ${C.line}`, borderRadius: '8px', overflow: 'hidden' }}>
                <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: WS_COLS, gap: 1.5, px: 1.5, py: 1, bgcolor: '#F9FAFB', borderBottom: `1px solid ${C.line}`, ...th }}>
                    <span>Atölye / işlem</span><span>Termin</span><span>Teslim alınan</span><span>Tutar</span><span>Ödeme</span><span />
                </Box>
                {rows.map(t => {
                    const remain = remainOf(t), paid = t.paidAmount || 0, debt = (t.totalPrice || 0) - paid;
                    const d = t.dueDate ? daysLeft(t.dueDate) : null;
                    const late = remain > 0 && d !== null && d < 0;
                    return (
                        <Box key={t.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: WS_COLS }, gap: 1.5, px: 1.5, py: 1.25, fontSize: 13, alignItems: 'center', borderBottom: `1px solid ${C.line}`, '&:last-child': { borderBottom: 0 } }}>
                            <Box><Box sx={{ fontWeight: 600 }}>{t.workshop?.name || 'Atölye'}</Box><Box sx={{ color: C.muted }}>{PROCESS_LABEL[t.processType] || t.processType}</Box></Box>
                            <Box>
                                {fmtDate(t.dueDate)}
                                {remain > 0 && d !== null && <Box sx={{ fontSize: 12, fontWeight: 600, color: late ? C.danger : d <= 3 ? C.warn : C.muted }}>{late ? `${-d} gün gecikti` : d === 0 ? 'Bugün' : `${d} gün kaldı`}</Box>}
                            </Box>
                            <Box>
                                <Box sx={{ fontWeight: 600 }}>{t.receivedQuantity || 0}/{t.assignedQuantity} adet</Box>
                                <Box sx={{ fontSize: 12, color: (t.defectQuantity || 0) > 0 ? C.danger : C.muted }}>Fire: {t.defectQuantity || 0} · Kalan: {remain}</Box>
                            </Box>
                            <Box>{money(t.totalPrice)}</Box>
                            <Box>
                                <Box>{money(paid)} ödendi</Box>
                                <Box sx={{ fontSize: 12, fontWeight: 600, color: debt > 0 ? C.warn : C.ok }}>{debt > 0 ? `Kalan ${money(debt)}` : 'Ödeme tamam'}</Box>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                                <Tooltip title="Teslim al / fire gir"><span><IconButton size="small" disabled={remain <= 0} onClick={() => openReceive(o, t)} sx={{ color: C.accent, bgcolor: C.accentSoft, borderRadius: '8px' }}><PackageOpen size={16} /></IconButton></span></Tooltip>
                                <Tooltip title="Ödeme ekle"><span><IconButton size="small" disabled={debt <= 0} onClick={() => openPay(o, t)} sx={{ color: C.info, bgcolor: C.infoSoft, borderRadius: '8px' }}><Wallet size={16} /></IconButton></span></Tooltip>
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        );
    };

    const renderMatrix = (o: WorkOrder) => {
        const m = o.sizeMatrix || [];
        if (!m.length) return <Box sx={{ fontSize: 13, color: C.muted, py: 1 }}>Beden/renk dağılımı girilmemiş. Satır menüsünden Düzenle'yi seçerek ekleyebilirsiniz.</Box>;
        const cell = { p: '6px 12px', textAlign: 'center' as const, borderBottom: `1px solid ${C.line}` };
        return (
            <Box sx={{ overflowX: 'auto', border: `1px solid ${C.line}`, borderRadius: '8px' }}>
                <Box component="table" sx={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                    <thead><tr style={{ background: '#F9FAFB' }}><th style={{ ...cell, textAlign: 'left' }}>Renk</th>{SIZES.map(z => <th key={z} style={cell}>{z}</th>)}<th style={cell}>Toplam</th></tr></thead>
                    <tbody>
                        {m.map((r, i) => <tr key={i}><td style={{ ...cell, textAlign: 'left', fontWeight: 600 }}>{r.color || '—'}</td>{SIZES.map(z => <td key={z} style={{ ...cell, color: r.sizes?.[z] ? C.ink : C.line }}>{r.sizes?.[z] || 0}</td>)}<td style={{ ...cell, fontWeight: 700 }}>{rowTotal(r)}</td></tr>)}
                        <tr style={{ background: '#F9FAFB' }}><td style={{ ...cell, textAlign: 'left', fontWeight: 700 }}>Toplam</td>{SIZES.map(z => <td key={z} style={{ ...cell, fontWeight: 700 }}>{m.reduce((a, r) => a + (r.sizes?.[z] || 0), 0)}</td>)}<td style={{ ...cell, fontWeight: 700 }}>{matrixTotal(m)}</td></tr>
                    </tbody>
                </Box>
            </Box>
        );
    };

    const renderNotes = (o: WorkOrder) => {
        const list = notesByOrder[o.id] || [];
        return (
            <Box>
                <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                    <TextField size="small" fullWidth sx={fieldSx} placeholder="Not veya yorum yazın" value={noteText} onChange={e => setNoteText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(o); } }} />
                    <Button variant="contained" disableElevation onClick={() => addNote(o)} disabled={!noteText.trim()} sx={{ textTransform: 'none', bgcolor: C.accent, whiteSpace: 'nowrap' }}>Not ekle</Button>
                </Box>
                {list.length === 0 && <Box sx={{ fontSize: 13, color: C.muted }}>Henüz not yok.</Box>}
                {list.map(n => (
                    <Box key={n.id} sx={{ py: 1, borderTop: `1px solid ${C.line}`, fontSize: 13 }}>
                        <Box sx={{ color: C.muted, fontSize: 12 }}>{n.author || 'Kullanıcı'} · {new Date(n.createdAt).toLocaleString('tr-TR')}</Box>
                        <Box sx={{ mt: 0.25, whiteSpace: 'pre-wrap' }}>{n.text}</Box>
                    </Box>
                ))}
            </Box>
        );
    };

    const renderMatrixEditor = () => {
        const m = formData.sizeMatrix;
        const setM = (next: SizeRow[]) => setFormData({ ...formData, sizeMatrix: next });
        return (
            <Box sx={{ mt: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ fontWeight: 600, fontSize: 14 }}>Beden / renk dağılımı</Box>
                    <Button size="small" startIcon={<Plus size={14} />} onClick={() => setM([...m, { color: '', sizes: {} }])} sx={{ textTransform: 'none', color: C.accent }}>Renk ekle</Button>
                </Box>
                {m.length === 0 ? (
                    <Box sx={{ fontSize: 13, color: C.muted }}>Renk ve beden bazında adet girerseniz toplam miktar otomatik hesaplanır.</Box>
                ) : (
                    <Box sx={{ overflowX: 'auto' }}>
                        <Box component="table" sx={{ borderCollapse: 'collapse', width: '100%', fontSize: 13, '& td, & th': { p: 0.5 } }}>
                            <thead><tr><th style={{ textAlign: 'left' }}>Renk</th>{SIZES.map(z => <th key={z}>{z}</th>)}<th>Toplam</th><th /></tr></thead>
                            <tbody>
                                {m.map((r, i) => (
                                    <tr key={i}>
                                        <td><TextField size="small" placeholder="Siyah" value={r.color} onChange={e => setM(m.map((x, j) => j === i ? { ...x, color: e.target.value } : x))} /></td>
                                        {SIZES.map(z => (
                                            <td key={z}><TextField size="small" type="number" sx={{ width: 64 }} inputProps={{ min: 0, style: { textAlign: 'center', padding: '8px 4px' } }}
                                                value={r.sizes?.[z] || ''} onChange={e => setM(m.map((x, j) => j === i ? { ...x, sizes: { ...x.sizes, [z]: Math.max(0, parseInt(e.target.value) || 0) } } : x))} /></td>
                                        ))}
                                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{rowTotal(r)}</td>
                                        <td><IconButton size="small" onClick={() => setM(m.filter((_, j) => j !== i))} aria-label="Satırı sil"><Trash2 size={15} /></IconButton></td>
                                    </tr>
                                ))}
                            </tbody>
                        </Box>
                        <Box sx={{ textAlign: 'right', fontSize: 13, fontWeight: 600, mt: 1 }}>Toplam: {matrixTotal(m)} adet</Box>
                    </Box>
                )}
            </Box>
        );
    };

    const receiveRemain = receiveDlg ? remainOf(receiveDlg.t) : 0;
    const payDebt = payDlg ? (payDlg.t.totalPrice || 0) - (payDlg.t.paidAmount || 0) : 0;

    const quickTabs: { key: typeof quick; label: string; tone?: string }[] = [
        { key: 'all', label: 'Tümü' }, { key: 'active', label: 'Devam eden' },
        { key: 'late', label: 'Geciken', tone: C.danger }, { key: 'warehouse', label: 'Depo bekleyen', tone: C.warn },
        { key: 'done', label: 'Tamamlanan' }
    ];

    /* ───────── Render ───────── */
    return (
        <Box sx={{ bgcolor: C.bg, minHeight: '100vh', fontFamily: FONT, color: C.ink }}>
            {/* Top bar */}
            <Box sx={{ bgcolor: C.surface, borderBottom: `1px solid ${C.line}`, px: { xs: 2, md: 4 }, py: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <Box>
                        <Box component="h1" sx={{ m: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em' }}>İş emirleri</Box>
                        <Box sx={{ color: C.muted, fontSize: 14, mt: 0.5 }}>Mira Stok · Dış kaynak üretim takibi</Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                        <Button variant="outlined" onClick={exportExcel} startIcon={<Download size={16} />} sx={{ textTransform: 'none', borderColor: C.line, color: C.ink, borderRadius: '8px' }}>
                            Excel'e aktar
                        </Button>
                        <Button variant="contained" disableElevation startIcon={<Plus size={16} />} onClick={() => router.push('/fason/create-work-order')}
                            sx={{ textTransform: 'none', bgcolor: C.accent, borderRadius: '8px', '&:hover': { bgcolor: '#095858' } }}>
                            Yeni iş emri
                        </Button>
                    </Box>
                </Box>

                {/* Quick filters double as summary */}
                <Box sx={{ display: 'flex', gap: 1, mt: 2.5, flexWrap: 'wrap' }}>
                    {quickTabs.map(t => {
                        const on = quick === t.key;
                        return (
                            <Box key={t.key} component="button" onClick={() => setQuick(t.key)} sx={{
                                display: 'flex', alignItems: 'center', gap: 1, px: 1.75, py: 0.9, borderRadius: '8px', cursor: 'pointer', fontFamily: FONT, fontSize: 14,
                                border: `1px solid ${on ? C.accent : C.line}`, bgcolor: on ? C.accentSoft : C.surface, color: C.ink, fontWeight: on ? 600 : 500
                            }}>
                                {t.label}
                                <Box component="span" sx={{ fontWeight: 700, color: counts[t.key] > 0 && t.tone ? t.tone : C.muted }}>{counts[t.key]}</Box>
                            </Box>
                        );
                    })}
                </Box>
            </Box>

            <Box sx={{ px: { xs: 2, md: 4 }, py: 3, maxWidth: 1400, mx: 'auto' }}>
                {/* Filters */}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr 1fr auto' }, gap: 1.5, mb: 2.5 }}>
                    <TextField size="small" sx={fieldSx} placeholder="İş emri no, ürün, müşteri ara" value={search} onChange={e => setSearch(e.target.value)}
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><Search size={18} color={C.muted} /></InputAdornment>,
                            endAdornment: search ? <IconButton size="small" onClick={() => setSearch('')}><X size={16} /></IconButton> : null
                        }} />
                    <TextField select size="small" sx={fieldSx} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} SelectProps={{ displayEmpty: true }}>
                        <MenuItem value="">Tüm durumlar</MenuItem>
                        {Object.entries(STATUS).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}
                    </TextField>
                    <TextField select size="small" sx={fieldSx} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} SelectProps={{ displayEmpty: true }}>
                        <MenuItem value="">Tüm öncelikler</MenuItem>
                        {(Object.keys(PRIORITY) as Priority[]).map(k => <MenuItem key={k} value={k}>{PRIORITY[k].label}</MenuItem>)}
                    </TextField>
                    <TextField select size="small" sx={fieldSx} value={mobileFilter} onChange={e => setMobileFilter(e.target.value)} SelectProps={{ displayEmpty: true }}>
                        <MenuItem value="">Mobil: tümü</MenuItem>
                        <MenuItem value="assigned">Mobile atanmış</MenuItem>
                        <MenuItem value="not_assigned">Mobile atanmamış</MenuItem>
                    </TextField>
                    {(statusFilter || priorityFilter || mobileFilter || search || quick !== 'all') && (
                        <Button onClick={() => { setStatusFilter(''); setPriorityFilter(''); setMobileFilter(''); setSearch(''); setQuick('all'); }}
                            sx={{ textTransform: 'none', color: C.muted }}>Filtreleri temizle</Button>
                    )}
                </Box>

                {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }} action={<Button color="inherit" size="small" onClick={fetchWorkOrders}>Tekrar dene</Button>}>{error}</Alert>}

                {/* List */}
                <Box sx={{ bgcolor: C.surface, border: `1px solid ${C.line}`, borderRadius: '10px', overflow: 'hidden' }}>
                    {loading && <LinearProgress sx={{ height: 2 }} />}

                    <Box sx={{ display: { xs: 'none', lg: 'grid' }, gridTemplateColumns: '28px 1.1fr 1.6fr 1.5fr 130px 120px 96px', gap: 2, px: 2, py: 1.25,
                        bgcolor: '#F9FAFB', borderBottom: `1px solid ${C.line}`, fontSize: 12, color: C.muted, fontWeight: 600 }}>
                        <span /><span>İş emri</span><span>Ürün / müşteri</span><span>Üretim aşaması</span><span>Teslim</span><span>Durum</span><span />
                    </Box>

                    {filtered.map(o => {
                        const st = STATUS[o.status] || STATUS.BEKLIYOR;
                        const open = expanded === o.id;
                        const q = assignedQty(o);
                        return (
                            <Box key={o.id} sx={{ borderBottom: `1px solid ${C.line}`, '&:last-child': { borderBottom: 0 } }}>
                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '28px 1fr 40px', lg: '28px 1.1fr 1.6fr 1.5fr 130px 120px 96px' }, gap: 2, px: 2, py: 1.75, alignItems: 'center',
                                    borderLeft: `4px solid ${PRIORITY[o.priority].color}`, '&:hover': { bgcolor: '#FAFBFB' } }}>
                                    <IconButton size="small" onClick={() => toggleExpand(o.id)} aria-label="Ayrıntıları aç">
                                        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                    </IconButton>

                                    <Box>
                                        <Box sx={{ fontWeight: 700, fontSize: 15 }}>{o.orderNo}</Box>
                                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5, flexWrap: 'wrap' }}>
                                            <Box sx={{ fontSize: 12, color: PRIORITY[o.priority].color, fontWeight: 600 }}>{PRIORITY[o.priority].label} öncelik</Box>
                                            {o.assignedToMobile && <Chip size="small" icon={<Smartphone size={12} />} label="Mobilde" sx={{ height: 20, fontSize: 11, bgcolor: C.accentSoft, color: C.accent }} />}
                                        </Box>
                                    </Box>

                                    <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
                                        <Box sx={{ fontSize: 14 }}>{o.productName} <Box component="span" sx={{ color: C.muted }}>({o.productCode})</Box></Box>
                                        <Box sx={{ fontSize: 13, color: C.muted, mt: 0.25 }}>{o.customerName} · {o.quantity} adet</Box>
                                        <Box sx={{ fontSize: 12, color: C.muted, mt: 0.25 }}>{o.assignedUser ? `Takipçi: ${o.assignedUser.name}` : 'Takipçi atanmadı'}</Box>
                                    </Box>

                                    <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
                                        <StageTrack o={o} />
                                        <Box sx={{ fontSize: 12, color: C.muted, mt: 0.75 }}>Atölyeye verilen: {q}/{o.quantity} adet{debtOf(o) > 0 && <Box component="span" sx={{ color: C.warn, fontWeight: 600 }}> · Kalan borç {money(debtOf(o))}</Box>}</Box>
                                    </Box>

                                    <Box sx={{ display: { xs: 'none', lg: 'block' } }}><DueDate o={o} /></Box>

                                    <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
                                        <Box sx={{ display: 'inline-block', px: 1.25, py: 0.4, borderRadius: '6px', fontSize: 12, fontWeight: 600, color: st.fg, bgcolor: st.bg }}>{st.label}</Box>
                                        <Box sx={{ fontSize: 12, color: C.muted, mt: 0.5 }}>%{progress(o)} tamamlandı</Box>
                                    </Box>

                                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                                        <Tooltip title="Atölye ata">
                                            <span><IconButton onClick={() => openAssignDialog(o)} disabled={isClosed(o) || q >= o.quantity}
                                                sx={{ color: C.accent, bgcolor: C.accentSoft, borderRadius: '8px', '&:hover': { bgcolor: '#CBE6E4' } }}><Building size={17} /></IconButton></span>
                                        </Tooltip>
                                        <IconButton onClick={e => setMenu({ el: e.currentTarget, order: o, mode: 'main' })} aria-label="Diğer işlemler"><MoreVertical size={18} /></IconButton>
                                    </Box>
                                </Box>

                                {/* Mobile-only summary */}
                                <Box sx={{ display: { xs: 'block', lg: 'none' }, px: 2, pb: 1.5, ml: '44px' }}>
                                    <Box sx={{ fontSize: 14 }}>{o.productName} · {o.customerName}</Box>
                                    <Box sx={{ mt: 1 }}><StageTrack o={o} /></Box>
                                </Box>

                                {needsWarehouse(o) && (
                                    <Box sx={{ mx: 2, mb: 1.5, p: 1.25, bgcolor: C.warnSoft, borderRadius: '8px', display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
                                        <AlertTriangle size={16} color={C.warn} />
                                        <Box sx={{ fontSize: 13, color: C.warn, fontWeight: 500, flex: 1 }}>Ütü tamamlandı. Ürünler Merkez Depo'ya teslim alınmayı bekliyor.</Box>
                                        <Button size="small" variant="contained" disableElevation startIcon={<PackageCheck size={15} />} onClick={() => receiveAtWarehouse(o)}
                                            sx={{ textTransform: 'none', bgcolor: C.warn, '&:hover': { bgcolor: '#92400E' } }}>Depoya teslim al</Button>
                                    </Box>
                                )}

                                <Collapse in={open} unmountOnExit>
                                    <Box sx={{ px: 2, pb: 2, ml: '44px' }}>
                                        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', fontSize: 13, color: C.muted, mb: 1 }}>
                                            <span>Sipariş tarihi: <b style={{ color: C.ink }}>{fmtDate(o.orderDate)}</b></span>
                                            <span>Sevk adresi: <b style={{ color: C.ink }}>{o.shippingAddress || '—'}</b></span>
                                            <span>Maliyet: <b style={{ color: C.ink }}>{money(costOf(o))}</b></span>
                                            <span>Ödenen: <b style={{ color: C.ok }}>{money(paidOf(o))}</b></span>
                                            <span>Kalan: <b style={{ color: debtOf(o) > 0 ? C.warn : C.ink }}>{money(debtOf(o))}</b></span>
                                        </Box>
                                        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 36, mb: 1.5, '& .MuiTab-root': { textTransform: 'none', minHeight: 36 } }}>
                                            <Tab value="workshops" label={`Atölyeler (${(o.fasonTrackings || []).length})`} />
                                            <Tab value="matrix" label="Beden / renk" />
                                            <Tab value="notes" label={`Notlar (${(notesByOrder[o.id] || []).length})`} />
                                        </Tabs>
                                        {tab === 'workshops' && renderWorkshops(o)}
                                        {tab === 'matrix' && renderMatrix(o)}
                                        {tab === 'notes' && renderNotes(o)}
                                    </Box>
                                </Collapse>
                            </Box>
                        );
                    })}

                    {!loading && filtered.length === 0 && (
                        <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
                            <Box sx={{ fontSize: 17, fontWeight: 600 }}>Eşleşen iş emri yok</Box>
                            <Box sx={{ color: C.muted, mt: 0.75, mb: 2 }}>Filtreleri değiştirin ya da yeni bir iş emri oluşturun.</Box>
                            <Button variant="contained" disableElevation onClick={() => router.push('/fason/create-work-order')} sx={{ textTransform: 'none', bgcolor: C.accent, borderRadius: '8px' }}>Yeni iş emri</Button>
                        </Box>
                    )}
                </Box>
            </Box>

            {/* Row menu */}
            <Menu anchorEl={menu?.el} open={!!menu} onClose={() => setMenu(null)}>
                {menu?.mode === 'main' && menu && [
                    <MenuItem key="m" disabled={isClosed(menu.order)} onClick={() => { toggleMobile(menu.order); setMenu(null); }}>
                        <Truck size={16} style={{ marginRight: 10 }} />{menu.order.assignedToMobile ? 'Mobil atamayı kaldır' : 'Mobile ata'}
                    </MenuItem>,
                    <MenuItem key="u" disabled={isClosed(menu.order)} onClick={() => setMenu({ ...menu, mode: 'user' })}>
                        <UserPlus size={16} style={{ marginRight: 10 }} />Takipçi ata
                    </MenuItem>,
                    <MenuItem key="e" onClick={() => { openEdit(menu.order); setMenu(null); }}><Pencil size={16} style={{ marginRight: 10 }} />Düzenle</MenuItem>,
                    <MenuItem key="d" sx={{ color: C.danger }} onClick={() => { deleteOrder(menu.order); setMenu(null); }}><Trash2 size={16} style={{ marginRight: 10 }} />Sil</MenuItem>
                ]}
                {menu?.mode === 'user' && menu && [
                    <MenuItem key="none" onClick={() => assignUser(menu.order, null)}>Atamayı kaldır</MenuItem>,
                    ...fasonTrackers.map(u => (
                        <MenuItem key={u.id} selected={menu.order.assignedUser?.id === u.id} onClick={() => assignUser(menu.order, u.id)}>{u.name}</MenuItem>
                    ))
                ]}
            </Menu>

            {/* Order dialog */}
            <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ fontWeight: 700 }}>{editingOrder ? `${editingOrder.orderNo} düzenle` : 'Yeni iş emri'}</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 1 }}>
                        <TextField label="İş emri no" required value={formData.orderNo} onChange={e => setFormData({ ...formData, orderNo: e.target.value })} />
                        <TextField label="Ürün kodu" required value={formData.productCode} onChange={e => setFormData({ ...formData, productCode: e.target.value })} />
                        <TextField label="Ürün adı" required value={formData.productName} onChange={e => setFormData({ ...formData, productName: e.target.value })} />
                        <TextField label="Miktar" type="number" required inputProps={{ min: 1 }} value={matrixTotal(formData.sizeMatrix) || formData.quantity}
                            disabled={matrixTotal(formData.sizeMatrix) > 0} helperText={matrixTotal(formData.sizeMatrix) > 0 ? 'Beden dağılımından hesaplandı' : ''}
                            onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })} />
                        <TextField label="Müşteri" required value={formData.customerName} onChange={e => setFormData({ ...formData, customerName: e.target.value })} />
                        <TextField label="Sipariş tarihi" type="date" InputLabelProps={{ shrink: true }} value={formData.orderDate} onChange={e => setFormData({ ...formData, orderDate: e.target.value })} />
                        <TextField label="Teslim tarihi" type="date" InputLabelProps={{ shrink: true }} value={formData.deliveryDate} onChange={e => setFormData({ ...formData, deliveryDate: e.target.value })} />
                        <TextField select label="Durum" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                            {Object.entries(STATUS).map(([k, v]) => (
                                <MenuItem key={k} value={k} disabled={k === 'TESLIM_EDILDI' && !(editingOrder && canClose(editingOrder))}>
                                    {v.label}{k === 'TESLIM_EDILDI' ? ' (depo teslimi gerekir)' : ''}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField select label="Öncelik" value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value as Priority })}>
                            {(Object.keys(PRIORITY) as Priority[]).map(k => <MenuItem key={k} value={k}>{PRIORITY[k].label}</MenuItem>)}
                        </TextField>
                    </Box>
                    <TextField label="Sevk adresi" multiline rows={2} fullWidth sx={{ mt: 2 }} value={formData.shippingAddress} onChange={e => setFormData({ ...formData, shippingAddress: e.target.value })} />
                    {renderMatrixEditor()}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setOpenDialog(false)} sx={{ textTransform: 'none', color: C.muted }}>Vazgeç</Button>
                    <Button variant="contained" disableElevation onClick={saveOrder} sx={{ textTransform: 'none', bgcolor: C.accent }}>{editingOrder ? 'Değişiklikleri kaydet' : 'İş emri oluştur'}</Button>
                </DialogActions>
            </Dialog>

            {/* Workshop assignment dialog */}
            <Dialog open={openAssign} onClose={() => setOpenAssign(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: 700 }}>Atölyeye ver · {selectedOrder?.orderNo}</DialogTitle>
                <DialogContent>
                    {selectedOrder && (
                        <Box sx={{ p: 1.5, mb: 2, mt: 0.5, bgcolor: C.bg, borderRadius: '8px', fontSize: 13 }}>
                            <Box sx={{ fontWeight: 600 }}>{selectedOrder.productName} ({selectedOrder.productCode})</Box>
                            <Box sx={{ color: C.muted, mt: 0.5 }}>
                                {selectedOrder.customerName} · Toplam {selectedOrder.quantity} · Verilen {assignedQty(selectedOrder)} · Kalan {selectedOrder.quantity - assignedQty(selectedOrder)}
                            </Box>
                        </Box>
                    )}
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                        <TextField select label="Atölye" required value={assignForm.workshopId} onChange={e => setAssignForm({ ...assignForm, workshopId: e.target.value })}>
                            {workshops.map(w => <MenuItem key={w.id} value={String(w.id)}>{w.name} ({w.specialization})</MenuItem>)}
                        </TextField>
                        <TextField select label="İşlem" value={assignForm.processType} onChange={e => setAssignForm({ ...assignForm, processType: e.target.value })}>
                            {Object.entries(PROCESS_LABEL).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                        </TextField>
                        <TextField label="Adet" type="number" required inputProps={{ min: 1 }} value={assignForm.assignedQuantity}
                            onChange={e => setAssignForm({ ...assignForm, assignedQuantity: parseInt(e.target.value) || 0 })} />
                        <TextField label="Birim fiyat (₺)" type="number" required inputProps={{ min: 0, step: 0.01 }} value={assignForm.unitPrice}
                            onChange={e => setAssignForm({ ...assignForm, unitPrice: parseFloat(e.target.value) || 0 })} />
                        <TextField label="Termin tarihi" type="date" InputLabelProps={{ shrink: true }} value={assignForm.dueDate} onChange={e => setAssignForm({ ...assignForm, dueDate: e.target.value })} helperText="Atölyenin teslim edeceği tarih" />
                        <TextField label="Not" multiline rows={2} sx={{ gridColumn: '1 / -1' }} value={assignForm.notes} onChange={e => setAssignForm({ ...assignForm, notes: e.target.value })} />
                    </Box>
                    <Box sx={{ mt: 2, p: 1.5, bgcolor: C.accentSoft, borderRadius: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                        <span>Toplam tutar</span>
                        <span>{(assignForm.assignedQuantity * assignForm.unitPrice || 0).toLocaleString('tr-TR')} ₺</span>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setOpenAssign(false)} sx={{ textTransform: 'none', color: C.muted }}>Vazgeç</Button>
                    <Button variant="contained" disableElevation onClick={saveAssignment} sx={{ textTransform: 'none', bgcolor: C.accent }}>Atölyeye ver</Button>
                </DialogActions>
            </Dialog>

            {/* Receive dialog */}
            <Dialog open={!!receiveDlg} onClose={() => setReceiveDlg(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 700 }}>Teslim al · {receiveDlg?.t.workshop?.name}</DialogTitle>
                <DialogContent>
                    {receiveDlg && (
                        <Box sx={{ p: 1.5, mb: 2, mt: 0.5, bgcolor: C.bg, borderRadius: '8px', fontSize: 13, color: C.muted }}>
                            {PROCESS_LABEL[receiveDlg.t.processType]} · Verilen {receiveDlg.t.assignedQuantity} · Alınan {receiveDlg.t.receivedQuantity || 0} · Fire {receiveDlg.t.defectQuantity || 0} · <b style={{ color: C.ink }}>Kalan {receiveRemain}</b>
                        </Box>
                    )}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                        <TextField label="Sağlam adet" type="number" inputProps={{ min: 0 }} value={receiveForm.received} onChange={e => setReceiveForm({ ...receiveForm, received: parseInt(e.target.value) || 0 })} />
                        <TextField label="Fire / hatalı adet" type="number" inputProps={{ min: 0 }} value={receiveForm.defect} onChange={e => setReceiveForm({ ...receiveForm, defect: parseInt(e.target.value) || 0 })} />
                    </Box>
                    <Box sx={{ mt: 1.5, fontSize: 12, color: C.muted }}>Kalandan az girerseniz kısmi teslim olarak kaydedilir.</Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setReceiveDlg(null)} sx={{ textTransform: 'none', color: C.muted }}>Vazgeç</Button>
                    <Button variant="contained" disableElevation onClick={saveReceive} sx={{ textTransform: 'none', bgcolor: C.accent }}>Teslimi kaydet</Button>
                </DialogActions>
            </Dialog>

            {/* Payment dialog */}
            <Dialog open={!!payDlg} onClose={() => setPayDlg(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 700 }}>Ödeme ekle · {payDlg?.t.workshop?.name}</DialogTitle>
                <DialogContent>
                    {payDlg && (
                        <Box sx={{ p: 1.5, mb: 2, mt: 0.5, bgcolor: C.bg, borderRadius: '8px', fontSize: 13, color: C.muted }}>
                            Tutar {money(payDlg.t.totalPrice)} · Ödenen {money(payDlg.t.paidAmount || 0)} · <b style={{ color: C.ink }}>Kalan {money(payDebt)}</b>
                        </Box>
                    )}
                    <Box sx={{ display: 'grid', gap: 2 }}>
                        <TextField label="Ödeme tutarı (₺)" type="number" inputProps={{ min: 0, step: 0.01 }} value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: parseFloat(e.target.value) || 0 })} />
                        <TextField label="Açıklama" value={payForm.note} onChange={e => setPayForm({ ...payForm, note: e.target.value })} />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setPayDlg(null)} sx={{ textTransform: 'none', color: C.muted }}>Vazgeç</Button>
                    <Button variant="contained" disableElevation onClick={savePay} sx={{ textTransform: 'none', bgcolor: C.accent }}>Ödemeyi kaydet</Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                {toast ? <Alert severity={toast.type} onClose={() => setToast(null)} variant="filled">{toast.msg}</Alert> : undefined}
            </Snackbar>
        </Box>
    );
};

export default FasonTrackers;