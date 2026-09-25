import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Landmark } from 'lucide-react';
import { Panel } from '../../../shared/ui/panel';
import { Button } from '../../../shared/ui/button';
import { TextField } from '../../../shared/ui/field';
import { useToast } from '../../../shared/ui/toast';
import { ApiError } from '../../../shared/api/http';
import { openCashSession } from '../api';
import { parseLiraToKurus } from '../../../shared/lib/money-input';
import { errorMessage } from '../../../shared/lib/error-message';
import { CURRENT_KEY, INVALID_AMOUNT } from '../cash-format';

export function OpenCashForm(): JSX.Element {
  const client = useQueryClient();
  const { notify } = useToast();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>();
  const open = useMutation({
    mutationFn: openCashSession,
    onSuccess: (session) => {
      client.setQueryData(CURRENT_KEY, session);
      notify('Kasa açıldı.');
    },
    onError: (failure) => {
      setError(errorMessage(failure));
      // Kasa başka cihazda açıldıysa ekran açık kasaya geçsin.
      if (failure instanceof ApiError && failure.statusCode === 409) {
        void client.invalidateQueries({ queryKey: CURRENT_KEY });
      }
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const openingCashKurus = parseLiraToKurus(amount);
    if (openingCashKurus === null) {
      setError(INVALID_AMOUNT);
      return;
    }
    setError(undefined);
    open.mutate({ openingCashKurus, note: note.trim() || null });
  };
  return (
    <Panel title="Kasa kapalı" variant="elevated">
      <form aria-label="Kasa açılış formu" className="grid gap-4 p-4 sm:p-5" onSubmit={submit}>
        <p className="max-w-xl text-sm text-ink-secondary">
          Vardiyaya başlarken çekmecedeki bozuk parayı sayın ve açılış tutarı olarak girin. Kasa
          açıkken alınan nakit ödemeler beklenen tutara otomatik eklenir.
        </p>
        <div className="grid gap-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
          <TextField
            id="opening-cash"
            label="Açılış nakdi (₺)"
            inputMode="decimal"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0,00"
            error={error}
          />
          <TextField
            id="opening-note"
            label="Not"
            value={note}
            maxLength={250}
            onChange={(event) => setNote(event.target.value)}
            placeholder="İsteğe bağlı"
          />
        </div>
        <div>
          <Button
            type="submit"
            loading={open.isPending}
            icon={<Landmark aria-hidden="true" className="h-4 w-4" />}
          >
            Kasayı aç
          </Button>
        </div>
      </form>
    </Panel>
  );
}
