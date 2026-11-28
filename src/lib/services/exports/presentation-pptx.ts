import PptxGenJS from "pptxgenjs";
import type {
  DeckCalendarMonth,
  DeckMemberWorkload,
  DeckProject,
  PresentationDeckDTO,
} from "@/features/activities/export-types";

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const PALETTE = {
  navy: "0D3594",
  darkNavy: "1E3A8A",
  gold: "F59E0B",
  ink: "111625",
  slate: "475569",
  bgLight: "F8FAFC",
  white: "FFFFFF",
  blueSoft: "DBEAFE",
  blueCell: "EFF6FF",
  amberSoft: "FEF3C7",
  amberText: "92400E",
  border: "CBD5E1",
};

function cleanText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/[\u{1F000}-\u{1FFFF}\u2600-\u27BF]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function addSlideHeader(
  slide: PptxGenJS.Slide,
  kicker: string,
  title: string,
  subtitle: string,
  footerLeft: string,
  slideNumber: number,
  totalSlides: number,
) {
  slide.background = { color: PALETTE.bgLight };
  slide.addText(cleanText(kicker).toUpperCase(), {
    x: 0.5,
    y: 0.28,
    w: 7.5,
    h: 0.22,
    fontSize: 9,
    bold: true,
    color: PALETTE.navy,
  });
  slide.addText(cleanText(title), {
    x: 0.5,
    y: 0.48,
    w: 8.2,
    h: 0.4,
    fontSize: 20,
    bold: true,
    color: PALETTE.ink,
  });
  slide.addText(cleanText(subtitle), {
    x: 8.4,
    y: 0.54,
    w: 4.4,
    h: 0.3,
    fontSize: 9,
    color: PALETTE.slate,
    align: "right",
  });
  slide.addShape("line", {
    x: 0.5,
    y: 0.94,
    w: 12.33,
    h: 0,
    line: { color: PALETTE.navy, width: 1.5 },
  });
  slide.addShape("line", {
    x: 0.5,
    y: 7.08,
    w: 12.33,
    h: 0,
    line: { color: PALETTE.border, width: 0.75 },
  });
  slide.addText(cleanText(footerLeft), {
    x: 0.5,
    y: 7.14,
    w: 9.5,
    h: 0.22,
    fontSize: 8.5,
    color: PALETTE.slate,
  });
  slide.addText(`Slide ${slideNumber} of ${totalSlides}`, {
    x: 10.5,
    y: 7.14,
    w: 2.33,
    h: 0.22,
    fontSize: 8.5,
    color: PALETTE.slate,
    align: "right",
  });
}

function buildCalendarWeeks(cal: DeckCalendarMonth) {
  const firstUtc = Date.UTC(cal.year, cal.month, 1);
  const daysInMonth = new Date(Date.UTC(cal.year, cal.month + 1, 0)).getUTCDate();
  const lastUtc = Date.UTC(cal.year, cal.month, daysInMonth);
  const startMs = firstUtc - new Date(firstUtc).getUTCDay() * 86_400_000;
  const endMs = lastUtc + (6 - new Date(lastUtc).getUTCDay()) * 86_400_000;
  const weeks: { ymd: string; dayNum: number; inMonth: boolean }[][] = [];

  for (let ms = startMs; ms <= endMs; ms += 7 * 86_400_000) {
    const row: { ymd: string; dayNum: number; inMonth: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(ms + d * 86_400_000);
      row.push({
        ymd: cur.toISOString().slice(0, 10),
        dayNum: cur.getUTCDate(),
        inMonth: cur.getUTCMonth() === cal.month,
      });
    }
    weeks.push(row);
  }
  return weeks;
}

