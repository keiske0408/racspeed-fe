import fs from "fs";
import path from "path";
import {
  normalizeNotificationSlaConfig,
  type NotificationSlaConfig,
} from "@/lib/services/notifications/sla-config";

const STORAGE_FILE = path.join(
  process.cwd(),
  "src",
  "lib",
  "data",
  "notification-sla-store.json",
);

let inMemorySlaMap: Record<string, NotificationSlaConfig> = {};

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

function readAll(): Record<string, NotificationSlaConfig> {
  try {
    if (!fs.existsSync(STORAGE_FILE)) {
      return inMemorySlaMap;
    }
    const raw = fs.readFileSync(STORAGE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      inMemorySlaMap = parsed as Record<string, NotificationSlaConfig>;
    }
    return inMemorySlaMap;
  } catch (err) {
    console.warn("Could not read notification SLA store:", err);
    return inMemorySlaMap;
  }
}

export function readNotificationSlaStore(
  clubId: string,
): NotificationSlaConfig | null {
  const all = readAll();
  const entry = all[clubId];
  if (!entry) return null;
  return normalizeNotificationSlaConfig(entry);
}

export function writeNotificationSlaStore(
  clubId: string,
  config: NotificationSlaConfig,
): void {
  const normalized = normalizeNotificationSlaConfig(config);
  const current = readAll();
  const next = {
    ...current,
    [clubId]: normalized,
  };
  inMemorySlaMap = next;
  try {
    ensureDirectoryExistence(STORAGE_FILE);
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(next, null, 2), "utf-8");
  } catch (err) {
    console.warn(
      "Could not write notification SLA store to filesystem, cached in memory:",
      err,
    );
  }
}

