export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED";

export type TaskCommittee =
  | "CLUB_SERVICE"
  | "COMMUNITY_SERVICE"
  | "VOCATIONAL"
  | "INTERNATIONAL"
  | "PUBLIC_IMAGE"
  | "FINANCE"
  | "SECRETARIAT"
  | "BOARD";

export interface TaskChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  assignedMemberId?: string;
  assignedMemberName?: string;
  completedAt?: string;
}

export interface GroupTaskDTO {
  id: string;
  clubId: string;
  title: string;
  description: string;
  committee: TaskCommittee;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string; // YYYY-MM-DD
  assignedMemberIds: string[];
  assignedMemberNames: string[];
  checklist: TaskChecklistItem[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}
