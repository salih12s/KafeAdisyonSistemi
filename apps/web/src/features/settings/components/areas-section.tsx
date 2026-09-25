import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, PowerOff, RotateCcw } from 'lucide-react';
import type { CafeTableResponse, DiningAreaResponse } from '@kafe/contracts';
import { Button } from '../../../shared/ui/button';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { TextField } from '../../../shared/ui/field';
import { Panel } from '../../../shared/ui/panel';
import { createArea, createTable, fetchAreas, fetchTables, updateArea, updateTable } from '../api';
import { StatusBadge } from '../../../shared/ui/status-badge';
import { FormDialog } from '../../../shared/ui/form-dialog';
import { optionalErrorMessage } from '../../../shared/lib/error-message';
import { AddButton } from './add-button';
import { DEACTIVATE_DETAIL } from '../settings-form';

export function AreasSection(): JSX.Element {
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
        error={optionalErrorMessage(areaActiveMutation.error)}
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
        description={
          editingTable === null ? undefined : `${editingTable.name} bilgilerini güncelleyin.`
        }
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
        error={optionalErrorMessage(tableActiveMutation.error)}
        onClose={() => setDeactivatingTable(null)}
        onConfirm={() => {
          if (deactivatingTable === null) return;
          tableActiveMutation.mutate({ table: deactivatingTable, isActive: false });
        }}
      />
    </>
  );
}
