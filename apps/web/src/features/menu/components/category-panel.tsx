import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Pencil, Plus } from 'lucide-react';
import type { CategoryResponse } from '@kafe/contracts';
import { Button } from '../../../shared/ui/button';
import { TextField } from '../../../shared/ui/field';
import { Panel } from '../../../shared/ui/panel';
import { createCategory, updateCategory } from '../api';
import { StatusBadge } from '../../../shared/ui/status-badge';
import { FormDialog } from '../../../shared/ui/form-dialog';
import { ActiveCheckbox } from './active-checkbox';
import { readSortOrder } from '../menu-form';

interface CategoryPanelProps {
  categories: CategoryResponse[];
  activeCategoryId: string;
  canManage: boolean;
  onSelect: (id: string) => void;
}

export function CategoryPanel({
  categories,
  activeCategoryId,
  canManage,
  onSelect,
}: CategoryPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CategoryResponse | null>(null);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['menu-categories'] });
  };

  const createMutation = useMutation({
    mutationFn: (form: FormData) =>
      createCategory({
        name: String(form.get('name') ?? ''),
        sortOrder: readSortOrder(form.get('sortOrder')),
        isActive: true,
      }),
    onSuccess: () => {
      setCreating(false);
      invalidate();
    },
  });

  const editMutation = useMutation({
    mutationFn: (input: { id: string; form: FormData }) =>
      updateCategory(input.id, {
        name: String(input.form.get('name') ?? ''),
        sortOrder: readSortOrder(input.form.get('sortOrder')),
        isActive: input.form.get('isActive') === 'on',
      }),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
  });

  return (
    <>
      <Panel
        title="Kategoriler"
        meta={
          canManage ? (
            <Button
              type="button"
              size="small"
              icon={<Plus aria-hidden="true" className="h-4 w-4" />}
              onClick={() => {
                createMutation.reset();
                setCreating(true);
              }}
            >
              Kategori ekle
            </Button>
          ) : (
            `${categories.length} kayıt`
          )
        }
        variant="elevated"
      >
        {categories.length === 0 ? (
          <p className="px-4 py-4 text-sm text-ink-muted">
            Henüz kategori yok. “Kategori ekle” ile ilk kategoriyi oluşturun.
          </p>
        ) : (
          <>
            <p className="border-b border-line px-4 py-2 text-[12px] text-ink-secondary">
              Ürünlerini görmek için bir kategoriye dokunun.
            </p>
            <ul className="divide-y divide-line">
              {categories.map((category) => {
                const isSelected = category.id === activeCategoryId;
                return (
                  <li key={category.id} className={isSelected ? 'bg-primary-soft/60' : undefined}>
                    <div className="flex items-center gap-1 px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => onSelect(category.id)}
                        aria-current={isSelected}
                        aria-label={`${category.name} kategorisini seç`}
                        className={`flex min-h-touch min-w-0 flex-1 items-center gap-2 rounded-input px-2 text-left transition hover:bg-surface-muted ${
                          isSelected ? 'font-semibold' : ''
                        }`}
                      >
                        <ChevronRight
                          aria-hidden="true"
                          className={`h-4 w-4 shrink-0 transition ${
                            isSelected ? 'text-primary' : 'text-ink-subtle'
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{category.name}</span>
                          <span className="block text-[12px] font-normal text-ink-secondary">
                            Sıra {category.sortOrder}
                          </span>
                        </span>
                        <StatusBadge isActive={category.isActive} />
                      </button>
                      {canManage ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="small"
                          aria-label={`${category.name} kategorisini düzenle`}
                          className="min-h-touch w-11 shrink-0 px-0"
                          onClick={() => {
                            editMutation.reset();
                            setEditing(category);
                          }}
                          icon={<Pencil aria-hidden="true" className="h-4 w-4" />}
                        >
                          <span className="sr-only">Düzenle</span>
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>

      <FormDialog
        open={creating}
        title="Kategori ekle"
        description="Kategoriler menüyü gruplar; adisyon ekranında ürünler bu başlıklar altında listelenir."
        submitLabel="Kategoriyi kaydet"
        loading={createMutation.isPending}
        error={createMutation.error}
        onClose={() => setCreating(false)}
        onSubmit={(form) => createMutation.mutate(form)}
      >
        <TextField
          id="new-category-name"
          name="name"
          label="Kategori adı"
          placeholder="Örn. Sıcak İçecekler"
          required
        />
        <TextField
          id="new-category-sort"
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
        open={editing !== null}
        title="Kategoriyi düzenle"
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
          key={`cat-name-${editing?.id ?? ''}`}
          id="edit-category-name"
          name="name"
          label="Kategori adı"
          defaultValue={editing?.name ?? ''}
          required
        />
        <TextField
          key={`cat-sort-${editing?.id ?? ''}`}
          id="edit-category-sort"
          name="sortOrder"
          label="Sıra"
          type="number"
          min="0"
          defaultValue={editing?.sortOrder ?? 0}
          required
        />
        <ActiveCheckbox
          key={`cat-active-${editing?.id ?? ''}`}
          name="isActive"
          defaultChecked={editing?.isActive ?? true}
          label="Aktif kategori (pasif kategoriler adisyon ekranında görünmez)"
        />
      </FormDialog>
    </>
  );
}
