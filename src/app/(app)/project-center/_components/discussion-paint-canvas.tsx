"use client";

import React, { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowUpRight,
  Circle,
  Download,
  Eraser,
  Grid,
  Highlighter,
  Loader2,
  Minus,
  Paintbrush,
  Pencil,
  Redo2,
  Send,
  Square,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import { postDiscussionSketchAction } from "@/features/activities/actions";
import { notifyToast } from "@/components/shared/toast-viewport";

type DrawTool =
  | "pen"
  | "highlighter"
  | "eraser"
  | "line"
  | "arrow"
  | "rect"
  | "circle"
  | "text";

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 480;
const MAX_HISTORY = 25;

const COLORS = [
  "#111625", // Slate Dark
  "#0D3594", // Rotary Royal Blue
  "#DC2626", // Red
  "#059669", // Emerald Green
  "#D97706", // Amber Gold
  "#7C3AED", // Violet
  "#0284C7", // Sky Blue
  "#64748B", // Cool Gray
];

const SIZES = [
  { label: "S", px: 2 },
  { label: "M", px: 5 },
  { label: "L", px: 10 },
];

export function DiscussionPaintCanvas({
  activityId,
  onPosted,
}: {
  activityId: string;
  onPosted: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapshotBeforeShapeRef = useRef<ImageData | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const isDrawingRef = useRef(false);

  const [tool, setTool] = useState<DrawTool>("pen");
  const [color, setColor] = useState("#0D3594");
  const [strokeSize, setStrokeSize] = useState(5);
  const [showGrid, setShowGrid] = useState(true);
  const [hasDrawn, setHasDrawn] = useState(false);

  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const [textStampInput, setTextStampInput] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const initBlankCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();
    const blank = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    setHistory([blank]);
    setHistoryIdx(0);
    setHasDrawn(false);
  }, []);

  useEffect(() => {
    initBlankCanvas();
  }, [initBlankCanvas]);

  function pushSnapshot() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const snap = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    setHistory((prev) => {
      const sliced = prev.slice(0, historyIdx + 1);
      const next = [...sliced, snap].slice(-MAX_HISTORY);
      setHistoryIdx(next.length - 1);
      return next;
    });
  }

  function handleUndo() {
    if (historyIdx <= 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const nextIdx = historyIdx - 1;
    ctx.putImageData(history[nextIdx], 0, 0);
    setHistoryIdx(nextIdx);
    setHasDrawn(nextIdx > 0);
  }

  function handleRedo() {
    if (historyIdx >= history.length - 1) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const nextIdx = historyIdx + 1;
    ctx.putImageData(history[nextIdx], 0, 0);
    setHistoryIdx(nextIdx);
    setHasDrawn(true);
  }

  function getCanvasCoords(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function drawArrowHead(
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    size: number,
  ) {
    const headLen = Math.max(10, size * 3);
    const angle = Math.atan2(toY - fromY, toX - fromX);
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLen * Math.cos(angle - Math.PI / 6),
      toY - headLen * Math.sin(angle - Math.PI / 6),
    );
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLen * Math.cos(angle + Math.PI / 6),
      toY - headLen * Math.sin(angle + Math.PI / 6),
    );
    ctx.stroke();
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const pt = getCanvasCoords(e);

    if (tool === "text") {
      const label =
        textStampInput.trim() ||
        (typeof window !== "undefined"
          ? window.prompt("Enter label text to place on board:")?.trim() || ""
          : "");
      if (!label) return;
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.font = `bold ${Math.max(16, strokeSize * 3.2)}px sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillText(label, pt.x, pt.y);
      ctx.restore();
      setHasDrawn(true);
      pushSnapshot();
      return;
    }

    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    startPointRef.current = pt;

    if (
      tool === "line" ||
      tool === "arrow" ||
      tool === "rect" ||
      tool === "circle"
    ) {
      snapshotBeforeShapeRef.current = ctx.getImageData(
        0,
        0,
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
      );
      return;
    }

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (tool === "eraser") {
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = strokeSize * 3;
      ctx.globalAlpha = 1;
    } else if (tool === "highlighter") {
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeSize * 3.5;
      ctx.globalAlpha = 0.28;
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeSize;
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    ctx.lineTo(pt.x + 0.01, pt.y + 0.01);
    ctx.stroke();
    ctx.restore();
    setHasDrawn(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const start = startPointRef.current;
    if (!canvas || !ctx || !start) return;

    const pt = getCanvasCoords(e);

    if (
      tool === "line" ||
      tool === "arrow" ||
      tool === "rect" ||
      tool === "circle"
    ) {
      if (snapshotBeforeShapeRef.current) {
        ctx.putImageData(snapshotBeforeShapeRef.current, 0, 0);
      }
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = 1;
      ctx.beginPath();
      if (tool === "line" || tool === "arrow") {
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
        if (tool === "arrow") {
          drawArrowHead(ctx, start.x, start.y, pt.x, pt.y, strokeSize);
        }
      } else if (tool === "rect") {
        ctx.strokeRect(start.x, start.y, pt.x - start.x, pt.y - start.y);
      } else if (tool === "circle") {
        const rx = Math.abs(pt.x - start.x) / 2;
        const ry = Math.abs(pt.y - start.y) / 2;
        const cx = (start.x + pt.x) / 2;
        const cy = (start.y + pt.y) / 2;
        ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      setHasDrawn(true);
      return;
    }

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (tool === "eraser") {
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = strokeSize * 3;
      ctx.globalAlpha = 1;
    } else if (tool === "highlighter") {
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeSize * 3.5;
      ctx.globalAlpha = 0.28;
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeSize;
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    ctx.restore();
    startPointRef.current = pt;
    setHasDrawn(true);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    startPointRef.current = null;
    snapshotBeforeShapeRef.current = null;
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    pushSnapshot();
  }

  function handleDownloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `${(title.trim() || "project-sketch").toLowerCase().replace(/[^a-z0-9-]+/g, "-")}.png`;
    link.href = url;
    link.click();
  }

  function handleSubmitSketch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (title.trim().length < 2) {
      setError("Please add a short title for your visual summary sketch.");
      return;
    }
    if (!hasDrawn) {
      setError("Draw on the whiteboard before posting your sketch.");
      return;
    }

    startTransition(async () => {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png"),
      );
      if (!blob) {
        setError("Could not export drawing image.");
        return;
      }

      const file = new File([blob], "discussion-sketch.png", {
        type: "image/png",
      });
      const formData = new FormData();
      formData.append("activityId", activityId);
      formData.append("title", title.trim());
      formData.append("summary", summary.trim());
      formData.append("file", file);

      const res = await postDiscussionSketchAction(formData);
      if (!res.success) {
        setError(res.error);
        return;
      }

      notifyToast({
        message: res.message || "Visual summary sketch posted!",
        kind: "success",
      });
      setTitle("");
      setSummary("");
      setTextStampInput("");
      initBlankCanvas();
      onPosted();
    });
  }

  const tools: {
    id: DrawTool;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: "pen", label: "Pen", icon: Pencil },
    { id: "highlighter", label: "Highlight", icon: Highlighter },
    { id: "line", label: "Line", icon: Minus },
    { id: "arrow", label: "Arrow", icon: ArrowUpRight },
    { id: "rect", label: "Box", icon: Square },
    { id: "circle", label: "Circle", icon: Circle },
    { id: "text", label: "Text", icon: Type },
    { id: "eraser", label: "Eraser", icon: Eraser },
  ];

  return (
    <form
      onSubmit={handleSubmitSketch}
      className="rounded-xl border border-[#EDEDF2] bg-white p-4 space-y-3 dark:border-slate-800 dark:bg-[#161B26]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Paintbrush className="h-4 w-4 text-[#0D3594] dark:text-blue-400" />
          <div>
            <h3 className="text-xs font-bold text-[#111625] dark:text-white">
              Visual Summary Whiteboard
            </h3>
            <p className="text-[11px] text-slate-500">
              Sketch venue layouts, workflows, or brainstorm diagrams and attach a summary note.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={historyIdx <= 0}
            onClick={handleUndo}
            title="Undo"
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={historyIdx >= history.length - 1}
            onClick={handleRedo}
            title="Redo"
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowGrid((prev) => !prev)}
            title="Toggle background guide grid"
            aria-pressed={showGrid}
            className={`rounded-lg border p-1.5 transition cursor-pointer ${
              showGrid
                ? "border-blue-300 bg-blue-50 text-[#0D3594] dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300"
                : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800"
            }`}
          >
            <Grid className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDownloadPng}
            title="Download PNG"
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={initBlankCanvas}
            title="Clear canvas"
            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 cursor-pointer"
          >
            <Trash2 className="h-3 w-3" /> Clear
          </button>
        </div>
      </div>

      {/* Drawing Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 p-2 dark:border-slate-700 dark:bg-slate-900/50">
        <div className="flex flex-wrap items-center gap-1">
          {tools.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTool(id)}
              aria-pressed={tool === id}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition cursor-pointer ${
                tool === id
                  ? "bg-[#0D3594] text-white shadow-2xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

        {/* Color Palette */}
        <div className="flex items-center gap-1" role="group" aria-label="Colors">
          {COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={() => {
                setColor(swatch);
                if (tool === "eraser") setTool("pen");
              }}
              aria-label={`Select color ${swatch}`}
              className={`h-5 w-5 rounded-full border-2 transition cursor-pointer ${
                color === swatch && tool !== "eraser"
                  ? "scale-110 border-slate-900 ring-2 ring-[#0D3594]/30 dark:border-white"
                  : "border-white dark:border-slate-800"
              }`}
              style={{ backgroundColor: swatch }}
            />
          ))}
        </div>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

        {/* Stroke Width */}
        <div className="flex items-center gap-1">
          {SIZES.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setStrokeSize(s.px)}
              aria-pressed={strokeSize === s.px}
              className={`rounded-md px-2 py-1 text-[10px] font-bold transition cursor-pointer ${
                strokeSize === s.px
                  ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                  : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {tool === "text" && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs dark:border-blue-500/30 dark:bg-blue-950/20">
          <Type className="h-3.5 w-3.5 text-[#0D3594] dark:text-blue-400 shrink-0" />
          <input
            type="text"
            value={textStampInput}
            onChange={(e) => setTextStampInput(e.target.value)}
            placeholder="Type label here, then click anywhere on the canvas to place it (or click directly to prompt)"
            className="w-full bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-500 dark:text-white"
          />
        </div>
      )}

      {/* Drawing Surface */}
      <div className="relative overflow-hidden rounded-xl border border-slate-300 bg-white dark:border-slate-700">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="block w-full h-auto touch-none cursor-crosshair"
        />
        {showGrid && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                "linear-gradient(to right, #cbd5e1 1px, transparent 1px), linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
        )}
      </div>

      {/* Title + Summary Notes */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-xs font-semibold text-slate-700 dark:text-slate-200 sm:col-span-2">
          <span>
            Sketch Title / Diagram Label <span className="text-rose-500">*</span>
          </span>
          <input
            type="text"
            required
            minLength={2}
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Event Venue Floor Plan, Registration Flow, or Brainstorm Summary"
            className="w-full rounded-lg border border-[#DDE1EA] bg-white px-3 py-2 text-xs text-[#111625] outline-none focus:border-[#0D3594] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </label>

        <label className="block space-y-1 text-xs font-semibold text-slate-700 dark:text-slate-200 sm:col-span-2">
          <span>Summary / Key Takeaways</span>
          <textarea
            rows={2}
            maxLength={4000}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Summarize what this drawing illustrates, decisions made, or next steps..."
            className="w-full rounded-lg border border-[#DDE1EA] bg-white px-3 py-2 text-xs text-[#111625] outline-none focus:border-[#0D3594] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </label>
      </div>

      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-[11px] text-slate-500">
          Posted sketches appear in the pinned Visual Summaries strip and Discussion feed.
        </span>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D3594] px-4 py-2 text-xs font-bold text-white hover:bg-[#092569] disabled:opacity-60 transition cursor-pointer shrink-0"
        >
          {pending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Posting Sketch...
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              Post Visual Summary
            </>
          )}
        </button>
      </div>
    </form>
  );
}

