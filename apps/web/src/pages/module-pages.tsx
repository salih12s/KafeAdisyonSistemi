import { BarChart3, ChefHat, NotebookText, Settings, UsersRound, UtensilsCrossed } from 'lucide-react';
import { EmptyState } from '../components/ui/empty-state';
import { Panel } from '../components/ui/panel';

export function TablesPage(): JSX.Element {
  return (
    <Panel>
      <EmptyState
        icon={UtensilsCrossed}
        title="Henüz salon veya masa tanımlanmadı"
        description="Masa yönetimi Phase 2'de etkinleştirilecek. Salonlar ve masalar tanımlandığında bu ekranda masa planı, doluluk durumu ve açık adisyon tutarları görünecek."
        upcoming={[
          'Salon bazlı masa planı ve doluluk renkleri',
          'Masa açma ve açık adisyonu görüntüleme',
          'Masa taşıma ve masa birleştirme',
          'Hesap bölme ve hesap kapatma',
        ]}
      />
    </Panel>
  );
}

export function MenuPage(): JSX.Element {
  return (
    <Panel>
      <EmptyState
        icon={NotebookText}
        title="Menü henüz oluşturulmadı"
        description="Menü yönetimi Phase 2'de etkinleştirilecek. Fiyatlar kuruş cinsinden tam sayı olarak tutulacak."
        upcoming={[
          'Kategori ve ürün tanımları',
          'Ürün seçenekleri ve ekstralar',
          'Fiyat güncelleme',
          'Ürünü satışa kapatma',
        ]}
      />
    </Panel>
  );
}

export function KitchenPage(): JSX.Element {
  return (
    <Panel>
      <EmptyState
        icon={ChefHat}
        title="Bekleyen sipariş yok"
        description="Mutfak ekranı Phase 4'te etkinleştirilecek. Sipariş alma devreye girdiğinde mutfak ve bara düşen kalemler burada sırayla listelenecek."
        upcoming={[
          'Yeni siparişlerin anlık listelenmesi',
          'Hazırlanıyor ve hazır durum takibi',
          'Mutfak ve bar ayrımı',
          'Bekleme süresi göstergesi',
        ]}
      />
    </Panel>
  );
}

export function AccountsPage(): JSX.Element {
  return (
    <Panel>
      <EmptyState
        icon={UsersRound}
        title="Cari hesap kaydı bulunmuyor"
        description="Cari hesaplar Phase 6'da etkinleştirilecek. Müşteri hesapları açıldığında borç, tahsilat ve hesap özetleri bu ekranda takip edilecek."
        upcoming={[
          'Müşteri kartı oluşturma',
          'Adisyonu cariye aktarma',
          'Tahsilat kaydı',
          'Cari hesap ekstresi',
        ]}
      />
    </Panel>
  );
}

export function ReportsPage(): JSX.Element {
  return (
    <Panel>
      <EmptyState
        icon={BarChart3}
        title="Raporlanacak satış verisi yok"
        description="Raporlar Phase 7'de etkinleştirilecek. Satışlar başladığında gün sonu özeti, ödeme türü dağılımı ve ürün bazlı satış raporları burada oluşturulacak."
        upcoming={[
          'Gün sonu özeti',
          'Ödeme türüne göre dağılım',
          'Ürün ve kategori bazlı satış',
          'İndirim ve ikram dökümü',
        ]}
      />
    </Panel>
  );
}

export function SettingsPage(): JSX.Element {
  return (
    <Panel>
      <EmptyState
        icon={Settings}
        title="Ayarlar henüz açılmadı"
        description="Personel ve rol yönetimi Phase 1'de etkinleştirilecek. Veritabanı bağlantısı apps/api/.env dosyasından yapılandırılır."
        upcoming={[
          'Personel ve rol yönetimi',
          'Salon ve masa tanımları',
          'İşletme bilgileri',
          'İşlem geçmişi',
        ]}
      />
    </Panel>
  );
}
