import { useCallback, useState } from 'react';
import { Printer, QrCode as QrIcon } from 'lucide-react';
import { Panel } from '../ui/panel';
import { Button } from '../ui/button';
import { SegmentedControl } from '../ui/segmented-control';
import { useToast } from '../ui/toast';
import { QrCode } from '../qr-code';
import { PrintSheet } from '../print/print-sheet';
import { APP_NAME } from '../../config/app-info';
import { readPaperWidth, savePaperWidth, type PaperWidth } from '../../lib/print-settings';

/** Bu cihazın termal yazıcı kâğıt genişliği. */
export function PrinterSection(): JSX.Element {
  const { notify } = useToast();
  const [width, setWidth] = useState<PaperWidth>(readPaperWidth);
  const [testing, setTesting] = useState(false);
  const stopTesting = useCallback(() => setTesting(false), []);
  return (
    <Panel title="Yazıcı" meta="Bu cihaz için">
      <div className="grid gap-4 p-4 sm:p-5">
        <p className="max-w-2xl text-sm text-ink-secondary">
          Adisyon ve mutfak fişleri tarayıcının yazdırma penceresiyle basılır. Termal yazıcıyı
          bilgisayara veya tablete normal yazıcı olarak kurun ve yazdırma penceresinde varsayılan
          yazıcı olarak seçin. Kâğıt genişliği her cihaz için ayrı saklanır.
        </p>
        <SegmentedControl
          label="Kâğıt genişliği"
          value={width}
          onChange={(value) => {
            setWidth(value);
            savePaperWidth(value);
            notify(`Kâğıt genişliği ${value} mm olarak kaydedildi.`);
          }}
          options={[
            { value: '80', label: '80 mm' },
            { value: '58', label: '58 mm' },
          ]}
        />
        <div>
          <Button
            variant="outline"
            icon={<Printer aria-hidden="true" className="h-4 w-4" />}
            onClick={() => setTesting(true)}
          >
            Deneme fişi yazdır
          </Button>
        </div>
      </div>
      {testing ? (
        <PrintSheet onDone={stopTesting}>
          <article className="receipt">
            <strong className="receipt__title receipt__center">{APP_NAME}</strong>
            <div className="receipt__rule" />
            <div className="receipt__center">Deneme fişi · {width} mm</div>
            <div className="receipt__row">
              <span>Sol hizalı metin</span>
              <span>123,45 ₺</span>
            </div>
            <div className="receipt__rule" />
          </article>
        </PrintSheet>
      ) : null}
    </Panel>
  );
}

/** Masalara konacak QR menü kartı. Adres uygulamanın kendi origin'idir. */
export function QrMenuSection(): JSX.Element {
  const [printing, setPrinting] = useState(false);
  const stopPrinting = useCallback(() => setPrinting(false), []);
  const menuUrl = `${window.location.origin}/qr-menu`;
  return (
    <Panel title="QR menü" meta="Müşteri yalnız menüyü görür, sipariş veremez">
      <div className="grid gap-5 p-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:p-5">
        <QrCode
          value={menuUrl}
          label="QR menü kodu"
          className="h-48 w-48 rounded-card border border-line"
        />
        <div className="grid content-start gap-3">
          <p className="text-sm text-ink-secondary">
            Kodu yazdırıp masalara koyun. Telefon kamerasıyla okutan müşteri aktif ürünleri ve
            fiyatları görür. Menüde yaptığınız değişiklik en geç bir dakika içinde yansır.
          </p>
          <a
            href={menuUrl}
            target="_blank"
            rel="noreferrer"
            className="break-all text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {menuUrl}
          </a>
          <div>
            <Button
              variant="outline"
              icon={<QrIcon aria-hidden="true" className="h-4 w-4" />}
              onClick={() => setPrinting(true)}
            >
              QR kartını yazdır
            </Button>
          </div>
        </div>
      </div>
      {printing ? (
        <PrintSheet onDone={stopPrinting}>
          <article className="receipt receipt__center">
            <strong className="receipt__title">{APP_NAME}</strong>
            <div>Menü için okutun</div>
            <QrCode value={menuUrl} label="QR menü kodu" className="mx-auto my-2 w-4/5" />
          </article>
        </PrintSheet>
      ) : null}
    </Panel>
  );
}
