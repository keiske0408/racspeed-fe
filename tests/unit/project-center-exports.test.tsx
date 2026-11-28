import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import ExcelJS from "exceljs";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { buildCalendarWorkbookBuffer } from "@/lib/services/exports/calendar-excel";
import type {
  buildDeterministicDeck as BuildDeterministicDeckType,
  enrichDeckWithGemini as EnrichDeckWithGeminiType,
} from "@/lib/services/exports/presentation-builder";
import { renderPresentationPdfBuffer } from "@/lib/services/exports/presentation-pdf";
import { renderPresentationPptxBuffer } from "@/lib/services/exports/presentation-pptx";
import {
  DEFAULT_CLUB_ID,
  type ActivitySummaryDTO,
} from "@/features/activities/types";
import type { GroupTaskDTO } from "@/lib/data/tasks-types";
import { ExportCalendarModal } from "@/app/(app)/project-center/_components/export-calendar-modal";
import { PresentationBuilderModal } from "@/app/(app)/project-center/_components/presentation-builder-modal";
import { QuickSummaryModal } from "@/app/(app)/project-center/_components/quick-summary-modal";
import type { ProjectCenterHeader as ProjectCenterHeaderType } from "@/app/(app)/project-center/_components/project-center-header";
import {
  buildQuickSummaryData,
  formatQuickSummaryPlainText,
  recalculateQuickSummaryStats,
} from "@/lib/services/exports/quick-summary-data";

let buildDeterministicDeck: typeof BuildDeterministicDeckType;
let enrichDeckWithGemini: typeof EnrichDeckWithGeminiType;
let ProjectCenterHeader: typeof ProjectCenterHeaderType;

function makeActivity(
  overrides: Partial<ActivitySummaryDTO> = {},
): ActivitySummaryDTO {
  return {
    id: "act-export-1",
    clubId: DEFAULT_CLUB_ID,
    kind: "JOINT_PROJECT",
    meetingType: null,
    title: "Project ELEMENOPI",
    shortDescription: "Literacy and community partnership with RAC Nuvali.",
    location: "Nuvali, Laguna",
    startAt: "2026-11-28T09:00:00+08:00",
    endAt: "2026-12-20T17:00:00+08:00",
    allDay: false,
    status: "PLANNED",
    priority: "HIGH",
    committee: "COMMUNITY_SERVICE",
    ownerId: "user-1",
    ownerName: "Pres Glenn",
    isTeamMember: true,
    myTeamRole: "CHAIR",
    teamMembers: [],
    minMembersRequired: 10,
    capacity: null,
    rsvpEnabled: true,
    rsvpDeadline: null,
    selfCheckInEnabled: false,
    qrCheckInEnabled: true,
    checkInWindowMinutes: 180,
    volunteerHoursDefault: 4,
    rsvp: { going: 6, maybe: 1, notGoing: 0 },
    myRsvp: "GOING",
    attendeesCount: 0,
    checkedIn: false,
    tasksTotal: 1,
    tasksDone: 0,
    commentsCount: 0,
    coverUrl: null,
    rotaryYear: "2026-27",
    recurrence: {
      frequency: "CUSTOM_DATES",
      dates: ["2026-11-28", "2026-12-20"],
      sessionEndTime: "17:00",
    },
    ...overrides,
  };
}

const sampleActivities: ActivitySummaryDTO[] = [
  makeActivity(),
  makeActivity({
    id: "act-export-2",
    kind: "MEETING",
    meetingType: "GENERAL_ASSEMBLY",
    title: "November General Assembly",
    shortDescription: "Monthly club fellowship and project alignment.",
    location: "San Pedro Hall",
    startAt: "2026-11-15T18:00:00+08:00",
    endAt: "2026-11-15T20:00:00+08:00",
    status: "ONGOING",
    priority: "MEDIUM",
    minMembersRequired: null,
    tasksTotal: 0,
    recurrence: null,
  }),
];

