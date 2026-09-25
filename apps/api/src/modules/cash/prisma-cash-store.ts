import { Prisma, type PrismaClient } from '@prisma/client';
import type { CashSessionResponse } from '@kafe/contracts';
import { buildCashSession } from './cash-calculations';
import type { CashStore } from './cash-store';
import { StoreError } from '../../shared/store';
import { isUniqueConstraint, isSerializationConflict } from '../../shared/prisma-errors';

const SESSION_INCLUDE = {
  openedBy: { select: { fullName: true } },
  closedBy: { select: { fullName: true } },
  movements: { orderBy: { createdAt: 'desc' }, include: { actor: { select: { fullName: true } } } },
} satisfies Prisma.CashSessionInclude;

type SessionRow = Prisma.CashSessionGetPayload<{ include: typeof SESSION_INCLUDE }>;
type Reader = PrismaClient | Prisma.TransactionClient;

const transactionOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

/** Kapanış satır kilidiyle korunur; bkz. closeCashSession. */
const closeTransactionOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
} as const;

/** Oturum süresince alınan nakit ödemeler; açık oturumda şu ana kadar. */
async function cashSales(reader: Reader, from: Date, to: Date): Promise<number> {
  const result = await reader.payment.aggregate({
    where: { method: 'CASH', createdAt: { gte: from, lt: to } },
    _sum: { amountKurus: true },
  });
  return result._sum.amountKurus ?? 0;
}

async function toResponse(reader: Reader, row: SessionRow): Promise<CashSessionResponse> {
  // Kapanmış oturumun tutarı sabittir; ödemeler yeniden sorgulanmaz.
  const live = row.status === 'OPEN' ? await cashSales(reader, row.openedAt, new Date()) : 0;
  return buildCashSession(toSource(row), live);
}

async function requireOpenSession(transaction: Prisma.TransactionClient): Promise<SessionRow> {
  const row = await transaction.cashSession.findFirst({
    where: { status: 'OPEN' },
    include: SESSION_INCLUDE,
  });
  if (row === null) throw new StoreError('CONFLICT', 'Açık bir kasa oturumu yok.');
  return row;
}

async function withConflictMessage<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isSerializationConflict(error)) {
      throw new StoreError('CONFLICT', 'Kasa başka bir cihazda değişti; yeniden deneyin.');
    }
    throw error;
  }
}

export function createPrismaCashStore(client: PrismaClient): CashStore {
  return {
    async getCurrentCashSession() {
      const row = await client.cashSession.findFirst({
        where: { status: 'OPEN' },
        include: SESSION_INCLUDE,
      });
      return row === null ? null : toResponse(client, row);
    },

    async listClosedCashSessions(limit) {
      const rows = await client.cashSession.findMany({
        where: { status: 'CLOSED' },
        orderBy: { closedAt: 'desc' },
        take: limit,
        include: SESSION_INCLUDE,
      });
      return Promise.all(rows.map((row) => toResponse(client, row)));
    },

    async openCashSession(input) {
      try {
        return await client.$transaction(async (transaction) => {
          const created = await transaction.cashSession.create({
            data: {
              openedByUserId: input.actorUserId,
              openingCashKurus: input.openingCashKurus,
              openingNote: input.note,
            },
            include: SESSION_INCLUDE,
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'CASH_SESSION_OPENED',
              entityType: 'CashSession',
              entityId: created.id,
              metadata: { openingCashKurus: input.openingCashKurus },
            },
          });
          return toResponse(transaction, created);
        }, transactionOptions);
      } catch (error) {
        // CashSession_one_open_key: ikinci açık kasa veritabanında reddedilir.
        if (isUniqueConstraint(error)) {
          throw new StoreError('CONFLICT', 'Zaten açık bir kasa oturumu var.');
        }
        if (isSerializationConflict(error)) {
          throw new StoreError('CONFLICT', 'Kasa başka bir cihazda açıldı; sayfayı yenileyin.');
        }
        throw error;
      }
    },

    addCashMovement(input) {
      return withConflictMessage(() =>
        client.$transaction(async (transaction) => {
          const session = await requireOpenSession(transaction);
          const movement = await transaction.cashMovement.create({
            data: {
              sessionId: session.id,
              type: input.type,
              amountKurus: input.amountKurus,
              reason: input.reason,
              actorUserId: input.actorUserId,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'CASH_MOVEMENT_ADDED',
              entityType: 'CashSession',
              entityId: session.id,
              metadata: {
                movementId: movement.id,
                type: input.type,
                amountKurus: input.amountKurus,
              },
            },
          });
          const updated = await transaction.cashSession.findUniqueOrThrow({
            where: { id: session.id },
            include: SESSION_INCLUDE,
          });
          return toResponse(transaction, updated);
        }, transactionOptions),
      );
    },

    closeCashSession(input) {
      return withConflictMessage(() =>
        client.$transaction(async (transaction) => {
          // Açık kasa satırı özel kilitlenir. Nakit ödeme yazan işlemler aynı satırı
          // paylaşımlı kilitlediği için kapanış, yarım kalmış ödemelerin bitmesini
          // bekler; yeni nakit ödemeler de kapanış bitene kadar bekler. Read Committed
          // sayesinde bekleme sonrasındaki sorgular commit edilmiş ödemeleri görür.
          await transaction.$queryRaw`SELECT "id" FROM "CashSession" WHERE "status" = 'OPEN' FOR UPDATE`;
          const session = await requireOpenSession(transaction);
          const closedAt = new Date();
          // Beklenen tutar kapanış anında sabitlenir; sonraki ödemeler bu kasaya yazılmaz.
          const expected = buildCashSession(
            toSource(session),
            await cashSales(transaction, session.openedAt, closedAt),
          ).expectedCashKurus;
          const updated = await transaction.cashSession.updateMany({
            where: { id: session.id, status: 'OPEN' },
            data: {
              status: 'CLOSED',
              closedAt,
              closedByUserId: input.actorUserId,
              countedCashKurus: input.countedCashKurus,
              expectedCashKurus: expected,
              closingNote: input.note,
            },
          });
          if (updated.count !== 1) {
            throw new StoreError('CONFLICT', 'Kasa başka bir cihazda kapatıldı.');
          }
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'CASH_SESSION_CLOSED',
              entityType: 'CashSession',
              entityId: session.id,
              metadata: {
                expectedCashKurus: expected,
                countedCashKurus: input.countedCashKurus,
                differenceKurus: input.countedCashKurus - expected,
              },
            },
          });
          const closed = await transaction.cashSession.findUniqueOrThrow({
            where: { id: session.id },
            include: SESSION_INCLUDE,
          });
          return toResponse(transaction, closed);
        }, closeTransactionOptions),
      );
    },
  };
}

function toSource(row: SessionRow) {
  return {
    id: row.id,
    status: row.status,
    openedAt: row.openedAt,
    openedByName: row.openedBy.fullName,
    openingCashKurus: row.openingCashKurus,
    openingNote: row.openingNote,
    closedAt: row.closedAt,
    closedByName: row.closedBy?.fullName ?? null,
    countedCashKurus: row.countedCashKurus,
    expectedCashKurus: row.expectedCashKurus,
    closingNote: row.closingNote,
    movements: row.movements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      amountKurus: movement.amountKurus,
      reason: movement.reason,
      actorName: movement.actor.fullName,
      createdAt: movement.createdAt.toISOString(),
    })),
  };
}
