import { describe, expect, it } from 'vitest';
import {
  LIVE_CHECK_AGE_SPAN_MS,
  LIVE_CHECK_MIN_AGE_MS,
  isDemoStale,
  liveCheckShiftMs,
} from '../../src/modules/demo/demo-schedule';

const MINUTE = 60_000;
/** Istanbul UTC+3'tür; saatler okunaklı olsun diye yerel saat + ofsetle yazılır. */
const ist = (value: string): Date => new Date(`${value}+03:00`);

describe('Demo yenileme zamanı (isDemoStale)', () => {
  it('hiç demo verisi yoksa hemen yeniler', () => {
    expect(isDemoStale(null, ist('2026-09-28T14:00:00'))).toBe(true);
  });

  it('aynı Istanbul gününde üretilmiş veriyi yenilemez', () => {
    expect(isDemoStale(ist('2026-09-28T05:10:00'), ist('2026-09-28T23:59:00'))).toBe(false);
  });

  it('ertesi gün 05:00 olmadan yenilemez (gece yarısı sonrası eski gün görünür)', () => {
    expect(isDemoStale(ist('2026-09-28T05:10:00'), ist('2026-09-29T04:59:00'))).toBe(false);
  });

  it('ertesi gün 05:00 olunca yeniler', () => {
    expect(isDemoStale(ist('2026-09-28T05:10:00'), ist('2026-09-29T05:00:00'))).toBe(true);
  });

  it('günleri UTC değil Istanbul takvimine göre karşılaştırır', () => {
    // 00:30 Istanbul, UTC'de hâlâ önceki gündür (21:30Z). UTC ile bakan bir
    // uygulama 06:00'da "yeni gün" sanıp aynı gün ikinci kez silerdi.
    const seededAt = ist('2026-09-29T00:30:00');
    expect(seededAt.toISOString()).toBe('2026-09-28T21:30:00.000Z');
    expect(isDemoStale(seededAt, ist('2026-09-29T06:00:00'))).toBe(false);
  });

  it('birkaç gün hiç istek gelmediyse ilk istekte yeniler', () => {
    expect(isDemoStale(ist('2026-09-20T09:00:00'), ist('2026-09-28T10:00:00'))).toBe(true);
  });
});

describe('Açık masa tazeleme (liveCheckShiftMs)', () => {
  const now = ist('2026-09-28T16:00:00');
  const openedMinutesAgo = (minutes: number): Date => new Date(now.getTime() - minutes * MINUTE);

  it('aralıktaki (25–75 dk) masaya dokunmaz', () => {
    expect(liveCheckShiftMs(openedMinutesAgo(30), now)).toBe(0);
    expect(liveCheckShiftMs(openedMinutesAgo(75), now)).toBe(0);
  });

  it('yeni açılmış masaya dokunmaz', () => {
    expect(liveCheckShiftMs(openedMinutesAgo(1), now)).toBe(0);
  });

  it('saati ileri gitmiş (gelecekte açılmış görünen) masaya dokunmaz', () => {
    expect(liveCheckShiftMs(new Date(now.getTime() + 5 * MINUTE), now)).toBe(0);
  });

  it('76 dakikalık masayı 26 dakikaya döndürür', () => {
    expect(liveCheckShiftMs(openedMinutesAgo(76), now)).toBe(50 * MINUTE);
  });

  it('sabah açılmış masayı öğleden sonra da aralığın içine getirir', () => {
    const shift = liveCheckShiftMs(openedMinutesAgo(11 * 60), now);
    const newAge = 11 * 60 * MINUTE - shift;
    expect(newAge).toBeGreaterThanOrEqual(LIVE_CHECK_MIN_AGE_MS);
    expect(newAge).toBeLessThan(LIVE_CHECK_MIN_AGE_MS + LIVE_CHECK_AGE_SPAN_MS);
  });

  it('her yaş için: kaydırma negatif değildir ve sonuç asla aralığın dışına/geleceğe düşmez', () => {
    // Genel kural 2 günlük her dakika için denenir (property-based testin elle yazılmış hâli).
    for (let minutes = 0; minutes <= 2 * 24 * 60; minutes += 1) {
      const age = minutes * MINUTE;
      const shift = liveCheckShiftMs(openedMinutesAgo(minutes), now);
      expect(shift).toBeGreaterThanOrEqual(0);
      const newAge = age - shift;
      expect(newAge).toBeGreaterThanOrEqual(0);
      if (shift > 0) {
        expect(newAge).toBeGreaterThanOrEqual(LIVE_CHECK_MIN_AGE_MS);
        expect(newAge).toBeLessThan(LIVE_CHECK_MIN_AGE_MS + LIVE_CHECK_AGE_SPAN_MS);
      }
    }
  });
});
