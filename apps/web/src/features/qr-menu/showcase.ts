/**
 * QR menünün görsel vitrin kataloğu (ADR-025).
 *
 * Ürün tablosunda görsel ve açıklama alanı yoktur; kullanıcı kararıyla bu tur
 * migration yapılmadı. Fotoğraf ve açıklama, ürün adına göre bu statik
 * katalogdan eşlenir. Katalogda olmayan ürün fotoğrafsız ve açıklamasız,
 * yalnız ad ve fiyatla gösterilir; menü verisi her zaman API'den gelir.
 *
 * Fotoğraflar Unsplash lisanslıdır; kaynaklar `public/menu-photos/CREDITS.md`.
 */

const PHOTO_ROOT = '/menu-photos';

export const COVER_PHOTO = `${PHOTO_ROOT}/kapak.webp`;

export interface ProductShowcase {
  photo: string;
  description: string;
  /** Sayfanın başındaki "Öne çıkanlar" şeridinde gösterilir. */
  featured: boolean;
}

interface CatalogEntry {
  names: string[];
  photo: string;
  description: string;
  featured?: boolean;
}

const CATALOG: CatalogEntry[] = [
  {
    names: ['Espresso'],
    photo: 'espresso',
    description: 'Taze çekilmiş çekirdekten, yoğun gövdeli ve kalın kremalı tek shot.',
  },
  {
    names: ['Americano'],
    photo: 'americano',
    description: 'Sıcak suyla yumuşatılmış çift espresso; sade ve dengeli.',
  },
  {
    names: ['Latte', 'Caffè Latte'],
    photo: 'latte',
    description: 'Espresso üzerine ipeksi buharlanmış süt ve ince köpük.',
    featured: true,
  },
  {
    names: ['Cappuccino'],
    photo: 'cappuccino',
    description: 'Eşit ölçüde espresso, süt ve kadifemsi süt köpüğü.',
  },
  {
    names: ['Flat White'],
    photo: 'flat-white',
    description: 'Çift ristretto ve mikro köpüklü sütle kahvesi öne çıkan bir fincan.',
  },
  {
    names: ['Türk Kahvesi'],
    photo: 'turk-kahvesi',
    description: 'Geleneksel usulle, bol köpüklü pişirilir; yanında lokumla.',
    featured: true,
  },
  {
    names: ['Iced Latte', 'Buzlu Latte'],
    photo: 'iced-latte',
    description: 'Buz üzerine espresso ve soğuk süt; serinleten klasik.',
    featured: true,
  },
  {
    names: ['Cold Brew'],
    photo: 'cold-brew',
    description: 'Uzun süre soğukta demlenir; yumuşak içimli ve düşük asitli.',
  },
  {
    names: ['Ev Yapımı Limonata', 'Limonata'],
    photo: 'limonata',
    description: 'Limon, nane ve bolca buzla ferahlatıcı.',
  },
  {
    names: ['Taze Portakal Suyu', 'Portakal Suyu'],
    photo: 'portakal-suyu',
    description: 'Siparişle taze sıkılır.',
  },
  {
    names: ['Çay'],
    photo: 'cay',
    description: 'İnce belli bardakta, taze demlenmiş tavşan kanı çay.',
  },
  {
    names: ['Fincan Çay'],
    photo: 'fincan-cay',
    description: 'Büyük fincanda, uzun sohbetlere yetecek demli çay.',
  },
  {
    names: ['Bitki Çayı'],
    photo: 'bitki-cayi',
    description: 'Mevsime göre değişen, kafeinsiz bitki karışımı.',
  },
  {
    names: ['Serpme Kahvaltı (2 kişilik)', 'Serpme Kahvaltı'],
    photo: 'serpme-kahvalti',
    description:
      'Peynirler, zeytin, reçeller, yumurta ve sıcak ekmekle iki kişilik zengin kahvaltı.',
    featured: true,
  },
  {
    names: ['Menemen'],
    photo: 'menemen',
    description: 'Domates, biber ve yumurtayla sahanda; yanında taze ekmek.',
  },
  {
    names: ['Kaşarlı Tost'],
    photo: 'kasarli-tost',
    description: 'Bol eritilmiş kaşarla, çıtır kızarmış ekmekte.',
  },
  {
    names: ['Omlet'],
    photo: 'omlet',
    description: 'Üç yumurtalı, yumuşacık pişirilir; yeşillikle servis edilir.',
  },
  {
    names: ['San Sebastian'],
    photo: 'san-sebastian',
    description: 'Dışı karamelize, içi akışkan Bask usulü cheesecake.',
    featured: true,
  },
  {
    names: ['Tiramisu'],
    photo: 'tiramisu',
    description: 'Espressoya batırılmış kedidili, mascarpone kreması ve kakao.',
  },
  {
    names: ['Sıcak Brownie', 'Brownie'],
    photo: 'brownie',
    description: 'Fırından yeni çıkmış, içi yumuşak bitter çikolatalı brownie.',
  },
  {
    names: ['Cookie'],
    photo: 'cookie',
    description: 'Kenarları çıtır, ortası yumuşak; bol damla çikolatalı.',
  },
  {
    names: ['Magnolia'],
    photo: 'magnolia',
    description: 'Muz ve bisküvi katmanlı hafif vanilyalı krema, kupta.',
  },
];

function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
}

const BY_NAME = new Map<string, ProductShowcase>(
  CATALOG.flatMap((entry) =>
    entry.names.map((name): [string, ProductShowcase] => [
      nameKey(name),
      {
        photo: `${PHOTO_ROOT}/${entry.photo}.webp`,
        description: entry.description,
        featured: entry.featured === true,
      },
    ]),
  ),
);

export function findShowcase(productName: string): ProductShowcase | undefined {
  return BY_NAME.get(nameKey(productName));
}
