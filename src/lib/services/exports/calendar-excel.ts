import ExcelJS from "exceljs";
import {
  formatActivityStatusLabel,
  type ExportMonthTarget,
} from "@/features/activities/export-types";
import {
  expandActivityOccurrences,
  formatRecurrenceSummary,
  getNextActivityOccurrence,
  isRecurringSchedule,
} from "@/features/activities/recurrence";
import {
  ACTIVITY_KIND_META,
  ACTIVITY_PRIORITY_META,
  isProjectKind,
  type ActivitySummaryDTO,
} from "@/features/activities/types";
import type { GroupTaskDTO } from "@/lib/data/tasks-types";
import { formatManila } from "@/lib/utils/dates";
export {
  buildMonthsFromStart,
  getCalendarFileSlug,
} from "./calendar-excel-helpers";

const DAY_HEADERS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const COLORS = {
  navy: "FF0D3594",
  darkNavy: "FF1E3A8A",
  weekendHeader: "FF312E81",
  bannerBg: "FFEEF2FF",
  activeDayHeader: "FFDBEAFE",
  activeDayCell: "FFF0F9FF",
  weekendHeaderCell: "FFFEF3C7",
  weekendCell: "FFFFFBEB",
  outMonthBg: "FFF1F5F9",
  outMonthCell: "FFF8FAFC",
  mutedText: "FF94A3B8",
  darkText: "FF111625",
  slateText: "FF475569",
  borderLight: "FFCBD5E1",
  zebra: "FFF8FAFC",
  white: "FFFFFFFF",
  urgentBg: "FFFEE2E2",
  urgentText: "FF991B1B",
  highBg: "FFFFEDD5",
  highText: "FF9A3412",
  doneBg: "FFD1FAE5",
  doneText: "FF065F46",
  plannedBg: "FFDBEAFE",
  plannedText: "FF1E40AF",
  draftBg: "FFF1F5F9",
  draftText: "FF475569",
};

function sanitizeSheetName(raw: string, used: Set<string>): string {
  const cleaned = raw.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Sheet";
  let candidate = cleaned;
  let counter = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` ${counter}`;
    candidate = `${cleaned.slice(0, 31 - suffix.length)}${suffix}`;
    counter += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function formatMonthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month, 1)));
}

function formatShortMonthSheet(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month, 1)));
}

function formatCommitteeLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return code
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function applyThinBorder(cell: ExcelJS.Cell, color = COLORS.borderLight) {
  cell.border = {
    top: { style: "thin", color: { argb: color } },
    left: { style: "thin", color: { argb: color } },
    bottom: { style: "thin", color: { argb: color } },
    right: { style: "thin", color: { argb: color } },
  };
}

function applyHeaderRowStyle(row: ExcelJS.Row, fillArgb = COLORS.darkNavy) {
  row.height = 24;
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: fillArgb },
    };
    cell.font = {
      name: "Calibri",
      size: 10,
      bold: true,
      color: { argb: COLORS.white },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };
    applyThinBorder(cell, COLORS.navy);
  });
}

function priorityColors(priority: string): { bg: string; fg: string } {
  switch (priority) {
    case "URGENT":
      return { bg: COLORS.urgentBg, fg: COLORS.urgentText };
    case "HIGH":
      return { bg: COLORS.highBg, fg: COLORS.highText };
    case "LOW":
      return { bg: COLORS.outMonthBg, fg: COLORS.slateText };
    default:
      return { bg: COLORS.plannedBg, fg: COLORS.plannedText };
  }
}

function statusColors(status: string): { bg: string; fg: string } {
  switch (status) {
    case "COMPLETED":
    case "ACCOMPLISHED":
      return { bg: COLORS.doneBg, fg: COLORS.doneText };
    case "IN_PROGRESS":
    case "ONGOING":
      return { bg: COLORS.plannedBg, fg: COLORS.plannedText };
    case "IN_REVIEW":
    case "AWAITING_REPORT":
      return { bg: COLORS.highBg, fg: COLORS.highText };
    case "DRAFT":
    case "CANCELLED":
      return { bg: COLORS.draftBg, fg: COLORS.draftText };
    default:
      return { bg: COLORS.bannerBg, fg: COLORS.darkNavy };
  }
}

