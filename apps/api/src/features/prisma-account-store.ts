import { Prisma, type PrismaClient } from '@prisma/client';
import type {
  AccountEntryResponse,
  CustomerResponse,
  CustomerStatementResponse,
} from '@kafe/contracts';
import { StoreError, type AccountStore } from './store';
import { createPrismaOrderStore } from './prisma-order-store';

const transactionOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

function signedAmount(
  type: 'DEBT' | 'COLLECTION' | 'REFUND' | 'CORRECTION',
  amount: number,
): number {
  return type === 'DEBT' || type === 'REFUND' ? amount : -amount;
}

export function createPrismaAccountStore(client: PrismaClient): AccountStore {
  const balance = async (customerId: string): Promise<number> => {
    const entries = await client.accountEntry.findMany({
      where: { customerId },
      select: { type: true, amountKurus: true },
    });
    return entries.reduce((total, entry) => total + signedAmount(entry.type, entry.amountKurus), 0);
  };
  const customer = async (id: string): Promise<CustomerStatementResponse> => {
    const row = await client.customer.findUnique({
      where: { id },
      include: { entries: { orderBy: { createdAt: 'desc' }, include: { actor: true } } },
    });
    if (row === null) throw new StoreError('NOT_FOUND', 'Müşteri bulunamadı.');
    const entries: AccountEntryResponse[] = row.entries.map((entry) => ({
      id: entry.id,
      customerId: entry.customerId,
      type: entry.type,
      amountKurus: entry.amountKurus,
      description: entry.description,
      checkId: entry.checkId,
      actorUserId: entry.actorUserId,
      actorName: entry.actor.fullName,
      createdAt: entry.createdAt.toISOString(),
    }));
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      note: row.note,
      isActive: row.isActive,
      balanceKurus: entries.reduce(
        (total, entry) => total + signedAmount(entry.type, entry.amountKurus),
        0,
      ),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      entries,
    };
  };
  const summary = async (row: {
    id: string;
    name: string;
    phone: string | null;
    note: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<CustomerResponse> => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    note: row.note,
    isActive: row.isActive,
    balanceKurus: await balance(row.id),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
  return {
    async listCustomers(search): Promise<CustomerResponse[]> {
      const rows = await client.customer.findMany({
        where:
          search === undefined
            ? {}
            : {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { phone: { contains: search } },
                ],
              },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      });
      return Promise.all(rows.map(summary));
    },
    getCustomer: customer,
    async createCustomer(input): Promise<CustomerResponse> {
      const row = await client.$transaction(async (tx) => {
        const created = await tx.customer.create({
          data: {
            name: input.name,
            phone: input.phone,
            note: input.note,
            isActive: input.isActive,
          },
        });
        await tx.auditLog.create({
          data: {
            actorUserId: input.actorUserId,
            action: 'CUSTOMER_CREATED',
            entityType: 'Customer',
            entityId: created.id,
          },
        });
        return created;
      });
      return summary(row);
    },
    async updateCustomer(id, input): Promise<CustomerResponse> {
      try {
        const row = await client.$transaction(async (tx) => {
          const updated = await tx.customer.update({
            where: { id },
            data: {
              name: input.name,
              phone: input.phone,
              note: input.note,
              isActive: input.isActive,
            },
          });
          await tx.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'CUSTOMER_UPDATED',
              entityType: 'Customer',
              entityId: id,
            },
          });
          return updated;
        });
        return summary(row);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new StoreError('NOT_FOUND', 'Müşteri bulunamadı.');
        }
        throw error;
      }
    },
    async addAccountEntry(input): Promise<CustomerStatementResponse> {
      await client.$transaction(async (tx) => {
        const row = await tx.customer.findUnique({ where: { id: input.customerId } });
        if (row === null || !row.isActive) {
          throw new StoreError('CONFLICT', 'Aktif müşteri bulunamadı.');
        }
        const created = await tx.accountEntry.create({ data: input });
        await tx.auditLog.create({
          data: {
            actorUserId: input.actorUserId,
            action: input.type === 'COLLECTION' ? 'ACCOUNT_COLLECTION' : 'ACCOUNT_ENTRY_CREATED',
            entityType: 'AccountEntry',
            entityId: created.id,
            metadata: {
              customerId: input.customerId,
              type: input.type,
              amountKurus: input.amountKurus,
            },
          },
        });
      }, transactionOptions);
      return customer(input.customerId);
    },
    async transferCheckToAccount(input) {
      try {
        await client.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Check" WHERE "id" = ${input.checkId}::uuid FOR UPDATE`;
          const [check, customerRow] = await Promise.all([
            tx.check.findUnique({ where: { id: input.checkId }, include: { payments: true } }),
            tx.customer.findUnique({ where: { id: input.customerId } }),
          ]);
          if (check === null) throw new StoreError('NOT_FOUND', 'Adisyon bulunamadı.');
          if (check.status !== 'OPEN') throw new StoreError('CONFLICT', 'Bu adisyon açık değil.');
          if (customerRow === null || !customerRow.isActive) {
            throw new StoreError('CONFLICT', 'Aktif müşteri bulunamadı.');
          }
          const paid = check.payments.reduce((sum, payment) => sum + payment.amountKurus, 0);
          const remaining = check.totalKurus - paid;
          if (remaining <= 0) {
            throw new StoreError('CONFLICT', 'Cariye aktarılacak bakiye bulunmuyor.');
          }
          const entry = await tx.accountEntry.create({
            data: {
              customerId: input.customerId,
              type: 'DEBT',
              amountKurus: remaining,
              description: `Adisyon borcu`,
              checkId: check.id,
              actorUserId: input.actorUserId,
            },
          });
          await tx.payment.create({
            data: {
              checkId: check.id,
              method: 'ACCOUNT',
              amountKurus: remaining,
              receivedByUserId: input.actorUserId,
            },
          });
          await tx.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'CHECK_TRANSFERRED_TO_ACCOUNT',
              entityType: 'AccountEntry',
              entityId: entry.id,
              metadata: { checkId: check.id, customerId: input.customerId, amountKurus: remaining },
            },
          });
        }, transactionOptions);
        const check = await createPrismaOrderStore(client).getCheck(input.checkId);
        const entry = (await customer(input.customerId)).entries.find(
          (candidate) => candidate.checkId === input.checkId && candidate.type === 'DEBT',
        );
        if (entry === undefined) throw new StoreError('CONFLICT', 'Cari aktarım kaydı okunamadı.');
        return check;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
          throw new StoreError('CONFLICT', 'Adisyon veya cari değişti; yeniden deneyin.');
        }
        throw error;
      }
    },
  };
}
