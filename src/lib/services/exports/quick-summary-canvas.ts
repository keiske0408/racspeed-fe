import {
  DEFAULT_QUICK_SUMMARY_DESIGN,
  type QuickSummaryCardRadius,
  type QuickSummaryData,
  type QuickSummaryDesignConfig,
  type QuickSummaryFontScale,
  type QuickSummaryLayout,
  type QuickSummaryLogoSize,
  type QuickSummaryNoteTone,
  type QuickSummaryProjectItem,
  type QuickSummaryTaskItem,
  type QuickSummaryTheme,
} from "./quick-summary-data";

interface ThemePalette {
  bg: string;
  cardBg: string;
  cardBorder: string;
  highlightBg: string;
  textPrimary: string;
  textMuted: string;
  accentBlue: string;
  accentGold: string;
  pillBg: string;
  pillText: string;
}

const LIGHT_PALETTE: ThemePalette = {
  bg: "#F1F5F9",
  cardBg: "#FFFFFF",
  cardBorder: "#E2E8F0",
  highlightBg: "#FFFBEB",
  textPrimary: "#0F172A",
  textMuted: "#475569",
  accentBlue: "#0D3594",
  accentGold: "#F59E0B",
  pillBg: "#EEF2FF",
  pillText: "#1E3A8A",
};

const DARK_PALETTE: ThemePalette = {
  bg: "#0B1120",
  cardBg: "#161B26",
  cardBorder: "#273244",
  highlightBg: "#1E2536",
  textPrimary: "#F8FAFC",
  textMuted: "#94A3B8",
  accentBlue: "#3B82F6",
  accentGold: "#FBBF24",
  pillBg: "#1E293B",
  pillText: "#93C5FD",
};

function darkenHex(hex: string, ratio = 0.22): string {
  const clean = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return "#1E3A8A";
  const r = Math.max(0, Math.round(parseInt(clean.slice(0, 2), 16) * (1 - ratio)));
  const g = Math.max(0, Math.round(parseInt(clean.slice(2, 4), 16) * (1 - ratio)));
  const b = Math.max(0, Math.round(parseInt(clean.slice(4, 6), 16) * (1 - ratio)));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function resolveCardRadiusPx(radius: QuickSummaryCardRadius): number {
  switch (radius) {
    case "SHARP":
      return 4;
    case "SOFT":
      return 24;
    case "ROUNDED":
    default:
      return 16;
  }
}

function resolveFontFactor(scale: QuickSummaryFontScale): number {
  switch (scale) {
    case "COMPACT":
      return 0.9;
    case "LARGE":
      return 1.12;
    case "NORMAL":
    default:
      return 1;
  }
}

function resolveLogoPx(size: QuickSummaryLogoSize): number {
  switch (size) {
    case "SM":
      return 58;
    case "LG":
      return 96;
    case "MD":
    default:
      return 76;
  }
}

function resolveNoteToneColors(
  tone: QuickSummaryNoteTone,
  isDark: boolean,
): { bg: string; border: string; text: string } {
  if (isDark) {
    switch (tone) {
      case "BLUE":
        return { bg: "#0F2447", border: "#1D4ED8", text: "#BFDBFE" };
      case "RED":
        return { bg: "#3B1018", border: "#B91C1C", text: "#FECACA" };
      case "GREEN":
        return { bg: "#0B2E22", border: "#047857", text: "#A7F3D0" };
      case "AMBER":
      default:
        return { bg: "#2A1F0B", border: "#78350F", text: "#FDE68A" };
    }
  }
  switch (tone) {
    case "BLUE":
      return { bg: "#EFF6FF", border: "#93C5FD", text: "#1E3A8A" };
    case "RED":
      return { bg: "#FEF2F2", border: "#FCA5A5", text: "#991B1B" };
    case "GREEN":
      return { bg: "#ECFDF5", border: "#6EE7B7", text: "#065F46" };
    case "AMBER":
    default:
      return { bg: "#FFFBEB", border: "#FCD34D", text: "#92400E" };
  }
}

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
  lineWidth = 1.5,
) {
  drawRoundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
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
  fontSize: number,
): number {
  ctx.font = `700 ${fontSize}px 'Segoe UI', system-ui, -apple-system, sans-serif`;
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
  fontFactor: number,
  design: QuickSummaryDesignConfig,
): number {
  const titleSize = Math.round(24 * fontFactor);
  const lineGap = Math.round(28 * fontFactor);
  ctx.font = `700 ${titleSize}px 'Segoe UI', system-ui, -apple-system, sans-serif`;
  const titleMaxW = design.showBadges ? cardWidth - 190 : cardWidth - 52;
  const titleLines = wrapLines(ctx, p.title, titleMaxW);
  let h = 24 + Math.max(1, titleLines.length) * Math.round(30 * fontFactor) + 8;
  h += lineGap; // When line
  if (p.recurrenceLabel) h += lineGap;
  if (design.showMetaLine) h += lineGap;
  return h + 20;
}

