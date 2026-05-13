"use client";

import { useEffect, useRef } from "react";
import { Stroke } from "@/types/game";

export default function ResultCanvas({
  strokes,
  aspectRatio = "4 / 3",
  className = "",
}: {
  strokes: Stroke[];
  aspectRatio?: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wrap = canvas.parentElement;
    if (!wrap) return;
    const draw = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);
      strokes.forEach((s) => {
        if (!s.points || s.points.length === 0) return;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        s.points.forEach((p, i) => {
          const x = p.x * rect.width;
          const y = p.y * rect.height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      });
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [strokes]);
  return (
    <div className={`bg-white rounded-2xl border border-black/5 ${className}`} style={{ aspectRatio }}>
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
