import fs from "fs";
import path from "path";
import {
  TaskPriority,
  TaskStatus,
  TaskCommittee,
  TaskChecklistItem,
  GroupTaskDTO,
} from "./tasks-types";

export * from "./tasks-types";

const STORAGE_FILE = path.join(process.cwd(), "src", "lib", "data", "tasks-store.json");

const SEED_TASKS: GroupTaskDTO[] = [
  {
    id: "task-001",
    clubId: "00000000-0000-0000-0000-000000000001",
    title: "Coastal Clean-up Logistics & Barangay LGU Permitting",
    description: "Coordinate with Barangay San Antonio LGU for site permits, waste collection truck, and safety marshal deployment for Saturday clean-up drive.",
    committee: "COMMUNITY_SERVICE",
    status: "IN_PROGRESS",
    priority: "HIGH",
    dueDate: "2026-11-05",
    assignedMemberIds: ["mem-001", "mem-002"],
    assignedMemberNames: ["Gabriel Leyba", "Maria Santos"],
    checklist: [
      { id: "chk-101", title: "Secure Barangay Council Permit Letter", completed: true, completedAt: "2026-10-21" },
      { id: "chk-102", title: "Order 100 heavy-duty biodegradable trash bags & gloves", completed: true, completedAt: "2026-10-22" },
      { id: "chk-103", title: "Confirm CENRO garbage hauler truck arrival at 11:00 AM", completed: false },
      { id: "chk-104", title: "Assemble first aid station & hydration dispensers", completed: false },
    ],
    createdAt: "2026-10-20T08:00:00Z",
    updatedAt: "2026-10-22T09:30:00Z",
    createdBy: "Gabriel Leyba",
  },
  {
    id: "task-002",
    clubId: "00000000-0000-0000-0000-000000000001",
    title: "RY 2026-27 Induction Souvenir Program & Member Directory Layout",
    description: "Finalize high-resolution print design of the induction magazine featuring message from District Governor, sponsor Rotary club president, and inductee roster.",
    committee: "PUBLIC_IMAGE",
    status: "IN_PROGRESS",
    priority: "URGENT",
    dueDate: "2026-11-12",
    assignedMemberIds: ["mem-003", "mem-004"],
    assignedMemberNames: ["Sofia Reyes", "Juan Luna"],
    checklist: [
      { id: "chk-201", title: "Collect verified inductee headshots and classifications", completed: true, completedAt: "2026-10-20" },
      { id: "chk-202", title: "Receive Governor & Sponsor Club President messages", completed: true, completedAt: "2026-10-22" },
      { id: "chk-203", title: "Incorporate sponsor advertisements & partnership logos", completed: false },
      { id: "chk-204", title: "Send digital proof to President & Secretary for final signoff", completed: false },
      { id: "chk-205", title: "Deliver print bundle to publisher (200 physical copies)", completed: false },
    ],
    createdAt: "2026-10-18T10:00:00Z",
    updatedAt: "2026-10-22T07:15:00Z",
    createdBy: "Sofia Reyes",
  },
  {
    id: "task-003",
    clubId: "00000000-0000-0000-0000-000000000001",
    title: "Q3 Club Financial Audit & Membership Dues Reconciliation",
    description: "Reconcile district assessments, local semi-annual dues collected via GCash/BDO, and verify receipt attachments before submitting to Club Auditor.",
    committee: "FINANCE",
    status: "TODO",
    priority: "HIGH",
    dueDate: "2026-11-20",
    assignedMemberIds: ["mem-005"],
    assignedMemberNames: ["Camille Torres"],
    checklist: [
      { id: "chk-301", title: "Export payment verification log from Treasury ledger", completed: false },
      { id: "chk-302", title: "Cross-reference bank statements with issued receipt numbers", completed: false },
      { id: "chk-303", title: "Submit liquidation vouchers for project seed fund advances", completed: false },
      { id: "chk-304", title: "Draft Quarterly Treasurer's Report for General Assembly presentation", completed: false },
    ],
    createdAt: "2026-10-19T14:30:00Z",
    updatedAt: "2026-10-19T14:30:00Z",
    createdBy: "Camille Torres",
  },
  {
    id: "task-004",
    clubId: "00000000-0000-0000-0000-000000000001",
    title: "District Assembly Early Bird Registration Roster",
    description: "Compile official delegation list for the upcoming Rotaract District 3820 Assembly (DISAS) and remit bulk registration payment before deadline.",
    committee: "CLUB_SERVICE",
    status: "COMPLETED",
    priority: "MEDIUM",
    dueDate: "2026-10-25",
    assignedMemberIds: ["mem-001", "mem-006"],
    assignedMemberNames: ["Gabriel Leyba", "Carlos Mendoza"],
    checklist: [
      { id: "chk-401", title: "Post delegation interest form in club Discord/Messenger", completed: true, completedAt: "2026-10-15" },
      { id: "chk-402", title: "Collect individual registration fee shares", completed: true, completedAt: "2026-10-18" },
      { id: "chk-403", title: "Submit official club roster to District Secretariat", completed: true, completedAt: "2026-10-20" },
    ],
    createdAt: "2026-10-12T11:00:00Z",
    updatedAt: "2026-10-20T16:00:00Z",
    createdBy: "Gabriel Leyba",
  },
  {
    id: "task-005",
    clubId: "00000000-0000-0000-0000-000000000001",
    title: "Sister Club Joint Environmental Webinar Planning",
    description: "Plan the virtual exchange forum with RAC Osaka Minami (District 2660) on urban micro-greening and sustainability best practices.",
    committee: "INTERNATIONAL",
    status: "IN_REVIEW",
    priority: "MEDIUM",
    dueDate: "2026-11-28",
    assignedMemberIds: ["mem-002", "mem-007"],
    assignedMemberNames: ["Maria Santos", "Kenji Takahashi"],
    checklist: [
      { id: "chk-501", title: "Align meeting agenda & dual-timezone schedules via Zoom", completed: true, completedAt: "2026-10-16" },
      { id: "chk-502", title: "Translate introductory presentation slides to English/Japanese", completed: true, completedAt: "2026-10-21" },
      { id: "chk-503", title: "Send digital invitation blast to both club general assemblies", completed: false },
    ],
    createdAt: "2026-10-15T09:00:00Z",
    updatedAt: "2026-10-21T11:45:00Z",
    createdBy: "Maria Santos",
  },
];