export async function renderPresentationPptxBuffer(
  deck: PresentationDeckDTO,
): Promise<Uint8Array> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
  pptx.author = cleanText(deck.clubName);
  pptx.title = cleanText(deck.title);

  const calendarSlides = deck.calendarMonths.slice(0, 3);
  const projectPages = chunkArray<DeckProject>(deck.projects, 2);
  const workloadPages = chunkArray<DeckMemberWorkload>(deck.memberWorkloads, 4);

  const totalSlides =
    2 + calendarSlides.length + projectPages.length + workloadPages.length + 1;
  const footerLeft = `${deck.clubName} | Generated ${deck.generatedAtLabel}`;
  let slideCursor = 2;

  // Slide 1: Cover
  const cover = pptx.addSlide();
  cover.background = { color: PALETTE.navy };
  cover.addShape("rect", {
    x: 0.8,
    y: 1.2,
    w: 1.1,
    h: 0.08,
    fill: { color: PALETTE.gold },
    line: { width: 0 },
  });
  cover.addText(
    `${cleanText(deck.clubName).toUpperCase()}  |  DISTRICT ${cleanText(deck.districtCode)}`,
    {
      x: 0.8,
      y: 1.45,
      w: 11.5,
      h: 0.35,
      fontSize: 12,
      bold: true,
      color: "BFDBFE",
    },
  );
  cover.addText(cleanText(deck.title), {
    x: 0.8,
    y: 2.0,
    w: 11.5,
    h: 1.8,
    fontSize: 34,
    bold: true,
    color: PALETTE.white,
    valign: "top",
  });
  cover.addText(cleanText(deck.subtitle), {
    x: 0.8,
    y: 3.9,
    w: 11.5,
    h: 0.45,
    fontSize: 16,
    color: "DBEAFE",
  });
  cover.addShape("line", {
    x: 0.8,
    y: 6.35,
    w: 11.73,
    h: 0,
    line: { color: "1E40AF", width: 1 },
  });
  cover.addText(`Prepared by ${cleanText(deck.presenterName)}`, {
    x: 0.8,
    y: 6.5,
    w: 6,
    h: 0.3,
    fontSize: 11,
    color: "BFDBFE",
  });
  cover.addText(
    `${deck.aiEnhanced ? "AI-Enhanced Executive Brief" : "Club Database Brief"}  |  ${cleanText(deck.generatedAtLabel)}`,
    {
      x: 6.8,
      y: 6.5,
      w: 5.7,
      h: 0.3,
      fontSize: 11,
      color: "BFDBFE",
      align: "right",
    },
  );

  // Slide 2: Executive Overview & KPIs
  const overview = pptx.addSlide();
  addSlideHeader(
    overview,
    "Executive Briefing",
    "Schedule Overview & Readiness",
    deck.subtitle,
    footerLeft,
    slideCursor++,
    totalSlides,
  );

  const kpiCards = [
    {
      value: String(deck.kpis.totalActivities),
      label: `Projects & Events (${deck.kpis.totalSessions} sessions)`,
    },
    {
      value: String(deck.kpis.openTasks),
      label: `Open Member Tasks (${deck.kpis.completedTasks} done)`,
    },
    {
      value: `${deck.kpis.completedSubtasks}/${deck.kpis.totalSubtasks}`,
      label: "Subtasks Completed",
    },
    {
      value: String(deck.kpis.urgentCount),
      label: "Urgent Priority Items",
    },
  ];
  kpiCards.forEach((k, idx) => {
    const x = 0.5 + idx * 3.12;
    overview.addShape("roundRect", {
      x,
      y: 1.15,
      w: 2.95,
      h: 1.1,
      fill: { color: PALETTE.white },
      line: { color: PALETTE.border, width: 1 },
    });
    overview.addText(k.value, {
      x: x + 0.18,
      y: 1.25,
      w: 2.6,
      h: 0.48,
      fontSize: 24,
      bold: true,
      color: PALETTE.navy,
    });
    overview.addText(k.label, {
      x: x + 0.18,
      y: 1.78,
      w: 2.6,
      h: 0.35,
      fontSize: 9.5,
      color: PALETTE.slate,
    });
  });

  overview.addShape("roundRect", {
    x: 0.5,
    y: 2.45,
    w: 6.05,
    h: 4.4,
    fill: { color: PALETTE.white },
    line: { color: PALETTE.border, width: 1 },
  });
  overview.addText("SUMMARY & KEY HIGHLIGHTS", {
    x: 0.72,
    y: 2.62,
    w: 5.6,
    h: 0.28,
    fontSize: 10.5,
    bold: true,
    color: PALETTE.navy,
  });
  overview.addText(
    [
      cleanText(deck.executiveSummary),
      "",
      ...deck.highlights.slice(0, 4).map((h) => `• ${cleanText(h)}`),
    ].join("\n"),
    {
      x: 0.72,
      y: 2.95,
      w: 5.6,
      h: 3.7,
      fontSize: 11,
      color: PALETTE.ink,
      valign: "top",
    },
  );

  const hasAttn = deck.attentionItems.length > 0;
  overview.addShape("roundRect", {
    x: 6.75,
    y: 2.45,
    w: 6.08,
    h: 4.4,
    fill: { color: hasAttn ? "FFFBEB" : PALETTE.white },
    line: { color: hasAttn ? "FDE68A" : PALETTE.border, width: 1 },
  });
  overview.addText(
    hasAttn ? "NEEDS OFFICER ATTENTION" : "OPERATIONAL STATUS",
    {
      x: 6.97,
      y: 2.62,
      w: 5.6,
      h: 0.28,
      fontSize: 10.5,
      bold: true,
      color: hasAttn ? PALETTE.amberText : PALETTE.navy,
    },
  );
  overview.addText(
    hasAttn
      ? deck.attentionItems
          .slice(0, 5)
          .map((item) => `• ${cleanText(item)}`)
          .join("\n\n")
      : "All scheduled sessions and member deliverables are currently on track with no urgent blockers.",
    {
      x: 6.97,
      y: 2.95,
      w: 5.6,
      h: 3.7,
      fontSize: 11,
      color: PALETTE.ink,
      valign: "top",
    },
  );

  // Calendar Slides
  calendarSlides.forEach((cal) => {
    const slide = pptx.addSlide();
    addSlideHeader(
      slide,
      "Plotted Club Calendar (Asia/Manila)",
      cal.label,
      deck.subtitle,
      footerLeft,
      slideCursor++,
      totalSlides,
    );

    const weeks = buildCalendarWeeks(cal);
    const tableRows: PptxGenJS.TableRow[] = [
      DAY_NAMES.map((day) => ({
        text: day,
        options: {
          fill: { color: PALETTE.darkNavy },
          color: PALETTE.white,
          bold: true,
          fontSize: 9.5,
          align: "center" as const,
          valign: "middle" as const,
        },
      })),
      ...weeks.map((week) =>
        week.map((day) => {
          const entries = day.inMonth ? cal.entriesByDate[day.ymd] ?? [] : [];
          const hasAct = entries.some((e) => e.kind === "activity");
          const lines = entries
            .slice(0, 3)
            .map((e) =>
              cleanText(
                `${e.kind === "activity" ? "*" : "[]"} ${e.sessionLabel ? `[${e.sessionLabel}] ` : ""}${e.title}`.slice(
                  0,
                  26,
                ),
              ),
            );
          if (entries.length > 3) lines.push(`+${entries.length - 3} more`);
          return {
            text: `${day.dayNum}${lines.length > 0 ? `\n${lines.join("\n")}` : ""}`,
            options: {
              fill: {
                color: !day.inMonth
                  ? "F1F5F9"
                  : hasAct
                    ? PALETTE.blueCell
                    : PALETTE.white,
              },
              color: day.inMonth ? PALETTE.ink : "94A3B8",
              fontSize: 8.5,
              valign: "top" as const,
              border: { pt: 0.75, color: PALETTE.border },
            },
          };
        }),
      ),
    ];

    const rowHeight = Math.min(1.05, 5.4 / Math.max(1, weeks.length));
    slide.addTable(tableRows, {
      x: 0.5,
      y: 1.12,
      w: 12.33,
      colW: Array(7).fill(12.33 / 7),
      rowH: [0.34, ...weeks.map(() => rowHeight)],
      border: { pt: 0.75, color: PALETTE.border },
    });
  });

  // Project Spotlight Slides
  projectPages.forEach((pair, pageIdx) => {
    const slide = pptx.addSlide();
    addSlideHeader(
      slide,
      "Project & Deliverable Breakdown",
      `Upcoming Projects & Tasks${projectPages.length > 1 ? ` (${pageIdx + 1}/${projectPages.length})` : ""}`,
      deck.subtitle,
      footerLeft,
      slideCursor++,
      totalSlides,
    );

    pair.forEach((project, colIdx) => {
      const x = 0.5 + colIdx * 6.26;
      const w = pair.length === 1 ? 12.33 : 6.06;
      slide.addShape("roundRect", {
        x,
        y: 1.12,
        w,
        h: 5.75,
        fill: { color: PALETTE.white },
        line: { color: PALETTE.border, width: 1 },
      });
      slide.addText(cleanText(project.title), {
        x: x + 0.2,
        y: 1.25,
        w: w - 1.5,
        h: 0.4,
        fontSize: 14,
        bold: true,
        color: PALETTE.ink,
      });
      slide.addText(cleanText(project.statusLabel), {
        x: x + w - 1.3,
        y: 1.28,
        w: 1.1,
        h: 0.28,
        fontSize: 8.5,
        bold: true,
        color: PALETTE.darkNavy,
        fill: { color: PALETTE.blueSoft },
        align: "center",
      });
      slide.addText(
        `Schedule: ${cleanText(project.scheduleLabel)}${
          project.recurrenceLabel ? ` (${cleanText(project.recurrenceLabel)})` : ""
        }\nLead: ${cleanText(project.chairName)}  |  Where: ${cleanText(
          project.location,
        )}  |  Going: ${project.rsvpGoing}`,
        {
          x: x + 0.2,
          y: 1.72,
          w: w - 0.4,
          h: 0.52,
          fontSize: 9.5,
          color: PALETTE.slate,
        },
      );
      slide.addShape("rect", {
        x: x + 0.2,
        y: 2.32,
        w: w - 0.4,
        h: 0.85,
        fill: { color: PALETTE.bgLight },
        line: { color: PALETTE.navy, width: 0.75 },
      });
      slide.addText(cleanText(project.talkingPoint), {
        x: x + 0.3,
        y: 2.38,
        w: w - 0.6,
        h: 0.73,
        fontSize: 9.5,
        color: PALETTE.ink,
        valign: "top",
      });

      const taskLines =
        project.tasks.length === 0
          ? ["No project tasks assigned yet."]
          : project.tasks.slice(0, 4).flatMap((t) => [
              `• [${t.priority}] ${cleanText(t.title)} — ${cleanText(
                t.assignees.join(", "),
              )} (Due ${t.dueDate})`,
              ...t.checklist
                .slice(0, 2)
                .map(
                  (c) =>
                    `   ${c.completed ? "[x]" : "[ ]"} ${cleanText(c.title)}${
                      c.assignedMemberName
                        ? ` (${cleanText(c.assignedMemberName)})`
                        : ""
                    }`,
                ),
            ]);

      slide.addText(
        [`TASKS & SUBTASKS (${project.tasks.length})`, "", ...taskLines].join(
          "\n",
        ),
        {
          x: x + 0.2,
          y: 3.3,
          w: w - 0.4,
          h: 3.4,
          fontSize: 9,
          color: PALETTE.ink,
          valign: "top",
        },
      );
    });
  });

  // Member Workload Slides
  workloadPages.forEach((group, pageIdx) => {
    const slide = pptx.addSlide();
    addSlideHeader(
      slide,
      "Member Accountability",
      `Tasks & Subtasks by Member${workloadPages.length > 1 ? ` (${pageIdx + 1}/${workloadPages.length})` : ""}`,
      deck.subtitle,
      footerLeft,
      slideCursor++,
      totalSlides,
    );

    group.forEach((member, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 0.5 + col * 6.26;
      const y = 1.12 + row * 2.92;
      slide.addShape("roundRect", {
        x,
        y,
        w: 6.06,
        h: 2.75,
        fill: { color: PALETTE.white },
        line: { color: PALETTE.border, width: 1 },
      });
      slide.addText(cleanText(member.memberName), {
        x: x + 0.2,
        y: y + 0.14,
        w: 5.66,
        h: 0.3,
        fontSize: 13,
        bold: true,
        color: PALETTE.navy,
      });
      slide.addText(
        `${member.openTasks} open  |  ${member.completedTasks} completed  |  ${member.urgentTasks} high/urgent`,
        {
          x: x + 0.2,
          y: y + 0.45,
          w: 5.66,
          h: 0.22,
          fontSize: 9,
          color: PALETTE.slate,
        },
      );
      const lines = member.items.slice(0, 3).flatMap((item) => [
        `• ${cleanText(item.taskTitle)} (Due ${item.dueDate})`,
        ...item.pendingSubtasks.slice(0, 2).map((s) => `   [ ] ${cleanText(s)}`),
      ]);
      slide.addText(lines.join("\n"), {
        x: x + 0.2,
        y: y + 0.74,
        w: 5.66,
        h: 1.9,
        fontSize: 9,
        color: PALETTE.ink,
        valign: "top",
      });
    });
  });

  // Final Slide: Next Steps
  const closing = pptx.addSlide();
  addSlideHeader(
    closing,
    "Action Plan",
    "Next Steps & Coordination Checklist",
    deck.subtitle,
    footerLeft,
    slideCursor++,
    totalSlides,
  );
  closing.addShape("roundRect", {
    x: 0.5,
    y: 1.15,
    w: 12.33,
    h: 5.7,
    fill: { color: PALETTE.white },
    line: { color: PALETTE.border, width: 1 },
  });
  closing.addText(
    deck.nextSteps
      .map((s, idx) => `0${idx + 1}.  ${cleanText(s)}`)
      .join("\n\n\n"),
    {
      x: 0.9,
      y: 1.6,
      w: 11.5,
      h: 4.8,
      fontSize: 14,
      color: PALETTE.ink,
      valign: "top",
    },
  );

  const out = await pptx.write({ outputType: "uint8array" });
  return out instanceof Uint8Array ? out : new Uint8Array(out as ArrayBuffer);
}

