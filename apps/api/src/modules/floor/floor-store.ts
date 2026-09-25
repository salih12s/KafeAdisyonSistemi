import type { CafeTableResponse, DiningAreaResponse, FloorPlanResponse } from '@kafe/contracts';

export interface AreaWriteInput {
  actorUserId: string;
  name: string;
  nameKey: string;
  sortOrder: number;
  isActive: boolean;
}

export interface TableWriteInput {
  actorUserId: string;
  areaId: string;
  name: string;
  nameKey: string;
  capacity: number | null;
  sortOrder: number;
  isActive: boolean;
}

/** Salon, masa ve yönetim masa planı kalıcılığı. */
export interface FloorStore {
  listAreas(includeInactive: boolean): Promise<DiningAreaResponse[]>;
  createArea(input: AreaWriteInput): Promise<DiningAreaResponse>;
  updateArea(id: string, input: AreaWriteInput): Promise<DiningAreaResponse>;
  listTables(areaId: string | undefined, includeInactive: boolean): Promise<CafeTableResponse[]>;
  createTable(input: TableWriteInput): Promise<CafeTableResponse>;
  updateTable(id: string, input: TableWriteInput): Promise<CafeTableResponse>;
  getFloorPlan(): Promise<FloorPlanResponse>;
}
