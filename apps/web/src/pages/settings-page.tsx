import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  USER_ROLES,
  USER_ROLE_LABELS,
  type CafeTableResponse,
  type DiningAreaResponse,
  type StaffMember,
  type UserRole,
} from '@kafe/contracts';
import { Panel } from '../components/ui/panel';
import { formatTimestamp } from '../lib/datetime';
import {
  ApiError,
  createArea,
  createStaff,
  createTable,
  fetchAreas,
  fetchBusinessSettings,
  fetchStaff,
  fetchTables,
  resetStaffPassword,
  updateArea,
  updateBusinessSettings,
  updateStaff,
  updateTable,
} from '../lib/api';
import { AuditHistory } from '../components/audit-history';
import { SegmentedControl } from '../components/ui/segmented-control';

type Section = 'business' | 'staff' | 'areas' | 'audit';

const inputClass = 'mt-1 min-h-touch w-full rounded-panel border border-line bg-white px-3 text-sm';
const buttonClass =
  'min-h-touch rounded-panel bg-espresso px-4 text-sm font-semibold text-white hover:bg-espresso-soft disabled:opacity-50';
const secondaryButton =
  'min-h-touch rounded-panel border border-line px-3 text-sm font-medium hover:bg-canvas';

function ErrorText({ error }: { error: unknown }): JSX.Element | null {
  if (error === null || error === undefined) return null;
  return (
    <p role="alert" className="mt-2 text-sm text-danger">
      {error instanceof ApiError ? error.message : 'İşlem tamamlanamadı.'}
    </p>
  );
}

function readUserRole(value: FormDataEntryValue | null): UserRole {
  const role = String(value ?? 'WAITER');
  return USER_ROLES.find((candidate) => candidate === role) ?? 'WAITER';
}

export function SettingsPage(): JSX.Element {
  const [section, setSection] = useState<Section>('business');
  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">Yönetim</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight">Ayarlar</h2>
        <p className="mt-1 text-sm text-ink-secondary">
          İşletme yapısını, personeli ve işlem geçmişini yönetin.
        </p>
      </header>
      <SegmentedControl
        label="Ayar bölümleri"
        value={section}
        options={[
          { value: 'business', label: 'İşletme' },
          { value: 'staff', label: 'Personel' },
          { value: 'areas', label: 'Salonlar ve Masalar' },
          { value: 'audit', label: 'İşlem Geçmişi' },
        ]}
        onChange={setSection}
      />
      {section === 'business' ? <BusinessSection /> : null}
      {section === 'staff' ? <StaffSection /> : null}
      {section === 'areas' ? <AreasSection /> : null}
      {section === 'audit' ? <AuditHistory /> : null}
    </div>
  );
}

function BusinessSection(): JSX.Element {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['business-settings'], queryFn: fetchBusinessSettings });
  const mutation = useMutation({
    mutationFn: (input: { businessName: string; phone: string; address: string }) =>
      updateBusinessSettings(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['business-settings'] }),
  });

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    mutation.mutate({
      businessName: String(form.get('businessName') ?? ''),
      phone: String(form.get('phone') ?? ''),
      address: String(form.get('address') ?? ''),
    });
  };

  if (settings.isPending) {
    return (
      <Panel>
        <p className="p-4 text-sm text-ink-muted">İşletme bilgileri yükleniyor…</p>
      </Panel>
    );
  }
  if (settings.isError) {
    return (
      <Panel>
        <p className="p-4 text-sm text-danger">İşletme bilgileri yüklenemedi.</p>
      </Panel>
    );
  }

  return (
    <Panel title="İşletme bilgileri">
      <form className="grid gap-4 p-4 md:grid-cols-2" onSubmit={submit}>
        <label className="text-sm font-medium">
          İşletme adı
          <input
            className={inputClass}
            name="businessName"
            required
            defaultValue={settings.data.businessName}
          />
        </label>
        <label className="text-sm font-medium">
          Telefon
          <input className={inputClass} name="phone" defaultValue={settings.data.phone ?? ''} />
        </label>
        <label className="text-sm font-medium md:col-span-2">
          Adres
          <textarea
            className={`${inputClass} min-h-24 py-2`}
            name="address"
            defaultValue={settings.data.address ?? ''}
          />
        </label>
        <dl className="grid grid-cols-2 gap-3 rounded-panel border border-line bg-canvas p-3 text-sm md:col-span-2">
          <div>
            <dt className="text-ink-muted">Para birimi</dt>
            <dd className="font-medium">Türk Lirası</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Saat dilimi</dt>
            <dd className="font-medium">Europe/Istanbul</dd>
          </div>
        </dl>
        <div className="md:col-span-2">
          <button className={buttonClass} type="submit">
            Kaydet
          </button>
          <ErrorText error={mutation.error} />
        </div>
      </form>
    </Panel>
  );
}

