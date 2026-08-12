import {
  BarChart3,
  ChefHat,
  LayoutGrid,
  NotebookText,
  Settings,
  UsersRound,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@kafe/contracts';

export interface NavItem {
  /** React Router yolu. */
  to: string;
  /** Kenar çubuğunda ve başlıkta görünen ad. */
  label: string;
  /** Alt gezinmede kullanılan kısa ad. */
  shortLabel: string;
  /** Modülün ne işe yaradığını anlatan tek cümle. */
  description: string;
  icon: LucideIcon;
  ownerOnly?: boolean;
  roles?: readonly UserRole[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    to: '/',
    label: 'Özet',
    shortLabel: 'Özet',
    description: 'Sistem durumu ve modüllere hızlı erişim.',
    icon: LayoutGrid,
  },
  {
    to: '/masalar',
    label: 'Masalar',
    shortLabel: 'Masalar',
    description: 'Salonlara göre tanımlı masaların görünümü.',
    icon: UtensilsCrossed,
    roles: ['OWNER', 'CASHIER', 'WAITER'],
  },
  {
    to: '/menu',
    label: 'Menü',
    shortLabel: 'Menü',
    description: 'Kategoriler, ürünler, seçenekler ve fiyatlar.',
    icon: NotebookText,
    roles: ['OWNER', 'CASHIER', 'WAITER'],
  },
  {
    to: '/mutfak',
    label: 'Mutfak',
    shortLabel: 'Mutfak',
    description: 'Mutfak ve bara düşen siparişlerin hazırlık ekranı.',
    icon: ChefHat,
  },
  {
    to: '/cariler',
    label: 'Cariler',
    shortLabel: 'Cari',
    description: 'Müşteri cari hesapları, borç ve tahsilat kayıtları.',
    icon: UsersRound,
    roles: ['OWNER', 'CASHIER'],
  },
  {
    to: '/raporlar',
    label: 'Raporlar',
    shortLabel: 'Rapor',
    description: 'Gün sonu, ödeme türü ve ürün satış özetleri.',
    icon: BarChart3,
    roles: ['OWNER', 'CASHIER'],
  },
  {
    to: '/ayarlar',
    label: 'Ayarlar',
    shortLabel: 'Ayarlar',
    description: 'İşletme, personel, salon ve masa yönetimi.',
    icon: Settings,
    ownerOnly: true,
  },
];

/** Telefonda alt çubukta doğrudan yer alan modüller. Geri kalanı çekmecede listelenir. */
export const MOBILE_PRIMARY_PATHS: readonly string[] = ['/', '/masalar', '/menu', '/mutfak'];

export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.to === pathname);
}

export function navigationForRole(role: UserRole): readonly NavItem[] {
  return NAV_ITEMS.filter(
    (item) =>
      (item.ownerOnly !== true || role === 'OWNER') &&
      (item.roles === undefined || item.roles.includes(role)),
  );
}
