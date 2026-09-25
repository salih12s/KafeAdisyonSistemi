import { useState } from 'react';
import { AuditHistory } from '../components/audit-history';
import { SegmentedControl } from '../../../shared/ui/segmented-control';
import { PrinterSection, QrMenuSection } from '../components/device-sections';
import { AreasSection } from '../components/areas-section';
import { StaffSection } from '../components/staff-section';

type Section = 'staff' | 'areas' | 'devices' | 'audit';

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
          { value: 'devices', label: 'Yazıcı ve QR Menü' },
          { value: 'audit', label: 'İşlem Geçmişi' },
        ]}
        onChange={setSection}
      />
      {section === 'staff' ? <StaffSection /> : null}
      {section === 'areas' ? <AreasSection /> : null}
      {section === 'devices' ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <PrinterSection />
          <QrMenuSection />
        </div>
      ) : null}
      {section === 'audit' ? <AuditHistory /> : null}
    </div>
  );
}