function drawProjectCard(
  ctx: CanvasRenderingContext2D,
  p: QuickSummaryProjectItem,
  x: number,
  y: number,
  w: number,
  palette: ThemePalette,
  design: QuickSummaryDesignConfig,
  radiusPx: number,
  fontFactor: number,
): number {
  const h = measureProjectCard(ctx, p, w, fontFactor, design);
  const bg = p.highlighted ? palette.highlightBg : palette.cardBg;
  const border = p.highlighted ? design.accentColor : palette.cardBorder;
  fillAndStrokeCard(ctx, x, y, w, h, radiusPx, bg, border, p.highlighted ? 2.5 : 1.5);

  if (design.showCardStripe) {
    drawRoundRect(ctx, x, y, 7, h, Math.min(4, radiusPx));
    ctx.fillStyle = p.highlighted ? design.accentColor : design.primaryColor;
    ctx.fill();
  }

  const badgeFontSize = Math.round(17 * fontFactor);
  if (design.showBadges) {
    const label = p.highlighted ? `★ ${p.statusLabel}` : p.statusLabel;
    ctx.font = `700 ${badgeFontSize}px 'Segoe UI', system-ui, -apple-system, sans-serif`;
    const statusWidth = Math.ceil(ctx.measureText(label).width) + 22;
    drawBadge(
      ctx,
      x + w - 20 - statusWidth,
      y + 18,
      label,
      p.highlighted ? "#FEF3C7" : palette.pillBg,
      p.highlighted ? "#92400E" : palette.pillText,
      badgeFontSize,
    );
  }

  const leftOffset = design.showCardStripe ? 26 : 20;
  const titleSize = Math.round(24 * fontFactor);
  const titleStep = Math.round(30 * fontFactor);
  const metaSize = Math.round(18 * fontFactor);
  const lineGap = Math.round(28 * fontFactor);

  ctx.font = `700 ${titleSize}px 'Segoe UI', system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = palette.textPrimary;
  const titleLines = wrapLines(
    ctx,
    p.title,
    design.showBadges ? w - 200 : w - 44,
  );
  let cursorY = y + 42;
  for (const line of titleLines) {
    ctx.fillText(line, x + leftOffset, cursorY);
    cursorY += titleStep;
  }

  cursorY += 4;
  ctx.font = `600 ${Math.round(19 * fontFactor)}px 'Segoe UI', system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = palette.accentBlue;
  ctx.fillText(`${p.whenLabel}  (${p.kindLabel})`, x + leftOffset, cursorY);
  cursorY += lineGap;

  if (p.recurrenceLabel) {
    ctx.font = `600 ${metaSize}px 'Segoe UI', system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = palette.textMuted;
    ctx.fillText(`Repeat: ${p.recurrenceLabel}`, x + leftOffset, cursorY);
    cursorY += lineGap;
  }

  if (design.showMetaLine) {
    ctx.font = `500 ${metaSize}px 'Segoe UI', system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = palette.textMuted;
    const footerMeta = [
      `Where: ${p.location}`,
      `Lead: ${p.chairName}`,
      `${p.rsvpGoing} going`,
      p.tasksProgressLabel,
    ]
      .filter(Boolean)
      .join("   |   ");
    const metaLines = wrapLines(ctx, footerMeta, w - 50);
    ctx.fillText(metaLines[0] ?? "", x + leftOffset, cursorY);
  }

  return h;
}

