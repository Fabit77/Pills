"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const serverZone = () => "";

function offsetLabel(date: Date) {
  const totalMinutes = -date.getTimezoneOffset();
  const sign = totalMinutes >= 0 ? "+" : "-";
  const hours = Math.floor(Math.abs(totalMinutes) / 60);
  const minutes = Math.abs(totalMinutes) % 60;
  return `GMT${sign}${hours}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;
}

export function TimeZonePreview({ date, time }: { date: string; time: string }) {
  const zone = useSyncExternalStore(subscribe, browserZone, serverZone);
  if (!zone) return <small className="time-zone-preview">Detectando tu zona horaria…</small>;

  const localDate = date ? new Date(`${date}T${time || "00:00"}`) : new Date();
  if (!date && time) {
    const [hours, minutes] = time.split(":").map(Number);
    localDate.setHours(hours, minutes, 0, 0);
  }
  const displayTime = new Intl.DateTimeFormat("es-CL", { hour: "numeric", minute: "2-digit", hour12: true }).format(localDate);
  return <small className="time-zone-preview">{displayTime} {offsetLabel(localDate)} · {zone.replaceAll("_", " ")}</small>;
}
