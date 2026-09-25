export function ActiveCheckbox({
  name,
  defaultChecked,
  label,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
}): JSX.Element {
  return (
    <label className="flex min-h-touch items-center gap-2 text-sm sm:col-span-2">
      <input
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="h-4 w-4 accent-primary"
      />
      {label}
    </label>
  );
}
