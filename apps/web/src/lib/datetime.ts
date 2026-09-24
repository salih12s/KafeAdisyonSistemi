import { LOCALE, TIME_ZONE } from '@kafe/contracts';

const clockFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
});

const dayFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const timestampFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Europe/Istanbul takvimine göre bugünün tarihi, `YYYY-AA-GG` biçiminde. */
export function todayIstanbul(): string {
  return isoDateFormatter.format(new Date());
}

/** `YYYY-AA-GG` takvim gününü `days` gün kaydırır (negatif geriye). */
export function shiftIsoDate(date: string, days: number): string {
  // Öğlen UTC kullanılır; gün sınırında saat dilimi kayması olmaz.
  const noon = new Date(`${date}T12:00:00Z`);
  noon.setUTCDate(noon.getUTCDate() + days);
  return noon.toISOString().slice(0, 10);
}

export function formatClock(value: Date): string {
  return clockFormatter.format(value);
}

export function formatDay(value: Date): string {
  return dayFormatter.format(value);
}

/** ISO metnini Europe/Istanbul saatine çevirir; metin geçersizse tire döner. */
export function formatTimestamp(isoText: string): string {
  const parsed = new Date(isoText);

  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return timestampFormatter.format(parsed);
}

export function formatDateTime(isoText: string): string {
  const parsed = new Date(isoText);
  return Number.isNaN(parsed.getTime()) ? '—' : dateTimeFormatter.format(parsed);
}
