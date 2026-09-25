/** Ayarlar formlarının ortak metinleri ve rol alanının okunması. */
import { USER_ROLES, type UserRole } from '@kafe/contracts';

/** Kayıtlar fiziksel olarak silinmez; geçmiş adisyon ve raporlar için korunur. */
export const DEACTIVATE_DETAIL =
  'Kayıt silinmez. Geçmiş adisyon, rapor ve işlem geçmişi bozulmasın diye korunur; ' +
  'listede "Pasif" olarak görünür ve yeni işlemlerde kullanılamaz. İstediğiniz zaman ' +
  'yeniden aktifleştirebilirsiniz.';

export function readUserRole(value: FormDataEntryValue | null): UserRole {
  const role = String(value ?? 'WAITER');
  return USER_ROLES.find((candidate) => candidate === role) ?? 'WAITER';
}
