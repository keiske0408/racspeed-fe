import { describe, expect, it, vi } from "vitest";
import {
  buildAiDraftPrompt,
  buildDynamicPromptSchemas,
  detectFormConflicts,
  extractJsonFromModelText,
  mapAiDraftToFormDraft,
  mergeAiDraftWithExistingForm,
  resolvePartialDateToIso,
  sanitizeAndValidateAiDraft,
  type ActivityFormState,
} from "@/features/activities/ai-draft-schema";
import {
  ACTIVITY_KINDS,
  ACTIVITY_STATUSES,
  AREAS_OF_FOCUS,
  COMMITTEES,
  DEFAULT_CLUB_ID,
} from "@/features/activities/types";
import { createActivitySchema } from "@/features/activities/schemas";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    GEMINI_API_KEY: "test_secret_api_key_value",
    GEMINI_MODEL: "gemini-2.5-flash",
  },
}));

import { generateActivityDraftFromText } from "@/lib/services/ai/gemini";

const TODAY = "2026-11-24";

function makeBaseForm(overrides: Partial<ActivityFormState> = {}): ActivityFormState {
  return {
    kind: "JOINT_PROJECT",
    meetingType: "GENERAL_ASSEMBLY",
    title: "",
    shortDescription: "",
    description: "",
    location: "",
    startAt: "2026-12-01T09:00",
    endAt: "2026-12-01T12:00",
    allDay: false,
    committee: "",
    status: "PLANNED",
    priority: "MEDIUM",
    objective: "",
    beneficiaryType: "",
    beneficiaryTarget: 0,
    fundingTarget: 0,
    fundingSource: "",
    areasOfFocus: [],
    sdgs: [],
    selectedPartnerIds: [],
    externalPartners: [],
    relatedLinks: [],
    initialTasks: [],
    ...overrides,
  };
}

describe("AI Project Draft Schema & Prompt Builder", () => {
  it("dynamically builds project and activity schemas containing live app enums", () => {
    const { projectSchemaPrompt, activitySchemaPrompt } =
      buildDynamicPromptSchemas();

    for (const kind of ACTIVITY_KINDS) {
      expect(projectSchemaPrompt).toContain(kind);
    }
    for (const committee of COMMITTEES) {
      expect(projectSchemaPrompt).toContain(committee);
    }
    for (const status of ACTIVITY_STATUSES) {
      expect(projectSchemaPrompt).toContain(status);
    }
    for (const area of AREAS_OF_FOCUS) {
      expect(projectSchemaPrompt).toContain(area.code);
    }
    expect(activitySchemaPrompt).toContain("dueDate");
    expect(activitySchemaPrompt).toContain("priority");
    expect(activitySchemaPrompt).toContain("URGENT");
    expect(activitySchemaPrompt).toContain("TODO");
  });

  it("renders the runtime prompt template with TODAY, schemas, and raw text", () => {
    const prompt = buildAiDraftPrompt({
      rawText: "Hi Pres! Let's partner on Nov 28 🤝",
      todayIso: TODAY,
    });
    expect(prompt).toContain(`Today's date: ${TODAY}`);
    expect(prompt).toContain("Project schema (fill only these fields):");
    expect(prompt).toContain("Activity schema:");
    expect(prompt).toContain("Never invent dates, names, links, or amounts.");
    expect(prompt).toContain("Hi Pres! Let's partner on Nov 28 🤝");
  });
});

