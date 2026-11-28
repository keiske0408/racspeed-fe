import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type {
  DeckCalendarMonth,
  DeckMemberWorkload,
  DeckProject,
  PresentationDeckDTO,
} from "@/features/activities/export-types";

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function safePdfText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replaceAll("✓", "[x]")
    .replaceAll("☐", "[ ]")
    .replaceAll("★", "*")
    .replaceAll("●", "-")
    .replace(/[\u{1F000}-\u{1FFFF}\u2600-\u27BF]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

const styles = StyleSheet.create({
  coverPage: {
    backgroundColor: "#0D3594",
    color: "#FFFFFF",
    padding: 56,
    fontFamily: "Helvetica",
    justifyContent: "space-between",
  },
  coverAccent: {
    width: 72,
    height: 5,
    backgroundColor: "#F59E0B",
    marginBottom: 18,
  },
  coverClubTag: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#BFDBFE",
    marginBottom: 12,
  },
  coverTitle: {
    fontSize: 34,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.2,
    color: "#FFFFFF",
    maxWidth: 760,
  },
  coverSubtitle: {
    marginTop: 14,
    fontSize: 15,
    color: "#DBEAFE",
  },
  coverFooter: {
    borderTopWidth: 1,
    borderTopColor: "#1E40AF",
    paddingTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 11,
    color: "#BFDBFE",
  },
  slide: {
    backgroundColor: "#F8FAFC",
    color: "#111625",
    paddingTop: 30,
    paddingHorizontal: 38,
    paddingBottom: 28,
    fontFamily: "Helvetica",
    justifyContent: "space-between",
  },
  slideHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 2,
    borderBottomColor: "#0D3594",
    paddingBottom: 8,
    marginBottom: 14,
  },
  slideKicker: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#0D3594",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  slideTitle: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#111625",
  },
  slideMeta: {
    fontSize: 9,
    color: "#64748B",
  },
  slideBody: {
    flex: 1,
  },
  slideFooter: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8.5,
    color: "#64748B",
  },
  kpiRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 6,
    padding: 12,
  },
  kpiValue: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: "#0D3594",
  },
  kpiLabel: {
    marginTop: 4,
    fontSize: 9.5,
    color: "#475569",
  },
  twoCol: {
    flexDirection: "row",
    gap: 14,
    flex: 1,
  },
  panel: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 6,
    padding: 14,
  },
  panelWarn: {
    flex: 1,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 6,
    padding: 14,
  },
  panelTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#0D3594",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  panelTitleWarn: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#92400E",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  bodyText: {
    fontSize: 10.5,
    lineHeight: 1.45,
    color: "#1E293B",
    marginBottom: 10,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 6,
    gap: 6,
  },
  bulletDot: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#0D3594",
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.4,
    color: "#334155",
  },
  calHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#1E3A8A",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  calDowCell: {
    flex: 1,
    paddingVertical: 5,
    textAlign: "center",
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  calWeekRow: {
    flexDirection: "row",
    flex: 1,
    borderLeftWidth: 1,
    borderColor: "#CBD5E1",
  },
  calDayCell: {
    flex: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#CBD5E1",
    padding: 4,
    backgroundColor: "#FFFFFF",
  },
  calDayActive: {
    backgroundColor: "#EFF6FF",
  },
  calDayMuted: {
    backgroundColor: "#F1F5F9",
  },
  calDayNum: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#1E293B",
    marginBottom: 3,
  },
  calPillAct: {
    backgroundColor: "#DBEAFE",
    color: "#1E3A8A",
    fontSize: 7,
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    borderRadius: 2,
    marginBottom: 2,
  },
  calPillTask: {
    backgroundColor: "#FEF3C7",
    color: "#92400E",
    fontSize: 7,
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    borderRadius: 2,
    marginBottom: 2,
  },
  projectCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    padding: 14,
  },
  projectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 8,
    marginBottom: 8,
  },
  projectTitle: {
    fontSize: 13.5,
    fontFamily: "Helvetica-Bold",
    color: "#111625",
    maxWidth: 310,
  },
  badge: {
    backgroundColor: "#EEF2FF",
    color: "#1E3A8A",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
  },
  metaLine: {
    fontSize: 9.5,
    color: "#475569",
    marginBottom: 4,
  },
  talkingBox: {
    backgroundColor: "#F8FAFC",
    borderLeftWidth: 3,
    borderLeftColor: "#0D3594",
    padding: 8,
    marginVertical: 6,
  },
  taskRow: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 5,
    marginTop: 5,
  },
  taskTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1E293B",
  },
  subtaskText: {
    fontSize: 8,
    color: "#475569",
    marginLeft: 8,
    marginTop: 1.5,
  },
  memberGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    flex: 1,
  },
  memberCard: {
    width: "48.8%",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    padding: 12,
  },
  memberName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#0D3594",
    marginBottom: 3,
  },
  memberStats: {
    fontSize: 8.5,
    color: "#64748B",
    marginBottom: 7,
  },
});

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function SlideChrome({
  kicker,
  title,
  deck,
  slideNumber,
  totalSlides,
  children,
}: {
  kicker: string;
  title: string;
  deck: PresentationDeckDTO;
  slideNumber: number;
  totalSlides: number;
  children: React.ReactNode;
}) {
  return (
    <Page size={{ width: 960, height: 540 }} style={styles.slide}>
      <View style={styles.slideHeader}>
        <View>
          <Text style={styles.slideKicker}>{safePdfText(kicker)}</Text>
          <Text style={styles.slideTitle}>{safePdfText(title)}</Text>
        </View>
        <Text style={styles.slideMeta}>{safePdfText(deck.subtitle)}</Text>
      </View>
      <View style={styles.slideBody}>{children}</View>
      <View style={styles.slideFooter}>
        <Text>
          {safePdfText(deck.clubName)} | Generated {safePdfText(deck.generatedAtLabel)}
        </Text>
        <Text>
          Slide {slideNumber} of {totalSlides}
        </Text>
      </View>
    </Page>
  );
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

export function PresentationPdfDocument({
  deck,
}: {
  deck: PresentationDeckDTO;
}) {
  const calendarSlides = deck.calendarMonths.slice(0, 3);
  const projectPages = chunkArray<DeckProject>(deck.projects, 2);
  const workloadPages = chunkArray<DeckMemberWorkload>(deck.memberWorkloads, 4);

  const totalSlides =
    1 + // Cover
    1 + // Overview
    calendarSlides.length +
    projectPages.length +
    workloadPages.length +
    1; // Next steps

  let cursor = 2;

  return (
    <Document title={safePdfText(deck.title)} author={safePdfText(deck.clubName)}>
      {/* Slide 1: Cover */}
      <Page size={{ width: 960, height: 540 }} style={styles.coverPage}>
        <View>
          <View style={styles.coverAccent} />
          <Text style={styles.coverClubTag}>
            {safePdfText(deck.clubName)} | District {safePdfText(deck.districtCode)}
          </Text>
          <Text style={styles.coverTitle}>{safePdfText(deck.title)}</Text>
          <Text style={styles.coverSubtitle}>{safePdfText(deck.subtitle)}</Text>
        </View>
        <View style={styles.coverFooter}>
          <Text>Prepared by {safePdfText(deck.presenterName)}</Text>
          <Text>
            {deck.aiEnhanced ? "AI-Enhanced Executive Brief" : "Club Database Brief"} |{" "}
            {safePdfText(deck.generatedAtLabel)}
          </Text>
        </View>
      </Page>

      {/* Slide 2: Executive Overview & KPIs */}
      <SlideChrome
        kicker="Executive Briefing"
        title="Schedule Overview & Readiness"
        deck={deck}
        slideNumber={cursor++}
        totalSlides={totalSlides}
      >
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{deck.kpis.totalActivities}</Text>
            <Text style={styles.kpiLabel}>
              Projects &amp; Events ({deck.kpis.totalSessions} sessions)
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{deck.kpis.openTasks}</Text>
            <Text style={styles.kpiLabel}>
              Open Member Tasks ({deck.kpis.completedTasks} done)
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>
              {deck.kpis.completedSubtasks}/{deck.kpis.totalSubtasks}
            </Text>
            <Text style={styles.kpiLabel}>Subtasks Completed</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{deck.kpis.urgentCount}</Text>
            <Text style={styles.kpiLabel}>Urgent Priority Items</Text>
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Summary &amp; Key Highlights</Text>
            <Text style={styles.bodyText}>{safePdfText(deck.executiveSummary)}</Text>
            {deck.highlights.slice(0, 4).map((item, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>-</Text>
                <Text style={styles.bulletText}>{safePdfText(item)}</Text>
              </View>
            ))}
          </View>

          <View style={deck.attentionItems.length > 0 ? styles.panelWarn : styles.panel}>
            <Text
              style={
                deck.attentionItems.length > 0
                  ? styles.panelTitleWarn
                  : styles.panelTitle
              }
            >
              {deck.attentionItems.length > 0
                ? "Needs Officer Attention"
                : "Operational Status"}
            </Text>
            {deck.attentionItems.length > 0 ? (
              deck.attentionItems.slice(0, 5).map((item, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>!</Text>
                  <Text style={styles.bulletText}>{safePdfText(item)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.bodyText}>
                All scheduled sessions and member deliverables are currently on track with no urgent blockers flagged.
              </Text>
            )}
          </View>
        </View>
      </SlideChrome>

      {/* Plotted Calendar Slides */}
      {calendarSlides.map((cal) => {
        const weeks = buildCalendarWeeks(cal);
        return (
          <SlideChrome
            key={`${cal.year}-${cal.month}`}
            kicker="Plotted Club Calendar (Asia/Manila)"
            title={cal.label}
            deck={deck}
            slideNumber={cursor++}
            totalSlides={totalSlides}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.calHeaderRow}>
                {DAY_NAMES.map((d) => (
                  <Text key={d} style={styles.calDowCell}>
                    {d}
                  </Text>
                ))}
              </View>
              {weeks.map((week, wIdx) => (
                <View key={wIdx} style={styles.calWeekRow}>
                  {week.map((day) => {
                    const entries = day.inMonth
                      ? cal.entriesByDate[day.ymd] ?? []
                      : [];
                    const hasAct = entries.some((e) => e.kind === "activity");
                    return (
                      <View
                        key={day.ymd}
                        style={[
                          styles.calDayCell,
                          !day.inMonth
                            ? styles.calDayMuted
                            : hasAct
                              ? styles.calDayActive
                              : {},
                        ]}
                      >
                        <Text
                          style={[
                            styles.calDayNum,
                            !day.inMonth ? { color: "#94A3B8" } : {},
                          ]}
                        >
                          {day.dayNum}
                        </Text>
                        {entries.slice(0, 3).map((e, eIdx) => (
                          <Text
                            key={eIdx}
                            style={
                              e.kind === "activity"
                                ? styles.calPillAct
                                : styles.calPillTask
                            }
                          >
                            {safePdfText(
                              `${e.sessionLabel ? `[${e.sessionLabel}] ` : ""}${e.title}`.slice(
                                0,
                                28,
                              ),
                            )}
                          </Text>
                        ))}
                        {entries.length > 3 && (
                          <Text style={{ fontSize: 6.5, color: "#64748B" }}>
                            +{entries.length - 3} more
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </SlideChrome>
        );
      })}

      {/* Project Spotlights */}
      {projectPages.map((pair, pageIdx) => (
        <SlideChrome
          key={`proj-page-${pageIdx}`}
          kicker="Project & Deliverable Breakdown"
          title={`Upcoming Projects & Tasks${projectPages.length > 1 ? ` (${pageIdx + 1}/${projectPages.length})` : ""}`}
          deck={deck}
          slideNumber={cursor++}
          totalSlides={totalSlides}
        >
          <View style={styles.twoCol}>
            {pair.map((project) => (
              <View key={project.id} style={styles.projectCard}>
                <View style={styles.projectHeader}>
                  <Text style={styles.projectTitle}>
                    {safePdfText(project.title)}
                  </Text>
                  <Text style={styles.badge}>
                    {safePdfText(project.statusLabel)}
                  </Text>
                </View>

                <Text style={styles.metaLine}>
                  Schedule: {safePdfText(project.scheduleLabel)}
                  {project.recurrenceLabel
                    ? ` (${safePdfText(project.recurrenceLabel)})`
                    : ""}
                </Text>
                <Text style={styles.metaLine}>
                  Lead: {safePdfText(project.chairName)} | Where:{" "}
                  {safePdfText(project.location)} | Going: {project.rsvpGoing}
                </Text>

                <View style={styles.talkingBox}>
                  <Text style={{ fontSize: 9, lineHeight: 1.35, color: "#1E293B" }}>
                    {safePdfText(project.talkingPoint)}
                  </Text>
                </View>

                <Text
                  style={{
                    fontSize: 9,
                    fontFamily: "Helvetica-Bold",
                    color: "#0D3594",
                    marginTop: 4,
                  }}
                >
                  Tasks &amp; Subtasks ({project.tasks.length})
                </Text>

                {project.tasks.length === 0 ? (
                  <Text style={{ fontSize: 8.5, color: "#64748B", marginTop: 4 }}>
                    No project tasks assigned yet.
                  </Text>
                ) : (
                  project.tasks.slice(0, 4).map((t) => (
                    <View key={t.id} style={styles.taskRow}>
                      <Text style={styles.taskTitle}>
                        [{safePdfText(t.priority)}] {safePdfText(t.title)} -{" "}
                        {safePdfText(t.assignees.join(", "))} (Due {t.dueDate})
                      </Text>
                      {t.checklist.slice(0, 3).map((c, cIdx) => (
                        <Text key={cIdx} style={styles.subtaskText}>
                          {c.completed ? "[x]" : "[ ]"}{" "}
                          {safePdfText(c.title)}
                          {c.assignedMemberName
                            ? ` (${safePdfText(c.assignedMemberName)})`
                            : ""}
                        </Text>
                      ))}
                    </View>
                  ))
                )}
              </View>
            ))}
          </View>
        </SlideChrome>
      ))}

      {/* Member Tasks & Subtasks Workload */}
      {workloadPages.map((group, pageIdx) => (
        <SlideChrome
          key={`work-page-${pageIdx}`}
          kicker="Member Accountability"
          title={`Tasks & Subtasks by Member${workloadPages.length > 1 ? ` (${pageIdx + 1}/${workloadPages.length})` : ""}`}
          deck={deck}
          slideNumber={cursor++}
          totalSlides={totalSlides}
        >
          <View style={styles.memberGrid}>
            {group.map((member) => (
              <View key={member.memberName} style={styles.memberCard}>
                <Text style={styles.memberName}>
                  {safePdfText(member.memberName)}
                </Text>
                <Text style={styles.memberStats}>
                  {member.openTasks} open | {member.completedTasks} completed |{" "}
                  {member.urgentTasks} high/urgent
                </Text>
                {member.items.slice(0, 4).map((item, idx) => (
                  <View key={idx} style={{ marginBottom: 5 }}>
                    <Text style={styles.taskTitle}>
                      - {safePdfText(item.taskTitle)} (Due {item.dueDate})
                    </Text>
                    {item.pendingSubtasks.slice(0, 2).map((sub, sIdx) => (
                      <Text key={sIdx} style={styles.subtaskText}>
                        [ ] {safePdfText(sub)}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </SlideChrome>
      ))}

      {/* Final Slide: Next Steps */}
      <SlideChrome
        kicker="Action Plan"
        title="Next Steps & Coordination Checklist"
        deck={deck}
        slideNumber={cursor++}
        totalSlides={totalSlides}
      >
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Immediate Club Follow-Ups</Text>
          {deck.nextSteps.map((step, idx) => (
            <View
              key={idx}
              style={{
                flexDirection: "row",
                gap: 10,
                paddingVertical: 10,
                borderBottomWidth: idx < deck.nextSteps.length - 1 ? 1 : 0,
                borderBottomColor: "#E2E8F0",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Helvetica-Bold",
                  color: "#0D3594",
                  width: 24,
                }}
              >
                0{idx + 1}
              </Text>
              <Text style={{ flex: 1, fontSize: 12, color: "#1E293B", lineHeight: 1.4 }}>
                {safePdfText(step)}
              </Text>
            </View>
          ))}
        </View>
      </SlideChrome>
    </Document>
  );
}

export async function renderPresentationPdfBuffer(
  deck: PresentationDeckDTO,
): Promise<Uint8Array> {
  const buffer = await renderToBuffer(<PresentationPdfDocument deck={deck} />);
  return new Uint8Array(buffer);
}

