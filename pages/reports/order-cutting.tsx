import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import Link from 'next/link';

type ReportRow = {
  customerName: string;
  customerOrderId: number;
  customerOrderNo: string;
  itemId: number;
  productCode: string;
  productName: string;
  color: string;
  orderQuantity: number;
  assignedToCutting: number;
  cutQuantity: number;
  remainingQuantity: number;
  workOrderNos: string[];
};

type Summary = {
  totalRows: number;
  totalOrderQuantity: number;
  totalAssignedToCutting: number;
  totalCutQuantity: number;
  totalRemainingQuantity: number;
};

type CuttingProgressFilter = 'all' | 'notStarted' | 'assigned' | 'inProgress' | 'completed';

type ReportColumnId =
  | 'customerName'
  | 'customerOrderNo'
  | 'productCode'
  | 'productName'
  | 'color'
  | 'orderQuantity'
  | 'assignedToCutting'
  | 'cutQuantity'
  | 'remainingQuantity'
  | 'workOrderNos';

type ReportColumn = {
  id: ReportColumnId;
  label: string;
  width: number;
  minWidth: number;
  textAlign?: 'left' | 'right';
};

type GroupedReportRow =
  | {
      kind: 'group';
      key: string;
      level: number;
      columnId: ReportColumnId;
      value: string;
      count: number;
    }
  | {
      kind: 'row';
      row: ReportRow;
    };

const emptySummary: Summary = {
  totalRows: 0,
  totalOrderQuantity: 0,
  totalAssignedToCutting: 0,
  totalCutQuantity: 0,
  totalRemainingQuantity: 0,
};

const formatNumber = (value: number): string => Number(value || 0).toLocaleString('tr-TR');

const normalizeSearchText = (value: string): string =>
  String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0131/g, 'i')
    .replace(/\u011f/g, 'g')
    .replace(/\u00fc/g, 'u')
    .replace(/\u015f/g, 's')
    .replace(/\u00f6/g, 'o')
    .replace(/\u00e7/g, 'c')
    .trim();

const REPORT_COLUMNS: ReportColumn[] = [
  { id: 'customerName', label: 'Musteri', width: 220, minWidth: 140 },
  { id: 'customerOrderNo', label: 'Siparis No', width: 140, minWidth: 110 },
  { id: 'productCode', label: 'Urun Kodu', width: 140, minWidth: 110 },
  { id: 'productName', label: 'Urun Adi', width: 180, minWidth: 130 },
  { id: 'color', label: 'Renk', width: 120, minWidth: 90 },
  { id: 'orderQuantity', label: 'Siparis Adedi', width: 130, minWidth: 100, textAlign: 'right' },
  { id: 'assignedToCutting', label: 'Kesime Atanan', width: 130, minWidth: 110, textAlign: 'right' },
  { id: 'cutQuantity', label: 'Kesilen', width: 120, minWidth: 90, textAlign: 'right' },
  { id: 'remainingQuantity', label: 'Kalan', width: 120, minWidth: 90, textAlign: 'right' },
  { id: 'workOrderNos', label: 'Is Emirleri', width: 260, minWidth: 170 },
];

const GROUP_HINT_TEXT = 'Gruplamak icin kolon surukleyip birakin';

const getColumnLabel = (columnId: ReportColumnId): string =>
  REPORT_COLUMNS.find((column) => column.id === columnId)?.label || columnId;

const getColumnValue = (row: ReportRow, columnId: ReportColumnId): string | number => {
  switch (columnId) {
    case 'customerName':
      return row.customerName;
    case 'customerOrderNo':
      return row.customerOrderNo;
    case 'productCode':
      return row.productCode;
    case 'productName':
      return row.productName || '';
    case 'color':
      return row.color;
    case 'orderQuantity':
      return row.orderQuantity;
    case 'assignedToCutting':
      return row.assignedToCutting;
    case 'cutQuantity':
      return row.cutQuantity;
    case 'remainingQuantity':
      return row.remainingQuantity;
    case 'workOrderNos':
      return row.workOrderNos.join(', ');
    default:
      return '';
  }
};

