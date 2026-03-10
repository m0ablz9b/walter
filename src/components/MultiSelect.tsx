import { useState, useRef, useEffect } from "react";

interface Props {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  formatOption?: (value: string) => string;
}

export default function MultiSelect({
  label,
  options,
  selected,
  onChange,
  formatOption,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const allSelected = selected.size === 0;
  const display = allSelected
    ? label
    : selected.size === 1
      ? (formatOption ?? String)([...selected][0])
      : `${label} (${selected.size})`;

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onChange(next);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`border rounded px-2 py-1.5 text-sm bg-white text-left min-w-[120px] flex items-center justify-between gap-1 ${
          allSelected ? "border-gray-300 text-gray-700" : "border-blue-400 text-blue-700"
        }`}
      >
        <span className="truncate">{display}</span>
        <span className="text-xs text-gray-400">{open ? "\u25B2" : "\u25BC"}</span>
      </button>
      {open && (
        <div className="absolute z-10 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-60 overflow-y-auto min-w-[160px]">
          <button
            type="button"
            onClick={() => onChange(new Set())}
            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 ${
              allSelected ? "font-medium text-blue-600" : "text-gray-600"
            }`}
          >
            All
          </button>
          <div className="border-t border-gray-100" />
          {options.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.has(opt)}
                onChange={() => toggle(opt)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="truncate">
                {formatOption ? formatOption(opt) : opt}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
