"use client";

import { Minus, Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const SIZE = 500;

export function ArtworkCropper({ file, onCancel, onApply }: { file: File; onCancel: () => void; onApply: (file: File) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const loaded = new window.Image();
    loaded.onload = () => setImage(loaded);
    loaded.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const drawing = useCallback(() => {
    if (!image) return null;
    const baseScale = Math.max(SIZE / image.naturalWidth, SIZE / image.naturalHeight);
    const scale = baseScale * zoom;
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const maxX = Math.max(0, (width - SIZE) / 2);
    const maxY = Math.max(0, (height - SIZE) / 2);
    return { width, height, x: Math.max(-maxX, Math.min(maxX, offset.x)), y: Math.max(-maxY, Math.min(maxY, offset.y)) };
  }, [image, offset, zoom]);

  useEffect(() => {
    const canvas = canvasRef.current; const values = drawing();
    if (!canvas || !image || !values) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, SIZE, SIZE);
    context.drawImage(image, (SIZE - values.width) / 2 + values.x, (SIZE - values.height) / 2 + values.y, values.width, values.height);
  }, [drawing, image]);

  function pointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current || !canvasRef.current) return;
    const ratio = SIZE / canvasRef.current.clientWidth;
    setOffset((current) => ({ x: current.x + (event.clientX - dragRef.current!.x) * ratio, y: current.y + (event.clientY - dragRef.current!.y) * ratio }));
    dragRef.current = { x: event.clientX, y: event.clientY };
  }

  function apply() {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const stem = file.name.replace(/\.[^.]+$/, "") || "pill";
      onApply(new File([blob], `${stem}-recortada.webp`, { type: "image/webp" }));
    }, "image/webp", 0.92);
  }

  return <div className="crop-editor-backdrop"><section className="crop-editor" role="dialog" aria-modal="true" aria-label="Ajustar imagen"><header><div><span>ARTE DE LA PILL</span><h3>Ajusta tu insignia</h3><p>Arrastra la imagen y usa el zoom hasta encuadrarla.</p></div><button type="button" onClick={onCancel} aria-label="Cerrar"><X /></button></header><div className="crop-canvas-shell"><canvas ref={canvasRef} width={SIZE} height={SIZE} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { x: event.clientX, y: event.clientY }; }} onPointerMove={pointerMove} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }} /></div><div className="crop-zoom"><Minus /><input aria-label="Zoom" type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /><Plus /></div><footer><button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button><button type="button" className="primary-button" onClick={apply}>Usar esta imagen</button></footer></section></div>;
}
