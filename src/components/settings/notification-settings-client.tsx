"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  Clock,
  ExternalLink,
  MessageCircle,
  RefreshCw,
  Send,
  Settings,
  Unlink,
} from "lucide-react";
import { PushNotificationControl } from "@/components/settings/push-notification-control";
import type { NotificationType } from "@/lib/services/notifications/dispatch";
import type { NotificationSlaConfig } from "@/lib/services/notifications/sla-config";
import { NOTIFICATION_TYPES } from "@/lib/services/notifications/templates";

interface NotificationSettingsClientProps {
  clubId: string;
  canManage: boolean;
  slaConfig?: NotificationSlaConfig;
}

interface SettingsResponse {
  preferences: Record<string, unknown>;
  appBaseUrl?: string;
  telegram: {
    connected: boolean;
    username: string | null;
    connectedAt: string | null;
    botUsername: string | null;
  };
}

interface TelegramGroup {
  id: string;
  title: string;
  enabled: boolean;
  linked_at: string;
}

interface NotificationTemplate {
  type: NotificationType;
  title_template: string;
  message_template: string;
}

interface TelegramGroupsResponse {
  groups: TelegramGroup[];
  error?: string;
}

interface NotificationTemplatesResponse {
  templates: NotificationTemplate[];
  error?: string;
}

const DEFAULT_TEMPLATE_TYPE: NotificationType = "GENERAL";
const categoryControls = [
  { key: "telegramMembershipUpdates", label: "Membership updates" },
  { key: "telegramActivityUpdates", label: "Activities and attendance" },
  { key: "telegramTreasuryUpdates", label: "Treasury and dues" },
  { key: "telegramReportingUpdates", label: "Reports and deadlines" },
  { key: "telegramAdminUpdates", label: "Administration" },
] as const;

const DEFAULT_TEMPLATE = { titleTemplate: "{{title}}", messageTemplate: "{{message}}" };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Notification settings request failed.");
  }
  return body as T;
}