describe("AI Output Parsing, Date Resolution, URL Extraction & Mapping", () => {
  it("resolves partial dates relative to today's date and rolls past dates to next year", () => {
    expect(resolvePartialDateToIso("Nov 28", TODAY)).toEqual({
      date: "2026-11-28",
      time: null,
    });
    expect(resolvePartialDateToIso("December 20", TODAY)).toEqual({
      date: "2026-12-20",
      time: null,
    });
    expect(resolvePartialDateToIso("Jan 15", TODAY)).toEqual({
      date: "2027-01-15",
      time: null,
    });
    expect(resolvePartialDateToIso("2026-11-28T09:30:00+08:00", TODAY)).toEqual({
      date: "2026-11-28",
      time: "09:30",
    });
  });

  it("extracts JSON even when wrapped in markdown fences and preserves markdown/verbatim URLs", () => {
    const modelOutput = `\`\`\`json
{
  "project": {
    "kind": "JOINT_PROJECT",
    "title": "Project Kaagapay Community Outreach 🤝",
    "shortDescription": "Tara partner tayo for community outreach on Nov 28 and Dec 20!",
    "description": "Magandang araw Pres! Inviting your club to join our two-day outreach.",
    "location": null,
    "startAt": "Nov 28",
    "endAt": "Dec 20",
    "allDay": false,
    "committee": "COMMUNITY_SERVICE",
    "status": "DRAFT",
    "objective": "Deliver community relief and literacy kits across two outreach dates.",
    "beneficiaryType": "Barangay families",
    "beneficiaryTarget": 0,
    "fundingTarget": 0,
    "areasOfFocus": ["BASIC_EDUCATION (Basic education and literacy)"],
    "sdgs": [4, 1],
    "organizer": "Rotaract Club of Metro South",
    "call_to_action": "Sign up via registration link if interested to partner",
    "addressed_to": "Club President",
    "sent_by": "Pres. Marco",
    "urls": [
      {
        "url": "[Project Primer](https://drive.google.com/file/d/1AbCdEfG/view?usp=sharing)",
        "label": "Project Primer",
        "purpose": "primer"
      },
      {
        "url": "https://tinyurl.com/kaagapay-signup",
        "label": "Partner Registration Form",
        "purpose": "registration"
      }
    ],
    "dates_mentioned": [
      { "date": "Nov 28", "label": "Outreach Day 1" },
      { "date": "Dec 20", "label": "Outreach Day 2" }
    ]
  },
  "activities": [
    {
      "title": "Review Project Kaagapay primer (Google Drive)",
      "description": "Open https://drive.google.com/file/d/1AbCdEfG/view?usp=sharing and note scope & requirements.",
      "dueDate": "2026-11-25",
      "priority": "HIGH",
      "status": "TODO",
      "order": 1
    },
    {
      "title": "Assess club calendar & manpower for Nov 28 and Dec 20",
      "description": "Check member availability for both dates.",
      "dueDate": "2026-11-26",
      "priority": "HIGH",
      "status": "TODO",
      "order": 2
    },
    {
      "title": "Present proposal at club board/assembly meeting & vote",
      "description": "Approve whether to partner on Nov 28, Dec 20, or both.",
      "dueDate": "2026-11-26",
      "priority": "URGENT",
      "status": "TODO",
      "order": 3
    },
    {
      "title": "Assign Club Point Person for partnership coordination",
      "description": "Coordinate with Pres. Marco of Rotaract Club of Metro South.",
      "dueDate": "2026-11-26",
      "priority": "MEDIUM",
      "status": "TODO",
      "order": 4
    },
    {
      "title": "Complete partner sign-up via registration link",
      "description": "Submit club decision at https://tinyurl.com/kaagapay-signup before Nov 28 kickoff.",
      "dueDate": "2026-11-27",
      "priority": "URGENT",
      "status": "TODO",
      "order": 5
    },
    {
      "title": "Coordinate logistics & execute Outreach Day 1 (Nov 28)",
      "description": "Confirm venue and call time with organizer.",
      "dueDate": "Nov 28",
      "priority": "HIGH",
      "status": "TODO",
      "order": 6
    },
    {
      "title": "Follow up after Day 1 & prepare Outreach Day 2 (Dec 20)",
      "description": "Debrief with host club and mobilize volunteers for Dec 20.",
      "dueDate": "Dec 20",
      "priority": "MEDIUM",
      "status": "TODO",
      "order": 7
    }
  ],
  "missing_info": [
    "Exact venue / barangay location",
    "Registration deadline date",
    "Required counterpart budget or sponsorship amount"
  ]
}
\`\`\``;

    const rawJson = extractJsonFromModelText(modelOutput);
    const validated = sanitizeAndValidateAiDraft(rawJson, TODAY);
    expect(validated.success).toBe(true);
    if (!validated.success) return;

    expect(validated.data.project.areasOfFocus).toEqual(["BASIC_EDUCATION"]);
    expect(validated.data.project.urls).toEqual([
      {
        url: "https://drive.google.com/file/d/1AbCdEfG/view?usp=sharing",
        label: "Project Primer",
        purpose: "primer",
      },
      {
        url: "https://tinyurl.com/kaagapay-signup",
        label: "Partner Registration Form",
        purpose: "registration",
      },
    ]);
    expect(validated.data.missing_info).toHaveLength(3);

    const mapped = mapAiDraftToFormDraft(validated.data, {
      todayIso: TODAY,
      partnerClubs: [
        { id: "00000000-0000-0000-0000-000000000099", name: "Rotaract Club of Metro South" },
      ],
    });

    expect(mapped.form.kind).toBe("JOINT_PROJECT");
    expect(mapped.form.status).toBe("DRAFT");
    expect(mapped.form.startAt).toBe("2026-11-28T09:00");
    expect(mapped.form.endAt).toBe("2026-12-20T17:00");
    expect(mapped.form.selectedPartnerIds).toEqual([
      "00000000-0000-0000-0000-000000000099",
    ]);
    expect(mapped.form.relatedLinks).toHaveLength(2);
    expect(mapped.form.initialTasks).toHaveLength(7);
    expect(mapped.form.initialTasks[0]?.dueDate).toBe("2026-11-25");
    expect(mapped.form.initialTasks[6]?.dueDate).toBe("2026-12-20");
    expect(mapped.meta.addressedTo).toBe("Club President");
    expect(mapped.meta.callToAction).toContain("registration link");

    // Verify mapped state produces a valid createActivitySchema payload
    const schemaResult = createActivitySchema.safeParse({
      clubId: DEFAULT_CLUB_ID,
      kind: mapped.form.kind,
      title: mapped.form.title,
      shortDescription: mapped.form.shortDescription,
      description: mapped.form.description,
      location: mapped.form.location,
      startAt: mapped.form.startAt,
      endAt: mapped.form.endAt,
      allDay: mapped.form.allDay,
      committee: mapped.form.committee || undefined,
      status: mapped.form.status,
      objective: mapped.form.objective,
      beneficiaryType: mapped.form.beneficiaryType,
      beneficiaryTarget: mapped.form.beneficiaryTarget,
      fundingTarget: mapped.form.fundingTarget,
      fundingSource: mapped.form.fundingSource,
      areasOfFocus: mapped.form.areasOfFocus,
      sdgs: mapped.form.sdgs,
      sisterClubId: mapped.form.selectedPartnerIds[0],
      partners: [
        {
          name: "Rotaract Club of Metro South",
          role: "IMPLEMENTING_PARTNER",
          sisterClubId: mapped.form.selectedPartnerIds[0],
        },
      ],
      relatedLinks: mapped.form.relatedLinks.map((l) => ({
        label: l.label,
        url: l.url,
      })),
      initialTasks: mapped.form.initialTasks.map((t) => ({
        title: t.title,
        description: t.description,
        dueDate: t.dueDate,
        priority: t.priority,
        status: t.status,
      })),
    });
    expect(schemaResult.success).toBe(true);
  });

  it("rejects invalid enum values so retry logic is triggered", () => {
    const result = sanitizeAndValidateAiDraft(
      {
        project: { kind: "NON_EXISTENT_KIND", title: "Bad Kind" },
        activities: [
          {
            title: "Task 1",
            dueDate: "2026-11-28",
            priority: "MEDIUM",
            status: "TODO",
            order: 1,
          },
        ],
        missing_info: [],
      },
      TODAY,
    );
    expect(result.success).toBe(false);
  });
});

