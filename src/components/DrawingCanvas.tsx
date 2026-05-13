"use client";

import { useEffect, useRef, useState } from "react";
import { Point, Stroke } from "@/types/game";
import { isStrokeValid } from "@/lib/gameLogic";

type Props = {
  strokes: Stroke[];
  liveStroke: Stroke | null;
  myColor: string;
  myPlayerId: string;
  canDraw: boolean;
  onLiveStrokeUpdate?: (stroke: Stroke | null) => void;
  onStrokeComplete: (stroke: Stroke) => void;
  showEmptyHint?: boolean;
};

export default function DrawingCanvas({
  strokes,
  liveStroke,
  myColor,
  myPlayerId,
  canDraw,
  onLiveStrokeUpdate,
  onStrokeComplete,
  showEmptyHint = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [invalidToast, setInvalidToast] = useState(0);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const strokeDoneRef = useRef(false);
  const sizeRef = useRef({ w: 0, h: 0 });
  const lastLiveUpdateRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
      sizeRef.current = { w: rect.width, h: rect.height };
      redraw();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, liveStroke]);

  useEffect(() => {
    strokeDoneRef.current = false;
    currentStrokeRef.current = null;
  }, [canDraw, myPlayerId]);

  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach((s) => drawStroke(ctx, s, w, h));
    if (liveStroke) drawStroke(ctx, liveStroke, w, h);
    if (currentStrokeRef.current && currentStrokeRef.current !== liveStroke) {
      drawStroke(ctx, currentStrokeRef.current, w, h);
    }
  }

  function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, w: number, h: number) {
    if (!stroke.points || stroke.points.length === 0) return;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    stroke.points.forEach((p, i) => {
      const x = p.x * w;
      const y = p.y * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  function getPos(e: TouchEvent | MouseEvent): Point {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    const cx = "touches" in e ? e.touches[0]?.clientX ?? 0 : (e as MouseEvent).clientX;
    const cy = "touches" in e ? e.touches[0]?.clientY ?? 0 : (e as MouseEvent).clientY;
    return { x: (cx - r.left) / r.width, y: (cy - r.top) / r.height };
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canDraw) return;
    const handleStart = (e: TouchEvent | MouseEvent) => {
      e.preventDefault();
      if (strokeDoneRef.current) return;
      const p = getPos(e);
      const newStroke: Stroke = { color: myColor, playerId: myPlayerId, points: [p] };
      currentStrokeRef.current = newStroke;
      onLiveStrokeUpdate?.(newStroke);
      lastLiveUpdateRef.current = Date.now();
      redraw();
    };
    const handleMove = (e: TouchEvent | MouseEvent) => {
      e.preventDefault();
      if (!currentStrokeRef.current || strokeDoneRef.current) return;
      const p = getPos(e);
      const stroke = currentStrokeRef.current;
      const last = stroke.points[stroke.points.length - 1];
      const { w, h } = sizeRef.current;
      const dx = (last.x - p.x) * w;
      const dy = (last.y - p.y) * h;
      if (Math.sqrt(dx * dx + dy * dy) < 1) return;
      stroke.points.push(p);
      redraw();
      const now = Date.now();
      if (now - lastLiveUpdateRef.current > 50) {
        onLiveStrokeUpdate?.(stroke);
        lastLiveUpdateRef.current = now;
      }
    };
    const handleEnd = (e: TouchEvent | MouseEvent) => {
      e.preventDefault();
      const stroke = currentStrokeRef.current;
      if (!stroke || strokeDoneRef.current) return;
      const { w, h } = sizeRef.current;
      if (!isStrokeValid(stroke.points, w, h)) {
        currentStrokeRef.current = null;
        onLiveStrokeUpdate?.(null);
        setInvalidToast(Date.now());
        setTimeout(() => setInvalidToast(0), 1500);
        redraw();
        return;
      }
      strokeDoneRef.current = true;
      onStrokeComplete(stroke);
      currentStrokeRef.current = null;
    };
    canvas.addEventListener("touchstart", handleStart, { passive: false });
    canvas.addEventListener("touchmove", handleMove, { passive: false });
    canvas.addEventListener("touchend", handleEnd);
    canvas.addEventListener("touchcancel", handleEnd);
    canvas.addEventListener("mousedown", handleStart);
    canvas.addEventListener("mousemove", handleMove);
    canvas.addEventListener("mouseup", handleEnd);
    canvas.addEventListener("mouseleave", handleEnd);
    return () => {
      canvas.removeEventListener("touchstart", handleStart);
      canvas.removeEventListener("touchmove", handleMove);
      canvas.removeEventListener("touchend", handleEnd);
      canvas.removeEventListener("touchcancel", handleEnd);
      canvas.removeEventListener("mousedown", handleStart);
      canvas.removeEventListener("mousemove", handleMove);
      canvas.removeEventListener("mouseup", handleEnd);
      canvas.removeEventListener("mouseleave", handleEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canDraw, myColor, myPlayerId, onStrokeComplete, onLiveStrokeUpdate]);

  // 내 차례면 캔버스 테두리 강조 (9번 요구사항)
  const borderStyle = canDraw
    ? { borderColor: myColor, borderWidth: "4px", boxShadow: `0 0 0 2px ${myColor}33` }
    : {};

  return (
    <div
      ref={wrapRef}
      className="relative bg-white rounded-2xl overflow-hidden flex-1 min-h-0 border-2 border-black/5 transition-all"
      style={borderStyle}
    >
      <canvas ref={canvasRef} className="block w-full h-full touch-none" />
      {showEmptyHint && strokes.length === 0 && !liveStroke && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-black/15 text-base font-semibold text-center">
            한 번에 한 획만
            <br />
            펜을 떼면 다음 사람으로
          </p>
        </div>
      )}
      {invalidToast > 0 && (
        <div className="invalid-toast-anim absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/85 text-white px-4 py-2.5 rounded-full text-xs font-medium pointer-events-none whitespace-nowrap">
          점만 찍으면 무효 - 선을 그어주세요
        </div>
      )}
    </div>
  );
}
