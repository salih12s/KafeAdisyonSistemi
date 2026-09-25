import { useCallback, useState } from 'react';

/**
 * Yazdırma işini yönetir. Her `print()` yeni bir iş numarası üretir ve
 * `PrintSheet` bu numarayla yeniden takılır; tarayıcı `afterprint` olayını hiç
 * göndermese bile düğme tekrar çalışır.
 */
export function usePrintJob(): { job: number | null; print: () => void; done: () => void } {
  const [job, setJob] = useState<number | null>(null);
  const print = useCallback(() => setJob((current) => (current ?? 0) + 1), []);
  const done = useCallback(() => setJob(null), []);
  return { job, print, done };
}