describe("Non-Overwriting Conflict Detection & Form Merge", () => {
  it("detects modified fields and keeps user-entered values under fill_empty strategy", () => {
    const current = makeBaseForm({
      title: "My Custom Project Title",
      location: "San Pedro Plaza",
      initialTasks: [
        {
          id: "manual-1",
          title: "Manual Task",
          description: "",
          dueDate: "2026-11-25",
          priority: "HIGH",
          status: "TODO",
          order: 1,
        },
      ],
    });
    const incoming = makeBaseForm({
      title: "AI Extracted Title",
      shortDescription: "AI summary filled into empty field",
      location: "AI Venue",
      startAt: "2026-11-28T09:00",
      endAt: "2026-12-20T17:00",
      initialTasks: [
        {
          id: "ai-1",
          title: "Review primer",
          description: "",
          dueDate: "2026-11-25",
          priority: "HIGH",
          status: "TODO",
          order: 1,
        },
      ],
    });

    const conflicts = detectFormConflicts(current, incoming, {
      defaultStartAt: "2026-12-01T09:00",
      defaultEndAt: "2026-12-01T12:00",
    });
    expect(conflicts.map((c) => c.field)).toEqual([
      "title",
      "location",
      "initialTasks",
    ]);

    const safeMerged = mergeAiDraftWithExistingForm(
      current,
      incoming,
      "fill_empty",
      {
        defaultStartAt: "2026-12-01T09:00",
        defaultEndAt: "2026-12-01T12:00",
      },
    );
    expect(safeMerged.title).toBe("My Custom Project Title");
    expect(safeMerged.location).toBe("San Pedro Plaza");
    expect(safeMerged.shortDescription).toBe(
      "AI summary filled into empty field",
    );
    expect(safeMerged.startAt).toBe("2026-11-28T09:00");
    expect(safeMerged.initialTasks.map((t) => t.title)).toEqual([
      "Manual Task",
      "Review primer",
    ]);

    const overwritten = mergeAiDraftWithExistingForm(
      current,
      incoming,
      "overwrite",
    );
    expect(overwritten.title).toBe("AI Extracted Title");
    expect(overwritten.initialTasks.map((t) => t.title)).toEqual([
      "Review primer",
    ]);
  });
});

