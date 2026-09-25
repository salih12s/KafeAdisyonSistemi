import { Plus } from 'lucide-react';
import { Button } from '../../../shared/ui/button';

/** Panel başlığının sağında duran birincil ekleme düğmesi. */
export function AddButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: string;
}): JSX.Element {
  return (
    <Button
      type="button"
      size="small"
      onClick={onClick}
      icon={<Plus aria-hidden="true" className="h-4 w-4" />}
    >
      {children}
    </Button>
  );
}
