import { createAdminClient } from "@/lib/supabase/admin";
import {
  readTasksStore,
  GroupTaskDTO,
  TaskStatus,
  TaskPriority,
} from "@/lib/data/tasks-storage";

export interface TaskStatsDTO {
  total: number;
  todo: number;
  inProgress: number;
  inReview: number;
  completed: number;
  urgent: number;
}

export async function getGroupTasksList(
  clubId = "00000000-0000-0000-0000-000000000001"
): Promise<GroupTaskDTO[]> {
  try {
    const admin = createAdminClient();
    const { data: rows, error } = await admin
      .from("tasks")
      .select("*")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false });

    if (!error && rows && rows.length > 0) {
      return rows.map((r: any) => ({
        id: r.id,
        clubId: r.club_id,
        title: r.title,
        description: r.description || "",
        committee: r.committee,
        status: r.status,
        priority: r.priority,
        dueDate: r.due_date,
        assignedMemberIds: Array.isArray(r.assigned_member_ids) ? r.assigned_member_ids : [],
        assignedMemberNames: Array.isArray(r.assigned_member_names) ? r.assigned_member_names : [],
        checklist: Array.isArray(r.checklist) ? r.checklist : [],
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        createdBy: r.created_by,
        projectId: r.activity_id || r.project_id || r.projectId,
        projectTitle: r.project_title || r.projectTitle,
      }));
    }
  } catch {
    // If Supabase table is not yet migrated, fall back seamlessly
  }

  const allTasks = readTasksStore();
  return allTasks.filter((t) => !clubId || t.clubId === clubId);
}

export async function getTaskStats(
  clubId = "00000000-0000-0000-0000-000000000001"
): Promise<TaskStatsDTO> {
  const tasks = await getGroupTasksList(clubId);

  return {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === "TODO").length,
    inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    inReview: tasks.filter((t) => t.status === "IN_REVIEW").length,
    completed: tasks.filter((t) => t.status === "COMPLETED").length,
    urgent: tasks.filter((t) => t.priority === "URGENT" && t.status !== "COMPLETED").length,
  };
}