describe("Server-Side Gemini Client Retry & Security", () => {
  it("retries once on malformed JSON and succeeds on second attempt without exposing key in URL", async () => {
    const validResponse = {
      project: {
        kind: "SERVICE_PROJECT",
        title: "Clean Water Drive",
        status: "DRAFT",
      },
      activities: [
        {
          title: "Review primer document",
          description: "Inspect details",
          dueDate: "2026-11-25",
          priority: "HIGH",
          status: "TODO",
          order: 1,
        },
      ],
      missing_info: ["Exact venue"],
    };

    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "{not valid json" }] } }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: JSON.stringify(validResponse) }] } },
            ],
          }),
          { status: 200 },
        ),
      );

    const res = await generateActivityDraftFromText({
      rawText: "Join our Clean Water Drive!",
      todayIso: TODAY,
      fetchImpl: mockFetch,
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).not.toContain("test_secret_api_key_value");
    expect((init?.headers as Record<string, string>)["x-goog-api-key"]).toBe(
      "test_secret_api_key_value",
    );
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.attempts).toBe(2);
      expect(res.data.project.title).toBe("Clean Water Drive");
    }
  });

  it("returns INVALID_AI_OUTPUT error when both attempts emit malformed output", async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "still not json" }] } }],
        }),
        { status: 200 },
      ),
    );

    const res = await generateActivityDraftFromText({
      rawText: "Join our Clean Water Drive!",
      todayIso: TODAY,
      fetchImpl: mockFetch,
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.code).toBe("INVALID_AI_OUTPUT");
    }
  });
});

