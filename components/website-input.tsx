"use client";

import { Check, Globe2, X } from "lucide-react";
import { useRef, useState } from "react";
import { normalizeWebsiteUrl, websiteLabel } from "@/lib/website";

type WebsiteInputProps = {
  name?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

export function WebsiteInput({ name = "eventUrl", defaultValue = "", onValueChange }: WebsiteInputProps) {
  const initialUrl = normalizeWebsiteUrl(defaultValue);
  const [draft, setDraft] = useState(initialUrl || defaultValue);
  const [confirmed, setConfirmed] = useState(Boolean(initialUrl));
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function confirm() {
    const normalized = normalizeWebsiteUrl(draft);
    if (!draft.trim()) { setError(""); onValueChange?.(""); return; }
    if (!normalized) { setError("Escribe un dominio válido, por ejemplo asadao.io"); return; }
    setDraft(normalized);
    setError("");
    setConfirmed(true);
    onValueChange?.(normalized);
  }

  function edit() {
    setConfirmed(false);
    setError("");
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }

  return <div className={`website-input ${confirmed ? "confirmed" : ""}`}>
    <span>Sitio web</span>
    {confirmed ? <div className="website-confirmed">
      <Globe2 aria-hidden="true" />
      <span><strong>{websiteLabel(draft)}</strong><small><Check /> Sitio web confirmado</small></span>
      <input type="hidden" name={name} value={draft} />
      <button type="button" onClick={edit} aria-label="Cambiar sitio web"><X /></button>
    </div> : <>
      <div className="website-editing">
        <Globe2 aria-hidden="true" />
        <input
          ref={inputRef}
          name={name}
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={draft}
          onChange={(event) => { setDraft(event.target.value); setError(""); onValueChange?.(event.target.value); }}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); confirm(); } }}
          placeholder="asadao.io o www.asadao.io"
        />
        <button type="button" onClick={confirm}>Confirmar</button>
      </div>
      <small className={error ? "website-error" : "website-help"}>{error || "Escribe el dominio y presiona Enter para confirmarlo."}</small>
    </>}
  </div>;
}
