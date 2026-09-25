import { optionalErrorMessage } from '../lib/error-message';

/** Form altındaki hata satırı; hata yoksa hiçbir şey çizmez. */
export function ErrorText({ error }: { error: unknown }): JSX.Element | null {
  const message = optionalErrorMessage(error);
  if (message === undefined) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {message}
    </p>
  );
}
