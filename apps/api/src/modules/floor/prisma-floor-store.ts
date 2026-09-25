import type { PrismaClient } from '@prisma/client';
import type { CafeTableResponse, DiningAreaResponse, FloorPlanResponse } from '@kafe/contracts';
import { StoreError } from '../../shared/store';
import { isUniqueConstraint, isMissingRecord } from '../../shared/prisma-errors';
import type { FloorStore, AreaWriteInput, TableWriteInput } from './floor-store';

/** Salon, masa ve masa planının Prisma uygulaması. */
export function createPrismaFloorStore(client: PrismaClient): FloorStore {
  return {
    async listAreas(includeInactive: boolean): Promise<DiningAreaResponse[]> {
      const areas = await client.diningArea.findMany({
        where: includeInactive ? {} : { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
      return areas.map(({ id, name, sortOrder, isActive }) => ({ id, name, sortOrder, isActive }));
    },

    async createArea(input: AreaWriteInput): Promise<DiningAreaResponse> {
      try {
        const area = await client.$transaction(async (transaction) => {
          const created = await transaction.diningArea.create({
            data: {
              name: input.name,
              nameKey: input.nameKey,
              sortOrder: input.sortOrder,
              isActive: input.isActive,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'AREA_CREATED',
              entityType: 'DiningArea',
              entityId: created.id,
              metadata: { name: created.name },
            },
          });
          return created;
        });
        return { id: area.id, name: area.name, sortOrder: area.sortOrder, isActive: area.isActive };
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new StoreError('CONFLICT', 'Bu salon adı zaten kullanılıyor.');
        }
        throw error;
      }
    },

    async updateArea(id: string, input: AreaWriteInput): Promise<DiningAreaResponse> {
      try {
        const area = await client.$transaction(async (transaction) => {
          const updated = await transaction.diningArea.update({
            where: { id },
            data: {
              name: input.name,
              nameKey: input.nameKey,
              sortOrder: input.sortOrder,
              isActive: input.isActive,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'AREA_UPDATED',
              entityType: 'DiningArea',
              entityId: updated.id,
              metadata: { name: updated.name, isActive: updated.isActive },
            },
          });
          return updated;
        });
        return { id: area.id, name: area.name, sortOrder: area.sortOrder, isActive: area.isActive };
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new StoreError('CONFLICT', 'Bu salon adı zaten kullanılıyor.');
        }
        if (isMissingRecord(error)) throw new StoreError('NOT_FOUND', 'Salon bulunamadı.');
        throw error;
      }
    },

    async listTables(areaId, includeInactive): Promise<CafeTableResponse[]> {
      const tables = await client.cafeTable.findMany({
        where: {
          ...(areaId === undefined ? {} : { areaId }),
          ...(includeInactive ? {} : { isActive: true }),
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
      return tables.map(({ id, areaId: tableAreaId, name, capacity, sortOrder, isActive }) => ({
        id,
        areaId: tableAreaId,
        name,
        capacity,
        sortOrder,
        isActive,
      }));
    },

    async createTable(input: TableWriteInput): Promise<CafeTableResponse> {
      try {
        const table = await client.$transaction(async (transaction) => {
          const area = await transaction.diningArea.findUnique({ where: { id: input.areaId } });
          if (area === null) throw new StoreError('NOT_FOUND', 'Salon bulunamadı.');
          const created = await transaction.cafeTable.create({
            data: {
              areaId: input.areaId,
              name: input.name,
              nameKey: input.nameKey,
              capacity: input.capacity,
              sortOrder: input.sortOrder,
              isActive: input.isActive,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'TABLE_CREATED',
              entityType: 'CafeTable',
              entityId: created.id,
              metadata: { name: created.name, areaId: created.areaId },
            },
          });
          return created;
        });
        return {
          id: table.id,
          areaId: table.areaId,
          name: table.name,
          capacity: table.capacity,
          sortOrder: table.sortOrder,
          isActive: table.isActive,
        };
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new StoreError('CONFLICT', 'Bu salonda aynı masa adı zaten kullanılıyor.');
        }
        throw error;
      }
    },

    async updateTable(id: string, input: TableWriteInput): Promise<CafeTableResponse> {
      try {
        const table = await client.$transaction(async (transaction) => {
          const area = await transaction.diningArea.findUnique({ where: { id: input.areaId } });
          if (area === null) throw new StoreError('NOT_FOUND', 'Salon bulunamadı.');
          const updated = await transaction.cafeTable.update({
            where: { id },
            data: {
              areaId: input.areaId,
              name: input.name,
              nameKey: input.nameKey,
              capacity: input.capacity,
              sortOrder: input.sortOrder,
              isActive: input.isActive,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'TABLE_UPDATED',
              entityType: 'CafeTable',
              entityId: updated.id,
              metadata: { name: updated.name, areaId: updated.areaId, isActive: updated.isActive },
            },
          });
          return updated;
        });
        return {
          id: table.id,
          areaId: table.areaId,
          name: table.name,
          capacity: table.capacity,
          sortOrder: table.sortOrder,
          isActive: table.isActive,
        };
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new StoreError('CONFLICT', 'Bu salonda aynı masa adı zaten kullanılıyor.');
        }
        if (isMissingRecord(error)) throw new StoreError('NOT_FOUND', 'Masa bulunamadı.');
        throw error;
      }
    },

    async getFloorPlan(): Promise<FloorPlanResponse> {
      const areas = await client.diningArea.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          tables: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
        },
      });
      return {
        areas: areas.map((area) => ({
          id: area.id,
          name: area.name,
          sortOrder: area.sortOrder,
          tables: area.tables.map((table) => ({
            id: table.id,
            name: table.name,
            capacity: table.capacity,
            sortOrder: table.sortOrder,
          })),
        })),
      };
    },
  };
}
