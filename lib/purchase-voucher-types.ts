export type VoucherMode = "B" | "R";

export type PurchaseVoucherType = {
  code: number;
  label: string;
  voucherMode: VoucherMode;
};

export const PURCHASE_VOUCHER_TYPES: PurchaseVoucherType[] = [
  { code: 1, label: "1-Mal Alim Faturasi", voucherMode: "B" },
  { code: 6, label: "6-Fasona Giris Faturasi", voucherMode: "B" },
  { code: 7, label: "7-Alinan Fiyat Farki Faturasi", voucherMode: "B" },
  { code: 9, label: "9-Mustahsil Faturasi", voucherMode: "B" },
  { code: 11, label: "11-Fason (Alinan) Giris Faturasi", voucherMode: "B" },
  { code: 22, label: "22-Alinan Hizmet Faturasi", voucherMode: "B" },
  { code: 28, label: "28-Konsinye Alis Faturasi", voucherMode: "B" },
  { code: 91, label: "91-Alinan Proforma Fatura", voucherMode: "B" },
  { code: 92, label: "92-Alinan Serbest Meslek Makbuzu", voucherMode: "B" },
  { code: 93, label: "93-Alinan Kur Farki Faturasi", voucherMode: "B" },
  { code: 94, label: "94-Alinan Vade Farki Faturasi", voucherMode: "B" },
  { code: 122, label: "122-Mal Alim Iade Faturasi", voucherMode: "R" },
  { code: 133, label: "133-Fason (Verilen) Giris Iade Faturasi", voucherMode: "R" },
  { code: 139, label: "139-Alinan Hizmet Iadesi", voucherMode: "R" },
];

export const DEFAULT_PURCHASE_VOUCHER_TYPE_CODE =
  PURCHASE_VOUCHER_TYPES.find((item) => item.code === 1)?.code ?? PURCHASE_VOUCHER_TYPES[0]?.code ?? 1;

export const DEFAULT_PURCHASE_VOUCHER_TYPE_LABEL =
  PURCHASE_VOUCHER_TYPES.find((item) => item.code === DEFAULT_PURCHASE_VOUCHER_TYPE_CODE)?.label ??
  "1-Mal Alim Faturasi";