export function NotificationSettingsClient({
  clubId,
  canManage,
  slaConfig,
}: NotificationSettingsClientProps) {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [groups, setGroups] = useState<TelegramGroup[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [selectedType, setSelectedType] = useState<NotificationType>(DEFAULT_TEMPLATE_TYPE);
  const [titleTemplate, setTitleTemplate] = useState(DEFAULT_TEMPLATE.titleTemplate);
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_TEMPLATE.messageTemplate);
  const [groupLink, setGroupLink] = useState<string | null>(null);
  const [accountLink, setAccountLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const templatesByType = useMemo(
    () => new Map(templates.map((template) => [template.type, template])),
    [templates],
  );
  const currentTemplate = templatesByType.get(selectedType);

  const loadSettings = useCallback(async () => {
    const response = await requestJson<SettingsResponse>("/api/notifications/settings", {
      cache: "no-store",
    });
    setSettings(response);
  }, []);

  const loadAdminSettings = useCallback(async () => {
    const [groupResponse, templateResponse] = await Promise.all([
      requestJson<{ groups: TelegramGroup[] }>(
        `/api/notifications/telegram/groups?clubId=${encodeURIComponent(clubId)}`,
        { cache: "no-store" },
      ),
      requestJson<{ templates: NotificationTemplate[] }>(
        `/api/notifications/templates?clubId=${encodeURIComponent(clubId)}`,
        { cache: "no-store" },
      ),
    ]);
    setGroups(groupResponse.groups);
    setTemplates(templateResponse.templates);
  }, [clubId]);

  useEffect(() => {
    let active = true;
    const adminRequests = canManage
      ? Promise.all([
          fetch(`/api/notifications/telegram/groups?clubId=${encodeURIComponent(clubId)}`, {
            cache: "no-store",
          }),
          fetch(`/api/notifications/templates?clubId=${encodeURIComponent(clubId)}`, {
            cache: "no-store",
          }),
        ])
      : Promise.resolve(null);

    Promise.all([
      fetch("/api/notifications/settings", { cache: "no-store" }),
      adminRequests,
    ])
      .then(async ([settingsResponse, adminResponses]) => {
        const settingsBody = (await settingsResponse.json()) as SettingsResponse & { error?: string };
        if (!settingsResponse.ok) {
          throw new Error(settingsBody.error || "Could not load notification settings.");
        }
        let groupBody: TelegramGroupsResponse | null = null;
        let templateBody: NotificationTemplatesResponse | null = null;
        if (adminResponses) {
          const [groupResponse, templateResponse] = adminResponses;
          groupBody = (await groupResponse.json()) as TelegramGroupsResponse;
          templateBody = (await templateResponse.json()) as NotificationTemplatesResponse;
          if (!groupResponse.ok || !templateResponse.ok) {
            throw new Error(
              groupBody?.error || templateBody?.error || "Could not load club notification settings.",
            );
          }
        }
        if (!active) return;
        setSettings(settingsBody);
        if (groupBody && templateBody) {
          setGroups(groupBody.groups);
          setTemplates(templateBody.templates);
          const initialTemplate = templateBody.templates.find(
            (template) => template.type === DEFAULT_TEMPLATE_TYPE,
          );
          setTitleTemplate(initialTemplate?.title_template || DEFAULT_TEMPLATE.titleTemplate);
          setMessageTemplate(initialTemplate?.message_template || DEFAULT_TEMPLATE.messageTemplate);
        }
      })
      .catch((reason) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Could not load notification settings.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [canManage, clubId]);

  function isEnabled(key: string, defaultValue: boolean) {
    const value = settings?.preferences[key];
    return typeof value === "boolean" ? value : defaultValue;
  }

  async function savePreference(update: Record<string, boolean | string>) {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await requestJson("/api/notifications/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(update),
      });
      await loadSettings();
      setStatus("Notification preferences saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save notification preferences.");
    } finally {
      setSaving(false);
    }
  }

  async function connectTelegram() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const response = await requestJson<{ deepLink: string }>("/api/notifications/telegram/link", {
        method: "POST",
      });
      setAccountLink(response.deepLink);
      setStatus("Open Telegram and press Start to confirm your account link.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start Telegram linking.");
    } finally {
      setSaving(false);
    }
  }

  async function disconnectTelegram() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await requestJson("/api/notifications/telegram/disconnect", { method: "DELETE" });
      setAccountLink(null);
      await loadSettings();
      setStatus("Telegram account disconnected.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not disconnect Telegram.");
    } finally {
      setSaving(false);
    }
  }

  async function sendTestNotification() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const res = await requestJson<{
        appBaseUrl: string;
        deliveryStatuses: string[];
      }>("/api/notifications/test", { method: "POST" });
      const sentCount = res.deliveryStatuses.filter((s) => s === "SENT").length;
      setStatus(
        sentCount > 0
          ? `Test notification sent (${sentCount} external delivery succeeded, outbound link base: ${res.appBaseUrl}).`
          : `In-app test notification created (outbound link base: ${res.appBaseUrl}). Enable Web Push or Telegram to test external delivery.`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not send test notification.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function createGroupLink() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const response = await requestJson<{ deepLink: string }>(
        "/api/notifications/telegram/groups",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ clubId }),
        },
      );
      setGroupLink(response.deepLink);
      setStatus("Add the bot to the group with admin permission, then open the link there.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create a group link.");
    } finally {
      setSaving(false);
    }
  }

  async function unlinkGroup(groupId: string) {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await requestJson("/api/notifications/telegram/groups", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clubId, groupId }),
      });
      await loadAdminSettings();
      setStatus("Telegram group unlinked.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not unlink Telegram group.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTemplate() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await requestJson("/api/notifications/templates", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clubId,
          type: selectedType,
          titleTemplate,
          messageTemplate,
        }),
      });
      await loadAdminSettings();
      setStatus("Notification template saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save notification template.");
    } finally {
      setSaving(false);
    }
  }

  async function resetTemplate() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await requestJson("/api/notifications/templates", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clubId, type: selectedType }),
      });
      await loadAdminSettings();
      setTitleTemplate(DEFAULT_TEMPLATE.titleTemplate);
      setMessageTemplate(DEFAULT_TEMPLATE.messageTemplate);
      setStatus("Default template restored.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not reset notification template.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Loading notification settings...</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0D3594] dark:text-blue-300">Preferences</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">Notification settings</h1>
        <p className="mt-1 text-sm text-slate-500">Choose where and how RacSpeed sends updates to you.</p>
      </header>

      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
      {status && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{status}</p>}

      <PushNotificationControl />

      {slaConfig && (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-amber-50 p-2 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                <Clock className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Club Notification &amp; Deadline SLA Policy
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Active timing thresholds configured in Club Settings for task updates and upcoming deadlines.
                </p>
              </div>
            </div>
            {canManage && (
              <Link
                href="/settings#sla-configuration"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Settings className="h-3.5 w-3.5" /> Configure SLA in Club Settings
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 text-xs">
            <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="block text-[11px] text-slate-500">Task due soon</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{slaConfig.taskDueSoonHours}h before due</span>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="block text-[11px] text-slate-500">Project nearby</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{slaConfig.projectNearbyHours}h before start</span>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="block text-[11px] text-slate-500">Project / RSVP deadline</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{slaConfig.projectDeadlineHours}h before cutoff</span>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="block text-[11px] text-slate-500">Draft readiness SLA</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{slaConfig.draftReadinessDays} days before start</span>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="block text-[11px] text-slate-500">Report submission SLA</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{slaConfig.reportDueSlaDays} days post-event</span>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="block text-[11px] text-slate-500">Task triggers</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {slaConfig.notifyOnTaskAssigned ? "Assign" : "No assign"} &middot;{" "}
                {slaConfig.notifyOnTaskMarked ? "Mark" : "No mark"} &middot;{" "}
                {slaConfig.taskOverdueReminderEnabled ? "Overdue on" : "Overdue off"}
              </span>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-sky-50 p-2 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"><MessageCircle className="h-4 w-4" /></span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Telegram</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Connect through the bot. Telegram requires you to press Start before it can send direct messages.
              </p>
              <p className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                {settings?.telegram.connected
                  ? `Connected${settings.telegram.username ? ` as @${settings.telegram.username}` : ""}`
                  : "Not connected"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void sendTestNotification()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" /> Send test notification
            </button>
            {settings?.telegram.connected ? (
              <>
                <button type="button" disabled={saving} onClick={() => void loadSettings().catch((reason) => setError(reason.message))} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 cursor-pointer">
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </button>
                <button type="button" disabled={saving} onClick={disconnectTelegram} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 cursor-pointer">
                  <Unlink className="h-3.5 w-3.5" /> Disconnect
                </button>
              </>
            ) : (
              <button type="button" disabled={saving || !settings?.telegram.botUsername} onClick={connectTelegram} className="inline-flex items-center gap-2 rounded-lg bg-[#0D3594] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer">
                <Send className="h-3.5 w-3.5" /> Connect Telegram
              </button>
            )}
          </div>
        </div>

        {canManage && settings?.appBaseUrl && (
          <div
            className={`rounded-lg border px-3 py-2 text-[11px] flex flex-wrap items-center justify-between gap-2 ${
              settings.appBaseUrl.includes("localhost") ||
              settings.appBaseUrl === "https://racspeed.vercel.app"
                ? "border-amber-300/70 bg-amber-50/70 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/25 dark:text-amber-300"
                : "border-slate-200 bg-slate-50/70 text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300"
            }`}
          >
            <span>
              Outbound link base URL:{" "}
              <code className="font-mono font-semibold">{settings.appBaseUrl}</code>
            </span>
            {(settings.appBaseUrl.includes("localhost") ||
              settings.appBaseUrl === "https://racspeed.vercel.app") && (
              <span>
                Update <code>NEXT_PUBLIC_APP_URL</code> to{" "}
                <code>https://racspeed-fe.vercel.app</code> in Vercel for production deep links.
              </span>
            )}
          </div>
        )}

        {accountLink && (
          <div className="flex flex-wrap items-center gap-2">
            <a href={accountLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-100 dark:bg-sky-950/30 dark:text-sky-200">
              Open Telegram and press Start <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <button type="button" disabled={saving} onClick={() => void loadSettings().then(() => setStatus("Connection status refreshed.")).catch((reason) => setError(reason.message))} className="text-xs font-semibold text-slate-600 hover:underline disabled:opacity-50 dark:text-slate-300">
              Check connection
            </button>
          </div>
        )}

        <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
          <label className="flex items-center justify-between gap-4">
            <span>
              <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">Enable Telegram notifications</span>
              <span className="mt-0.5 block text-[11px] text-slate-500">Requires a connected Telegram account.</span>
            </span>
            <input
              type="checkbox"
              checked={isEnabled("telegram_enabled", false)}
              disabled={saving || !settings?.telegram.connected}
              onChange={(event) => void savePreference({ telegramEnabled: event.target.checked })}
              className="h-4 w-4 accent-[#0D3594]"
            />
          </label>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {categoryControls.map((control) => (
              <label key={control.key} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={isEnabled(control.key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), true)}
                  disabled={saving || !settings?.telegram.connected}
                  onChange={(event) => void savePreference({ [control.key]: event.target.checked })}
                  className="h-3.5 w-3.5 accent-[#0D3594]"
                />
                {control.label}
              </label>
            ))}
          </div>

          <label className="mt-4 flex items-center justify-between gap-4 border-t border-slate-100 pt-3 dark:border-slate-800">
            <span>
              <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">
                Receive Telegram copy for my own actions
              </span>
              <span className="mt-0.5 block text-[11px] text-slate-500">
                Off by default to prevent notification noise. Enable when testing self-assignments or self-updated tasks.
              </span>
            </span>
            <input
              type="checkbox"
              checked={isEnabled("telegram_self_actions", false)}
              disabled={saving || !settings?.telegram.connected}
              onChange={(event) =>
                void savePreference({ telegramSelfActions: event.target.checked })
              }
              className="h-4 w-4 accent-[#0D3594]"
            />
          </label>

          <label className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-slate-800 dark:text-slate-100">Delivery frequency</span>
            <select
              value={settings?.preferences.telegram_frequency === "DAILY_DIGEST" ? "DAILY_DIGEST" : "IMMEDIATE"}
              disabled={saving || !settings?.telegram.connected}
              onChange={(event) => void savePreference({ telegramFrequency: event.target.value })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="IMMEDIATE">Immediately</option>
              <option value="DAILY_DIGEST">Daily digest (9:00 AM Manila time)</option>
            </select>
          </label>
        </div>
      </section>

      {canManage && (
        <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Club Telegram destinations</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">Only explicit public announcements are sent to linked groups. The bot must be an administrator, and the linking member must also be a group administrator.</p>
          </div>
          <button type="button" disabled={saving} onClick={createGroupLink} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">
            <Send className="h-3.5 w-3.5" /> Generate group link
          </button>
          {groupLink && <a href={groupLink} target="_blank" rel="noreferrer" className="ml-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D3594] hover:underline dark:text-blue-300">Open link in Telegram <ExternalLink className="h-3.5 w-3.5" /></a>}
          {groups.length > 0 ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {groups.map((group) => (
                <li key={group.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{group.title}</span>
                  <button type="button" disabled={saving} onClick={() => void unlinkGroup(group.id)} className="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50 dark:text-rose-300">Unlink</button>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-slate-500">No Telegram groups are linked.</p>}

          <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">Message templates</h3>
            <p className="mt-1 text-[11px] text-slate-500">Supported placeholders: {"{{title}}"} and {"{{message}}"}.</p>
            <div className="mt-3 space-y-3">
              <select
                value={selectedType}
                onChange={(event) => {
                  const type = event.target.value as NotificationType;
                  const template = templatesByType.get(type);
                  setSelectedType(type);
                  setTitleTemplate(template?.title_template || DEFAULT_TEMPLATE.titleTemplate);
                  setMessageTemplate(template?.message_template || DEFAULT_TEMPLATE.messageTemplate);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 sm:w-auto"
              >
                {NOTIFICATION_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
              </select>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Title
                <input value={titleTemplate} onChange={(event) => setTitleTemplate(event.target.value)} maxLength={120} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-800" />
              </label>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Message
                <textarea value={messageTemplate} onChange={(event) => setMessageTemplate(event.target.value)} maxLength={2000} rows={4} className="mt-1 block w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-800" />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={saving} onClick={saveTemplate} className="inline-flex items-center gap-2 rounded-lg bg-[#0D3594] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Check className="h-3.5 w-3.5" /> Save template</button>
                {currentTemplate && <button type="button" disabled={saving} onClick={resetTemplate} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">Restore default</button>}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
