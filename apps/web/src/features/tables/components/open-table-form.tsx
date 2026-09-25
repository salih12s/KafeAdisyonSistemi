import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../../shared/api/http';
import { openTableCheck } from '../../orders/api';
import { Button } from '../../../shared/ui/button';
import { TextField } from '../../../shared/ui/field';
import type { OperationalTable } from '../tables-format';

export function OpenTableForm({
  table,
  onOpened,
  onClose,
}: {
  table: OperationalTable;
  onOpened: (checkId: string) => void;
  onClose: () => void;
}): JSX.Element {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (guestCount: number) => openTableCheck(table.id, guestCount),
    onSuccess: (check) => {
      void queryClient.invalidateQueries({ queryKey: ['operational-floor-plan'] });
      onOpened(check.id);
      onClose();
    },
  });
  return (
    <form
      aria-label="Masa açma formu"
      className="grid gap-4 p-5"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        mutation.mutate(Number(new FormData(event.currentTarget).get('guestCount') ?? 1));
      }}
    >
      <TextField
        id="guest-count"
        label="Kişi sayısı"
        name="guestCount"
        type="number"
        min="1"
        max="50"
        defaultValue="1"
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="secondary" onClick={onClose}>
          Vazgeç
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          Masayı aç
        </Button>
      </div>
      {mutation.error === null ? null : (
        <p role="alert" className="text-sm text-danger">
          {mutation.error instanceof ApiError ? mutation.error.message : 'Masa açılamadı.'}
        </p>
      )}
    </form>
  );
}
