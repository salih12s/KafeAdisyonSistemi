import { Badge } from './badge';

/** Kaydın aktif/pasif durumunu gösteren rozet. */
export function StatusBadge({ isActive }: { isActive: boolean }): JSX.Element {
  return <Badge tone={isActive ? 'success' : 'neutral'}>{isActive ? 'Aktif' : 'Pasif'}</Badge>;
}