export default function OrderCuttingReportPage() {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [customerFilter, setCustomerFilter] = useState<string>('');
  const [orderNoFilter, setOrderNoFilter] = useState<string>('');
  const [productCodeFilter, setProductCodeFilter] = useState<string>('');
  const [colorFilter, setColorFilter] = useState<string>('');
  const [workOrderFilter, setWorkOrderFilter] = useState<string>('');
  const [progressFilter, setProgressFilter] = useState<CuttingProgressFilter>('all');
  const [remainingOnly, setRemainingOnly] = useState<boolean>(false);
  const [columnWidths, setColumnWidths] = useState<Record<ReportColumnId, number>>(() => {
    const initial = {} as Record<ReportColumnId, number>;
    REPORT_COLUMNS.forEach((column) => {
      initial[column.id] = column.width;
    });
    return initial;
  });
  const [groupByColumns, setGroupByColumns] = useState<ReportColumnId[]>([]);
  const [draggingColumnId, setDraggingColumnId] = useState<ReportColumnId | null>(null);
  const [isGroupDropActive, setIsGroupDropActive] = useState(false);
  const resizingStateRef = useRef<{ columnId: ReportColumnId; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await fetch('/api/reports/order-cutting');
        if (!response.ok) {
          throw new Error('Rapor verisi alinamadi');
        }
        const data = await response.json();
        const reportRows = Array.isArray(data?.rows) ? (data.rows as ReportRow[]) : [];
        const reportSummary = (data?.summary || emptySummary) as Summary;

        setRows(reportRows);
        setSummary({
          totalRows: Number(reportSummary.totalRows || 0),
          totalOrderQuantity: Number(reportSummary.totalOrderQuantity || 0),
          totalAssignedToCutting: Number(reportSummary.totalAssignedToCutting || 0),
          totalCutQuantity: Number(reportSummary.totalCutQuantity || 0),
          totalRemainingQuantity: Number(reportSummary.totalRemainingQuantity || 0),
        });
      } catch (fetchError) {
        console.error(fetchError);
        setError('Siparis kesim raporu yuklenemedi.');
        setRows([]);
        setSummary(emptySummary);
      } finally {
        setLoading(false);
      }
    };

    void fetchReport();
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  const customerOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.customerName).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'tr-TR')
      ),
    [rows]
  );

  const productCodeOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.productCode).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'tr-TR')
      ),
    [rows]
  );

  const colorOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.color).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'tr-TR')
      ),
    [rows]
  );

  const resolveProgressState = (row: ReportRow): Exclude<CuttingProgressFilter, 'all'> => {
    if (row.cutQuantity >= row.orderQuantity) return 'completed';
    if (row.cutQuantity > 0) return 'inProgress';
    if (row.assignedToCutting > 0 || row.workOrderNos.length > 0) return 'assigned';
    return 'notStarted';
  };

  const filteredRows = useMemo(() => {
    const normalizedSearch = normalizeSearchText(search);
    const normalizedOrderNoFilter = normalizeSearchText(orderNoFilter);
    const normalizedWorkOrderFilter = normalizeSearchText(workOrderFilter);

    return rows.filter((row) => {
      if (normalizedSearch) {
        const searchable = [
          row.customerName,
          row.customerOrderNo,
          row.productCode,
          row.productName || '',
          row.color,
          row.workOrderNos.join(', '),
        ];
        const hasSearchMatch = searchable.some((value) => normalizeSearchText(value).includes(normalizedSearch));
        if (!hasSearchMatch) return false;
      }

      if (customerFilter && row.customerName !== customerFilter) return false;
      if (productCodeFilter && row.productCode !== productCodeFilter) return false;
      if (colorFilter && row.color !== colorFilter) return false;
      if (normalizedOrderNoFilter && !normalizeSearchText(row.customerOrderNo).includes(normalizedOrderNoFilter)) {
        return false;
      }
      if (
        normalizedWorkOrderFilter &&
        !normalizeSearchText(row.workOrderNos.join(', ')).includes(normalizedWorkOrderFilter)
      ) {
        return false;
      }
      if (remainingOnly && row.remainingQuantity <= 0) return false;
      if (progressFilter !== 'all' && resolveProgressState(row) !== progressFilter) return false;

      return true;
    });
  }, [
    rows,
    search,
    customerFilter,
    productCodeFilter,
    colorFilter,
    orderNoFilter,
    workOrderFilter,
    remainingOnly,
    progressFilter,
  ]);

  const filteredSummary = useMemo<Summary>(() => {
    return {
      totalRows: filteredRows.length,
      totalOrderQuantity: Number(filteredRows.reduce((sum, row) => sum + Number(row.orderQuantity || 0), 0).toFixed(3)),
      totalAssignedToCutting: Number(
        filteredRows.reduce((sum, row) => sum + Number(row.assignedToCutting || 0), 0).toFixed(3)
      ),
      totalCutQuantity: Number(filteredRows.reduce((sum, row) => sum + Number(row.cutQuantity || 0), 0).toFixed(3)),
      totalRemainingQuantity: Number(
        filteredRows.reduce((sum, row) => sum + Number(row.remainingQuantity || 0), 0).toFixed(3)
      ),
    };
  }, [filteredRows]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    Boolean(customerFilter) ||
    Boolean(orderNoFilter.trim()) ||
    Boolean(productCodeFilter) ||
    Boolean(colorFilter) ||
    Boolean(workOrderFilter.trim()) ||
    progressFilter !== 'all' ||
    remainingOnly;

  const startColumnResize = (columnId: ReportColumnId, event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const currentWidth = columnWidths[columnId];
    resizingStateRef.current = {
      columnId,
      startX: event.clientX,
      startWidth: currentWidth,
    };

    const onMouseMove = (moveEvent: MouseEvent) => {
      const state = resizingStateRef.current;
      if (!state || state.columnId !== columnId) return;
      const columnMeta = REPORT_COLUMNS.find((column) => column.id === state.columnId);
      const minWidth = columnMeta?.minWidth ?? 90;
      const nextWidth = Math.max(minWidth, state.startWidth + (moveEvent.clientX - state.startX));
      setColumnWidths((prev) => ({ ...prev, [state.columnId]: nextWidth }));
    };

    const stopResize = () => {
      resizingStateRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', stopResize);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', stopResize);
  };

  const onHeaderDragStart = (columnId: ReportColumnId, event: ReactDragEvent<HTMLElement>) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', columnId);
    setDraggingColumnId(columnId);
  };

  const onHeaderDragEnd = () => {
    setDraggingColumnId(null);
    setIsGroupDropActive(false);
  };

  const addGroupColumn = (columnId: ReportColumnId) => {
    setGroupByColumns((prev) => (prev.includes(columnId) ? prev : [...prev, columnId]));
  };

  const removeGroupColumn = (columnId: ReportColumnId) => {
    setGroupByColumns((prev) => prev.filter((value) => value !== columnId));
  };

  const clearFilters = () => {
    setSearch('');
    setCustomerFilter('');
    setOrderNoFilter('');
    setProductCodeFilter('');
    setColorFilter('');
    setWorkOrderFilter('');
    setProgressFilter('all');
    setRemainingOnly(false);
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (pageRef.current) {
          await pageRef.current.requestFullscreen();
        }
      } else {
        await document.exitFullscreen();
      }
    } catch (fullscreenError) {
      console.error('Tam ekran islemi basarisiz:', fullscreenError);
    }
  };

  const exportRows = useMemo(
    () =>
      filteredRows.map((row) => ({
        Musteri: row.customerName,
        'Siparis No': row.customerOrderNo,
        'Urun Kodu': row.productCode,
        'Urun Adi': row.productName || '-',
        Renk: row.color,
        'Siparis Adedi': row.orderQuantity,
        'Kesime Atanan': row.assignedToCutting,
        Kesilen: row.cutQuantity,
        Kalan: row.remainingQuantity,
        'Is Emirleri': row.workOrderNos.length > 0 ? row.workOrderNos.join(', ') : '-',
      })),
    [filteredRows]
  );

  const reportFileBase = `siparis-kesim-raporu-${new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[:T]/g, '-')}`;

  const exportCsv = () => {
    if (!exportRows.length) return;

    const headers = Object.keys(exportRows[0]);
    const csvRows = [headers.join(';')];
    exportRows.forEach((row) => {
      const values = headers.map((header) => {
        const raw = row[header as keyof typeof row];
        const cell = String(raw ?? '').replace(/"/g, '""');
        return `"${cell}"`;
      });
      csvRows.push(values.join(';'));
    });

    const csvContent = `\uFEFF${csvRows.join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${reportFileBase}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportExcel = async () => {
    if (!exportRows.length) return;
    const XLSX = await import('xlsx');
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Siparis Kesim Raporu');
    XLSX.writeFile(workbook, `${reportFileBase}.xlsx`);
  };

  const printReport = () => {
    window.print();
  };

  const groupedRows = useMemo<GroupedReportRow[]>(() => {
    if (!groupByColumns.length) {
      return filteredRows.map((row) => ({ kind: 'row', row }));
    }

    const groupRecursive = (sourceRows: ReportRow[], level: number, keyPath: string): GroupedReportRow[] => {
      if (level >= groupByColumns.length) {
        return sourceRows.map((row) => ({ kind: 'row', row }));
      }

      const columnId = groupByColumns[level];
      const grouped = new Map<string, ReportRow[]>();

      sourceRows.forEach((row) => {
        const rawValue = getColumnValue(row, columnId);
        const value = String(rawValue || '').trim() || '(Bos)';
        const bucket = grouped.get(value);
        if (bucket) {
          bucket.push(row);
        } else {
          grouped.set(value, [row]);
        }
      });

      const output: GroupedReportRow[] = [];
      grouped.forEach((groupRows, groupValue) => {
        const nextKeyPath = keyPath ? `${keyPath}|${columnId}:${groupValue}` : `${columnId}:${groupValue}`;
        output.push({
          kind: 'group',
          key: nextKeyPath,
          level,
          columnId,
          value: groupValue,
          count: groupRows.length,
        });
        output.push(...groupRecursive(groupRows, level + 1, nextKeyPath));
      });
      return output;
    };

    return groupRecursive(filteredRows, 0, '');
  }, [filteredRows, groupByColumns]);

  const tableMinWidth = useMemo(
    () =>
      REPORT_COLUMNS.reduce((sum, column) => {
        return sum + (columnWidths[column.id] ?? column.width);
      }, 0),
    [columnWidths]
  );

  return (
    <div ref={pageRef} style={styles.page}>
      <div style={styles.header}>
        <div>
          <Link href="/reports" style={styles.backLink}>
            {'<- Raporlara Don'}
          </Link>
          <h1 style={styles.title}>Siparis Kesim Raporu</h1>
          <p style={styles.subtitle}>Tam ekran, filtreleme ve rapor alma destekli kesim ozeti</p>
        </div>
        <div style={styles.headerActions}>
          <button type="button" style={styles.actionButton} onClick={() => setShowFilters((prev) => !prev)}>
            {showFilters ? 'Filtreleri Gizle' : 'Filtreleri Goster'}
          </button>
          <button type="button" style={styles.actionButton} onClick={toggleFullscreen}>
            {isFullscreen ? 'Tam Ekrandan Cik' : 'Tam Ekran'}
          </button>
          <button type="button" style={styles.actionButton} onClick={exportCsv} disabled={exportRows.length === 0}>
            CSV Al
          </button>
          <button
            type="button"
            style={styles.actionButton}
            onClick={() => void exportExcel()}
            disabled={exportRows.length === 0}
          >
            Excel Al
          </button>
          <button type="button" style={styles.actionButton} onClick={printReport} disabled={exportRows.length === 0}>
            Yazdir
          </button>
        </div>
      </div>

      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Toplam Satir</span>
          <strong style={styles.summaryValue}>{formatNumber(filteredSummary.totalRows)}</strong>
          {hasActiveFilters && <small style={styles.summaryMeta}>Genel: {formatNumber(summary.totalRows)}</small>}
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Siparis Adedi</span>
          <strong style={styles.summaryValue}>{formatNumber(filteredSummary.totalOrderQuantity)}</strong>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Kesimhaneye Atanan</span>
          <strong style={styles.summaryValue}>{formatNumber(filteredSummary.totalAssignedToCutting)}</strong>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Kesilen Adet</span>
          <strong style={styles.summaryValue}>{formatNumber(filteredSummary.totalCutQuantity)}</strong>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Kalan</span>
          <strong style={styles.summaryValue}>{formatNumber(filteredSummary.totalRemainingQuantity)}</strong>
        </div>
      </div>

      {showFilters && (
        <div style={styles.filterPanel}>
          <div style={styles.filterGrid}>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tum alanlarda ara..."
              style={styles.searchInput}
            />
            <select
              value={customerFilter}
              onChange={(event) => setCustomerFilter(event.target.value)}
              style={styles.filterSelect}
            >
              <option value="">Musteri (Tum)</option>
              {customerOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={orderNoFilter}
              onChange={(event) => setOrderNoFilter(event.target.value)}
              placeholder="Siparis No filtre"
              style={styles.searchInput}
            />
            <select
              value={productCodeFilter}
              onChange={(event) => setProductCodeFilter(event.target.value)}
              style={styles.filterSelect}
            >
              <option value="">Urun Kodu (Tum)</option>
              {productCodeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select value={colorFilter} onChange={(event) => setColorFilter(event.target.value)} style={styles.filterSelect}>
              <option value="">Renk (Tum)</option>
              {colorOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={workOrderFilter}
              onChange={(event) => setWorkOrderFilter(event.target.value)}
              placeholder="Is Emri No filtre"
              style={styles.searchInput}
            />
            <select
              value={progressFilter}
              onChange={(event) => setProgressFilter(event.target.value as CuttingProgressFilter)}
              style={styles.filterSelect}
            >
              <option value="all">Durum (Tum)</option>
              <option value="notStarted">Baslamadi</option>
              <option value="assigned">Atandi</option>
              <option value="inProgress">Devam Ediyor</option>
              <option value="completed">Tamamlandi</option>
            </select>
            <label style={styles.checkboxWrap}>
              <input
                type="checkbox"
                checked={remainingOnly}
                onChange={(event) => setRemainingOnly(event.target.checked)}
              />
              Sadece kalani olanlar
            </label>
            <button type="button" style={styles.clearFilterButton} onClick={clearFilters}>
              Filtreyi Temizle
            </button>
          </div>
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.tableWrap}>
        <div
          style={{
            ...styles.groupHint,
            ...(isGroupDropActive ? styles.groupHintActive : {}),
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsGroupDropActive(true);
          }}
          onDragLeave={() => setIsGroupDropActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsGroupDropActive(false);
            const droppedColumnId = event.dataTransfer.getData('text/plain') as ReportColumnId;
            if (REPORT_COLUMNS.some((column) => column.id === droppedColumnId)) {
              addGroupColumn(droppedColumnId);
            }
          }}
        >
          {groupByColumns.length === 0 ? (
            GROUP_HINT_TEXT
          ) : (
            <div style={styles.groupChipWrap}>
              {groupByColumns.map((columnId) => (
                <span key={columnId} style={styles.groupChip}>
                  {getColumnLabel(columnId)}
                  <button
                    type="button"
                    style={styles.groupChipRemove}
                    onClick={() => removeGroupColumn(columnId)}
                    title="Gruplamadan kaldir"
                  >
                    x
                  </button>
                </span>
              ))}
              <button type="button" style={styles.groupClearButton} onClick={() => setGroupByColumns([])}>
                Temizle
              </button>
            </div>
          )}
        </div>
        {loading ? (
          <div style={styles.empty}>Yukleniyor...</div>
        ) : groupedRows.length === 0 ? (
          <div style={styles.empty}>Rapor satiri bulunamadi.</div>
        ) : (
          <table style={{ ...styles.table, minWidth: `${tableMinWidth}px` }}>
            <thead>
              <tr>
                {REPORT_COLUMNS.map((column) => (
                  <th
                    key={column.id}
                    draggable
                    onDragStart={(event) => onHeaderDragStart(column.id, event)}
                    onDragEnd={onHeaderDragEnd}
                    title="Gruplamak icin yukari surukleyin"
                    style={{
                      ...styles.th,
                      width: columnWidths[column.id],
                      minWidth: column.minWidth,
                      textAlign: column.textAlign || 'left',
                      ...(draggingColumnId === column.id ? styles.thDragging : {}),
                    }}
                  >
                    <span>{column.label}</span>
                    <span
                      role="presentation"
                      style={styles.resizeHandle}
                      onMouseDown={(event) => startColumnResize(column.id, event)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                let dataRowIndex = -1;
                return groupedRows.map((item) => {
                  if (item.kind === 'group') {
                    return (
                      <tr key={`group-${item.key}`}>
                        <td colSpan={REPORT_COLUMNS.length} style={styles.groupRowCell}>
                          <span style={{ paddingLeft: item.level * 18 }}>
                            {getColumnLabel(item.columnId)}: {item.value} ({item.count})
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  dataRowIndex += 1;
                  const row = item.row;
                  return (
                    <tr
                      key={`${row.customerOrderId}-${row.itemId}`}
                      style={dataRowIndex % 2 === 0 ? styles.trEven : styles.trOdd}
                    >
                      <td style={{ ...styles.td, width: columnWidths.customerName }}>{row.customerName}</td>
                      <td style={{ ...styles.td, width: columnWidths.customerOrderNo }}>{row.customerOrderNo}</td>
                      <td style={{ ...styles.td, width: columnWidths.productCode, fontWeight: 700 }}>{row.productCode}</td>
                      <td style={{ ...styles.td, width: columnWidths.productName }}>{row.productName || '-'}</td>
                      <td style={{ ...styles.td, width: columnWidths.color }}>{row.color}</td>
                      <td style={{ ...styles.td, width: columnWidths.orderQuantity, textAlign: 'right' }}>
                        {formatNumber(row.orderQuantity)}
                      </td>
                      <td style={{ ...styles.td, width: columnWidths.assignedToCutting, textAlign: 'right' }}>
                        {formatNumber(row.assignedToCutting)}
                      </td>
                      <td
                        style={{
                          ...styles.td,
                          width: columnWidths.cutQuantity,
                          textAlign: 'right',
                          color: '#166534',
                          fontWeight: 700,
                        }}
                      >
                        {formatNumber(row.cutQuantity)}
                      </td>
                      <td
                        style={{
                          ...styles.td,
                          width: columnWidths.remainingQuantity,
                          textAlign: 'right',
                          color: row.remainingQuantity > 0 ? '#b91c1c' : '#166534',
                          fontWeight: 700,
                        }}
                      >
                        {formatNumber(row.remainingQuantity)}
                      </td>
                      <td style={{ ...styles.td, width: columnWidths.workOrderNos }}>
                        {row.workOrderNos.length > 0 ? row.workOrderNos.join(', ') : '-'}
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    height: '100%',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '10px 12px 12px',
    boxSizing: 'border-box',
    background: 'var(--fs-color-bg)',
    color: 'var(--fs-color-text)',
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  headerActions: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  actionButton: {
    border: '1px solid var(--fs-color-border-strong)',
    background: 'var(--fs-color-surface)',
    color: 'var(--fs-color-text)',
    borderRadius: '8px',
    padding: '7px 10px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  backLink: {
    display: 'inline-block',
    marginBottom: '8px',
    color: '#2563eb',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: 600,
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 800,
  },
  subtitle: {
    margin: '6px 0 0',
    color: 'var(--fs-color-text-muted)',
    fontSize: '13px',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: '10px',
  },
  summaryCard: {
    border: '1px solid var(--fs-color-border)',
    borderRadius: '12px',
    background: 'var(--fs-color-surface)',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  summaryLabel: {
    fontSize: '12px',
    color: 'var(--fs-color-text-muted)',
  },
  summaryValue: {
    fontSize: '20px',
    color: 'var(--fs-color-text)',
  },
  summaryMeta: {
    color: 'var(--fs-color-text-muted)',
    fontSize: '11px',
  },
  filterPanel: {
    border: '1px solid var(--fs-color-border)',
    borderRadius: '12px',
    background: 'var(--fs-color-surface)',
    padding: '10px',
  },
  filterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '8px',
  },
  searchInput: {
    width: '100%',
    border: '1px solid var(--fs-color-border-strong)',
    borderRadius: '10px',
    padding: '10px 12px',
    fontSize: '13px',
    background: 'var(--fs-color-surface)',
    color: 'var(--fs-color-text)',
    outline: 'none',
    boxSizing: 'border-box',
  },
  filterSelect: {
    width: '100%',
    border: '1px solid var(--fs-color-border-strong)',
    borderRadius: '10px',
    padding: '10px 12px',
    fontSize: '13px',
    background: 'var(--fs-color-surface)',
    color: 'var(--fs-color-text)',
    outline: 'none',
    boxSizing: 'border-box',
  },
  checkboxWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: '13px',
    color: 'var(--fs-color-text)',
    paddingLeft: 2,
  },
  clearFilterButton: {
    border: '1px solid var(--fs-color-border-strong)',
    borderRadius: '10px',
    background: 'var(--fs-color-surface-soft)',
    color: 'var(--fs-color-text)',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    padding: '10px 12px',
  },
  error: {
    border: '1px solid #fecaca',
    borderRadius: '12px',
    background: '#fef2f2',
    color: '#b91c1c',
    padding: '10px 12px',
    fontSize: '12px',
  },
  tableWrap: {
    flex: 1,
    minHeight: 0,
    border: '1px solid var(--fs-color-border)',
    borderRadius: '12px',
    background: 'var(--fs-color-surface)',
    overflow: 'auto',
  },
  groupHint: {
    borderBottom: '1px solid var(--fs-color-border)',
    padding: '8px 12px',
    fontSize: '11px',
    textAlign: 'center',
    color: 'var(--fs-color-text-muted)',
    background: 'var(--fs-color-surface-soft)',
    letterSpacing: 0.2,
  },
  groupHintActive: {
    background: '#dbeafe',
    color: '#1d4ed8',
  },
  groupChipWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  groupChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: '1px solid #93c5fd',
    borderRadius: 999,
    background: '#eff6ff',
    color: '#1d4ed8',
    padding: '3px 8px',
    fontWeight: 700,
  },
  groupChipRemove: {
    border: 'none',
    background: 'transparent',
    color: '#1d4ed8',
    cursor: 'pointer',
    fontSize: '12px',
    lineHeight: 1,
    padding: 0,
  },
  groupClearButton: {
    border: '1px solid #93c5fd',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#1d4ed8',
    padding: '3px 8px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '1000px',
    tableLayout: 'fixed',
  },
  th: {
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--fs-color-text-muted)',
    background: 'var(--fs-color-surface-soft)',
    borderBottom: '1px solid var(--fs-color-border)',
    padding: '10px',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    cursor: 'grab',
    position: 'relative',
  },
  thDragging: {
    opacity: 0.55,
  },
  resizeHandle: {
    position: 'absolute',
    right: -1,
    top: 0,
    bottom: 0,
    width: 9,
    cursor: 'col-resize',
    zIndex: 3,
  },
  trEven: {
    borderBottom: '1px solid var(--fs-color-border)',
    background: '#ffffff',
  },
  trOdd: {
    borderBottom: '1px solid var(--fs-color-border)',
    background: 'var(--fs-color-surface-soft)',
  },
  td: {
    fontSize: '12px',
    color: 'var(--fs-color-text)',
    padding: '10px',
    verticalAlign: 'top',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  groupRowCell: {
    borderBottom: '1px solid var(--fs-color-border)',
    background: '#eff6ff',
    color: '#1d4ed8',
    padding: '8px 10px',
    fontSize: '12px',
    fontWeight: 700,
  },
  empty: {
    padding: '24px',
    textAlign: 'center',
    color: 'var(--fs-color-text-muted)',
    fontSize: '13px',
  },
};
