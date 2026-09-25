import { ApiError } from '../api/http';

const FALLBACK_MESSAGE = 'İşlem tamamlanamadı.';

/** Kullanıcıya gösterilecek hata metni: sunucunun mesajı, yoksa genel mesaj. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : FALLBACK_MESSAGE;
}

/** Hata yoksa `undefined` döner; alanın `error` özelliğine doğrudan verilebilir. */
export function optionalErrorMessage(error: unknown): string | undefined {
  return error === null || error === undefined ? undefined : errorMessage(error);
}
