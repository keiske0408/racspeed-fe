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
