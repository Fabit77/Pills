"use client";

import { Clock3, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

type TimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  ariaLabel?: string;
};

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = Array.from({ length: 60 }, (_, index) => index);
const PERIODS = ["a.m.", "p.m."] as const;
const ITEM_HEIGHT = 42;

function parseTime(value: string) {
  const [rawHour = "0", rawMinute = "0"] = value.split(":");
  const hour24 = Math.min(23, Math.max(0, Number(rawHour) || 0));
  const minute = Math.min(59, Math.max(0, Number(rawMinute) || 0));
  const period: (typeof PERIODS)[number] = hour24 >= 12 ? "p.m." : "a.m.";
  return { hour: hour24 % 12 || 12, minute, period };
}

function toTime(hour: number, minute: number, period: (typeof PERIODS)[number]) {
  const hour24 = period === "p.m." ? (hour % 12) + 12 : hour % 12;
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function TimeColumn<T extends string | number>({
  label,
  options,
  value,
  format,
  onSelect,
}: {
  label: string;
  options: readonly T[];
  value: T;
  format: (option: T) => string;
  onSelect: (option: T) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const settleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const index = options.indexOf(value);
    if (listRef.current && index >= 0) listRef.current.scrollTop = index * ITEM_HEIGHT;
  }, [options, value]);

  useEffect(() => () => {
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
  }, []);

  function selectNearest() {
    if (!listRef.current) return;
    const index = Math.min(options.length - 1, Math.max(0, Math.round(listRef.current.scrollTop / ITEM_HEIGHT)));
    onSelect(options[index]);
  }

  return <div className="time-picker-column-wrap">
    <span>{label}</span>
    <div
      ref={listRef}
      className="time-picker-column"
      role="listbox"
      aria-label={label}
      onScroll={() => {
        if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = window.setTimeout(selectNearest, 90);
      }}
    >
      <i aria-hidden="true" />
      {options.map((option) => <button
        type="button"
        role="option"
        aria-selected={option === value}
        className={option === value ? "selected" : ""}
        key={String(option)}
        onClick={() => {
          onSelect(option);
          const index = options.indexOf(option);
          listRef.current?.scrollTo({ top: index * ITEM_HEIGHT, behavior: "smooth" });
        }}
      >{format(option)}</button>)}
      <i aria-hidden="true" />
    </div>
  </div>;
}

export function TimePicker({ value, onChange, name, ariaLabel = "Seleccionar hora" }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const selected = parseTime(value);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function update(next: Partial<typeof selected>) {
    const time = { ...selected, ...next };
    onChange(toTime(time.hour, time.minute, time.period));
  }

  return <div className="time-picker" ref={rootRef}>
    {name && <input type="hidden" name={name} value={value} />}
    <button
      type="button"
      className={`time-picker-trigger ${open ? "open" : ""}`}
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={id}
      onClick={() => setOpen((current) => !current)}
    >
      <span>{String(selected.hour).padStart(2, "0")}:{String(selected.minute).padStart(2, "0")} <em>{selected.period}</em></span>
      <Clock3 aria-hidden="true" />
    </button>
    {open && <div className="time-picker-popover" id={id} role="dialog" aria-label={ariaLabel}>
      <header><div><strong>Elige una hora</strong><small>Desliza hacia arriba o abajo</small></div><button type="button" aria-label="Cerrar selector de hora" onClick={() => setOpen(false)}><X /></button></header>
      <div className="time-picker-wheels">
        <TimeColumn label="Hora" options={HOURS} value={selected.hour} format={(hour) => String(hour).padStart(2, "0")} onSelect={(hour) => update({ hour })} />
        <TimeColumn label="Minutos" options={MINUTES} value={selected.minute} format={(minute) => String(minute).padStart(2, "0")} onSelect={(minute) => update({ minute })} />
        <TimeColumn label="Periodo" options={PERIODS} value={selected.period} format={(period) => period} onSelect={(period) => update({ period })} />
      </div>
      <footer><span>El desplazamiento termina en el primer y último valor.</span><button type="button" onClick={() => setOpen(false)}>Listo</button></footer>
    </div>}
  </div>;
}
