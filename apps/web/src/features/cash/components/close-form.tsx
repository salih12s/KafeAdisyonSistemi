import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LockKeyhole } from 'lucide-react';
import { Panel } from '../../../shared/ui/panel';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import { TextField } from '../../../shared/ui/field';
import { useToast } from '../../../shared/ui/toast';
import { closeCashSession } from '../api';
import { parseLiraToKurus } from '../../../shared/lib/money-input';
import { errorMessage } from '../../../shared/lib/error-message';
import {
  CURRENT_KEY,
  HISTORY_KEY,
  INVALID_AMOUNT,
  differenceLabel,
  differenceTone,
} from '../cash-format';

export function CloseForm({ expectedCashKurus }: { expectedCashKurus: number }): JSX.Element {
  const client = useQueryClient();
  const { notify } = useToast();
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>();
  const countedKurus = parseLiraToKurus(counted);
  const close = useMutation({
    mutationFn: closeCashSession,
    onSuccess: (session) => {
      client.setQueryData(CURRENT_KEY, null);
      void client.invalidateQueries({ queryKey: HISTORY_KEY });
      notify(
        session.differenceKurus === null
          ? 'Kasa kapatıldı.'
          : `Kasa kapatıldı: ${differenceLabel(session.differenceKurus)}.`,
      );
    },
    onError: (failure) => setError(errorMessage(failure)),
  });
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (countedKurus === null) {
      setError(INVALID_AMOUNT);
      return;
    }
    setError(undefined);
    close.mutate({ countedCashKurus: countedKurus, note: note.trim() || null });
  };
  const preview = countedKurus === null ? null : countedKurus - expectedCashKurus;
  return (
    <Panel title="Vardiya sonu" variant="muted">
      <form aria-label="Kasa kapanış formu" className="grid gap-3 p-4" onSubmit={submit}>
        <TextField
          id="counted-cash"
          label="Sayılan nakit (₺)"
          inputMode="decimal"
          required
          value={counted}
          onChange={(event) => setCounted(event.target.value)}
          error={error}
        />
        {preview === null ? null : (
          <p className="flex items-center justify-between gap-2 text-sm" aria-live="polite">
            <span className="text-ink-secondary">Sayım farkı</span>
            <Badge tone={differenceTone(preview)}>{differenceLabel(preview)}</Badge>
          </p>
        )}
        <TextField
          id="closing-note"
          label="Kapanış notu"
          maxLength={250}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Fark varsa nedenini yazın"
        />
        <Button
          type="submit"
          variant="primary"
          loading={close.isPending}
          icon={<LockKeyhole aria-hidden="true" className="h-4 w-4" />}
        >
          Kasayı kapat
        </Button>
      </form>
    </Panel>
  );
}
