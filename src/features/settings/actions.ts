"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertPermission,
  getUserAccessContext,
  requireUser,
} from "@/lib/auth/session";
import { writeNotificationSlaStore } from "@/lib/data/notification-sla-storage";
import {
  DEFAULT_NOTIFICATION_SLA_CONFIG,
  notificationSlaSchema,
  type NotificationSlaConfig,
} from "@/lib/services/notifications/sla-config";
import {
  evaluateDeadlineAndSlaNotifications,
  resetSlaEvaluationCooldown,
} from "@/lib/services/notifications/sla-reminders";

const clubIdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  .default("00000000-0000-0000-0000-000000000001");

const updateClubSettingsSchema = z.object({
  clubId: clubIdSchema,
  clubName: z.string().min(3, "Club name is required"),
  districtCode: z.string().min(1, "District code is required"),
  sponsorRotaryClub: z.string().min(3, "Sponsor Rotary Club name is required"),
  currentRotaryYear: z.string().min(4, "Rotary Year is required"),
  requireRegistrationApproval: z.boolean().default(true),
  budgetApprovalPolicy: z.enum([
    "PRESIDENT_AND_TREASURER",
    "PRESIDENT_ONLY",
    "TREASURER_ONLY",
    "EITHER",
  ]).default("PRESIDENT_AND_TREASURER"),
  retentionConsecutiveGasThreshold: z.number().int().min(1).max(10).default(3),
  retentionServiceDaysThreshold: z.number().int().min(15).max(365).default(60),
  notificationSla: notificationSlaSchema.default(DEFAULT_NOTIFICATION_SLA_CONFIG),
});

function parseCheckboxBool(
  formData: FormData,
  key: string,
  fallback: boolean,
): boolean {
  if (!formData.has(key)) return fallback;
  return formData.get(key) === "true";
}