function StaffSection(): JSX.Element {
  const queryClient = useQueryClient();
  const staff = useQuery({ queryKey: ['staff'], queryFn: fetchStaff });
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [resetting, setResetting] = useState<StaffMember | null>(null);
  const [resetSucceeded, setResetSucceeded] = useState(false);
  const mutation = useMutation({
    mutationFn: async (form: FormData) => {
      const id = String(form.get('id') ?? '');
      const fullName = String(form.get('fullName') ?? '');
      const role = readUserRole(form.get('role'));
      if (id.length === 0) {
        return createStaff({
          fullName,
          username: String(form.get('username') ?? ''),
          password: String(form.get('password') ?? ''),
          role,
        });
      }
      return updateStaff(id, { fullName, role, isActive: form.get('isActive') === 'on' });
    },
    onSuccess: () => {
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
  const resetMutation = useMutation({
    mutationFn: (input: { id: string; password: string }) =>
      resetStaffPassword(input.id, input.password),
    onSuccess: () => setResetSucceeded(true),
  });
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    mutation.mutate(new FormData(event.currentTarget));
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Panel title="Personel">
        {staff.isPending ? (
          <p className="p-4 text-sm text-ink-muted">Personel yükleniyor…</p>
        ) : null}
        {staff.isError ? (
          <p className="p-4 text-sm text-danger">Personel listesi yüklenemedi.</p>
        ) : null}
        {staff.isSuccess ? (
          <ul className="divide-y divide-line">
            {staff.data.map((member) => (
              <li
                key={member.id}
                className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{member.fullName}</p>
                  <p className="text-[13px] text-ink-muted">
                    @{member.username} · {member.isActive ? 'Aktif' : 'Pasif'}
                  </p>
                  <p className="text-[13px] text-ink-muted">
                    Son giriş:{' '}
                    {member.lastLoginAt === null
                      ? 'Henüz giriş yapmadı'
                      : formatTimestamp(member.lastLoginAt)}
                  </p>
                </div>
                <p className="text-sm">{USER_ROLE_LABELS[member.role]}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={secondaryButton}
                    type="button"
                    onClick={() => setEditing(member)}
                  >
                    Düzenle
                  </button>
                  <button
                    className={secondaryButton}
                    type="button"
                    onClick={() => {
                      setResetSucceeded(false);
                      resetMutation.reset();
                      setResetting(member);
                    }}
                  >
                    Şifre sıfırla
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
      <Panel title={editing === null ? 'Personel ekle' : 'Personeli düzenle'}>
        <form key={editing?.id ?? 'new'} className="space-y-3 p-4" onSubmit={submit}>
          <input type="hidden" name="id" value={editing?.id ?? ''} />
          <label className="block text-sm font-medium">
            Ad soyad
            <input
              className={inputClass}
              name="fullName"
              required
              defaultValue={editing?.fullName ?? ''}
            />
          </label>
          {editing === null ? (
            <label className="block text-sm font-medium">
              Kullanıcı adı
              <input className={inputClass} name="username" required />
            </label>
          ) : null}
          {editing === null ? (
            <label className="block text-sm font-medium">
              Geçici şifre
              <input
                className={inputClass}
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={72}
              />
            </label>
          ) : null}
          <label className="block text-sm font-medium">
            Rol
            <select className={inputClass} name="role" defaultValue={editing?.role ?? 'WAITER'}>
              {USER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {USER_ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </label>
          {editing !== null ? (
            <label className="flex min-h-touch items-center gap-2 text-sm">
              <input name="isActive" type="checkbox" defaultChecked={editing.isActive} /> Aktif
              personel
            </label>
          ) : null}
          <div className="flex gap-2">
            <button className={buttonClass} type="submit">
              Kaydet
            </button>
            {editing !== null ? (
              <button className={secondaryButton} type="button" onClick={() => setEditing(null)}>
                Vazgeç
              </button>
            ) : null}
          </div>
          <ErrorText error={mutation.error} />
        </form>
      </Panel>
      {resetting !== null ? (
        <Panel title="Şifre sıfırla" className="xl:col-start-2">
          <form
            className="space-y-3 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              setResetSucceeded(false);
              const form = new FormData(event.currentTarget);
              resetMutation.mutate({
                id: resetting.id,
                password: String(form.get('password') ?? ''),
              });
            }}
          >
            <p className="text-sm text-ink-muted">
              {resetting.fullName} için yeni geçici şifre belirleyin.
            </p>
            <label className="block text-sm font-medium">
              Yeni geçici şifre
              <input
                className={inputClass}
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
              />
            </label>
            {resetSucceeded ? (
              <p role="status" className="text-sm text-success">
                Şifre güncellendi; kullanıcının diğer oturumları kapatıldı.
              </p>
            ) : null}
            <ErrorText error={resetMutation.error} />
            <div className="flex gap-2">
              <button className={buttonClass} disabled={resetMutation.isPending} type="submit">
                {resetMutation.isPending ? 'Güncelleniyor…' : 'Şifreyi güncelle'}
              </button>
              <button className={secondaryButton} type="button" onClick={() => setResetting(null)}>
                Kapat
              </button>
            </div>
          </form>
        </Panel>
      ) : null}
    </div>
  );
}

function AreasSection(): JSX.Element {
  const queryClient = useQueryClient();
  const areas = useQuery({ queryKey: ['areas'], queryFn: fetchAreas });
  const tables = useQuery({ queryKey: ['tables'], queryFn: fetchTables });
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [editingArea, setEditingArea] = useState<DiningAreaResponse | null>(null);
  const [editingTable, setEditingTable] = useState<CafeTableResponse | null>(null);
  const activeAreaId = selectedAreaId || areas.data?.[0]?.id || '';

  const areaMutation = useMutation({
    mutationFn: (form: FormData) => {
      const id = String(form.get('id') ?? '');
      const input = {
        name: String(form.get('name') ?? ''),
        sortOrder: Number(form.get('sortOrder') ?? 0),
      };
      return id.length === 0
        ? createArea(input)
        : updateArea(id, { ...input, isActive: form.get('isActive') === 'on' });
    },
    onSuccess: () => {
      setEditingArea(null);
      void queryClient.invalidateQueries({ queryKey: ['areas'] });
      void queryClient.invalidateQueries({ queryKey: ['floor-plan'] });
    },
  });
  const tableMutation = useMutation({
    mutationFn: (form: FormData) => {
      const id = String(form.get('id') ?? '');
      const capacityText = String(form.get('capacity') ?? '');
      const input = {
        areaId: activeAreaId,
        name: String(form.get('name') ?? ''),
        capacity: capacityText.length === 0 ? null : Number(capacityText),
        sortOrder: Number(form.get('sortOrder') ?? 0),
      };
      return id.length === 0
        ? createTable(input)
        : updateTable(id, { ...input, isActive: form.get('isActive') === 'on' });
    },
    onSuccess: () => {
      setEditingTable(null);
      void queryClient.invalidateQueries({ queryKey: ['tables'] });
      void queryClient.invalidateQueries({ queryKey: ['floor-plan'] });
    },
  });
  const selectedTables = tables.data?.filter((table) => table.areaId === activeAreaId) ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <Panel title="Salonlar">
        <ul className="divide-y divide-line">
          {areas.data?.map((area) => (
            <li key={area.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedAreaId(area.id);
                  setEditingArea(area);
                }}
                className={`${area.id === activeAreaId ? 'bg-accent-soft' : ''} min-h-touch w-full px-3 text-left text-sm`}
              >
                <span className="font-medium">{area.name}</span>
                <span className="ml-2 text-ink-muted">
                  Sıra {area.sortOrder} · {area.isActive ? 'Aktif' : 'Pasif'}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <form
          key={editingArea?.id ?? 'new-area'}
          className="space-y-2 border-t border-line p-3"
          onSubmit={(event) => {
            event.preventDefault();
            areaMutation.mutate(new FormData(event.currentTarget));
          }}
        >
          <input type="hidden" name="id" value={editingArea?.id ?? ''} />
          <label className="block text-sm">
            Salon adı
            <input
              className={inputClass}
              name="name"
              required
              defaultValue={editingArea?.name ?? ''}
            />
          </label>
          <label className="block text-sm">
            Sıra
            <input
              className={inputClass}
              name="sortOrder"
              type="number"
              min="0"
              required
              defaultValue={editingArea?.sortOrder ?? 0}
            />
          </label>
          {editingArea !== null ? (
            <label className="flex min-h-touch items-center gap-2 text-sm">
              <input name="isActive" type="checkbox" defaultChecked={editingArea.isActive} /> Aktif
              salon
            </label>
          ) : null}
          <div className="flex gap-2">
            <button className={buttonClass} type="submit">
              {editingArea === null ? 'Salon ekle' : 'Kaydet'}
            </button>
            {editingArea !== null ? (
              <button
                className={secondaryButton}
                type="button"
                onClick={() => setEditingArea(null)}
              >
                Yeni
              </button>
            ) : null}
          </div>
          <ErrorText error={areaMutation.error} />
        </form>
      </Panel>
      <Panel
        title="Masalar"
        meta={activeAreaId.length === 0 ? 'Önce salon ekleyin' : `${selectedTables.length} kayıt`}
      >
        <ul className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
          {selectedTables.map((table) => (
            <li key={table.id} className="rounded-panel border border-line p-3">
              <p className="font-medium">{table.name}</p>
              <p className="text-[13px] text-ink-muted">
                {table.capacity === null ? 'Kapasite yok' : `${table.capacity} kişi`} · Sıra{' '}
                {table.sortOrder} · {table.isActive ? 'Aktif' : 'Pasif'}
              </p>
              <button
                className={`${secondaryButton} mt-2`}
                type="button"
                onClick={() => setEditingTable(table)}
              >
                Düzenle
              </button>
            </li>
          ))}
        </ul>
        {activeAreaId.length > 0 ? (
          <form
            key={editingTable?.id ?? `new-table-${activeAreaId}`}
            className="grid gap-3 border-t border-line p-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              tableMutation.mutate(new FormData(event.currentTarget));
            }}
          >
            <input type="hidden" name="id" value={editingTable?.id ?? ''} />
            <label className="text-sm">
              Masa adı
              <input
                className={inputClass}
                name="name"
                required
                defaultValue={editingTable?.name ?? ''}
              />
            </label>
            <label className="text-sm">
              Kapasite
              <input
                className={inputClass}
                name="capacity"
                type="number"
                min="1"
                max="50"
                defaultValue={editingTable?.capacity ?? ''}
              />
            </label>
            <label className="text-sm">
              Sıra
              <input
                className={inputClass}
                name="sortOrder"
                type="number"
                min="0"
                required
                defaultValue={editingTable?.sortOrder ?? 0}
              />
            </label>
            {editingTable !== null ? (
              <label className="flex min-h-touch items-center gap-2 text-sm">
                <input name="isActive" type="checkbox" defaultChecked={editingTable.isActive} />{' '}
                Aktif masa
              </label>
            ) : null}
            <div className="flex gap-2 sm:col-span-2">
              <button className={buttonClass} type="submit">
                {editingTable === null ? 'Masa ekle' : 'Kaydet'}
              </button>
              {editingTable !== null ? (
                <button
                  className={secondaryButton}
                  type="button"
                  onClick={() => setEditingTable(null)}
                >
                  Yeni
                </button>
              ) : null}
            </div>
            <ErrorText error={tableMutation.error} />
          </form>
        ) : null}
      </Panel>
    </div>
  );
}
