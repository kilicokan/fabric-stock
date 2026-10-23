import { useMemo } from "react";
import { useRouter } from "next/router";
import CustomerOrderAddPage from "../customer-orders/add";

type SalesDocumentType = "INVOICE" | "DISPATCH";
type VoucherMode = "B" | "R";

type SalesDocumentFormPageProps = {
  initialOrderId?: number;
  initialFromOrderId?: number;
  initialDocumentType?: SalesDocumentType;
  initialVoucherMode?: VoucherMode;
  initialVoucherTypeCode?: number;
  initialVoucherTypeLabel?: string;
};

const normalizeDocumentType = (value: unknown): SalesDocumentType => {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "DISPATCH" ? "DISPATCH" : "INVOICE";
};

export default function SalesDocumentFormPage({
  initialOrderId,
  initialFromOrderId,
  initialDocumentType,
  initialVoucherMode,
  initialVoucherTypeCode,
  initialVoucherTypeLabel,
}: SalesDocumentFormPageProps) {
  const router = useRouter();

  const resolvedOrderId = useMemo(() => {
    if (typeof initialOrderId === "number" && Number.isInteger(initialOrderId) && initialOrderId > 0) {
      return initialOrderId;
    }

    const queryId = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
    const parsedId = Number(queryId);
    return Number.isInteger(parsedId) && parsedId > 0 ? parsedId : undefined;
  }, [initialOrderId, router.query.id]);

  const resolvedDocumentType = useMemo<SalesDocumentType>(() => {
    if (initialDocumentType) {
      return normalizeDocumentType(initialDocumentType);
    }
    const queryType = Array.isArray(router.query.type) ? router.query.type[0] : router.query.type;
    return normalizeDocumentType(queryType);
  }, [initialDocumentType, router.query.type]);

  const resolvedFromOrderId = useMemo<number | undefined>(() => {
    if (typeof initialFromOrderId === "number" && Number.isInteger(initialFromOrderId) && initialFromOrderId > 0) {
      return initialFromOrderId;
    }
    const queryOrderId = Array.isArray(router.query.fromOrderId)
      ? router.query.fromOrderId[0]
      : router.query.fromOrderId;
    const parsed = Number(queryOrderId);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  }, [initialFromOrderId, router.query.fromOrderId]);

  const resolvedVoucherMode = useMemo<VoucherMode>(() => {
    if (initialVoucherMode === "B" || initialVoucherMode === "R") {
      return initialVoucherMode;
    }
    const queryMode = Array.isArray(router.query.voucherMode)
      ? router.query.voucherMode[0]
      : router.query.voucherMode;
    return String(queryMode || "").toUpperCase() === "R" ? "R" : "B";
  }, [initialVoucherMode, router.query.voucherMode]);

  const resolvedVoucherTypeCode = useMemo<number | undefined>(() => {
    if (typeof initialVoucherTypeCode === "number" && Number.isInteger(initialVoucherTypeCode)) {
      return initialVoucherTypeCode;
    }
    const queryCode = Array.isArray(router.query.voucherTypeCode)
      ? router.query.voucherTypeCode[0]
      : router.query.voucherTypeCode;
    const parsed = Number(queryCode);
    return Number.isInteger(parsed) ? parsed : undefined;
  }, [initialVoucherTypeCode, router.query.voucherTypeCode]);

  const resolvedVoucherTypeLabel = useMemo<string>(() => {
    if (initialVoucherTypeLabel && initialVoucherTypeLabel.trim()) {
      return initialVoucherTypeLabel.trim();
    }
    const queryLabel = Array.isArray(router.query.voucherTypeLabel)
      ? router.query.voucherTypeLabel[0]
      : router.query.voucherTypeLabel;
    return String(queryLabel || "").trim();
  }, [initialVoucherTypeLabel, router.query.voucherTypeLabel]);

  return (
    <CustomerOrderAddPage
      initialOrderId={resolvedOrderId}
      initialFromOrderId={resolvedFromOrderId}
      initialDocumentType={resolvedDocumentType}
      initialVoucherMode={resolvedVoucherMode}
      initialVoucherTypeCode={resolvedVoucherTypeCode}
      initialVoucherTypeLabel={resolvedVoucherTypeLabel}
    />
  );
}