export async function updateClubSettingsAction(formData: FormData) {
  await requireUser();
  const clubId = (formData.get("clubId") as string) || "00000000-0000-0000-0000-000000000001";
  await assertPermission(clubId, "SETTINGS_MANAGE");

  const validated = updateClubSettingsSchema.safeParse({
    clubId,
    clubName: formData.get("clubName"),
    districtCode: formData.get("districtCode"),
    sponsorRotaryClub: formData.get("sponsorRotaryClub"),
    currentRotaryYear: formData.get("currentRotaryYear"),
    requireRegistrationApproval: formData.get("requireRegistrationApproval") === "true",
    budgetApprovalPolicy: formData.get("budgetApprovalPolicy"),
    retentionConsecutiveGasThreshold: Number(formData.get("retentionConsecutiveGasThreshold") || 3),
    retentionServiceDaysThreshold: Number(formData.get("retentionServiceDaysThreshold") || 60),
    notificationSla: {
      taskDueSoonHours: formData.get("taskDueSoonHours") ?? DEFAULT_NOTIFICATION_SLA_CONFIG.taskDueSoonHours,
      taskOverdueReminderEnabled: parseCheckboxBool(
        formData,
        "taskOverdueReminderEnabled",
        DEFAULT_NOTIFICATION_SLA_CONFIG.taskOverdueReminderEnabled,
      ),
      projectNearbyHours: formData.get("projectNearbyHours") ?? DEFAULT_NOTIFICATION_SLA_CONFIG.projectNearbyHours,
      projectDeadlineHours: formData.get("projectDeadlineHours") ?? DEFAULT_NOTIFICATION_SLA_CONFIG.projectDeadlineHours,
      draftReadinessDays: formData.get("draftReadinessDays") ?? DEFAULT_NOTIFICATION_SLA_CONFIG.draftReadinessDays,
      reportDueSlaDays: formData.get("reportDueSlaDays") ?? DEFAULT_NOTIFICATION_SLA_CONFIG.reportDueSlaDays,
      notifyOnTaskAssigned: parseCheckboxBool(
        formData,
        "notifyOnTaskAssigned",
        DEFAULT_NOTIFICATION_SLA_CONFIG.notifyOnTaskAssigned,
      ),
      notifyOnTaskMarked: parseCheckboxBool(
        formData,
        "notifyOnTaskMarked",
        DEFAULT_NOTIFICATION_SLA_CONFIG.notifyOnTaskMarked,
      ),
    },
  });

  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message || "Invalid settings input." };
  }

  const {
    clubName,
    districtCode,
    sponsorRotaryClub,
    currentRotaryYear,
    requireRegistrationApproval,
    budgetApprovalPolicy,
    retentionConsecutiveGasThreshold,
    retentionServiceDaysThreshold,
    notificationSla,
  } = validated.data;

  // Always persist local fallback store so SLA configuration takes effect immediately
  writeNotificationSlaStore(clubId, notificationSla);
  resetSlaEvaluationCooldown();

  try {
    const admin = createAdminClient();

    // 1. Update clubs table
    const { error: clubErr } = await admin
      .from("clubs")
      .update({
        name: clubName,
        district_code: districtCode,
        sponsor_rotary_club: sponsorRotaryClub,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clubId);

    if (clubErr) {
      console.warn("Could not update clubs table:", clubErr.message);
    }

    // 2. Update or upsert app_settings table
    const baseSettingsPayload = {
      club_id: clubId,
      current_rotary_year: currentRotaryYear,
      require_registration_approval: requireRegistrationApproval,
      budget_approval_policy: budgetApprovalPolicy,
      retention_consecutive_gas_threshold: retentionConsecutiveGasThreshold,
      retention_service_days_threshold: retentionServiceDaysThreshold,
      updated_at: new Date().toISOString(),
    };

    let { error: settingsErr } = await admin
      .from("app_settings")
      .upsert(
        {
          ...baseSettingsPayload,
          notification_sla_config: notificationSla,
        },
        { onConflict: "club_id" },
      );

    if (settingsErr && settingsErr.message?.includes("notification_sla_config")) {
      const retry = await admin
        .from("app_settings")
        .upsert(baseSettingsPayload, { onConflict: "club_id" });
      settingsErr = retry.error;
    }

    if (settingsErr) {
      return { success: false, error: `Failed to update club settings: ${settingsErr.message}` };
    }

    revalidatePath("/settings");
    revalidatePath("/settings/notifications");
    revalidatePath("/dashboard");
    revalidatePath("/members");
    revalidatePath("/budgets");
    revalidatePath("/retention-alerts");
    revalidatePath("/project-center");
    revalidatePath("/tasks");

    return {
      success: true,
      notificationSla,
      message: "Club governance & Notification SLA settings saved!",
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update settings" };
  }
}

export async function runNotificationSlaCheckAction(
  clubId = "00000000-0000-0000-0000-000000000001",
  slaOverride?: NotificationSlaConfig,
) {
  await requireUser();
  const parsedClubId = clubIdSchema.safeParse(clubId);
  if (!parsedClubId.success) {
    return { success: false, error: "Invalid club ID." };
  }
  const access = await getUserAccessContext(parsedClubId.data);
  if (
    !access.isPlatformAdmin &&
    !access.permissions.has("SETTINGS_MANAGE") &&
    !access.permissions.has("NOTIFICATION_SEND")
  ) {
    return { success: false, error: "Not authorized to run notification SLA checks." };
  }

  try {
    const summary = await evaluateDeadlineAndSlaNotifications(
      parsedClubId.data,
      {
        deferDelivery: false,
        slaConfig: slaOverride,
      },
    );
    revalidatePath("/notifications");
    return {
      success: true,
      summary,
      message:
        summary.totalCreated > 0
          ? `Sent ${summary.totalCreated} SLA reminder${summary.totalCreated === 1 ? "" : "s"} (${summary.tasksDueSoon + summary.tasksOverdue} tasks, ${summary.projectsNearby + summary.projectDeadlines + summary.draftsSoon + summary.reportsDue} projects/reports).`
          : "SLA check completed — no new due or overdue notifications needed.",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to evaluate notification SLA rules.",
    };
  }
}
