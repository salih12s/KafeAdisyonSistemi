import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, Plus, PowerOff, RotateCcw } from 'lucide-react';
import {
  USER_ROLES,
  USER_ROLE_LABELS,
  type CafeTableResponse,
  type DiningAreaResponse,
  type StaffMember,
  type UserRole,
} from '@kafe/contracts';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { Dialog } from '../components/ui/dialog';
import { SelectField, TextField } from '../components/ui/field';
import { Panel } from '../components/ui/panel';
import { formatTimestamp } from '../lib/datetime';
import {
  ApiError,
  createArea,
  createStaff,
  createTable,
  fetchAreas,
  fetchStaff,
  fetchTables,
  resetStaffPassword,
  updateArea,
  updateStaff,
  updateTable,
} from '../lib/api';
import { AuditHistory } from '../components/audit-history';
import { SegmentedControl } from '../components/ui/segmented-control';

type Section = 'staff' | 'areas' | 'audit';

/** Kayıtlar fiziksel olarak silinmez; geçmiş adisyon ve raporlar için korunur. */
const DEACTIVATE_DETAIL =
  'Kayıt silinmez. Geçmiş adisyon, rapor ve işlem geçmişi bozulmasın diye korunur; ' +
  'listede "Pasif" olarak görünür ve yeni işlemlerde kullanılamaz. İstediğiniz zaman ' +
  'yeniden aktifleştirebilirsiniz.';

function errorMessage(error: unknown): string | undefined {
  if (error === null || error === undefined) return undefined;
  return error instanceof ApiError ? error.message : 'İşlem tamamlanamadı.';
}

function ErrorText({ error }: { error: unknown }): JSX.Element | null {
  const message = errorMessage(error);
  if (message === undefined) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {message}
    </p>
  );
}

function readUserRole(value: FormDataEntryValue | null): UserRole {
  const role = String(value ?? 'WAITER');
  return USER_ROLES.find((candidate) => candidate === role) ?? 'WAITER';
}

function StatusBadge({ isActive }: { isActive: boolean }): JSX.Element {
  return <Badge tone={isActive ? 'success' : 'neutral'}>{isActive ? 'Aktif' : 'Pasif'}</Badge>;
}

/** Panel başlığının sağında duran birincil ekleme düğmesi. */
function AddButton({ onClick, children }: { onClick: () => void; children: string }): JSX.Element {
  return (
    <Button
      type="button"
      size="small"
      onClick={onClick}
      icon={<Plus aria-hidden="true" className="h-4 w-4" />}
    >
      {children}
    </Button>
  );
}

/** Form içeren dialoglar için ortak gövde; kaydet/vazgeç düğmeleri altta sabittir. */
function FormDialog({
  open,
  title,
  description,
  submitLabel,
  loading,
  error,
  onClose,
  onSubmit,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  submitLabel: string;
  loading: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (form: FormData) => void;
  children: ReactNode;
}): JSX.Element | null {
  const formId = `${title.replace(/\s+/g, '-').toLowerCase()}-form`;
  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      className="sm:max-w-lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId} loading={loading}>
            {submitLabel}
          </Button>
        </div>
      }
    >
      <form
        id={formId}
        aria-label={title}
        className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          onSubmit(new FormData(event.currentTarget));
        }}
      >
        {children}
        <div className="sm:col-span-2">
          <ErrorText error={error} />
        </div>
      </form>
    </Dialog>
  );
}

export function SettingsPage(): JSX.Element {
  const [section, setSection] = useState<Section>('staff');
  return (
    <div className="space-y-5">
      <SegmentedControl
        label="Ayar bölümleri"
        value={section}
        options={[
          { value: 'staff', label: 'Personel' },
          { value: 'areas', label: 'Salonlar ve Masalar' },
          { value: 'audit', label: 'İşlem Geçmişi' },
        ]}
        onChange={setSection}
      />
      {section === 'staff' ? <StaffSection /> : null}
      {section === 'areas' ? <AreasSection /> : null}
      {section === 'audit' ? <AuditHistory /> : null}
    </div>
  );
}

function StaffSection(): JSX.Element {
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
          resetting === null ? undefined : `${resetting.fullName} için yeni geçici şifre belirleyin.`
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
        error={errorMessage(activeMutation.error)}
        onClose={() => setDeactivating(null)}
        onConfirm={() => {
          if (deactivating === null) return;
          activeMutation.mutate({ member: deactivating, isActive: false });
        }}
      />
    </>
  );
}

