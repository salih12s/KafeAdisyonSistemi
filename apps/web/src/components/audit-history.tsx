import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Panel } from './ui/panel';
import { fetchAuditLogs, fetchStaff } from '../lib/api';
import { formatDateTime } from '../lib/datetime';
import { formatKurus } from '@kafe/contracts';

const input = 'min-h-touch rounded-panel border border-line bg-white px-3 text-sm';

function todayIstanbul(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
}

const ACTION_LABELS: Record<string, string> = {
  OWNER_CREATED: 'İlk işletme sahibi oluşturuldu',
  STAFF_CREATED: 'Personel oluşturuldu',
  STAFF_UPDATED: 'Personel güncellendi',
  STAFF_PASSWORD_RESET: 'Personel şifresi sıfırlandı',
  PASSWORD_CHANGED: 'Şifre değiştirildi',
  BUSINESS_UPDATED: 'İşletme bilgileri güncellendi',
  AREA_CREATED: 'Salon oluşturuldu',
  AREA_UPDATED: 'Salon güncellendi',
  TABLE_CREATED: 'Masa oluşturuldu',
  TABLE_UPDATED: 'Masa güncellendi',
  CATEGORY_CREATED: 'Kategori oluşturuldu',
  CATEGORY_UPDATED: 'Kategori güncellendi',
  PRODUCT_CREATED: 'Ürün oluşturuldu',
  PRODUCT_UPDATED: 'Ürün güncellendi',
  OPTION_GROUP_CREATED: 'Seçenek grubu oluşturuldu',
  OPTION_GROUP_UPDATED: 'Seçenek grubu güncellendi',
  OPTION_VALUE_CREATED: 'Seçenek oluşturuldu',
  OPTION_VALUE_UPDATED: 'Seçenek güncellendi',
  CHECK_OPENED: 'Adisyon açıldı',
  CHECK_CLOSED: 'Adisyon kapatıldı',
  ORDER_ITEM_ADDED: 'Sipariş kalemi eklendi',
  ORDER_ITEM_UPDATED: 'Sipariş kalemi güncellendi',
  ORDER_ITEM_CANCELLED: 'Sipariş kalemi iptal edildi',
  ORDER_ITEM_COMPLIMENTARY: 'Sipariş kalemi ikram edildi',
  ORDER_ITEM_PREPARING: 'Hazırlamaya başlandı',
  ORDER_ITEM_READY: 'Sipariş hazırlandı',
  ORDER_ITEM_SERVED: 'Sipariş servis edildi',
  PAYMENT_RECEIVED: 'Ödeme alındı',
  CHECK_SPLIT_PREVIEWED: 'Hesap bölme önizlendi',
  CHECK_DISCOUNT_APPLIED: 'İndirim uygulandı',
  CHECK_TABLE_MOVED: 'Masa taşındı',
  CHECKS_MERGED: 'Adisyonlar birleştirildi',
  CUSTOMER_CREATED: 'Cari müşteri oluşturuldu',
  CUSTOMER_UPDATED: 'Cari müşteri güncellendi',
  CHECK_TRANSFERRED_TO_ACCOUNT: 'Adisyon cariye aktarıldı',
  ACCOUNT_COLLECTION: 'Cari tahsilat kaydedildi',
  ACCOUNT_ENTRY_CREATED: 'Cari hareket kaydedildi',
};

const ENTITY_LABELS: Record<string, string> = {
  User: 'Personel',
  BusinessSettings: 'İşletme',
  DiningArea: 'Salon',
  CafeTable: 'Masa',
  Category: 'Kategori',
  Product: 'Ürün',
  ProductOptionGroup: 'Seçenek grubu',
  ProductOptionValue: 'Seçenek',
  Check: 'Adisyon',
  OrderItem: 'Sipariş kalemi',
  Payment: 'Ödeme',
  CheckDiscount: 'İndirim',
  Customer: 'Cari müşteri',
  AccountEntry: 'Cari hareket',
};

const METADATA_LABELS: Record<string, string> = {
  username: 'Kullanıcı adı',
  role: 'Rol',
  isActive: 'Aktif',
  name: 'Ad',
  areaId: 'Salon kimliği',
  tableId: 'Masa kimliği',
  guestCount: 'Kişi sayısı',
  checkId: 'Adisyon kimliği',
  productId: 'Ürün kimliği',
  quantity: 'Adet',
  reason: 'Gerekçe',
  preparationStatus: 'Hazırlık durumu',
  method: 'Ödeme yöntemi',
  amountKurus: 'Tutar',
  totalKurus: 'Toplam',
  mode: 'Bölme yöntemi',
  shares: 'Paylar',
  customerId: 'Müşteri kimliği',
  sourceTableId: 'Kaynak masa kimliği',
  targetTableId: 'Hedef masa kimliği',
  sourceCheckId: 'Kaynak adisyon kimliği',
  priceKurus: 'Fiyat',
  groupId: 'Grup kimliği',
};

