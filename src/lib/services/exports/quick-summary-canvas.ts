import type {
  QuickSummaryData,
  QuickSummaryLayout,
  QuickSummaryProjectItem,
  QuickSummaryTaskItem,
  QuickSummaryTheme,
} from "./quick-summary-data";

interface ThemePalette {
  bg: string;
  cardBg: string;
  cardBorder: string;
  textPrimary: string;
  textMuted: string;
  accentBlue: string;
  accentGold: string;
  pillBg: string;
  pillText: string;
  noteBg: string;
  noteBorder: string;
  noteText: string;
}

const LIGHT_PALETTE: ThemePalette = {
  bg: "#F1F5F9",
  cardBg: "#FFFFFF",
  cardBorder: "#E2E8F0",
  textPrimary: "#0F172A",
  textMuted: "#475569",
  accentBlue: "#0D3594",
  accentGold: "#F59E0B",
  pillBg: "#EEF2FF",
  pillText: "#1E3A8A",
  noteBg: "#FFFBEB",
  noteBorder: "#FCD34D",
  noteText: "#92400E",
};

const DARK_PALETTE: ThemePalette = {
  bg: "#0B1120",
  cardBg: "#161B26",
  cardBorder: "#273244",
  textPrimary: "#F8FAFC",
  textMuted: "#94A3B8",
  accentBlue: "#3B82F6",
  accentGold: "#FBBF24",
  pillBg: "#1E293B",
  pillText: "#93C5FD",
  noteBg: "#2A1F0B",
  noteBorder: "#78350F",
  noteText: "#FDE68A",
};

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function fillAndStrokeCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke?: string,
) {
  drawRoundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

function priorityColors(priority: string): { bg: string; fg: string } {
  switch (priority.toUpperCase()) {
    case "URGENT":
      return { bg: "#FEE2E2", fg: "#991B1B" };
    case "HIGH":
      return { bg: "#FFEDD5", fg: "#9A3412" };
    case "LOW":
      return { bg: "#E2E8F0", fg: "#475569" };
    default:
      return { bg: "#DBEAFE", fg: "#1E40AF" };
  }
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  bg: string,
  fg: string,
  font = "700 18px 'Segoe UI', system-ui, -apple-system, sans-serif",
): number {
  ctx.font = font;
  const width = Math.ceil(ctx.measureText(text).width) + 22;
  fillAndStrokeCard(ctx, x, y, width, 30, 8, bg);
  ctx.fillStyle = fg;
  ctx.fillText(text, x + 11, y + 21);
  return width;
}

function measureProjectCard(
  ctx: CanvasRenderingContext2D,
  p: QuickSummaryProjectItem,
  cardWidth: number,
): number {
  ctx.font = "700 24px 'Segoe UI', system-ui, -apple-system, sans-serif";
  const titleLines = wrapLines(ctx, p.title, cardWidth - 190);
  let h = 24 + Math.max(1, titleLines.length) * 30 + 10;
  h += 28; // When line
  if (p.recurrenceLabel) h += 28;
  h += 28; // Where / Lead / RSVP line
  return h + 22;
}

function drawProjectCard(
  ctx: CanvasRenderingContext2D,
  p: QuickSummaryProjectItem,
  x: number,
  y: number,
  w: number,
  palette: ThemePalette,
): number {
  const h = measureProjectCard(ctx, p, w);
  fillAndStrokeCard(ctx, x, y, w, h, 16, palette.cardBg, palette.cardBorder);

  // Left navy accent stripe
  drawRoundRect(ctx, x, y, 7, h, 4);
  ctx.fillStyle = palette.accentBlue;
  ctx.fill();

  const badgeFont =
    "700 18px 'Segoe UI', system-ui, -apple-system, sans-serif";
  ctx.font = badgeFont;
  const statusWidth = Math.ceil(ctx.measureText(p.statusLabel).width) + 22;
  drawBadge(
    ctx,
    x + w - 22 - statusWidth,
    y + 20,
    p.statusLabel,
    palette.pillBg,
    palette.pillText,
    badgeFont,
  );

  ctx.font = "700 24px 'Segoe UI', system-ui, -apple-system, sans-serif";
  ctx.fillStyle = palette.textPrimary;
  const titleLines = wrapLines(ctx, p.title, w - 200);
  let cursorY = y + 44;
  for (const line of titleLines) {
    ctx.fillText(line, x + 26, cursorY);
    cursorY += 30;
  }

  cursorY += 4;
  ctx.font = "600 19px 'Segoe UI', system-ui, -apple-system, sans-serif";
  ctx.fillStyle = palette.accentBlue;
  ctx.fillText(`${p.whenLabel}  (${p.kindLabel})`, x + 26, cursorY);
  cursorY += 28;

  if (p.recurrenceLabel) {
    ctx.font = "600 18px 'Segoe UI', system-ui, -apple-system, sans-serif";
    ctx.fillStyle = palette.textMuted;
    ctx.fillText(`Repeat: ${p.recurrenceLabel}`, x + 26, cursorY);
    cursorY += 28;
  }

  ctx.font = "500 18px 'Segoe UI', system-ui, -apple-system, sans-serif";
  ctx.fillStyle = palette.textMuted;
  const footerMeta = [
    `Where: ${p.location}`,
    `Lead: ${p.chairName}`,
    `${p.rsvpGoing} going`,
    p.tasksProgressLabel,
  ]
    .filter(Boolean)
    .join("   |   ");
  const metaLines = wrapLines(ctx, footerMeta, w - 52);
  ctx.fillText(metaLines[0] ?? "", x + 26, cursorY);

  return h;
}

function measureTaskCard(
  ctx: CanvasRenderingContext2D,
  t: QuickSummaryTaskItem,
  cardWidth: number,
  includeSubtasks: boolean,
): number {
  ctx.font = "700 22px 'Segoe UI', system-ui, -apple-system, sans-serif";
  const titleLines = wrapLines(ctx, t.title, cardWidth - 180);
  let h = 22 + Math.max(1, titleLines.length) * 28 + 8;
  h += 28; // Assignee + Due date line
  if (includeSubtasks && t.checklist.length > 0) {
    const shown = Math.min(4, t.checklist.length);
    h += shown * 26 + 8;
    if (t.checklist.length > 4) h += 24;
  }
  return h + 20;
}

function drawTaskCard(
  ctx: CanvasRenderingContext2D,
  t: QuickSummaryTaskItem,
  x: number,
  y: number,
  w: number,
  includeSubtasks: boolean,
  palette: ThemePalette,
): number {
  const h = measureTaskCard(ctx, t, w, includeSubtasks);
  fillAndStrokeCard(ctx, x, y, w, h, 16, palette.cardBg, palette.cardBorder);

  const prColors = priorityColors(t.priority);
  const badgeW = drawBadge(ctx, x + 22, y + 18, t.priority.toUpperCase(), prColors.bg, prColors.fg);

  ctx.font = "700 22px 'Segoe UI', system-ui, -apple-system, sans-serif";
  ctx.fillStyle = palette.textPrimary;
  const titleLines = wrapLines(ctx, t.title, w - badgeW - 64);
  let cursorY = y + 40;
  titleLines.forEach((line, idx) => {
    ctx.fillText(line, idx === 0 ? x + 32 + badgeW : x + 22, cursorY);
    cursorY += 28;
  });

  ctx.font = "500 18px 'Segoe UI', system-ui, -apple-system, sans-serif";
  ctx.fillStyle = t.isOverdue ? "#DC2626" : palette.textMuted;
  const duePrefix = t.isOverdue ? "OVERDUE · Due " : "Due ";
  const line2 = [
    `${duePrefix}${t.dueDateLabel}`,
    `Assigned: ${t.assignees.join(", ")}`,
    t.projectTitle ? `Project: ${t.projectTitle}` : null,
  ]
    .filter(Boolean)
    .join("   |   ");
  const metaLines = wrapLines(ctx, line2, w - 44);
  ctx.fillText(metaLines[0] ?? "", x + 22, cursorY);
  cursorY += 28;

  if (includeSubtasks && t.checklist.length > 0) {
    cursorY += 4;
    ctx.font = "500 18px 'Segoe UI', system-ui, -apple-system, sans-serif";
    t.checklist.slice(0, 4).forEach((sub) => {
      ctx.fillStyle = sub.completed ? "#10B981" : palette.textMuted;
      const prefix = sub.completed ? "✓" : "☐";
      const label = `${prefix} ${sub.title}${
        sub.assignedMemberName ? ` (${sub.assignedMemberName})` : ""
      }`;
      const subLines = wrapLines(ctx, label, w - 68);
      ctx.fillText(subLines[0] ?? "", x + 34, cursorY);
      cursorY += 26;
    });
    if (t.checklist.length > 4) {
      ctx.fillStyle = palette.textMuted;
      ctx.fillText(`+${t.checklist.length - 4} more subtasks`, x + 34, cursorY);
    }
  }

  return h;
}

/**
 * Renders the summary card directly onto an HTMLCanvasElement (both for live WYSIWYG
 * modal preview and crisp PNG blob export) using pure 2D drawing.
 */
export function renderQuickSummaryCanvas(
  canvas: HTMLCanvasElement,
  data: QuickSummaryData,
  options: {
    theme: QuickSummaryTheme;
    layout: QuickSummaryLayout;
  },
): { width: number; height: number } | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const palette = options.theme === "DARK" ? DARK_PALETTE : LIGHT_PALETTE;
  const twoCol = options.layout === "WIDE" && data.mode === "COMBINED";
  const width = twoCol ? 1400 : 1080;
  const padX = 48;
  const contentW = width - padX * 2;
  const colW = twoCol ? (contentW - 28) / 2 : contentW;

  const shownProjects = data.projects.slice(0, 8);
  const shownTasks = data.tasks.slice(0, 10);

  // Compute exact dynamic height before painting
  ctx.font = "700 24px 'Segoe UI', system-ui, -apple-system, sans-serif";
  const projectsBlockHeight =
    data.mode === "TASKS_ONLY"
      ? 0
      : 54 +
        (shownProjects.length === 0
          ? 90
          : shownProjects.reduce(
              (acc, p) => acc + measureProjectCard(ctx, p, colW) + 16,
              0,
            )) +
        (data.projects.length > shownProjects.length ? 34 : 0);

  const tasksBlockHeight =
    data.mode === "PROJECTS_ONLY"
      ? 0
      : 54 +
        (shownTasks.length === 0
          ? 90
          : shownTasks.reduce(
              (acc, t) =>
                acc + measureTaskCard(ctx, t, colW, data.includeSubtasks) + 16,
              0,
            )) +
        (data.tasks.length > shownTasks.length ? 34 : 0);

  const bodyHeight = twoCol
    ? Math.max(projectsBlockHeight, tasksBlockHeight)
    : projectsBlockHeight +
      (projectsBlockHeight > 0 && tasksBlockHeight > 0 ? 20 : 0) +
      tasksBlockHeight;

  const noteHeight = data.customNote ? 92 : 0;
  const height = Math.max(
    520,
    220 + // Header banner
      130 + // KPI strip
      bodyHeight +
      noteHeight +
      84, // Footer
  );

  canvas.width = width;
  canvas.height = height;

  // Background
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);

  // Header gradient banner
  const grad = ctx.createLinearGradient(0, 0, width, 210);
  grad.addColorStop(0, "#0D3594");
  grad.addColorStop(1, "#1E3A8A");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, 210);

  // Gold accent bar
  ctx.fillStyle = palette.accentGold;
  ctx.fillRect(padX, 34, 72, 6);

  ctx.font = "700 20px 'Segoe UI', system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#BFDBFE";
  ctx.fillText(
    `${data.clubName.toUpperCase()}  |  DISTRICT ${data.districtCode}`,
    padX,
    72,
  );

  ctx.font = "800 40px 'Segoe UI', system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(data.headline, padX, 126);

  const ryText =
    data.rotaryYear && data.rotaryYear !== "ALL"
      ? `RY ${data.rotaryYear}`
      : "All Rotary Years";
  ctx.font = "500 22px 'Segoe UI', system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#DBEAFE";
  ctx.fillText(
    `${data.timeframeLabel}   ·   ${ryText}   ·   Asia/Manila`,
    padX,
    168,
  );

  // KPI cards row
  const kpiY = 236;
  const kpiItems =
    data.mode === "TASKS_ONLY"
      ? [
          { value: String(data.stats.openTasksCount), label: "Open Tasks" },
          {
            value: String(data.stats.urgentTasksCount),
            label: "High / Urgent Priority",
          },
          {
            value: `${data.stats.subtasksDone}/${data.stats.subtasksTotal}`,
            label: "Subtasks Completed",
          },
        ]
      : data.mode === "PROJECTS_ONLY"
        ? [
            {
              value: String(data.stats.projectsCount),
              label: "Scheduled Projects & Events",
            },
            { value: String(data.stats.sessionsCount), label: "Plotted Sessions" },
            {
              value: String(data.stats.openTasksCount),
              label: "Open Related Tasks",
            },
          ]
        : [
            {
              value: String(data.stats.projectsCount),
              label: "Projects & Events",
            },
            { value: String(data.stats.sessionsCount), label: "Sessions" },
            { value: String(data.stats.openTasksCount), label: "Open Tasks" },
            {
              value: `${data.stats.subtasksDone}/${data.stats.subtasksTotal}`,
              label: "Subtasks Done",
            },
          ];

  const kpiGap = 18;
  const kpiW = (contentW - kpiGap * (kpiItems.length - 1)) / kpiItems.length;
  kpiItems.forEach((k, idx) => {
    const kx = padX + idx * (kpiW + kpiGap);
    fillAndStrokeCard(
      ctx,
      kx,
      kpiY,
      kpiW,
      98,
      14,
      palette.cardBg,
      palette.cardBorder,
    );
    ctx.font = "800 34px 'Segoe UI', system-ui, -apple-system, sans-serif";
    ctx.fillStyle = palette.accentBlue;
    ctx.fillText(k.value, kx + 20, kpiY + 46);
    ctx.font = "600 18px 'Segoe UI', system-ui, -apple-system, sans-serif";
    ctx.fillStyle = palette.textMuted;
    ctx.fillText(k.label, kx + 20, kpiY + 78);
  });

  const startContentY = kpiY + 126;

  // Helper to paint sections
  const drawProjectsSection = (x: number, y: number, w: number): number => {
    let curY = y;
    ctx.font = "800 22px 'Segoe UI', system-ui, -apple-system, sans-serif";
    ctx.fillStyle = palette.accentBlue;
    ctx.fillText(
      `PROJECTS & SCHEDULE (${data.projects.length})`,
      x,
      curY + 24,
    );
    curY += 44;

    if (shownProjects.length === 0) {
      fillAndStrokeCard(
        ctx,
        x,
        curY,
        w,
        78,
        14,
        palette.cardBg,
        palette.cardBorder,
      );
      ctx.font = "500 20px 'Segoe UI', system-ui, -apple-system, sans-serif";
      ctx.fillStyle = palette.textMuted;
      ctx.fillText(
        "No upcoming projects or activities match this timeframe.",
        x + 22,
        curY + 46,
      );
      return curY + 94 - y;
    }

    for (const p of shownProjects) {
      const cardH = drawProjectCard(ctx, p, x, curY, w, palette);
      curY += cardH + 16;
    }

    if (data.projects.length > shownProjects.length) {
      ctx.font = "600 18px 'Segoe UI', system-ui, -apple-system, sans-serif";
      ctx.fillStyle = palette.textMuted;
      ctx.fillText(
        `+${data.projects.length - shownProjects.length} more projects/activities on Racspeed`,
        x + 8,
        curY + 16,
      );
      curY += 32;
    }
    return curY - y;
  };

  const drawTasksSection = (x: number, y: number, w: number): number => {
    let curY = y;
    ctx.font = "800 22px 'Segoe UI', system-ui, -apple-system, sans-serif";
    ctx.fillStyle = palette.accentBlue;
    ctx.fillText(
      `TASKS & DELIVERABLES (${data.tasks.length})`,
      x,
      curY + 24,
    );
    curY += 44;

    if (shownTasks.length === 0) {
      fillAndStrokeCard(
        ctx,
        x,
        curY,
        w,
        78,
        14,
        palette.cardBg,
        palette.cardBorder,
      );
      ctx.font = "500 20px 'Segoe UI', system-ui, -apple-system, sans-serif";
      ctx.fillStyle = palette.textMuted;
      ctx.fillText("All tracked tasks are completed!", x + 22, curY + 46);
      return curY + 94 - y;
    }

    for (const t of shownTasks) {
      const cardH = drawTaskCard(
        ctx,
        t,
        x,
        curY,
        w,
        data.includeSubtasks,
        palette,
      );
      curY += cardH + 16;
    }

    if (data.tasks.length > shownTasks.length) {
      ctx.font = "600 18px 'Segoe UI', system-ui, -apple-system, sans-serif";
      ctx.fillStyle = palette.textMuted;
      ctx.fillText(
        `+${data.tasks.length - shownTasks.length} more open tasks on Racspeed`,
        x + 8,
        curY + 16,
      );
      curY += 32;
    }
    return curY - y;
  };

  let bottomY = startContentY;
  if (twoCol) {
    const hLeft = drawProjectsSection(padX, startContentY, colW);
    const hRight = drawTasksSection(padX + colW + 28, startContentY, colW);
    bottomY = startContentY + Math.max(hLeft, hRight);
  } else {
    if (data.mode !== "TASKS_ONLY") {
      bottomY += drawProjectsSection(padX, bottomY, contentW);
    }
    if (data.mode !== "PROJECTS_ONLY") {
      if (data.mode === "COMBINED") bottomY += 16;
      bottomY += drawTasksSection(padX, bottomY, contentW);
    }
  }

  // Optional custom GC note banner
  if (data.customNote) {
    const noteY = height - 152;
    fillAndStrokeCard(
      ctx,
      padX,
      noteY,
      contentW,
      70,
      14,
      palette.noteBg,
      palette.noteBorder,
    );
    ctx.font = "700 20px 'Segoe UI', system-ui, -apple-system, sans-serif";
    ctx.fillStyle = palette.noteText;
    const noteLines = wrapLines(ctx, `Note: ${data.customNote}`, contentW - 44);
    ctx.fillText(noteLines[0] ?? "", padX + 22, noteY + 42);
    void bottomY;
  }

  // Footer
  ctx.fillStyle = palette.cardBorder;
  ctx.fillRect(padX, height - 62, contentW, 1.5);
  ctx.font = "600 18px 'Segoe UI', system-ui, -apple-system, sans-serif";
  ctx.fillStyle = palette.textMuted;
  ctx.fillText(
    `Generated via Racspeed  ·  ${data.generatedAtLabel}`,
    padX,
    height - 26,
  );
  const rightText = "Open Racspeed to RSVP & update task progress";
  const rightW = ctx.measureText(rightText).width;
  ctx.fillText(rightText, width - padX - rightW, height - 26);

  return { width, height };
}

export async function exportQuickSummaryPngBlob(
  data: QuickSummaryData,
  options: {
    theme: QuickSummaryTheme;
    layout: QuickSummaryLayout;
  },
): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const offscreen = document.createElement("canvas");
  const rendered = renderQuickSummaryCanvas(offscreen, data, options);
  if (!rendered) return null;

  return new Promise<Blob | null>((resolve) => {
    offscreen.toBlob((blob) => resolve(blob), "image/png");
  });
}
