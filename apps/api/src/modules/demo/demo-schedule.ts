/**
 * Canlı demonun zamanlama kuralları (ADR-026). Saf fonksiyonlardır: saat
 * parametre olarak gelir, veritabanına dokunmaz.
 */
import { TIME_ZONE } from '@kafe/contracts';

const MINUTE = 60_000;

/** Demo verisi her gün bu saatten (Europe/Istanbul) sonra ilk fırsatta yenilenir. */
export const DEMO_RESET_HOUR = 5;

/**
 * Açık masaların yaşı bu aralıkta tutulur: MIN..MIN+SPAN dakika. Demo sabah
 * üretilse de öğleden sonra bakan biri "11 saattir açık" masa görmez.
 */
export const LIVE_CHECK_MIN_AGE_MS = 25 * MINUTE;
export const LIVE_CHECK_AGE_SPAN_MS = 50 * MINUTE;

const dateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const hourFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  hourCycle: 'h23',
});

function istanbulDate(value: Date): string {
  return dateFormat.format(value);
}

function istanbulHour(value: Date): number {
  return Number(hourFormat.format(value));
}

/**
 * Demo verisi yenilenmeli mi? Veri hiç yoksa (`seededAt` null) hemen; varsa
 * yalnız Istanbul'da yeni bir gün başlamış ve saat DEMO_RESET_HOUR'u geçmişse.
 * Gece yarısından sonra ama sabah 05:00'ten önce gelen istek eski günü görür;
 * böylece "bugün"ün verisi gece yarısına göre üretilmez.
 */
export function isDemoStale(seededAt: Date | null, now: Date): boolean {
  if (seededAt === null) return true;
  if (istanbulDate(seededAt) >= istanbulDate(now)) return false;
  return istanbulHour(now) >= DEMO_RESET_HOUR;
}

/**
 * Açık bir adisyonun zamanlarının ne kadar ileri kaydırılacağı (ms). Yaşı
 * aralığın üst sınırını aşmadıysa 0. Aşdıysa yaşı aralığın içine döner:
 * yaş = MIN + ((yaş - MIN) mod SPAN). Kaydırma hiçbir zaman gelecek tarih üretmez.
 */
export function liveCheckShiftMs(openedAt: Date, now: Date): number {
  const age = now.getTime() - openedAt.getTime();
  if (age <= LIVE_CHECK_MIN_AGE_MS + LIVE_CHECK_AGE_SPAN_MS) return 0;
  const target = LIVE_CHECK_MIN_AGE_MS + ((age - LIVE_CHECK_MIN_AGE_MS) % LIVE_CHECK_AGE_SPAN_MS);
  return age - target;
}
