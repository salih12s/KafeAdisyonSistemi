import { z } from 'zod';

/** Birden fazla modülün router'ında kullanılan doğrulama şemaları. */

export const nameSchema = z.string().trim().min(1).max(100);

export const uuidParamsSchema = z.object({ id: z.string().uuid('Geçerli bir UUID girin.') });

/** `?includeInactive=true` sorgusunu boolean'a çevirir. */
export const includeInactiveSchema = z.object({
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});
