import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, PowerOff, RotateCcw } from 'lucide-react';
import { USER_ROLES, USER_ROLE_LABELS, type StaffMember } from '@kafe/contracts';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { Dialog } from '../../../shared/ui/dialog';
import { SelectField, TextField } from '../../../shared/ui/field';
import { Panel } from '../../../shared/ui/panel';
import { formatTimestamp } from '../../../shared/lib/datetime';
import { createStaff, fetchStaff, resetStaffPassword, updateStaff } from '../api';
import { ErrorText } from '../../../shared/ui/error-text';
import { StatusBadge } from '../../../shared/ui/status-badge';
import { FormDialog } from '../../../shared/ui/form-dialog';
import { optionalErrorMessage } from '../../../shared/lib/error-message';
import { AddButton } from './add-button';
import { DEACTIVATE_DETAIL, readUserRole } from '../settings-form';

export function StaffSection(): JSX.Element {
  const queryClient = useQueryClient();
  const staff = useQuery({ queryKey: ['staff'], queryFn: fetchStaff });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [resetting, setResetting] = useState<StaffMember | null>(null);
  const [deactivating, setDeactivating] = useState<StaffMember | null>(null);
  const [resetSucceeded, setResetSucceeded] = useState(false);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['staff'] });
  };

  const createMutation = useMutation({
    mutationFn: (form: FormData) =>
      createStaff({
        fullName: String(form.get('fullName') ?? ''),
        username: String(form.get('username') ?? ''),
        password: String(form.get('password') ?? ''),
        role: readUserRole(form.get('role')),
      }),
    onSuccess: () => {
      setCreating(false);
      invalidate();
    },
  });

  const editMutation = useMutation({
    mutationFn: (input: { id: string; form: FormData }) =>
      updateStaff(input.id, {
        fullName: String(input.form.get('fullName') ?? ''),
        role: readUserRole(input.form.get('role')),
        isActive: true,
      }),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
  });

  const activeMutation = useMutation({
    mutationFn: (input: { member: StaffMember; isActive: boolean }) =>
      updateStaff(input.member.id, {
        fullName: input.member.fullName,
        role: input.member.role,
        isActive: input.isActive,
      }),
    onSuccess: () => {
      setDeactivating(null);
      invalidate();
    },
  });

  const resetMutation = useMutation({
    mutationFn: (input: { id: string; password: string }) =>
      resetStaffPassword(input.id, input.password),
    onSuccess: () => setResetSucceeded(true),
  });

  return (
    <>
      <Panel
        title="Personel"
        meta={
          <AddButton
            onClick={() => {
              createMutation.reset();
              setCreating(true);
            }}
          >
            Personel ekle
          </AddButton>
        }
        variant="elevated"
      >
        {staff.isPending ? (
          <p className="p-4 text-sm text-ink-muted">Personel yükleniyor…</p>
        ) : null}
        {staff.isError ? (
          <p className="p-4 text-sm text-danger">Personel listesi yüklenemedi.</p>
        ) : null}
        {staff.isSuccess && staff.data.length === 0 ? (
          <p className="p-4 text-sm text-ink-muted">
            Henüz personel yok. Sağ üstteki “Personel ekle” ile başlayın.
          </p>
        ) : null}
        {staff.isSuccess ? (
          <ul className="divide-y divide-line">
            {staff.data.map((member) => (
              <li
                key={member.id}
                className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">{member.fullName}</p>
                    <Badge tone="primary">{USER_ROLE_LABELS[member.role]}</Badge>
                    <StatusBadge isActive={member.isActive} />
                  </div>
                  <p className="mt-1 text-[13px] text-ink-secondary">
                    @{member.username} · Son giriş:{' '}
                    {member.lastLoginAt === null
                      ? 'Henüz giriş yapmadı'
                      : formatTimestamp(member.lastLoginAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    icon={<Pencil aria-hidden="true" className="h-4 w-4" />}
                    onClick={() => {
                      editMutation.reset();
                      setEditing(member);
                    }}
                  >
                    Düzenle
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    icon={<KeyRound aria-hidden="true" className="h-4 w-4" />}
                    onClick={() => {
                      setResetSucceeded(false);
                      resetMutation.reset();
                      setResetting(member);
                    }}
                  >
                    Şifre sıfırla
                  </Button>
                  {member.isActive ? (
                    <Button
                      type="button"
                      variant="danger"
                      size="small"
                      icon={<PowerOff aria-hidden="true" className="h-4 w-4" />}
                      onClick={() => {
                        activeMutation.reset();
                        setDeactivating(member);
                      }}
                    >
                      Pasife al
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="success"
                      size="small"
                      loading={activeMutation.isPending}
                      icon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
                      onClick={() => activeMutation.mutate({ member, isActive: true })}
                    >
                      Aktife al
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>

      <FormDialog
        open={creating}
        title="Personel ekle"
        description="Yeni personel bu bilgilerle giriş yapar; şifreyi ilk girişten sonra değiştirmesini isteyin."
        submitLabel="Personeli kaydet"
        loading={createMutation.isPending}
        error={createMutation.error}
        onClose={() => setCreating(false)}
        onSubmit={(form) => createMutation.mutate(form)}
      >
        <TextField id="new-staff-name" name="fullName" label="Ad soyad" required />
        <TextField
          id="new-staff-username"
          name="username"
          label="Kullanıcı adı"
          autoComplete="off"
          required
        />
        <TextField
          id="new-staff-password"
          name="password"
          label="Geçici şifre"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          helper="En az 8 karakter."
          required
        />
        <SelectField id="new-staff-role" name="role" label="Rol" defaultValue="WAITER">
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {USER_ROLE_LABELS[role]}
            </option>
          ))}
        </SelectField>
      </FormDialog>

      <FormDialog
        open={editing !== null}
        title="Personeli düzenle"
        description={editing === null ? undefined : `${editing.fullName} için ad ve rol bilgisi.`}
        submitLabel="Kaydet"
        loading={editMutation.isPending}
        error={editMutation.error}
        onClose={() => setEditing(null)}
        onSubmit={(form) => {
          if (editing === null) return;
          editMutation.mutate({ id: editing.id, form });
        }}
      >
        <TextField
          key={`name-${editing?.id ?? ''}`}
          id="edit-staff-name"
          name="fullName"
          label="Ad soyad"
          defaultValue={editing?.fullName ?? ''}
          required
        />
        <SelectField
          key={`role-${editing?.id ?? ''}`}
          id="edit-staff-role"
          name="role"
          label="Rol"
          defaultValue={editing?.role ?? 'WAITER'}
        >
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {USER_ROLE_LABELS[role]}
            </option>
          ))}
        </SelectField>
      </FormDialog>

      <Dialog
        open={resetting !== null}
        title="Şifre sıfırla"
        description={
          resetting === null
            ? undefined
            : `${resetting.fullName} için yeni geçici şifre belirleyin.`
        }
        onClose={() => setResetting(null)}
        className="sm:max-w-md"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setResetting(null)}>
              Kapat
            </Button>
            <Button type="submit" form="reset-password-form" loading={resetMutation.isPending}>
              Şifreyi güncelle
            </Button>
          </div>
        }
      >
        <form
          id="reset-password-form"
          key={resetting?.id ?? 'reset'}
          aria-label="Şifre sıfırlama formu"
          className="space-y-3 p-4 sm:p-5"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (resetting === null) return;
            setResetSucceeded(false);
            const form = new FormData(event.currentTarget);
            resetMutation.mutate({
              id: resetting.id,
              password: String(form.get('password') ?? ''),
            });
          }}
        >
          <TextField
            id="reset-password"
            name="password"
            label="Yeni geçici şifre"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            helper="En az 8 karakter. Kaydedince kullanıcının açık oturumları kapanır."
            required
          />
          {resetSucceeded ? (
            <p role="status" className="text-sm font-medium text-success">
              Şifre güncellendi; kullanıcının diğer oturumları kapatıldı.
            </p>
          ) : null}
          <ErrorText error={resetMutation.error} />
        </form>
      </Dialog>

      <ConfirmDialog
        open={deactivating !== null}
        title="Personeli pasife al"
        description={
          deactivating === null
            ? ''
            : `${deactivating.fullName} artık giriş yapamayacak ve açık oturumları kapanacak.`
        }
        detail={DEACTIVATE_DETAIL}
        confirmLabel="Pasife al"
        confirmVariant="danger"
        loading={activeMutation.isPending}
        error={optionalErrorMessage(activeMutation.error)}
        onClose={() => setDeactivating(null)}
        onConfirm={() => {
          if (deactivating === null) return;
          activeMutation.mutate({ member: deactivating, isActive: false });
        }}
      />
    </>
  );
}
