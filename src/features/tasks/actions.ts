"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import {
  createTask,
  updateTaskStatus,
  toggleChecklistItem,
  addChecklistItem,
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
  const user = await requireUser();

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || "";
  const committee = formData.get("committee") as TaskCommittee;
  const priority = (formData.get("priority") as TaskPriority) || "MEDIUM";
  const dueDate = formData.get("dueDate") as string;
  const clubId = (formData.get("clubId") as string) || "00000000-0000-0000-0000-000000000001";

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
    });

    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    revalidatePath("/projects");

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
  await requireUser();

  try {
    const updated = updateTaskStatus(taskId, status);
    if (!updated) {
      return { success: false, error: "Task not found." };
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
  await requireUser();

  try {
    const ok = deleteTask(taskId);
    if (!ok) {
      return { success: false, error: "Task not found or could not be removed." };
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