function label(value: string, labels: Record<string, string>): string {
  return labels[value] ?? 'Diğer işlem';
}

function metadataValue(key: string, value: unknown): string {
  if (key.endsWith('Kurus') && typeof value === 'number') return formatKurus(value);
  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
  if (Array.isArray(value)) return value.map((entry) => String(entry)).join(', ');
  return String(value);
}

function safeMetadata(metadata: Record<string, unknown> | null): string {
  if (metadata === null || Object.keys(metadata).length === 0) return '—';
  return Object.entries(metadata)
    .map(([key, value]) => `${METADATA_LABELS[key] ?? 'Detay'}: ${metadataValue(key, value)}`)
    .join(' · ');
}

export function AuditHistory(): JSX.Element {
  const today = todayIstanbul();
  const [filter, setFilter] = useState({
    from: today,
    to: today,
    actorUserId: '',
    action: '',
    entityType: '',
  });
  const staff = useQuery({ queryKey: ['staff'], queryFn: fetchStaff });
  const audit = useQuery({ queryKey: ['audit', filter], queryFn: () => fetchAuditLogs(filter) });
  return (
    <div className="space-y-4">
      <Panel title="İşlem geçmişi" meta="Salt okunur · son 250 kayıt">
        <form
          aria-label="İşlem geçmişi filtresi"
          className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-5"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setFilter({
              from: String(form.get('from')),
              to: String(form.get('to')),
              actorUserId: String(form.get('actorUserId')),
              action: String(form.get('action')),
              entityType: String(form.get('entityType')),
            });
          }}
        >
          <label className="grid gap-1 text-sm">
            Başlangıç
            <input className={input} name="from" type="date" defaultValue={filter.from} />
          </label>
          <label className="grid gap-1 text-sm">
            Bitiş
            <input className={input} name="to" type="date" defaultValue={filter.to} />
          </label>
          <label className="grid gap-1 text-sm">
            Personel
            <select className={input} name="actorUserId" defaultValue={filter.actorUserId}>
              <option value="">Tümü</option>
              {staff.data?.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            İşlem türü
            <select className={input} name="action" defaultValue={filter.action}>
              <option value="">Tümü</option>
              {audit.data?.actions.map((value) => (
                <option key={value} value={value}>
                  {label(value, ACTION_LABELS)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Kayıt türü
            <select className={input} name="entityType" defaultValue={filter.entityType}>
              <option value="">Tümü</option>
              {audit.data?.entityTypes.map((value) => (
                <option key={value} value={value}>
                  {label(value, ENTITY_LABELS)}
                </option>
              ))}
            </select>
          </label>
          <button className="min-h-touch rounded-panel bg-espresso px-4 text-sm font-semibold text-white sm:col-span-2 xl:col-span-5 xl:justify-self-start">
            Filtrele
          </button>
        </form>
      </Panel>
      <Panel title="Kayıtlar" meta={`${audit.data?.entries.length ?? 0} sonuç`}>
        {audit.isError ? (
          <p className="p-4 text-sm text-danger">
            İşlem geçmişi yüklenemedi. Bağlantıyı kontrol edip yeniden deneyin.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="border-b border-line bg-canvas text-xs uppercase text-ink-muted">
                <tr>
                  <th className="px-3 py-2">Ne zaman</th>
                  <th className="px-3 py-2">Kim</th>
                  <th className="px-3 py-2">İşlem</th>
                  <th className="px-3 py-2">İlgili kayıt</th>
                  <th className="px-3 py-2">Güvenli detay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {audit.data?.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap px-3 py-2">
                      {formatDateTime(entry.createdAt)}
                    </td>
                    <td className="px-3 py-2 font-medium">{entry.actorName}</td>
                    <td className="px-3 py-2">{label(entry.action, ACTION_LABELS)}</td>
                    <td className="px-3 py-2">
                      <span className="block">{label(entry.entityType, ENTITY_LABELS)}</span>
                      <code className="text-xs text-ink-muted">{entry.entityId}</code>
                    </td>
                    <td className="max-w-md break-words px-3 py-2 text-xs text-ink-muted">
                      {safeMetadata(entry.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {audit.data?.entries.length === 0 ? (
              <p className="p-4 text-sm text-ink-muted">Bu filtrelerle kayıt bulunamadı.</p>
            ) : null}
          </div>
        )}
      </Panel>
    </div>
  );
}
