"use client"

import React, { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Minus, Share2, Printer, Mail, MessageCircle } from "lucide-react"

export interface ChecklistItem {
  text: string
  checkedBy?: string
  checkedAt?: string
}

export interface SewingNotesData {
  modelInfo: {
    modelNo: string
    modelName: string
    fabricContent: string
    washingInstruction: string
    weightMeter: string
    threadNote: string
    productImage?: string
    productCode?: string
    productName?: string
  }
  checklist: ChecklistItem[]
  sizeChart: { size: string; chest: string; waist: string; hip: string; length: string }[]
  generalNotes: string
}

export const defaultSewingNotes = (): SewingNotesData => ({
  modelInfo: {
    modelNo: "",
    modelName: "",
    fabricContent: "",
    washingInstruction: "",
    weightMeter: "",
    threadNote: "",
    productImage: "",
    productCode: "",
    productName: "",
  },
  checklist: [
    { text: "YAKA BİYESİNİN ESNEMEMESİ" },
    { text: "ADIM AYARLARI AÇIK OLMAYACAK" },
    { text: "YIKAMA TALİMATI" },
    { text: "İPLİK TEMİZLEME" },
    { text: "SAĞ SOL KOL EŞİTLİĞİ" },
  ],
  sizeChart: [
    { size: "S", chest: "", waist: "", hip: "", length: "" },
    { size: "M", chest: "", waist: "", hip: "", length: "" },
    { size: "L", chest: "", waist: "", hip: "", length: "" },
    { size: "XL", chest: "", waist: "", hip: "", length: "" },
  ],
  generalNotes: "",
})

interface Props {
  value?: SewingNotesData
  onChange?: (data: SewingNotesData) => void
  readOnly?: boolean
  currentUser?: string
  productImage?: string
  productCode?: string
  productName?: string
}

