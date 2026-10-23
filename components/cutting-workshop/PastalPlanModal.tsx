"use client";

import { useEffect, useState } from "react";
import type { PastalPlan, PastalPlanColor } from "../../lib/pastalPlan";

interface PastalPlanModalProps {
  open: boolean;
  initialPlan: PastalPlan | null;
  fallbackPlan: PastalPlan;
  colorVariants: string[];
  saving: boolean;
  onClose: () => void;
  onSave: (plan: PastalPlan) => void;
}

const createColorRow = (color = ""): PastalPlanColor => ({ color, layers: 1, weightKg: 0 });

export default function PastalPlanModal({
  open,
  initialPlan,
  fallbackPlan,
  colorVariants,
  saving,
  onClose,
  onSave,
}: PastalPlanModalProps) {
  const [plannedLayers, setPlannedLayers] = useState("");
  const [colors, setColors] = useState<PastalPlanColor[]>([]);

  useEffect(() => {
    if (!open) return;
    const plan = initialPlan || fallbackPlan;
    setPlannedLayers(String(plan.plannedLayers || ""));
    setColors(plan.colors.length ? plan.colors.map(color => ({ ...color })) : [createColorRow()]);
  }, [open, initialPlan, fallbackPlan]);

  if (!open) return null;

  const updateColor = (index: number, field: keyof PastalPlanColor, value: string) => {
    setColors(current => current.map((item, row) => {
      if (row !== index) return item;
      if (field === "color") return { ...item, color: value };
      if (field === "layers") return { ...item, layers: value === "" ? 0 : Number(value) };
      return { ...item, weightKg: value === "" ? 0 : Number(value) };
    }));
  };
  const valid = Number.isInteger(Number(plannedLayers)) &&
    Number(plannedLayers) > 0 &&
    colors.length > 0 &&
    new Set(colors.map(item => item.color.trim().toLocaleLowerCase("tr-TR"))).size === colors.length &&
    colors.every(item => item.color.trim() && Number.isInteger(item.layers) && item.layers > 0 &&
      Number.isFinite(item.weightKg) && item.weightKg >= 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <section
        aria-labelledby="pastal-plan-title"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-600 bg-slate-900 p-5 text-slate-100 shadow-2xl"
        role="dialog"
      >
        <header className="mb-5">
          <h2 className="text-xl font-semibold" id="pastal-plan-title">Pastal Planı</h2>
          <p className="mt-1 text-sm text-slate-400">Renk sırası, kat ve hedef kumaş miktarını girin.</p>
        </header>
        <label className="mb-4 block text-sm font-medium">
          Plan kat
          <input
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
            min="1"
            step="1"
            type="number"
            value={plannedLayers}
            onChange={event => setPlannedLayers(event.target.value)}
          />
        </label>
        <div className="space-y-3">
          {colors.map((item, index) => (
            <div className="grid grid-cols-[1fr_90px_110px_36px] items-end gap-2" key={index}>
              <label className="text-sm font-medium">
                Renk {index + 1}
                <input
                  className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
                  list={`pastal-colors-${index}`}
                  value={item.color}
                  onChange={event => updateColor(index, "color", event.target.value)}
                />
                <datalist id={`pastal-colors-${index}`}>
                  {colorVariants.map(color => <option key={color} value={color} />)}
                </datalist>
              </label>
              <label className="text-sm font-medium">
                Kat
                <input
                  className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-2"
                  min="1"
                  step="1"
                  type="number"
                  value={item.layers || ""}
                  onChange={event => updateColor(index, "layers", event.target.value)}
                />
              </label>
              <label className="text-sm font-medium">
                Kg
                <input
                  className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-2"
                  min="0"
                  step="0.01"
                  type="number"
                  value={item.weightKg}
                  onChange={event => updateColor(index, "weightKg", event.target.value)}
                />
              </label>
              <button
                aria-label={`Renk ${index + 1} satırını kaldır`}
                className="mb-1 rounded-md px-2 py-2 text-red-300 hover:bg-slate-800"
                disabled={colors.length === 1}
                onClick={() => setColors(current => current.filter((_, row) => row !== index))}
                type="button"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          className="mt-4 rounded-md border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800"
          onClick={() => setColors(current => [...current, createColorRow(colorVariants.find(color => !current.some(row => row.color === color)) || "")])}
          type="button"
        >
          + Renk ekle
        </button>
        <footer className="mt-6 flex justify-end gap-3">
          <button className="rounded-md border border-slate-600 px-4 py-2" disabled={saving} onClick={onClose} type="button">
            Vazgeç
          </button>
          <button
            className="rounded-md bg-indigo-600 px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!valid || saving}
            onClick={() => onSave({
              plannedLayers: Number(plannedLayers),
              colors: colors.map(item => ({ ...item, color: item.color.trim() })),
              source: "manual",
              updatedAt: new Date().toISOString(),
            })}
            type="button"
          >
            {saving ? "Kaydediliyor..." : "Planı Kaydet"}
          </button>
        </footer>
      </section>
    </div>
  );
}