let inMemoryTasks: GroupTaskDTO[] = [...SEED_TASKS];

function ensureDirectoryExistence(filePath: string) {
  try {
    const dirname = path.dirname(filePath);
    if (!fs.existsSync(dirname)) {
      fs.mkdirSync(dirname, { recursive: true });
    }
  } catch {
    // Read-only filesystem in serverless environments
  }
}

export function readTasksStore(): GroupTaskDTO[] {
  try {
    if (!fs.existsSync(STORAGE_FILE)) {
      ensureDirectoryExistence(STORAGE_FILE);
      try {
        fs.writeFileSync(STORAGE_FILE, JSON.stringify(SEED_TASKS, null, 2), "utf-8");
      } catch {
        // Ephemeral in-memory fallback
      }
      return inMemoryTasks;
    }
    const data = fs.readFileSync(STORAGE_FILE, "utf-8");
    const parsed = JSON.parse(data);
    inMemoryTasks = Array.isArray(parsed) ? parsed : [...SEED_TASKS];
    return inMemoryTasks;
  } catch (err) {
    console.warn("Failed to read tasks store from filesystem, using seed memory:", err);
    return inMemoryTasks;
  }
}

export function writeTasksStore(tasks: GroupTaskDTO[]) {
  inMemoryTasks = tasks;
  try {
    ensureDirectoryExistence(STORAGE_FILE);
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(tasks, null, 2), "utf-8");
  } catch (err) {
    // Log gracefully instead of crashing on read-only serverless filesystems
    console.warn("Serverless filesystem write ignored, cached in-memory:", err);
  }
}

export function createTask(data: Omit<GroupTaskDTO, "id" | "createdAt" | "updatedAt">): GroupTaskDTO {
  const tasks = readTasksStore();
  const newTask: GroupTaskDTO = {
    ...data,
    id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  tasks.unshift(newTask);
  writeTasksStore(tasks);
  return newTask;
}

export function updateTaskStatus(taskId: string, status: TaskStatus): GroupTaskDTO | null {
  const tasks = readTasksStore();
  const index = tasks.findIndex((t) => t.id === taskId);
  if (index === -1) return null;

  tasks[index] = {
    ...tasks[index],
    status,
    updatedAt: new Date().toISOString(),
  };
  writeTasksStore(tasks);
  return tasks[index];
}

export function toggleChecklistItem(taskId: string, itemId: string, forcedState?: boolean): GroupTaskDTO | null {
  const tasks = readTasksStore();
  const taskIndex = tasks.findIndex((t) => t.id === taskId);
  if (taskIndex === -1) return null;

  const task = tasks[taskIndex];
  const itemIndex = task.checklist.findIndex((item) => item.id === itemId);
  if (itemIndex === -1) return null;

  const currentCompleted = task.checklist[itemIndex].completed;
  const nextCompleted = forcedState !== undefined ? forcedState : !currentCompleted;

  task.checklist[itemIndex] = {
    ...task.checklist[itemIndex],
    completed: nextCompleted,
    completedAt: nextCompleted ? new Date().toISOString().split("T")[0] : undefined,
  };

  const allCompleted = task.checklist.every((i) => i.completed);
  if (allCompleted && task.status !== "COMPLETED") {
    task.status = "COMPLETED";
  } else if (!allCompleted && task.status === "COMPLETED") {
    task.status = "IN_PROGRESS";
  }

  task.updatedAt = new Date().toISOString();
  tasks[taskIndex] = task;
  writeTasksStore(tasks);
  return task;
}

export function addChecklistItem(
  taskId: string,
  title: string,
  assignedMemberName?: string
): GroupTaskDTO | null {
  const tasks = readTasksStore();
  const taskIndex = tasks.findIndex((t) => t.id === taskId);
  if (taskIndex === -1) return null;

  const task = tasks[taskIndex];
  const newItem: TaskChecklistItem = {
    id: `chk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title: title.trim(),
    completed: false,
    assignedMemberName: assignedMemberName?.trim() || undefined,
  };

  task.checklist.push(newItem);
  if (task.status === "COMPLETED") {
    task.status = "IN_PROGRESS";
  }
  task.updatedAt = new Date().toISOString();
  tasks[taskIndex] = task;
  writeTasksStore(tasks);
  return task;
}

export function updateTask(
  taskId: string,
  updates: Partial<Omit<GroupTaskDTO, "id" | "clubId" | "createdAt">>
): GroupTaskDTO | null {
  const tasks = readTasksStore();
  const index = tasks.findIndex((t) => t.id === taskId);
  if (index === -1) return null;

  tasks[index] = {
    ...tasks[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  writeTasksStore(tasks);
  return tasks[index];
}

export function deleteTask(taskId: string): boolean {
  const tasks = readTasksStore();
  const initialLength = tasks.length;
  const filtered = tasks.filter((t) => t.id !== taskId);
  if (filtered.length !== initialLength) {
    writeTasksStore(filtered);
    return true;
  }
  return false;
}