function AreasSection(): JSX.Element {
  const queryClient = useQueryClient();
  const areas = useQuery({ queryKey: ['areas'], queryFn: fetchAreas });
  const tables = useQuery({ queryKey: ['tables'], queryFn: fetchTables });
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [creatingArea, setCreatingArea] = useState(false);
  const [editingArea, setEditingArea] = useState<DiningAreaResponse | null>(null);
  const [deactivatingArea, setDeactivatingArea] = useState<DiningAreaResponse | null>(null);
  const [creatingTable, setCreatingTable] = useState(false);
  const [editingTable, setEditingTable] = useState<CafeTableResponse | null>(null);
  const [deactivatingTable, setDeactivatingTable] = useState<CafeTableResponse | null>(null);
  const activeAreaId = selectedAreaId || areas.data?.[0]?.id || '';
  const activeArea = areas.data?.find((area) => area.id === activeAreaId);

  const invalidateAreas = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['areas'] });
    void queryClient.invalidateQueries({ queryKey: ['floor-plan'] });
  };
  const invalidateTables = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['tables'] });
    void queryClient.invalidateQueries({ queryKey: ['floor-plan'] });
  };

  const createAreaMutation = useMutation({
    mutationFn: (form: FormData) =>
      createArea({
        name: String(form.get('name') ?? ''),
        sortOrder: Number(form.get('sortOrder') ?? 0),
      }),
    onSuccess: () => {
      setCreatingArea(false);
      invalidateAreas();
    },
  });

  const editAreaMutation = useMutation({
    mutationFn: (input: { id: string; form: FormData }) =>
      updateArea(input.id, {
        name: String(input.form.get('name') ?? ''),
        sortOrder: Number(input.form.get('sortOrder') ?? 0),
        isActive: true,
      }),
    onSuccess: () => {
      setEditingArea(null);
      invalidateAreas();
    },
  });

  const areaActiveMutation = useMutation({
    mutationFn: (input: { area: DiningAreaResponse; isActive: boolean }) =>
      updateArea(input.area.id, {
        name: input.area.name,
        sortOrder: input.area.sortOrder,
        isActive: input.isActive,
      }),
    onSuccess: () => {
      setDeactivatingArea(null);
      invalidateAreas();
    },
  });

  const createTableMutation = useMutation({
    mutationFn: (form: FormData) => {
      const capacityText = String(form.get('capacity') ?? '');
      return createTable({
        areaId: activeAreaId,
        name: String(form.get('name') ?? ''),
        capacity: capacityText.length === 0 ? null : Number(capacityText),
        sortOrder: Number(form.get('sortOrder') ?? 0),
      });
    },
    onSuccess: () => {
      setCreatingTable(false);
      invalidateTables();
    },
  });

  const editTableMutation = useMutation({
    mutationFn: (input: { table: CafeTableResponse; form: FormData }) => {
      const capacityText = String(input.form.get('capacity') ?? '');
      return updateTable(input.table.id, {
        areaId: input.table.areaId,
        name: String(input.form.get('name') ?? ''),
        capacity: capacityText.length === 0 ? null : Number(capacityText),
        sortOrder: Number(input.form.get('sortOrder') ?? 0),
        isActive: true,
      });
    },
    onSuccess: () => {
      setEditingTable(null);
      invalidateTables();
    },
  });

  const tableActiveMutation = useMutation({
    mutationFn: (input: { table: CafeTableResponse; isActive: boolean }) =>
      updateTable(input.table.id, {
        areaId: input.table.areaId,
        name: input.table.name,
        capacity: input.table.capacity,
        sortOrder: input.table.sortOrder,
        isActive: input.isActive,
      }),
    onSuccess: () => {
      setDeactivatingTable(null);
      invalidateTables();
    },
  });

  const selectedTables = tables.data?.filter((table) => table.areaId === activeAreaId) ?? [];

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Panel
          title="Salonlar"
          meta={
            <AddButton
              onClick={() => {
                createAreaMutation.reset();
                setCreatingArea(true);
              }}
            >
              Salon ekle
            </AddButton>
          }
          variant="elevated"
        >
          {areas.data?.length === 0 ? (
            <p className="p-4 text-sm text-ink-muted">
              Henüz salon yok. Masaları tanımlamak için önce bir salon ekleyin.
            </p>
          ) : null}
          <ul className="divide-y divide-line">
            {areas.data?.map((area) => (
              <li
                key={area.id}
                className={area.id === activeAreaId ? 'bg-primary-soft/60' : undefined}
              >
                <div className="flex items-center gap-1 px-2 py-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAreaId(area.id)}
                    aria-current={area.id === activeAreaId}
                    className="flex min-h-touch min-w-0 flex-1 flex-col justify-center rounded-input px-2 text-left hover:bg-surface-muted"
                  >
                    <span className="truncate text-sm font-semibold">{area.name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-secondary">
                      Sıra {area.sortOrder}
                      <StatusBadge isActive={area.isActive} />
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="small"
                    aria-label={`${area.name} salonunu düzenle`}
                    className="min-h-touch w-11 px-0"
                    onClick={() => {
                      editAreaMutation.reset();
                      setEditingArea(area);
                    }}
                    icon={<Pencil aria-hidden="true" className="h-4 w-4" />}
                  >
                    <span className="sr-only">Düzenle</span>
                  </Button>
                  {area.isActive ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="small"
                      aria-label={`${area.name} salonunu pasife al`}
                      className="min-h-touch w-11 px-0 text-danger hover:text-danger"
                      onClick={() => {
                        areaActiveMutation.reset();
                        setDeactivatingArea(area);
                      }}
                      icon={<PowerOff aria-hidden="true" className="h-4 w-4" />}
                    >
                      <span className="sr-only">Pasife al</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="small"
                      aria-label={`${area.name} salonunu aktife al`}
                      className="min-h-touch w-11 px-0 text-success hover:text-success"
                      onClick={() => areaActiveMutation.mutate({ area, isActive: true })}
                      icon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
                    >
                      <span className="sr-only">Aktife al</span>
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title={activeArea === undefined ? 'Masalar' : `Masalar — ${activeArea.name}`}
          meta={
            activeAreaId.length === 0 ? (
              'Önce salon ekleyin'
            ) : (
              <AddButton
                onClick={() => {
                  createTableMutation.reset();
                  setCreatingTable(true);
                }}
              >
                Masa ekle
              </AddButton>
            )
          }
          variant="elevated"
        >
          {activeAreaId.length === 0 ? (
            <p className="p-4 text-sm text-ink-muted">
              Masa eklemek için soldan bir salon seçin veya yeni salon oluşturun.
            </p>
          ) : selectedTables.length === 0 ? (
            <p className="p-4 text-sm text-ink-muted">Bu salonda henüz masa yok.</p>
          ) : (
            <ul className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
              {selectedTables.map((table) => (
                <li key={table.id} className="surface-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate font-semibold">{table.name}</p>
                    <StatusBadge isActive={table.isActive} />
                  </div>
                  <p className="mt-1 text-[13px] text-ink-secondary">
                    {table.capacity === null ? 'Kapasite yok' : `${table.capacity} kişi`} · Sıra{' '}
                    {table.sortOrder}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="small"
                      icon={<Pencil aria-hidden="true" className="h-4 w-4" />}
                      onClick={() => {
                        editTableMutation.reset();
                        setEditingTable(table);
                      }}
                    >
                      <span className="sr-only">{table.name} masasını </span>Düzenle
                    </Button>
                    {table.isActive ? (
                      <Button
                        type="button"
                        variant="danger"
                        size="small"
                        icon={<PowerOff aria-hidden="true" className="h-4 w-4" />}
                        onClick={() => {
                          tableActiveMutation.reset();
                          setDeactivatingTable(table);
                        }}
                      >
                        Pasife al
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="success"
                        size="small"
                        icon={<RotateCcw aria-hidden="true" className="h-4 w-4" />}
                        onClick={() => tableActiveMutation.mutate({ table, isActive: true })}
                      >
                        Aktife al
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <FormDialog
        open={creatingArea}
        title="Salon ekle"
        description="Salonlar masaları gruplar; masa planı ve adisyon ekranında bu adla görünür."
        submitLabel="Salonu kaydet"
        loading={createAreaMutation.isPending}
        error={createAreaMutation.error}
        onClose={() => setCreatingArea(false)}
        onSubmit={(form) => createAreaMutation.mutate(form)}
      >
        <TextField
          id="new-area-name"
          name="name"
          label="Salon adı"
          placeholder="Örn. Bahçe"
          required
        />
        <TextField
          id="new-area-sort"
          name="sortOrder"
          label="Sıra"
          type="number"
          min="0"
          defaultValue={0}
          helper="Küçük sayı önce gösterilir."
          required
        />
      </FormDialog>

      <FormDialog
        open={editingArea !== null}
        title="Salonu düzenle"
        description={editingArea === null ? undefined : `${editingArea.name} salonunu güncelleyin.`}
        submitLabel="Kaydet"
        loading={editAreaMutation.isPending}
        error={editAreaMutation.error}
        onClose={() => setEditingArea(null)}
        onSubmit={(form) => {
          if (editingArea === null) return;
          editAreaMutation.mutate({ id: editingArea.id, form });
        }}
      >
        <TextField
          key={`area-name-${editingArea?.id ?? ''}`}
          id="edit-area-name"
          name="name"
          label="Salon adı"
          defaultValue={editingArea?.name ?? ''}
          required
        />
        <TextField
          key={`area-sort-${editingArea?.id ?? ''}`}
          id="edit-area-sort"
          name="sortOrder"
          label="Sıra"
          type="number"
          min="0"
          defaultValue={editingArea?.sortOrder ?? 0}
          required
        />
        {editingArea?.isActive === false ? (
          <p className="text-sm text-ink-secondary sm:col-span-2">
            Bu salon şu anda pasif. Kaydettiğinizde yeniden aktif olur.
          </p>
        ) : null}
      </FormDialog>

      <ConfirmDialog
        open={deactivatingArea !== null}
        title="Salonu pasife al"
        description={
          deactivatingArea === null
            ? ''
            : `${deactivatingArea.name} salonu masa planında görünmeyecek.`
        }
        detail={DEACTIVATE_DETAIL}
        confirmLabel="Pasife al"
        confirmVariant="danger"
        loading={areaActiveMutation.isPending}
        error={errorMessage(areaActiveMutation.error)}
        onClose={() => setDeactivatingArea(null)}
        onConfirm={() => {
          if (deactivatingArea === null) return;
          areaActiveMutation.mutate({ area: deactivatingArea, isActive: false });
        }}
      />

      <FormDialog
        open={creatingTable}
        title="Masa ekle"
        description={
          activeArea === undefined ? undefined : `${activeArea.name} salonuna yeni masa ekleyin.`
        }
        submitLabel="Masayı kaydet"
        loading={createTableMutation.isPending}
        error={createTableMutation.error}
        onClose={() => setCreatingTable(false)}
        onSubmit={(form) => createTableMutation.mutate(form)}
      >
        <TextField
          id="new-table-name"
          name="name"
          label="Masa adı"
          placeholder="Örn. Masa 1"
          required
        />
        <TextField
          id="new-table-capacity"
          name="capacity"
          label="Kapasite"
          type="number"
          min="1"
          max="50"
          helper="Boş bırakılabilir."
        />
        <TextField
          id="new-table-sort"
          name="sortOrder"
          label="Sıra"
          type="number"
          min="0"
          defaultValue={0}
          required
        />
      </FormDialog>

      <FormDialog
        open={editingTable !== null}
        title="Masayı düzenle"
        description={editingTable === null ? undefined : `${editingTable.name} bilgilerini güncelleyin.`}
        submitLabel="Kaydet"
        loading={editTableMutation.isPending}
        error={editTableMutation.error}
        onClose={() => setEditingTable(null)}
        onSubmit={(form) => {
          if (editingTable === null) return;
          editTableMutation.mutate({ table: editingTable, form });
        }}
      >
        <TextField
          key={`table-name-${editingTable?.id ?? ''}`}
          id="edit-table-name"
          name="name"
          label="Masa adı"
          defaultValue={editingTable?.name ?? ''}
          required
        />
        <TextField
          key={`table-capacity-${editingTable?.id ?? ''}`}
          id="edit-table-capacity"
          name="capacity"
          label="Kapasite"
          type="number"
          min="1"
          max="50"
          defaultValue={editingTable?.capacity ?? ''}
          helper="Boş bırakılabilir."
        />
        <TextField
          key={`table-sort-${editingTable?.id ?? ''}`}
          id="edit-table-sort"
          name="sortOrder"
          label="Sıra"
          type="number"
          min="0"
          defaultValue={editingTable?.sortOrder ?? 0}
          required
        />
        {editingTable?.isActive === false ? (
          <p className="text-sm text-ink-secondary sm:col-span-2">
            Bu masa şu anda pasif. Kaydettiğinizde yeniden aktif olur.
          </p>
        ) : null}
      </FormDialog>

      <ConfirmDialog
        open={deactivatingTable !== null}
        title="Masayı pasife al"
        description={
          deactivatingTable === null
            ? ''
            : `${deactivatingTable.name} masa planında görünmeyecek ve yeni adisyon açılamayacak.`
        }
        detail={DEACTIVATE_DETAIL}
        confirmLabel="Pasife al"
        confirmVariant="danger"
        loading={tableActiveMutation.isPending}
        error={errorMessage(tableActiveMutation.error)}
        onClose={() => setDeactivatingTable(null)}
        onConfirm={() => {
          if (deactivatingTable === null) return;
          tableActiveMutation.mutate({ table: deactivatingTable, isActive: false });
        }}
      />
    </>
  );
}