function measureTaskCard(
  ctx: CanvasRenderingContext2D,
  t: QuickSummaryTaskItem,
  cardWidth: number,
  includeSubtasks: boolean,
  fontFactor: number,
  design: QuickSummaryDesignConfig,
): number {
  const titleSize = Math.round(22 * fontFactor);
  const lineGap = Math.round(27 * fontFactor);
  ctx.font = `700 ${titleSize}px 'Segoe UI', system-ui, -apple-system, sans-serif`;
  const titleLines = wrapLines(
    ctx,
    t.title,
    design.showBadges ? cardWidth - 180 : cardWidth - 48,
  );
  let h = 22 + Math.max(1, titleLines.length) * Math.round(28 * fontFactor) + 8;
  if (design.showMetaLine) h += lineGap;
  if (includeSubtasks && t.checklist.length > 0) {
    const shown = Math.min(4, t.checklist.length);
    h += shown * Math.round(25 * fontFactor) + 8;
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
  design: QuickSummaryDesignConfig,
  radiusPx: number,
  fontFactor: number,
): number {
  const h = measureTaskCard(ctx, t, w, includeSubtasks, fontFactor, design);
  const bg = t.highlighted ? palette.highlightBg : palette.cardBg;
  const border = t.highlighted ? design.accentColor : palette.cardBorder;
  fillAndStrokeCard(ctx, x, y, w, h, radiusPx, bg, border, t.highlighted ? 2.5 : 1.5);

  if (design.showCardStripe) {
    drawRoundRect(ctx, x, y, 7, h, Math.min(4, radiusPx));
    ctx.fillStyle = t.highlighted ? design.accentColor : design.primaryColor;
    ctx.fill();
  }

  const leftOffset = design.showCardStripe ? 24 : 20;
  let badgeW = 0;
  const badgeFontSize = Math.round(17 * fontFactor);
  if (design.showBadges) {
    const prColors = priorityColors(t.priority);
    const label = t.highlighted
      ? `★ ${t.priority.toUpperCase()}`
      : t.priority.toUpperCase();
    badgeW = drawBadge(
      ctx,
      x + leftOffset,
      y + 18,
      label,
      prColors.bg,
      prColors.fg,
      badgeFontSize,
    );
  }

  const titleSize = Math.round(22 * fontFactor);
  const titleStep = Math.round(28 * fontFactor);
  const metaSize = Math.round(18 * fontFactor);
  const lineGap = Math.round(27 * fontFactor);

  ctx.font = `700 ${titleSize}px 'Segoe UI', system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = palette.textPrimary;
  const titleLines = wrapLines(
    ctx,
    t.title,
    design.showBadges ? w - badgeW - 68 : w - 44,
  );
  let cursorY = y + 40;
  titleLines.forEach((line, idx) => {
    const titleX =
      idx === 0 && design.showBadges ? x + leftOffset + badgeW + 10 : x + leftOffset;
    ctx.fillText(line, titleX, cursorY);
    cursorY += titleStep;
  });

  if (design.showMetaLine) {
    ctx.font = `500 ${metaSize}px 'Segoe UI', system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = t.isOverdue ? "#DC2626" : palette.textMuted;
    const duePrefix = t.isOverdue ? "OVERDUE · Due " : "Due ";
    const line2 = [
      `${duePrefix}${t.dueDateLabel}`,
      `Assigned: ${t.assignees.join(", ") || "Unassigned"}`,
      t.projectTitle ? `Project: ${t.projectTitle}` : null,
    ]
      .filter(Boolean)
      .join("   |   ");
    const metaLines = wrapLines(ctx, line2, w - 48);
    ctx.fillText(metaLines[0] ?? "", x + leftOffset, cursorY);
    cursorY += lineGap;
  }

  if (includeSubtasks && t.checklist.length > 0) {
    cursorY += 4;
    ctx.font = `500 ${metaSize}px 'Segoe UI', system-ui, -apple-system, sans-serif`;
    t.checklist.slice(0, 4).forEach((sub) => {
      ctx.fillStyle = sub.completed ? "#10B981" : palette.textMuted;
      const prefix = sub.completed ? "✓" : "☐";
      const label = `${prefix} ${sub.title}${
        sub.assignedMemberName ? ` (${sub.assignedMemberName})` : ""
      }`;
      const subLines = wrapLines(ctx, label, w - 72);
      ctx.fillText(subLines[0] ?? "", x + leftOffset + 12, cursorY);
      cursorY += Math.round(25 * fontFactor);
    });
    if (t.checklist.length > 4) {
      ctx.fillStyle = palette.textMuted;
      ctx.fillText(
        `+${t.checklist.length - 4} more subtasks`,
        x + leftOffset + 12,
        cursorY,
      );
    }
  }

  return h;
}

/**
 * Renders the summary card directly onto an HTMLCanvasElement honoring all editable
 * text, element visibility toggles, colors, typography scale, logo, and card ordering.
 */