export default function SewingInstruction({ value, onChange, readOnly = false, currentUser = "admin", productImage, productCode, productName }: Props) {
  const [internal, setInternal] = useState<SewingNotesData>(() => {
    const initial = value ?? defaultSewingNotes();
    return {
      ...initial,
      checklist: Array.isArray(initial.checklist)
        ? initial.checklist.map((item) => {
            if (typeof item === "string") return { text: item };
            if (item && typeof item === "object") {
              const obj = item as { text?: unknown; checkedBy?: unknown; checkedAt?: unknown };
              return {
                text: typeof obj.text === "string" ? obj.text : "",
                checkedBy: typeof obj.checkedBy === "string" ? obj.checkedBy : undefined,
                checkedAt: typeof obj.checkedAt === "string" ? obj.checkedAt : undefined,
              };
            }
            return { text: "" };
          })
        : [],
    };
  });
  const [showPreview, setShowPreview] = useState(false)

  const rawData = value ?? internal
  const normalizeData = (d: SewingNotesData): SewingNotesData => ({
    ...d,
    checklist: Array.isArray(d.checklist)
      ? d.checklist.map((item) => {
          if (typeof item === "string") return { text: item };
          if (item && typeof item === "object") {
            const obj = item as { text?: unknown; checkedBy?: unknown; checkedAt?: unknown };
            return {
              text: typeof obj.text === "string" ? obj.text : "",
              checkedBy: typeof obj.checkedBy === "string" ? obj.checkedBy : undefined,
              checkedAt: typeof obj.checkedAt === "string" ? obj.checkedAt : undefined,
            };
          }
          return { text: "" };
        })
      : [],
  });
  const data = value ? normalizeData(rawData) : rawData
  const update = (next: SewingNotesData) => {
    if (!value) setInternal(next)
    onChange?.(next)
  }

  const modelImage = productImage || data.modelInfo.productImage
  const modelCode = productCode || data.modelInfo.productCode || data.modelInfo.modelNo
  const modelName = productName || data.modelInfo.productName || data.modelInfo.modelName

  const setModelInfo = (field: keyof SewingNotesData["modelInfo"], val: string) =>
    update({ ...data, modelInfo: { ...data.modelInfo, [field]: val } })

  const toggleCheckItem = (i: number) => {
    const c = [...data.checklist]
    const item = c[i]
    if (item.checkedBy) {
      c[i] = { ...item, checkedBy: undefined, checkedAt: undefined }
    } else {
      c[i] = { ...item, checkedBy: currentUser, checkedAt: new Date().toLocaleString("tr-TR") }
    }
    update({ ...data, checklist: c })
  }

  const updateChecklist = (i: number, val: string) => {
    const c = [...data.checklist]
    c[i] = { ...c[i], text: val }
    update({ ...data, checklist: c })
  }
  const addChecklist = () => update({ ...data, checklist: [...data.checklist, { text: "" }] })
  const removeChecklist = (i: number) =>
    update({ ...data, checklist: data.checklist.filter((_, idx) => idx !== i) })

  const updateSize = (i: number, field: keyof SewingNotesData["sizeChart"][0], val: string) => {
    const rows = data.sizeChart.map((r, idx) => (idx === i ? { ...r, [field]: val } : r))
    update({ ...data, sizeChart: rows })
  }
  const addSizeRow = () =>
    update({ ...data, sizeChart: [...data.sizeChart, { size: "", chest: "", waist: "", hip: "", length: "" }] })
  const removeSizeRow = (i: number) =>
    update({ ...data, sizeChart: data.sizeChart.filter((_, idx) => idx !== i) })

  const handleShareWhatsApp = () => {
    const text = `${modelCode} - ${modelName}\n\nDikim Talimatları:\n${data.checklist.map((item, i) => `${item.checkedBy ? "[✓]" : "[ ]"} ${item.text}${item.checkedBy ? ` (${item.checkedBy} - ${item.checkedAt})` : ""}`).join("\n")}\n\n${data.generalNotes}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank")
  }

  const handleShareEmail = () => {
    const subject = `Dikim Talimatı - ${modelCode} ${modelName}`
    const body = `${modelCode} - ${modelName}\n\nDikim Talimatları:\n${data.checklist.map((item, i) => `${item.checkedBy ? "[✓]" : "[ ]"} ${item.text}${item.checkedBy ? ` (${item.checkedBy} - ${item.checkedAt})` : ""}`).join("\n")}\n\nGenel Notlar:\n${data.generalNotes}`
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank")
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
{/* Paylaşım ve Baskı Araçları */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setShowPreview(true)} variant="outline" size="sm" className="gap-1">
          <Share2 className="h-3 w-3" /> Önizle ve Paylaş
        </Button>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => {
          const text = data.checklist.map((item, i) => `${item.checkedBy ? "[✓]" : "[ ]"} ${item.text}${item.checkedBy ? ` (${item.checkedBy} - ${item.checkedAt})` : ""}`).join("\n");
          navigator.clipboard.writeText(text);
        }}>
          <Share2 className="h-3 w-3" /> Kopyala
        </Button>
      </div>

      {/* Önizleme Modalı */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">Dikim Talimatı Önizleme</h2>
              <button onClick={() => setShowPreview(false)} className="text-slate-500 hover:text-slate-800 text-xl">&times;</button>
            </div>

            {modelImage && (
              <div className="mb-4">
                <img src={modelImage} alt={modelName} className="max-h-40 object-contain rounded border border-slate-200" />
              </div>
            )}
            <p className="text-sm font-bold text-slate-700 mb-2">{modelCode} - {modelName}</p>

            <h3 className="text-sm font-semibold text-slate-700 mb-2">Kontrol Edilecekler</h3>
            <div className="space-y-1 mb-4">
              {data.checklist.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className={item.checkedBy ? "text-green-600" : "text-slate-400"}>
                    {item.checkedBy ? "☑" : "☐"}
                  </span>
                  <span className={item.checkedBy ? "line-through text-slate-500" : ""}>{item.text}</span>
                  {item.checkedBy && (
                    <span className="text-xs text-slate-400">Kontrol edildi ({item.checkedBy}) - {item.checkedAt}</span>
                  )}
                </div>
              ))}
            </div>

            {data.generalNotes && (
              <>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Genel Notlar</h3>
                <p className="text-sm text-slate-600 mb-4 whitespace-pre-wrap">{data.generalNotes}</p>
              </>
            )}

            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-200">
              <Button onClick={handleShareWhatsApp} variant="outline" size="sm">
                <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
              </Button>
              <Button onClick={handleShareEmail} variant="outline" size="sm">
                <Mail className="h-3 w-3 mr-1" /> E-posta
              </Button>
              <Button onClick={handlePrint} variant="outline" size="sm">
                <Printer className="h-3 w-3 mr-1" /> Yazdır
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                const text = data.checklist.map((item, i) => `${item.checkedBy ? "[✓]" : "[ ]"} ${item.text}${item.checkedBy ? ` (${item.checkedBy} - ${item.checkedAt})` : ""}`).join("\n");
                navigator.clipboard.writeText(text);
              }}>
                <Share2 className="h-3 w-3 mr-1" /> Kopyala
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Ürün Görseli */}
      {modelImage && (
        <div className="rounded-lg border border-slate-200 p-3 flex items-center gap-4 bg-white">
          <img src={modelImage} alt={modelName} className="h-20 w-20 object-contain rounded border border-slate-200" />
          <div>
            <p className="font-semibold text-sm text-slate-800">{modelCode} - {modelName}</p>
            <p className="text-xs text-slate-500">Ürün görseli</p>
          </div>
        </div>
      )}

      {/* Model Bilgileri */}
      <div className="rounded-lg border border-slate-200 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Model Bilgileri</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["modelNo", "Model No"],
              ["modelName", "Model İsmi"],
              ["fabricContent", "Kumaş İçeriği"],
              ["washingInstruction", "Yıkama Talimatı"],
              ["weightMeter", "Gramaj & Metre"],
            ] as [keyof SewingNotesData["modelInfo"], string][]
          ).map(([field, label]) => (
            <div key={field}>
              <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
              <Input
                value={data.modelInfo[field]}
                onChange={(e) => setModelInfo(field, e.target.value)}
                disabled={readOnly}
                className="text-sm"
              />
            </div>
          ))}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">İplik Notu</label>
            <Textarea
              value={data.modelInfo.threadNote}
              onChange={(e) => setModelInfo("threadNote", e.target.value)}
              disabled={readOnly}
              rows={2}
              className="text-sm"
            />
          </div>
        </div>
      </div>

      {/* Ölçü Tablosu */}
      <div className="rounded-lg border border-slate-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Ölçü Tablosu</h3>
          {!readOnly && (
            <Button onClick={addSizeRow} size="sm" variant="outline">
              <Plus className="mr-1 h-3 w-3" /> Beden Ekle
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="border border-slate-200 px-3 py-2 text-left">Beden</th>
                <th className="border border-slate-200 px-3 py-2 text-left">Göğüs (cm)</th>
                <th className="border border-slate-200 px-3 py-2 text-left">Bel (cm)</th>
                <th className="border border-slate-200 px-3 py-2 text-left">Kalça (cm)</th>
                <th className="border border-slate-200 px-3 py-2 text-left">Boy (cm)</th>
                {!readOnly && <th className="border border-slate-200 px-2 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {data.sizeChart.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  {(["size", "chest", "waist", "hip", "length"] as const).map((field) => (
                    <td key={field} className="border border-slate-200 px-2 py-1">
                      <Input
                        value={row[field]}
                        onChange={(e) => updateSize(i, field, e.target.value)}
                        disabled={readOnly}
                        className="h-7 border-none p-0 text-sm focus:ring-0"
                      />
                    </td>
                  ))}
                  {!readOnly && (
                    <td className="border border-slate-200 px-2 py-1">
                      <Button onClick={() => removeSizeRow(i)} size="sm" variant="ghost" className="h-6 w-6 p-0">
                        <Minus className="h-3 w-3" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Kontrol Listesi */}
      <div className="rounded-lg border border-slate-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Kontrol Edilecekler</h3>
          {!readOnly && (
            <Button onClick={addChecklist} size="sm" variant="outline">
              <Plus className="mr-1 h-3 w-3" /> Ekle
            </Button>
          )}
        </div>
        <div className="space-y-1">
          {data.checklist.map((item, i) => (
            <div key={i} className="flex items-center gap-2 rounded border border-slate-200 px-3 py-1.5">
              <input
                type="checkbox"
                checked={!!item.checkedBy}
                onChange={() => !readOnly && toggleCheckItem(i)}
                disabled={readOnly}
                className="h-4 w-4 rounded border-slate-400 text-blue-600 focus:ring-blue-500"
              />
              <Input
                value={item.text}
                onChange={(e) => updateChecklist(i, e.target.value)}
                disabled={readOnly}
                className="h-6 flex-1 border-none p-0 text-xs focus:ring-0"
              />
              {item.checkedBy && (
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  Kontrol edildi ({item.checkedBy}) - {item.checkedAt}
                </span>
              )}
              {!readOnly && (
                <Button onClick={() => removeChecklist(i)} size="sm" variant="ghost" className="h-5 w-5 p-0">
                  <Minus className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Genel Notlar */}
      <div className="rounded-lg border border-slate-200 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Genel Notlar</h3>
        <Textarea
          value={data.generalNotes}
          onChange={(e) => update({ ...data, generalNotes: e.target.value })}
          disabled={readOnly}
          rows={4}
          placeholder="Atölyeye iletilecek özel notlar..."
          className="text-sm"
        />
      </div>
    </div>
  )
}
