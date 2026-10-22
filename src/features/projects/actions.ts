"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, assertPermission } from "@/lib/auth/session";

const createProjectSchema = z.object({
  title: z.string().min(3, "Project title must be at least 3 characters"),
  summary: z.string().optional(),
  venue: z.string().optional(),
  startDate: z.string().min(10, "Start date required"),
  endDate: z.string().min(10, "End date required"),
  beneficiaryCount: z.coerce.number().min(0).default(0),
  volunteerHours: z.coerce.number().min(0).default(0),
  fundsRaised: z.coerce.number().min(0).default(0),
  clubId: z.string().uuid().default("00000000-0000-0000-0000-000000000001"),
});

export async function createProjectAction(formData: FormData) {
  const user = await requireUser();
  const rawClubId = (formData.get("clubId") as string) || "00000000-0000-0000-0000-000000000001";
  await assertPermission(rawClubId, "PROJECT_CREATE");

  const validated = createProjectSchema.safeParse({
    title: formData.get("title"),
    summary: formData.get("summary") || undefined,
    venue: formData.get("venue") || undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    beneficiaryCount: formData.get("beneficiaryCount"),
    volunteerHours: formData.get("volunteerHours"),
    fundsRaised: formData.get("fundsRaised"),
    clubId: rawClubId,
  });

  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message || "Invalid project details" };
  }

  const { title, summary, venue, startDate, endDate, beneficiaryCount, volunteerHours, fundsRaised, clubId } = validated.data;
  const supabase = await createClient();

  const { error } = await supabase.from("projects").insert({
    host_club_id: clubId,
    title,
    summary: summary || null,
    venue: venue || null,
    start_date: startDate,
    end_date: endDate,
    rotary_year: "2026-27",
    project_chair_id: user.id,
    beneficiary_count: beneficiaryCount,
    volunteer_count: 0,
    total_volunteer_hours: volunteerHours,
    funds_raised: fundsRaised,
    total_expenses: 0,
    status: "APPROVED",
  });

  if (error) {
    return { success: false, error: `Failed to create project: ${error.message}` };
  }

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { success: true, message: `Project '${title}' registered successfully!` };
}

export async function submitAccomplishmentReportAction(projectId: string, narrative: string, clubId = "00000000-0000-0000-0000-000000000001") {
  const user = await requireUser();
  const adminClient = createAdminClient();

  const { error } = await adminClient.from("project_reports").insert({
    project_id: projectId,
    author_id: user.id,
    title: "Accomplishment Report",
    narrative,
    status: "SUBMITTED",
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/projects");
  return { success: true, message: "Accomplishment report submitted for Secretarial/Presidential review!" };
}