export function renderQuickSummaryCanvas(
  canvas: HTMLCanvasElement,
  data: QuickSummaryData,
  options: {
    theme: QuickSummaryTheme;
    layout: QuickSummaryLayout;
    design?: Partial<QuickSummaryDesignConfig>;
    logoImage?: HTMLImageElement | null;
  },
): { width: number; height: number } | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const design: QuickSummaryDesignConfig = {
    ...DEFAULT_QUICK_SUMMARY_DESIGN,
    ...(options.design ?? {}),
  };
  const isDark = options.theme === "DARK";
  const basePalette = isDark ? DARK_PALETTE : LIGHT_PALETTE;
  const palette: ThemePalette = {
    ...basePalette,
    accentBlue: isDark ? "#60A5FA" : design.primaryColor,
    accentGold: design.accentColor,
  };

  const radiusPx = resolveCardRadiusPx(design.cardRadius);
  const fontFactor = resolveFontFactor(design.fontScale);
  const logoPx = options.logoImage ? resolveLogoPx(design.logoSize) : 0;
  const headerIsCentered = design.headerAlign === "CENTER";
  const bannerHeight =
    205 + (options.logoImage && headerIsCentered ? logoPx + 14 : 0);

  const twoCol = options.layout === "WIDE" && data.mode === "COMBINED";
  const width = twoCol ? 1400 : 1080;
  const padX = 48;
  const contentW = width - padX * 2;
  const colW = twoCol ? (contentW - 28) / 2 : contentW;

  const shownProjects = data.projects.slice(0, 8);
  const shownTasks = data.tasks.slice(0, 10);

  const projectsBlockHeight =
    data.mode === "TASKS_ONLY"
      ? 0
      : 54 +
        (shownProjects.length === 0
          ? 90
          : shownProjects.reduce(
              (acc, p) =>
                acc +
                measureProjectCard(ctx, p, colW, fontFactor, design) +
                16,
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
                acc +
                measureTaskCard(
                  ctx,
                  t,
                  colW,
                  data.includeSubtasks,
                  fontFactor,
                  design,
                ) +
                16,
              0,
            )) +
        (data.tasks.length > shownTasks.length ? 34 : 0);

  const bodyHeight = twoCol
    ? Math.max(projectsBlockHeight, tasksBlockHeight)
    : projectsBlockHeight +
      (projectsBlockHeight > 0 && tasksBlockHeight > 0 ? 20 : 0) +
      tasksBlockHeight;

  const kpiBlockHeight = design.showKpis ? 126 : 18;
  const noteHeight = data.customNote ? 92 : 0;
  const footerHeight = design.showFooter ? 82 : 28;
  const height = Math.max(
    460,
    bannerHeight + 24 + kpiBlockHeight + bodyHeight + noteHeight + footerHeight,
  );

  canvas.width = width;
  canvas.height = height;

  // Canvas background
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);

  // Header banner gradient
  const grad = ctx.createLinearGradient(0, 0, width, bannerHeight);
  grad.addColorStop(0, design.primaryColor);
  grad.addColorStop(1, darkenHex(design.primaryColor, 0.25));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, bannerHeight);

  // Header content (supports LEFT / CENTER align & optional Logo)
  let textStartX = padX;
  let textCursorY = 36;

  if (options.logoImage) {
    const logoX = headerIsCentered ? (width - logoPx) / 2 : padX;
    const logoY = headerIsCentered ? 24 : Math.round((bannerHeight - logoPx) / 2);
    ctx.save();
    drawRoundRect(ctx, logoX, logoY, logoPx, logoPx, 14);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fill();
    ctx.clip();
    ctx.drawImage(options.logoImage, logoX, logoY, logoPx, logoPx);
    ctx.restore();
    drawRoundRect(ctx, logoX, logoY, logoPx, logoPx, 14);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (headerIsCentered) {
      textCursorY = logoY + logoPx + 22;
    } else {
      textStartX = padX + logoPx + 24;
    }
  }

  ctx.textAlign = headerIsCentered ? "center" : "left";
  const anchorX = headerIsCentered ? width / 2 : textStartX;

  if (design.showAccentBar) {
    const barX = headerIsCentered ? width / 2 - 36 : anchorX;
    ctx.fillStyle = design.accentColor;
    ctx.fillRect(barX, textCursorY, 72, 6);
    textCursorY += 28;
  } else {
    textCursorY += 12;
  }

  if (design.showClubTag) {
    ctx.font = `700 ${Math.round(19 * fontFactor)}px 'Segoe UI', system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "#BFDBFE";
    ctx.fillText(
      `${data.clubName.toUpperCase()}  |  DISTRICT ${data.districtCode}`,
      anchorX,
      textCursorY,
    );
    textCursorY += Math.round(48 * fontFactor);
  } else {
    textCursorY += Math.round(34 * fontFactor);
  }

  ctx.font = `800 ${Math.round(38 * fontFactor)}px 'Segoe UI', system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(data.headline, anchorX, textCursorY);
  textCursorY += Math.round(38 * fontFactor);

  const ryText =
    data.rotaryYear && data.rotaryYear !== "ALL"
      ? `RY ${data.rotaryYear}`
      : "All Rotary Years";
  ctx.font = `500 ${Math.round(21 * fontFactor)}px 'Segoe UI', system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = "#DBEAFE";
  ctx.fillText(
    `${data.timeframeLabel}   ·   ${ryText}   ·   Asia/Manila`,
    anchorX,
    textCursorY,
  );
  ctx.textAlign = "left";

  // KPI cards row
  const kpiY = bannerHeight + 24;
  if (design.showKpis) {
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
              {
                value: String(data.stats.sessionsCount),
                label: "Plotted Sessions",
              },
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
        radiusPx,
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
  }

  const startContentY = kpiY + kpiBlockHeight;

  const drawProjectsSection = (x: number, y: number, w: number): number => {
    let curY = y;
    ctx.font = `800 ${Math.round(22 * fontFactor)}px 'Segoe UI', system-ui, -apple-system, sans-serif`;
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
        radiusPx,
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
      const cardH = drawProjectCard(
        ctx,
        p,
        x,
        curY,
        w,
        palette,
        design,
        radiusPx,
        fontFactor,
      );
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
    ctx.font = `800 ${Math.round(22 * fontFactor)}px 'Segoe UI', system-ui, -apple-system, sans-serif`;
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
        radiusPx,
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
        design,
        radiusPx,
        fontFactor,
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

  if (twoCol) {
    if (design.sectionOrder === "TASKS_FIRST") {
      drawTasksSection(padX, startContentY, colW);
      drawProjectsSection(padX + colW + 28, startContentY, colW);
    } else {
      drawProjectsSection(padX, startContentY, colW);
      drawTasksSection(padX + colW + 28, startContentY, colW);
    }
  } else {
    let bottomY = startContentY;
    const order: ("PROJECTS" | "TASKS")[] =
      design.sectionOrder === "TASKS_FIRST"
        ? ["TASKS", "PROJECTS"]
        : ["PROJECTS", "TASKS"];
    let renderedFirst = false;

    for (const section of order) {
      if (section === "PROJECTS" && data.mode !== "TASKS_ONLY") {
        if (renderedFirst) bottomY += 16;
        bottomY += drawProjectsSection(padX, bottomY, contentW);
        renderedFirst = true;
      } else if (section === "TASKS" && data.mode !== "PROJECTS_ONLY") {
        if (renderedFirst) bottomY += 16;
        bottomY += drawTasksSection(padX, bottomY, contentW);
        renderedFirst = true;
      }
    }
  }

  // Optional GC reminder note banner
  if (data.customNote) {
    const toneColors = resolveNoteToneColors(design.noteTone, isDark);
    const noteY = height - footerHeight - 80;
    fillAndStrokeCard(
      ctx,
      padX,
      noteY,
      contentW,
      70,
      radiusPx,
      toneColors.bg,
      toneColors.border,
    );
    ctx.font = `700 ${Math.round(20 * fontFactor)}px 'Segoe UI', system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = toneColors.text;
    const noteLines = wrapLines(ctx, `Note: ${data.customNote}`, contentW - 44);
    ctx.fillText(noteLines[0] ?? "", padX + 22, noteY + 42);
  }

  // Footer branding
  if (design.showFooter) {
    ctx.fillStyle = palette.cardBorder;
    ctx.fillRect(padX, height - 62, contentW, 1.5);
    ctx.font = "600 18px 'Segoe UI', system-ui, -apple-system, sans-serif";
    ctx.fillStyle = palette.textMuted;
    ctx.fillText(
      `Generated via Racspeed  ·  ${data.generatedAtLabel}`,
      padX,
      height - 26,
    );
    const rightText =
      design.footerText.trim() || "Open Racspeed to RSVP & update task progress";
    const rightW = ctx.measureText(rightText).width;
    ctx.fillText(rightText, width - padX - rightW, height - 26);
  }

  return { width, height };
}

function loadLogoImage(dataUrl: string | null): Promise<HTMLImageElement | null> {
  if (!dataUrl || typeof Image === "undefined") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export async function exportQuickSummaryPngBlob(
  data: QuickSummaryData,
  options: {
    theme: QuickSummaryTheme;
    layout: QuickSummaryLayout;
    design?: Partial<QuickSummaryDesignConfig>;
  },
): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const offscreen = document.createElement("canvas");
  const logoImage = await loadLogoImage(options.design?.logoDataUrl ?? null);
  const rendered = renderQuickSummaryCanvas(offscreen, data, {
    ...options,
    logoImage,
  });
  if (!rendered) return null;

  return new Promise<Blob | null>((resolve) => {
    offscreen.toBlob((blob) => resolve(blob), "image/png");
  });
}