const sampleTasks: GroupTaskDTO[] = [
  {
    id: "task-1",
    clubId: DEFAULT_CLUB_ID,
    title: "Confirm logistics & registration",
    description: "Coordinate forms and kits for Day 1",
    committee: "COMMUNITY_SERVICE",
    status: "IN_PROGRESS",
    priority: "URGENT",
    dueDate: "2026-11-26",
    assignedMemberIds: ["mem-1"],
    assignedMemberNames: ["Maria Santos"],
    checklist: [
      {
        id: "sub-1",
        title: "Review primer PDF",
        completed: true,
        assignedMemberName: "Maria Santos",
      },
      {
        id: "sub-2",
        title: "Share Google Form in club GC",
        completed: false,
        assignedMemberName: "Carlo Reyes",
      },
    ],
    createdAt: "2026-11-20T08:00:00Z",
    updatedAt: "2026-11-24T08:00:00Z",
    createdBy: "user-1",
    projectId: "act-export-1",
    projectTitle: "Project ELEMENOPI",
  },
];

function collectSheetText(sheet: ExcelJS.Worksheet): string[] {
  const texts: string[] = [];
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.value !== null && cell.value !== undefined) {
        texts.push(String(cell.value));
      }
    });
  });
  return texts;
}

describe("Project Center Excel Calendar & Presentation Exports", () => {
  beforeAll(async () => {
    vi.resetModules();
    vi.doMock("server-only", () => ({}));
    vi.doMock("next/link", () => ({
      default: ({
        href,
        children,
        ...props
      }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
      }) => (
        <a href={href} {...props}>
          {children}
        </a>
      ),
    }));
    const [mod, headerMod] = await Promise.all([
      import("@/lib/services/exports/presentation-builder"),
      import("@/app/(app)/project-center/_components/project-center-header"),
    ]);
    buildDeterministicDeck = mod.buildDeterministicDeck;
    enrichDeckWithGemini = mod.enrichDeckWithGemini;
    ProjectCenterHeader = headerMod.ProjectCenterHeader;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  afterAll(() => {
    vi.doUnmock("server-only");
    vi.doUnmock("next/link");
    vi.resetModules();
  });

  it("generates a styled multi-sheet Excel calendar workbook with plotted recurring sessions and tasks", async () => {
    const buffer = await buildCalendarWorkbookBuffer({
      clubName: "Rotaract Club of San Pedro East",
      districtCode: "3820",
      rotaryYear: "2026-27",
      months: [
        { year: 2026, month: 10 }, // Nov 2026
        { year: 2026, month: 11 }, // Dec 2026
      ],
      activities: sampleActivities,
      tasks: sampleTasks,
      includeTasks: true,
      generatedAt: new Date("2026-11-28T04:00:00Z"),
    });

    expect(buffer.byteLength).toBeGreaterThan(2000);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as ArrayBuffer);

    const sheetNames = wb.worksheets.map((s) => s.name);
    expect(sheetNames).toEqual([
      "Nov 2026",
      "Dec 2026",
      "Projects & Schedule",
      "Tasks & Deliverables",
    ]);

    const novTexts = collectSheetText(wb.getWorksheet("Nov 2026")!);
    expect(novTexts.some((t) => t.includes("Project ELEMENOPI [S1/2]"))).toBe(
      true,
    );
    expect(novTexts.some((t) => t.includes("November General Assembly"))).toBe(
      true,
    );
    expect(
      novTexts.some((t) => t.includes("Confirm logistics & registration")),
    ).toBe(true);

    // Ensure Nov 29 gap day does not contain Project ELEMENOPI
    const novSheet = wb.getWorksheet("Nov 2026")!;
    let nov29Body = "";
    novSheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        if (cell.value === 29) {
          nov29Body = String(novSheet.getRow(rowNumber + 1).getCell(colNumber).value ?? "");
        }
      });
    });
    expect(nov29Body).not.toContain("Project ELEMENOPI");

    const decTexts = collectSheetText(wb.getWorksheet("Dec 2026")!);
    expect(decTexts.some((t) => t.includes("Project ELEMENOPI [S2/2]"))).toBe(
      true,
    );

    const tasksSheetTexts = collectSheetText(
      wb.getWorksheet("Tasks & Deliverables")!,
    );
    expect(
      tasksSheetTexts.some((t) =>
        t.includes("✓ Review primer PDF (Maria Santos)"),
      ),
    ).toBe(true);
    expect(
      tasksSheetTexts.some((t) =>
        t.includes("☐ Share Google Form in club GC (Carlo Reyes)"),
      ),
    ).toBe(true);
  });

  it("synthesizes deterministic presentation data, supports optional Gemini enrichment, and renders valid PDF & PPTX bytes", async () => {
    const baseDeck = buildDeterministicDeck({
      title: "November – December Club Briefing",
      clubName: "Rotaract Club of San Pedro East",
      districtCode: "3820",
      rotaryYear: "2026-27",
      presenterName: "Pres Glenn",
      months: [
        { year: 2026, month: 10 },
        { year: 2026, month: 11 },
      ],
      activities: sampleActivities,
      tasks: sampleTasks,
      includeCalendar: true,
      includeTasks: true,
      includeWorkload: true,
      referenceNow: new Date("2026-11-24T04:00:00Z"),
    });

    expect(baseDeck.aiEnhanced).toBe(false);
    expect(baseDeck.kpis).toMatchObject({
      totalActivities: 2,
      totalSessions: 3,
      openTasks: 1,
      completedTasks: 0,
      totalSubtasks: 2,
      completedSubtasks: 1,
      urgentCount: 1,
    });
    expect(baseDeck.calendarMonths[0].entriesByDate["2026-11-28"][0].sessionLabel).toBe(
      "S1/2",
    );
    expect(baseDeck.calendarMonths[1].entriesByDate["2026-12-20"][0].sessionLabel).toBe(
      "S2/2",
    );
    expect(baseDeck.projects[1].tasks[0].checklist).toHaveLength(2);
    expect(baseDeck.memberWorkloads[0].memberName).toBe("Maria Santos");

    // Fallback cleanly when API key is absent
    const fallbackDeck = await enrichDeckWithGemini(baseDeck, {
      apiKeyOverride: "",
    });
    expect(fallbackDeck.aiEnhanced).toBe(false);

    // Mock Gemini enrichment
    const mockedFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      executiveSummary:
                        "Club operations center on Project ELEMENOPI and November GA alignment.",
                      highlights: [
                        "Two-part literacy partnership across Nov 28 and Dec 20",
                        "Urgent registration logistics led by Maria Santos",
                      ],
                      attentionItems: [
                        "Complete Google Form sharing before Nov 26 deadline",
                      ],
                      projectTalkingPoints: {
                        "act-export-1":
                          "Joint literacy partnership requiring 10 members across Nov 28 and Dec 20.",
                      },
                      nextSteps: [
                        "Finalize participant RSVPs for Nov 28 kickoff",
                        "Share Excel schedule in club GC",
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const aiDeck = await enrichDeckWithGemini(baseDeck, {
      apiKeyOverride: "test-key",
      fetchImpl: mockedFetch as unknown as typeof fetch,
    });
    expect(aiDeck.aiEnhanced).toBe(true);
    expect(aiDeck.executiveSummary).toContain("Project ELEMENOPI");
    expect(
      aiDeck.projects.find((p) => p.id === "act-export-1")?.talkingPoint,
    ).toContain("10 members");

    // Verify PDF binary header (%PDF-)
    const pdfBytes = await renderPresentationPdfBuffer(aiDeck);
    expect(pdfBytes.byteLength).toBeGreaterThan(1000);
    expect(Buffer.from(pdfBytes.slice(0, 5)).toString("ascii")).toBe("%PDF-");

    // Verify PPTX ZIP header (PK)
    const pptxBytes = await renderPresentationPptxBuffer(aiDeck);
    expect(pptxBytes.byteLength).toBeGreaterThan(1000);
    expect(Buffer.from(pptxBytes.slice(0, 2)).toString("ascii")).toBe("PK");
  });

  it("renders ExportCalendarModal and triggers download request with selected options", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(new Uint8Array([80, 75, 3, 4]), {
          status: 200,
          headers: {
            "Content-Disposition":
              'attachment; filename="racspeed-calendar-2026-11-2m.xlsx"',
          },
        }),
      );
    vi.spyOn(window.URL, "createObjectURL").mockReturnValue("blob:mock-xlsx");
    vi.spyOn(window.URL, "revokeObjectURL").mockImplementation(() => {});

    const onClose = vi.fn();
    render(
      <ExportCalendarModal
        isOpen={true}
        onClose={onClose}
        activities={sampleActivities}
        tasks={sampleTasks}
        rotaryYear="2026-27"
        kindFilter="ALL"
        canManageClub={true}
        initialYear={2026}
        initialMonth={10}
      />,
    );

    expect(screen.getByText("Export Styled Excel Calendar")).toBeInTheDocument();
    expect(screen.getByText(/2 plotted sessions/i)).toBeInTheDocument();
    expect(screen.getByText(/1 task deadline/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "2 Months" }));
    expect(screen.getByText(/3 plotted sessions/i)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Download Excel Calendar/i }),
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/project-center/export-calendar",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("renders PresentationBuilderModal configuration and interactive preview", async () => {
    const generatedDeck = buildDeterministicDeck({
      clubName: "Rotaract Club of San Pedro East",
      districtCode: "3820",
      rotaryYear: "2026-27",
      presenterName: "Pres Glenn",
      months: [{ year: 2026, month: 10 }],
      activities: sampleActivities,
      tasks: sampleTasks,
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, deck: generatedDeck }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(
      <PresentationBuilderModal
        isOpen={true}
        onClose={vi.fn()}
        activities={sampleActivities}
        rotaryYear="2026-27"
        canManageClub={true}
      />,
    );

    expect(
      screen.getByText(/Create Project Presentation & PDF Deck/i),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Generate Presentation/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Download PDF/i }),
      ).toBeInTheDocument();
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/project-center/presentation/generate",
      expect.objectContaining({ method: "POST" }),
    );
    expect(screen.getByRole("button", { name: /Download PPTX/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Present Fullscreen/i }),
    ).toBeInTheDocument();
  });

  it("builds Quick Summary data across Combined, Projects Only, and Tasks Only modes", () => {
    const refNow = new Date("2026-11-24T04:00:00Z");

    const combined = buildQuickSummaryData({
      activities: sampleActivities,
      tasks: sampleTasks,
      mode: "COMBINED",
      timeframe: "TWO_MONTHS",
      rotaryYear: "2026-27",
      clubName: "Rotaract Club of San Pedro East",
      districtCode: "3820",
      includeSubtasks: true,
      customNote: "RSVP by Friday",
      referenceNow: refNow,
    });

    expect(combined.projects).toHaveLength(2);
    expect(combined.tasks).toHaveLength(1);
    expect(combined.tasks[0].checklist).toHaveLength(2);
    expect(combined.stats.sessionsCount).toBe(3);

    const text = formatQuickSummaryPlainText(combined);
    expect(text).toContain("Project ELEMENOPI");
    expect(text).toContain("Confirm logistics & registration");
    expect(text).toContain("Note: RSVP by Friday");

    const projectsOnly = buildQuickSummaryData({
      activities: sampleActivities,
      tasks: sampleTasks,
      mode: "PROJECTS_ONLY",
      timeframe: "TWO_MONTHS",
      rotaryYear: "2026-27",
      clubName: "Rotaract Club of San Pedro East",
      districtCode: "3820",
      referenceNow: refNow,
    });
    expect(projectsOnly.projects).toHaveLength(2);
    expect(projectsOnly.tasks).toHaveLength(0);

    const tasksOnly = buildQuickSummaryData({
      activities: sampleActivities,
      tasks: sampleTasks,
      mode: "TASKS_ONLY",
      timeframe: "TWO_MONTHS",
      rotaryYear: "2026-27",
      clubName: "Rotaract Club of San Pedro East",
      districtCode: "3820",
      includeSubtasks: false,
      referenceNow: refNow,
    });
    expect(tasksOnly.projects).toHaveLength(0);
    expect(tasksOnly.tasks).toHaveLength(1);
    expect(tasksOnly.tasks[0].checklist).toHaveLength(0);
  });

  it("renders QuickSummaryModal with mode toggles and unified ProjectCenterHeader Export menu", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-24T04:00:00Z"));

    render(
      <QuickSummaryModal
        isOpen={true}
        onClose={vi.fn()}
        activities={sampleActivities}
        tasks={sampleTasks}
        rotaryYear="2026-27"
        clubName="Rotaract Club of San Pedro East"
        districtCode="3820"
        canManageClub={true}
      />,
    );

    expect(
      screen.getByText("Export Quick Summary Image"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "This & Next Month" }));
    expect(
      screen.getByRole("button", { name: /Download Separate PNGs \(2\)/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tasks Only" }));
    expect(
      screen.queryByRole("button", { name: /Download Separate PNGs \(2\)/i }),
    ).toBeNull();
    expect(
      screen.getByText("Member Tasks & Subtasks Summary"),
    ).toBeInTheDocument();

    // Switch back to Combined and test inline editing + Reset to DB
    fireEvent.click(screen.getByRole("button", { name: "Combined" }));
    fireEvent.click(screen.getByRole("tab", { name: /Edit Content/i }));
    fireEvent.change(screen.getByLabelText("Summary headline"), {
      target: { value: "Revised December GC Briefing" },
    });
    expect(screen.getByText("Revised December GC Briefing")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Project 1 title"), {
      target: { value: "Project ELEMENOPI (Updated Venue)" },
    });
    expect(
      screen.getByText("Project ELEMENOPI (Updated Venue)"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Add Task/i }));
    expect(screen.getByText("[High] New Action Item")).toBeInTheDocument();

    // Test Reset to DB restores baseline data
    fireEvent.click(screen.getByRole("button", { name: /Reset to DB/i }));
    expect(
      screen.queryByText("[High] New Action Item"),
    ).toBeNull();
    expect(
      screen.getByText("Projects & Action Tasks Summary"),
    ).toBeInTheDocument();

    // Direct KPI recalculation sanity check
    const recalced = recalculateQuickSummaryStats(
      buildQuickSummaryData({
        activities: sampleActivities,
        tasks: sampleTasks,
        mode: "COMBINED",
        timeframe: "TWO_MONTHS",
        rotaryYear: "2026-27",
        clubName: "Rotaract Club of San Pedro East",
        districtCode: "3820",
        referenceNow: new Date("2026-11-24T04:00:00Z"),
      }),
      [],
      [],
    );
    expect(recalced.stats.projectsCount).toBe(0);
    expect(recalced.stats.openTasksCount).toBe(0);
    expect(recalced.stats.subtasksTotal).toBe(0);

    cleanup();

    const onQuick = vi.fn();
    const onExcel = vi.fn();
    const onPres = vi.fn();
    render(
      <ProjectCenterHeader
        rotaryYear="2026-27"
        availableRotaryYears={["2026-27"]}
        currentRotaryYear="2026-27"
        onRotaryYearChange={vi.fn()}
        canCreate={true}
        onOpenQuickSummary={onQuick}
        onOpenExportCalendar={onExcel}
        onOpenPresentation={onPres}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Export$/i }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: /Export Quick Summary/i }),
    );
    expect(onQuick).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /^Export$/i }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: /Export Excel Calendar/i }),
    );
    expect(onExcel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /^Export$/i }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: /Create Presentation/i }),
    );
    expect(onPres).toHaveBeenCalledTimes(1);
  });
});

