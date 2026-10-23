export interface WorkOrder {
  id: string;
  modelCode: string;
  customer: string;
  targetLayers: number;
  fabricType: string;
  status: "Bekliyor" | "Devam Ediyor" | "Tamamlandı";
}

export interface DefectLog {
  id: number;
  photo: string | null;
  note: string;
  time: string;
}

export type StepType = "select" | "spread" | "scale" | "report" | "complete";
export type AudioType = "success" | "error" | "scale" | "click";
