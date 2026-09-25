import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus } from 'lucide-react';
import { CASH_MOVEMENT_TYPE_LABELS, type CashMovementType } from '@kafe/contracts';
import { Panel } from '../../../shared/ui/panel';
import { Button } from '../../../shared/ui/button';
import { TextField } from '../../../shared/ui/field';
import { SegmentedControl } from '../../../shared/ui/segmented-control';
import { useToast } from '../../../shared/ui/toast';
import { addCashMovement } from '../api';
import { parseLiraToKurus } from '../../../shared/lib/money-input';
import { errorMessage } from '../../../shared/lib/error-message';
import { CURRENT_KEY, INVALID_AMOUNT } from '../cash-format';

export function MovementForm(): JSX.Element {
  const client = useQueryClient();
  const { notify } = useToast();
  const [type, setType] = useState<CashMovementType>('IN');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | undefined>();
  const add = useMutation({
    mutationFn: addCashMovement,
    onSuccess: (session) => {
      client.setQueryData(CURRENT_KEY, session);
      setAmount('');
      setReason('');
      notify('Kasa hareketi kaydedildi.');
    },
    onError: (failure) => setError(errorMessage(failure)),
  });
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const amountKurus = parseLiraToKurus(amount);
    if (amountKurus === null || amountKurus === 0) {
      setError(INVALID_AMOUNT);
      return;
    }
    setError(undefined);
    add.mutate({ type, amountKurus, reason: reason.trim() });
  };
  return (
    <Panel title="Nakit giriş / çıkış">
      <form aria-label="Kasa hareketi formu" className="grid gap-3 p-4" onSubmit={submit}>
        <SegmentedControl
          label="Hareket türü"
          value={type}
          onChange={setType}
          options={[
            { value: 'IN', label: CASH_MOVEMENT_TYPE_LABELS.IN },
            { value: 'OUT', label: CASH_MOVEMENT_TYPE_LABELS.OUT },
          ]}
        />
        <TextField
          id="movement-amount"
          label="Tutar (₺)"
          inputMode="decimal"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          error={error}
        />
        <TextField
          id="movement-reason"
          label="Açıklama"
          required
          minLength={3}
          maxLength={250}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={type === 'IN' ? 'Örn. bozuk para' : 'Örn. süt alımı'}
        />
        <Button
          type="submit"
          variant="secondary"
          loading={add.isPending}
          icon={
            type === 'IN' ? (
              <Plus aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Minus aria-hidden="true" className="h-4 w-4" />
            )
          }
        >
          Hareketi kaydet
        </Button>
      </form>
    </Panel>
  );
}
