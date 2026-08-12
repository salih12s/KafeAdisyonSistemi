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
    description: 'Salon planı, masa açma ve açık adisyonların takibi.',
    icon: UtensilsCrossed,
  },
  {
    to: '/menu',
    label: 'Menü',
    shortLabel: 'Menü',
    description: 'Kategoriler, ürünler, seçenekler ve fiyatlar.',
    icon: NotebookText,
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
  },
  {
    to: '/raporlar',
    label: 'Raporlar',
    shortLabel: 'Rapor',
    description: 'Gün sonu, ödeme türü ve ürün satış özetleri.',
    icon: BarChart3,
  },
  {
    to: '/ayarlar',
    label: 'Ayarlar',
    shortLabel: 'Ayarlar',
    description: 'Personel, salon tanımları ve uygulama seçenekleri.',
    icon: Settings,
  },
];

/** Telefonda alt çubukta doğrudan yer alan modüller. Geri kalanı çekmecede listelenir. */
export const MOBILE_PRIMARY_PATHS: readonly string[] = ['/', '/masalar', '/menu', '/mutfak'];

export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.to === pathname);
}