export async function buildCalendarWorkbookBuffer({
  clubName,
  districtCode,
  rotaryYear,
  months,
  activities,
  tasks,
  includeTasks,
  generatedAt = new Date(),
}: {
  clubName: string;
  districtCode: string;
  rotaryYear: string;
  months: ExportMonthTarget[];
  activities: ActivitySummaryDTO[];
  tasks: GroupTaskDTO[];
  includeTasks: boolean;
  generatedAt?: Date;
}): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = clubName;
  workbook.created = generatedAt;
  workbook.modified = generatedAt;

  const usedSheetNames = new Set<string>();
  const generatedLabel = formatManila(generatedAt, "MMM d, yyyy h:mm a");

  // 1) One styled monthly calendar worksheet per target month
  for (const target of months) {
    const monthLabel = formatMonthLabel(target.year, target.month);
    const monthPrefix = `${target.year}-${String(target.month + 1).padStart(2, "0")}`;
    const sheetName = sanitizeSheetName(
      formatShortMonthSheet(target.year, target.month),
      usedSheetNames,
    );

    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ showGridLines: true }],
      pageSetup: {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        paperSize: 9, // A4
      },
    });

    for (let col = 1; col <= 7; col++) {
      sheet.getColumn(col).width = 27;
    }

    const linesByDate = new Map<string, string[]>();
    const hasActivityDate = new Set<string>();
    let monthSessionCount = 0;
    let monthTaskCount = 0;

    for (const activity of activities) {
      const recurring = isRecurringSchedule(activity.recurrence);
      for (const occ of expandActivityOccurrences(activity)) {
        if (!occ.dateKey.startsWith(monthPrefix)) continue;
        monthSessionCount += 1;
        hasActivityDate.add(occ.dateKey);

        const icon = isProjectKind(activity.kind) ? "★" : "●";
        const timeStr = activity.allDay
          ? "All Day"
          : `${formatManila(occ.startAt, "h:mm a")}`;
        const sessionTag = recurring ? ` [S${occ.index}/${occ.total}]` : "";
        const draftTag = activity.status === "DRAFT" ? " [DRAFT]" : "";
        const placeTag = activity.location ? ` · ${activity.location}` : "";
        const line = `${icon} ${timeStr} ${activity.title}${sessionTag}${draftTag}${placeTag}`;

        const list = linesByDate.get(occ.dateKey) ?? [];
        list.push(line);
        linesByDate.set(occ.dateKey, list);
      }
    }

    if (includeTasks) {
      for (const task of tasks) {
        if (task.status === "COMPLETED") continue;
        const dueKey = task.dueDate?.slice(0, 10) || "";
        if (!dueKey.startsWith(monthPrefix)) continue;
        monthTaskCount += 1;

        const assignees =
          task.assignedMemberNames.length > 0
            ? ` (${task.assignedMemberNames.slice(0, 2).join(", ")})`
            : "";
        const line = `☐ [Task · ${task.priority}] ${task.title}${assignees}`;
        const list = linesByDate.get(dueKey) ?? [];
        list.push(line);
        linesByDate.set(dueKey, list);
      }
    }

    // Banner Row 1
    sheet.mergeCells("A1:G1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = `${clubName} — ${monthLabel} Project & Activity Calendar`;
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.navy },
    };
    titleCell.font = {
      name: "Calibri",
      size: 15,
      bold: true,
      color: { argb: COLORS.white },
    };
    titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    sheet.getRow(1).height = 30;

    // Banner Row 2
    sheet.mergeCells("A2:G2");
    const subtitleCell = sheet.getCell("A2");
    const ryLabel =
      rotaryYear && rotaryYear !== "ALL" ? `RY ${rotaryYear}` : "All Rotary Years";
    subtitleCell.value = `${ryLabel}  |  District ${districtCode}  |  ${monthSessionCount} Plotted Sessions${
      includeTasks ? `  |  ${monthTaskCount} Open Task Deadlines` : ""
    }  |  Asia/Manila  |  Generated ${generatedLabel}`;
    subtitleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.bannerBg },
    };
    subtitleCell.font = {
      name: "Calibri",
      size: 10,
      bold: true,
      color: { argb: COLORS.darkNavy },
    };
    subtitleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    sheet.getRow(2).height = 22;

    // Day-of-week header Row 3
    const dowRow = sheet.getRow(3);
    dowRow.height = 22;
    DAY_HEADERS.forEach((label, idx) => {
      const cell = dowRow.getCell(idx + 1);
      const isWeekend = idx === 0 || idx === 6;
      cell.value = label;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isWeekend ? COLORS.weekendHeader : COLORS.darkNavy },
      };
      cell.font = {
        name: "Calibri",
        size: 10,
        bold: true,
        color: { argb: COLORS.white },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      applyThinBorder(cell, COLORS.navy);
    });

    // Calculate calendar grid bounds (Sunday start -> Saturday end covering full month)
    const firstOfMonthUtc = Date.UTC(target.year, target.month, 1);
    const daysInMonth = new Date(
      Date.UTC(target.year, target.month + 1, 0),
    ).getUTCDate();
    const lastOfMonthUtc = Date.UTC(target.year, target.month, daysInMonth);
    const firstDow = new Date(firstOfMonthUtc).getUTCDay();
    const lastDow = new Date(lastOfMonthUtc).getUTCDay();
    const gridStartMs = firstOfMonthUtc - firstDow * 86_400_000;
    const gridEndMs = lastOfMonthUtc + (6 - lastDow) * 86_400_000;
    const totalDays = Math.round((gridEndMs - gridStartMs) / 86_400_000) + 1;
    const weekCount = Math.ceil(totalDays / 7);

    let currentRowNum = 4;
    for (let week = 0; week < weekCount; week++) {
      const dateHeaderRow = sheet.getRow(currentRowNum);
      const bodyRow = sheet.getRow(currentRowNum + 1);
      dateHeaderRow.height = 20;

      let maxLinesInWeek = 3;

      for (let dow = 0; dow < 7; dow++) {
        const dayMs = gridStartMs + (week * 7 + dow) * 86_400_000;
        const dt = new Date(dayMs);
        const ymd = dt.toISOString().slice(0, 10);
        const inMonth = dt.getUTCMonth() === target.month;
        const dayNum = dt.getUTCDate();
        const isWeekend = dow === 0 || dow === 6;
        const hasActivity = inMonth && hasActivityDate.has(ymd);
        const dayLines = inMonth ? linesByDate.get(ymd) ?? [] : [];

        // Estimate wrapped line count to auto-size row height cleanly
        const estimatedLines = dayLines.reduce(
          (sum, text) => sum + Math.max(1, Math.ceil(text.length / 28)),
          0,
        );
        if (estimatedLines > maxLinesInWeek) {
          maxLinesInWeek = estimatedLines;
        }

        const headerCell = dateHeaderRow.getCell(dow + 1);
        headerCell.value =
          dayNum === 1
            ? new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              }).format(dt)
            : dayNum;

        const headerBg = !inMonth
          ? COLORS.outMonthBg
          : hasActivity
            ? COLORS.activeDayHeader
            : isWeekend
              ? COLORS.weekendHeaderCell
              : COLORS.zebra;

        headerCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: headerBg },
        };
        headerCell.font = {
          name: "Calibri",
          size: 10,
          bold: inMonth,
          color: {
            argb: !inMonth
              ? COLORS.mutedText
              : hasActivity
                ? COLORS.navy
                : COLORS.darkText,
          },
        };
        headerCell.alignment = { vertical: "middle", horizontal: "right" };
        headerCell.border = {
          top: { style: "thin", color: { argb: COLORS.borderLight } },
          left: { style: "thin", color: { argb: COLORS.borderLight } },
          right: { style: "thin", color: { argb: COLORS.borderLight } },
          bottom: { style: "dotted", color: { argb: COLORS.borderLight } },
        };

        const bodyCell = bodyRow.getCell(dow + 1);
        bodyCell.value = dayLines.length > 0 ? dayLines.join("\n") : "";
        const bodyBg = !inMonth
          ? COLORS.outMonthCell
          : hasActivity
            ? COLORS.activeDayCell
            : isWeekend
              ? COLORS.weekendCell
              : COLORS.white;

        bodyCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: bodyBg },
        };
        bodyCell.font = {
          name: "Calibri",
          size: 9,
          color: { argb: inMonth ? COLORS.darkText : COLORS.mutedText },
        };
        bodyCell.alignment = {
          vertical: "top",
          horizontal: "left",
          wrapText: true,
        };
        bodyCell.border = {
          top: { style: "dotted", color: { argb: COLORS.borderLight } },
          left: { style: "thin", color: { argb: COLORS.borderLight } },
          right: { style: "thin", color: { argb: COLORS.borderLight } },
          bottom: { style: "thin", color: { argb: COLORS.borderLight } },
        };
      }

      bodyRow.height = Math.max(70, Math.min(220, maxLinesInWeek * 14 + 14));
      currentRowNum += 2;
    }

    // Legend row
    sheet.mergeCells(`A${currentRowNum}:G${currentRowNum}`);
    const legendCell = sheet.getCell(`A${currentRowNum}`);
    legendCell.value =
      "Legend:   ★ Project   |   ● Meeting / Club Event   |   ☐ Open Task Deadline   |   [S1/N] Recurring Session   |   Blue days have scheduled projects/events";
    legendCell.font = {
      name: "Calibri",
      size: 9,
      italic: true,
      color: { argb: COLORS.slateText },
    };
    legendCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    sheet.getRow(currentRowNum).height = 20;
  }

  // 2) Master Projects & Schedule worksheet
  const scheduleSheetName = sanitizeSheetName("Projects & Schedule", usedSheetNames);
  const scheduleSheet = workbook.addWorksheet(scheduleSheetName, {
    views: [{ state: "frozen", ySplit: 2, showGridLines: true }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  scheduleSheet.mergeCells("A1:L1");
  const schedBanner = scheduleSheet.getCell("A1");
  schedBanner.value = `${clubName} — Projects & Scheduled Activities (Asia/Manila)`;
  schedBanner.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.navy },
  };
  schedBanner.font = {
    name: "Calibri",
    size: 14,
    bold: true,
    color: { argb: COLORS.white },
  };
  schedBanner.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  scheduleSheet.getRow(1).height = 28;

  const scheduleColumns = [
    { header: "Next / Start Date", width: 17 },
    { header: "Time (Manila)", width: 19 },
    { header: "Project / Activity", width: 34 },
    { header: "Type", width: 18 },
    { header: "Schedule Pattern", width: 28 },
    { header: "Status", width: 16 },
    { header: "Priority", width: 12 },
    { header: "Location", width: 24 },
    { header: "Chair / Lead", width: 22 },
    { header: "Committee", width: 20 },
    { header: "Going", width: 10 },
    { header: "Tasks Done", width: 13 },
  ];
  scheduleColumns.forEach((c, idx) => {
    scheduleSheet.getColumn(idx + 1).width = c.width;
  });

  const schedHeader = scheduleSheet.getRow(2);
  scheduleColumns.forEach((c, idx) => {
    schedHeader.getCell(idx + 1).value = c.header;
  });
  applyHeaderRowStyle(schedHeader);
  scheduleSheet.autoFilter = "A2:L2";

  const sortedActivities = [...activities].sort((a, b) =>
    a.startAt.localeCompare(b.startAt),
  );
  sortedActivities.forEach((act, idx) => {
    const nextOcc = getNextActivityOccurrence(act, generatedAt);
    const displayStart = nextOcc?.startAt ?? act.startAt;
    const displayEnd = nextOcc?.endAt ?? act.endAt;
    const recurrenceLabel =
      formatRecurrenceSummary(act.recurrence, act.startAt, act.endAt) ||
      "Single Event";
    const row = scheduleSheet.getRow(idx + 3);
    row.height = 22;

    const values = [
      formatManila(displayStart, "MMM d, yyyy"),
      act.allDay
        ? "All Day"
        : `${formatManila(displayStart, "h:mm a")} – ${formatManila(displayEnd, "h:mm a")}`,
      act.title,
      ACTIVITY_KIND_META[act.kind]?.label || act.kind,
      recurrenceLabel,
      formatActivityStatusLabel(act.status),
      ACTIVITY_PRIORITY_META[act.priority]?.label || act.priority,
      act.location || "TBA",
      act.ownerName || "Unassigned",
      formatCommitteeLabel(act.committee),
      act.rsvp.going,
      act.tasksTotal > 0 ? `${act.tasksDone}/${act.tasksTotal}` : "0",
    ];

    const isZebra = idx % 2 === 1;
    const stColor = statusColors(act.status);
    const prColor = priorityColors(act.priority);

    values.forEach((val, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = val;
      cell.alignment = {
        vertical: "middle",
        horizontal: colIdx === 10 || colIdx === 11 ? "center" : "left",
        wrapText: true,
      };
      cell.font = {
        name: "Calibri",
        size: 10,
        bold: colIdx === 2 || colIdx === 5 || colIdx === 6,
        color: {
          argb:
            colIdx === 5
              ? stColor.fg
              : colIdx === 6
                ? prColor.fg
                : COLORS.darkText,
        },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb:
            colIdx === 5
              ? stColor.bg
              : colIdx === 6
                ? prColor.bg
                : isZebra
                  ? COLORS.zebra
                  : COLORS.white,
        },
      };
      applyThinBorder(cell);
    });
  });

  // 3) Tasks & Subtasks Deliverables worksheet
  if (includeTasks || tasks.length > 0) {
    const taskSheetName = sanitizeSheetName(
      "Tasks & Deliverables",
      usedSheetNames,
    );
    const taskSheet = workbook.addWorksheet(taskSheetName, {
      views: [{ state: "frozen", ySplit: 2, showGridLines: true }],
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    taskSheet.mergeCells("A1:I1");
    const taskBanner = taskSheet.getCell("A1");
    taskBanner.value = `${clubName} — Member Tasks, Subtasks & Deliverables`;
    taskBanner.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.navy },
    };
    taskBanner.font = {
      name: "Calibri",
      size: 14,
      bold: true,
      color: { argb: COLORS.white },
    };
    taskBanner.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    taskSheet.getRow(1).height = 28;

    const taskCols = [
      { header: "Due Date", width: 15 },
      { header: "Project / Activity", width: 28 },
      { header: "Task Title", width: 32 },
      { header: "Subtasks / Checklist", width: 42 },
      { header: "Assigned To", width: 24 },
      { header: "Committee", width: 18 },
      { header: "Priority", width: 12 },
      { header: "Status", width: 15 },
      { header: "Subtasks Done", width: 15 },
    ];
    taskCols.forEach((c, idx) => {
      taskSheet.getColumn(idx + 1).width = c.width;
    });

    const taskHeader = taskSheet.getRow(2);
    taskCols.forEach((c, idx) => {
      taskHeader.getCell(idx + 1).value = c.header;
    });
    applyHeaderRowStyle(taskHeader);
    taskSheet.autoFilter = "A2:I2";

    const activityTitleMap = new Map(activities.map((a) => [a.id, a.title]));
    const sortedTasks = [...tasks].sort((a, b) => {
      if (a.status === "COMPLETED" && b.status !== "COMPLETED") return 1;
      if (a.status !== "COMPLETED" && b.status === "COMPLETED") return -1;
      return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
    });

    sortedTasks.forEach((task, idx) => {
      const checklistLines = task.checklist.map((item) => {
        const mark = item.completed ? "✓" : "☐";
        const owner = item.assignedMemberName
          ? ` (${item.assignedMemberName})`
          : "";
        return `${mark} ${item.title}${owner}`;
      });
      const doneSubtasks = task.checklist.filter((c) => c.completed).length;
      const row = taskSheet.getRow(idx + 3);
      row.height = Math.max(22, Math.min(140, checklistLines.length * 15 + 8));

      const projectName =
        task.projectTitle ||
        (task.projectId ? activityTitleMap.get(task.projectId) : undefined) ||
        "General Club Task";

      const values = [
        task.dueDate || "No deadline",
        projectName,
        task.title,
        checklistLines.length > 0 ? checklistLines.join("\n") : "—",
        task.assignedMemberNames.length > 0
          ? task.assignedMemberNames.join(", ")
          : "Unassigned",
        formatCommitteeLabel(task.committee),
        task.priority,
        task.status.replaceAll("_", " "),
        task.checklist.length > 0
          ? `${doneSubtasks}/${task.checklist.length}`
          : "—",
      ];

      const isZebra = idx % 2 === 1;
      const stColor = statusColors(task.status);
      const prColor = priorityColors(task.priority);

      values.forEach((val, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        cell.value = val;
        cell.alignment = {
          vertical: "top",
          horizontal: colIdx === 8 ? "center" : "left",
          wrapText: true,
        };
        cell.font = {
          name: "Calibri",
          size: 10,
          bold: colIdx === 2 || colIdx === 6 || colIdx === 7,
          color: {
            argb:
              colIdx === 6
                ? prColor.fg
                : colIdx === 7
                  ? stColor.fg
                  : COLORS.darkText,
          },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb:
              colIdx === 6
                ? prColor.bg
                : colIdx === 7
                  ? stColor.bg
                  : isZebra
                    ? COLORS.zebra
                    : COLORS.white,
          },
        };
        applyThinBorder(cell);
      });
    });
  }

  const output = await workbook.xlsx.writeBuffer();
  return new Uint8Array(output as ArrayBuffer);
}
