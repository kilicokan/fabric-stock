export interface WorkOrder {
  id: string
  apiId?: number
  model: string
  name: string
  color: string
  customer: string
  qty: number
  deadline: string
  status: string
  colorDot?: string
  spreading?: string
  operations?: Operation[]
  createdAt: string
  updatedAt: string
  sewingNotes?: string | null
}

export interface Machine {
  id: string
  name: string
  status: string
  type: string
  cuttingTableId?: number
}

export interface Operator {
  id: string
  name: string
  role: string
  avatar?: string
}

export interface Operation {
  id: string
  workOrderId: string
  machineId: string
  operatorId: string
  type: string
  status: string
  startedAt?: string
  completedAt?: string
  notes?: string
  createdAt: string
  updatedAt: string
  workOrder?: WorkOrder
  machine?: Machine
  operator?: Operator
}
