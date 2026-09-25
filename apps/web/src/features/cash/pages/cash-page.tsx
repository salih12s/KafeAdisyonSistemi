import { useQuery } from '@tanstack/react-query';
import { Landmark } from 'lucide-react';
import { formatKurus } from '@kafe/contracts';
import { Panel } from '../../../shared/ui/panel';
import { Badge } from '../../../shared/ui/badge';
import { EmptyState } from '../../../shared/ui/empty-state';
import { ErrorState } from '../../../shared/ui/error-state';
import { fetchCashSessions, fetchCurrentCashSession } from '../api';
import { formatDateTime } from '../../../shared/lib/datetime';
import { errorMessage } from '../../../shared/lib/error-message';
import { CURRENT_KEY, HISTORY_KEY, differenceLabel, differenceTone } from '../cash-format';
import { OpenCashForm } from '../components/open-cash-form';
import { OpenSession } from '../components/open-session';

export function CashPage(): JSX.Element {
  const current = useQuery({
    queryKey: CURRENT_KEY,
    queryFn: fetchCurrentCashSession,
    // Nakit ödemeler başka cihazlardan gelir; beklenen tutar düzenli yenilenir.
    refetchInterval: 30_000,
  });
  const history = useQuery({ queryKey: HISTORY_KEY, queryFn: fetchCashSessions });

  return (
    <div className="space-y-5">
      {current.isError ? (
        <ErrorState
          title="Kasa bilgisi alınamadı"
          description={errorMessage(current.error)}
          onRetry={() => void current.refetch()}
        />
      ) : current.isPending ? (
        <p className="text-sm text-ink-muted">Kasa yükleniyor…</p>
      ) : current.data === null ? (
        <OpenCashForm />
      ) : (
        <OpenSession session={current.data} />
      )}

      <Panel title="Kapanmış kasalar" meta={`Son ${history.data?.length ?? 0} vardiya`}>
        {history.data === undefined || history.data.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="Henüz kapanmış kasa yok"
            description="Kapatılan her vardiya burada beklenen, sayılan tutar ve farkıyla listelenir."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-secondary">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 font-semibold">Kapanış</th>
                  <th className="px-4 py-3 font-semibold">Açan / kapatan</th>
                  <th className="px-4 py-3 text-right font-semibold">Beklenen</th>
                  <th className="px-4 py-3 text-right font-semibold">Sayılan</th>
                  <th className="px-4 py-3 text-right font-semibold">Fark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {history.data.map((session) => (
                  <tr key={session.id}>
                    <td className="px-4 py-3">
                      {session.closedAt === null ? '—' : formatDateTime(session.closedAt)}
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">
                      {session.openedByName} / {session.closedByName ?? '—'}
                    </td>
                    <td className="tabular px-4 py-3 text-right">
                      {formatKurus(session.expectedCashKurus)}
                    </td>
                    <td className="tabular px-4 py-3 text-right">
                      {session.countedCashKurus === null
                        ? '—'
                        : formatKurus(session.countedCashKurus)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {session.differenceKurus === null ? (
                        '—'
                      ) : (
                        <Badge tone={differenceTone(session.differenceKurus)}>
                          {differenceLabel(session.differenceKurus)}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
