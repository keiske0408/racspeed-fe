"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, getUserAccessContext } from "@/lib/auth/session";
import { getGroupTasksList } from "./queries";
import { awardEngagementPoints } from "@/lib/services/rewards";

async function assertTaskAdmin() {
  const user = await requireUser();
  const context = await getUserAccessContext();
  if (
    !context.isPlatformAdmin &&
    !context.permissions.has("ROLE_ASSIGN") &&
    !context.permissions.has("SETTINGS_MANAGE")
  ) {
    throw new Error("Unauthorized: Only administrators and designated officers have authority to perform task management operations.");
  }
  return { user, context };
}
import {
  createTask,
  updateTaskStatus,
  toggleChecklistItem,
  addChecklistItem,
  updateTask,
  deleteTask,
  TaskStatus,
  TaskPriority,
  TaskCommittee,
  TaskChecklistItem,
} from "@/lib/data/tasks-storage";

const createTaskSchema = z.object({
  clubId: z.string().default("00000000-0000-0000-0000-000000000001"),
  title: z.string().min(3, "Task title must be at least 3 characters"),
  description: z.string().default(""),
  committee: z.enum([
    "CLUB_SERVICE",
    "COMMUNITY_SERVICE",
    "VOCATIONAL",
    "INTERNATIONAL",
    "PUBLIC_IMAGE",
    "FINANCE",
    "SECRETARIAT",
    "BOARD",
  ]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z.string().min(1, "Due date is required"),
  assignedMemberIds: z.array(z.string()).default([]),
  assignedMemberNames: z.array(z.string()).default([]),
  checklistItems: z.array(z.string()).default([]),
});

export async function createGroupTaskAction(formData: FormData) {
  let user;
  try {
    const res = await assertTaskAdmin();
    user = res.user;
  } catch (err: any) {
    return { success: false, error: err.message || "Unauthorized" };
  }

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || "";
  const committee = formData.get("committee") as TaskCommittee;
  const priority = (formData.get("priority") as TaskPriority) || "MEDIUM";
  const dueDate = formData.get("dueDate") as string;
  const clubId = (formData.get("clubId") as string) || "00000000-0000-0000-0000-000000000001";
  let projectId = (formData.get("projectId") as string)?.trim() || undefined;
  const projectTitle = (formData.get("projectTitle") as string)?.trim() || undefined;

  // The task board links by title; resolve it to the Project Center activity id.
  if (!projectId && projectTitle) {
    try {
      const { data: activity } = await createAdminClient()
        .from("activities")
        .select("id")
        .eq("club_id", clubId)
        .eq("title", projectTitle)
        .order("start_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      projectId = activity?.id;
    } catch {
      // activities table not migrated yet
    }
  }

  // Parse multi-assignees and checklist items
  const assignedMemberIds = formData.getAll("assignedMemberIds") as string[];
  const assignedMemberNames = formData.getAll("assignedMemberNames") as string[];
  const rawChecklist = formData.getAll("checklistItems") as string[];

  const parsed = createTaskSchema.safeParse({
    clubId,
    title,
    description,
    committee,
    priority,
    dueDate,
    assignedMemberIds,
    assignedMemberNames,
    checklistItems: rawChecklist,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid group task data",
    };
  }

  const checklist: TaskChecklistItem[] = rawChecklist
    .filter((txt) => txt.trim().length > 0)
    .map((item, idx) => ({
      id: `chk-${Date.now()}-${idx}`,
      title: item.trim(),
      completed: false,
    }));

  try {
    const created = createTask({
      clubId,
      title,
      description,
      committee,
      priority,
      status: "TODO",
      dueDate,
      assignedMemberIds,
      assignedMemberNames,
      checklist,
      createdBy: user.fullName || user.email,
      projectId,
      projectTitle,
    });

    // Sync to Supabase tasks table if available
    try {
      const admin = createAdminClient();
      await admin.from("tasks").insert({
        id: created.id,
        club_id: created.clubId,
        activity_id: created.projectId && /^[0-9a-f-]{36}$/i.test(created.projectId) ? created.projectId : null,
        title: created.title,
        description: created.description,
        committee: created.committee,
        status: created.status,
        priority: created.priority,
        due_date: created.dueDate,
        assigned_member_ids: created.assignedMemberIds,
        assigned_member_names: created.assignedMemberNames,
        checklist: created.checklist,
        created_by: created.createdBy,
        created_at: created.createdAt,
        updated_at: created.updatedAt,
      });
    } catch (dbErr) {
      console.warn("Could not sync task insert to Supabase:", dbErr);
    }

    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    revalidatePath("/project-center");

    return {
      success: true,
      message: `Group task "${created.title}" successfully created!`,
      task: created,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to create group task",
    };
  }
}

export async function updateTaskStatusAction(taskId: string, status: TaskStatus) {
  const user = await requireUser();
  const taskBefore = (await getGroupTasksList()).find((task) => task.id === taskId);
  if (!taskBefore) return { success: false, error: "Task not found." };

  const context = await getUserAccessContext(taskBefore.clubId);
  const isAssigned =
    taskBefore.assignedMemberIds.includes(user.id) ||
    taskBefore.assignedMemberNames.some((name) => name.toLowerCase() === user.fullName.toLowerCase());
  const canManage =
    context.isPlatformAdmin || context.permissions.has("ROLE_ASSIGN") || context.permissions.has("SETTINGS_MANAGE");
  if (!isAssigned && !canManage) return { success: false, error: "Only an assignee or task manager can update this task." };

  try {
    const updated = updateTaskStatus(taskId, status);
    if (!updated) {
      return { success: false, error: "Task not found." };
    }

    try {
      const admin = createAdminClient();
      await admin.from("tasks").update({ status, updated_at: new Date().toISOString() }).eq("id", taskId);
    } catch (dbErr) {
      console.warn("Could not sync task status to Supabase:", dbErr);
    }

    if (status === "COMPLETED" && taskBefore.status !== "COMPLETED") {
      await awardEngagementPoints({
        clubId: taskBefore.clubId,
        profileId: user.id,
        sourceType: "TASK_COMPLETED",
        sourceId: taskId,
        reason: `Completed task: ${taskBefore.title}`,
      });
    }

    revalidatePath("/tasks");
    revalidatePath("/dashboard");

    return {
      success: true,
      task: updated,
      message: `Task status updated to ${status}.`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to update task status",
    };
  }
}

export async function toggleChecklistItemAction(
  taskId: string,
  itemId: string,
  forcedState?: boolean
) {
  await requireUser();

  try {
    const updated = toggleChecklistItem(taskId, itemId, forcedState);
    if (!updated) {
      return { success: false, error: "Task or checklist item not found." };
    }

    try {
      const admin = createAdminClient();
      await admin.from("tasks").update({
        checklist: updated.checklist,
        status: updated.status,
        updated_at: updated.updatedAt,
      }).eq("id", taskId);
    } catch (dbErr) {
      console.warn("Could not sync checklist toggle to Supabase:", dbErr);
    }

    revalidatePath("/tasks");

    return {
      success: true,
      task: updated,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to toggle checklist item",
    };
  }
}

export async function addChecklistItemAction(
  taskId: string,
  title: string,
  assignedMemberName?: string
) {
  await requireUser();

  if (!title || !title.trim()) {
    return { success: false, error: "Checklist item title is required." };
  }

  try {
    const updated = addChecklistItem(taskId, title, assignedMemberName);
    if (!updated) {
      return { success: false, error: "Task not found." };
    }

    try {
      const admin = createAdminClient();
      await admin.from("tasks").update({
        checklist: updated.checklist,
        status: updated.status,
        updated_at: updated.updatedAt,
      }).eq("id", taskId);
    } catch (dbErr) {
      console.warn("Could not sync checklist item addition to Supabase:", dbErr);
    }

    revalidatePath("/tasks");

    return {
      success: true,
      task: updated,
      message: "Checklist item added.",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to add checklist item",
    };
  }
}

export async function deleteTaskAction(taskId: string) {
  try {
    await assertTaskAdmin();
  } catch (err: any) {
    return { success: false, error: err.message || "Unauthorized" };
  }

  try {
    const ok = deleteTask(taskId);
    if (!ok) {
      return { success: false, error: "Task not found or could not be removed." };
    }

    try {
      const admin = createAdminClient();
      await admin.from("tasks").delete().eq("id", taskId);
    } catch (dbErr) {
      console.warn("Could not sync task deletion to Supabase:", dbErr);
    }

    revalidatePath("/tasks");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: "Group task removed.",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to delete task",
    };
  }
}

export async function updateGroupTaskAction(taskId: string, formData: FormData) {
  try {
    await assertTaskAdmin();
  } catch (err: any) {
    return { success: false, error: err.message || "Unauthorized" };
  }

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || "";
  const committee = formData.get("committee") as TaskCommittee;
  const priority = formData.get("priority") as TaskPriority;
  const status = formData.get("status") as TaskStatus;
  const dueDate = formData.get("dueDate") as string;
  const projectId = (formData.get("projectId") as string)?.trim() || undefined;
  const projectTitle = (formData.get("projectTitle") as string)?.trim() || undefined;

  const assignedMemberIds = formData.getAll("assignedMemberIds") as string[];
  const assignedMemberNames = formData.getAll("assignedMemberNames") as string[];

  if (!title || title.length < 3) {
    return { success: false, error: "Task title must be at least 3 characters." };
  }

  try {
    const updated = updateTask(taskId, {
      title,
      description,
      committee,
      priority,
      status,
      dueDate,
      assignedMemberIds,
      assignedMemberNames,
      projectId,
      projectTitle,
    });

    if (!updated) {
      return { success: false, error: "Task not found." };
    }

    try {
      const admin = createAdminClient();
      await admin.from("tasks").update({
        title,
        description,
        committee,
        priority,
        status,
        due_date: dueDate,
        assigned_member_ids: assignedMemberIds,
        assigned_member_names: assignedMemberNames,
        updated_at: updated.updatedAt,
      }).eq("id", taskId);
    } catch (dbErr) {
      console.warn("Could not sync task update to Supabase:", dbErr);
    }

    revalidatePath("/tasks");
    revalidatePath("/dashboard");

    return {
      success: true,
      task: updated,
      message: `Task "${updated.title}" successfully updated!`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to update task",
    };
  }
}

export async function assignMembersToTaskAction(
  taskId: string,
  assignedMemberIds: string[],
  assignedMemberNames: string[]
) {
  try {
    await assertTaskAdmin();
  } catch (err: any) {
    return { success: false, error: err.message || "Unauthorized" };
  }

  try {
    const updated = updateTask(taskId, {
      assignedMemberIds,
      assignedMemberNames,
    });

    if (!updated) {
      return { success: false, error: "Task not found." };
    }

    revalidatePath("/tasks");
    revalidatePath("/dashboard");

    return {
      success: true,
      task: updated,
      message: "Assignees updated successfully.",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to update assignees",
    };
  }
}

