import { BarChart3 } from 'lucide-react';
import { EmptyState } from '../components/ui/empty-state';
import { Panel } from '../components/ui/panel';

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
