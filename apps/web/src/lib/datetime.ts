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
