"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Megaphone,
  Copy,
  Check,
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  Users,
  Shirt,
  Award,
  Send,
  RefreshCw,
  FileText,
  Flame,
  Zap,
  ExternalLink,
  ShieldCheck,
  MessageSquare,
  Bot,
  HeartHandshake,
  Layers,
  ArrowRight,
  Plus,
  Trash2,
  Share2,
} from "lucide-react";
import {
  BroadcastDraft,
  BroadcastTone,
  BroadcastMessageType,
  VolunteerActivityCategory,
  WebhookConfig,
} from "@/features/broadcasts/types";
import { STARTER_PRESETS, parseRawTextToBroadcastDraft } from "@/features/broadcasts/parser";
import { formatBroadcastMessage } from "@/features/broadcasts/formatter";
import { BroadcastSourceItem } from "@/features/broadcasts/queries";

interface BroadcastsClientProps {
  sources: BroadcastSourceItem[];
  initialSelectedEventId?: string;
}

export function BroadcastsClient({
  sources,
  initialSelectedEventId,
}: BroadcastsClientProps) {
  // Current active draft
  const [draft, setDraft] = useState<BroadcastDraft>(() => {
    // If initialSelectedEventId passed, try to pre-populate
    if (initialSelectedEventId) {
      const match = sources.find((s) => s.id === initialSelectedEventId);
      if (match) {
        return {
          title: match.title,
          organizer: "Rotaract Club of San Pedro East · District 3820",
          category: "COMMUNITY_SERVICE",
          date: match.dateStr,
          time: match.timeStr,
          callTime: match.callTimeStr,
          venue: match.venue,
          volunteersNeeded: 15,
          volunteersConfirmed: match.volunteersConfirmed,
          attire: "Official Club Shirt or Red T-shirt + comfortable sneakers",
          thingsToBring: ["Personal water tumbler", "Extra shirt", "Face towel", "Valid ID"],
          perks: ["Free hearty meals & snacks", "Certificate of Participation", `${match.volunteerHours || 4} Verified Volunteer Hours`],
          contactPerson: "Club Secretariat",
          registrationLink: "",
          notes: match.description || "",
          customHashtags: "#RotaractSanPedroEast #District3820 #ServiceAboveSelf",
        };
      }
    }
    return STARTER_PRESETS[0].draft;
  });

  const [rawInputText, setRawInputText] = useState<string>(STARTER_PRESETS[0].sampleInput);
  const [tone, setTone] = useState<BroadcastTone>("energetic");
  const [messageType, setMessageType] = useState<BroadcastMessageType>("invitation");
  const [activeTab, setActiveTab] = useState<"ai_parser" | "structured_fields">("ai_parser");

  // Output formatting
  const [copied, setCopied] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiEngineUsed, setAiEngineUsed] = useState<"smart_local_nlp" | "gemini">("smart_local_nlp");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  // Webhook direct dispatch
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookPlatform, setWebhookPlatform] = useState<"discord" | "telegram" | "slack" | "generic">("discord");
  const [isSendingWebhook, setIsSendingWebhook] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Load saved API key & webhook config from localStorage
  useEffect(() => {
    try {
      const savedKey = localStorage.getItem("racspeed_gemini_key");
      if (savedKey) setGeminiApiKey(savedKey);
      const savedWebhook = localStorage.getItem("racspeed_broadcast_webhook");
      if (savedWebhook) setWebhookUrl(savedWebhook);
      const savedPlatform = localStorage.getItem("racspeed_broadcast_platform");
      if (savedPlatform) setWebhookPlatform(savedPlatform as any);
    } catch {
      // Local storage not available
    }
  }, []);

  // Compute live formatted composition
  const formattedOutput = formatBroadcastMessage(draft, tone, messageType);

  // Copy to clipboard handler
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = formattedOutput;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Convert raw text using smart AI engine
  const handleProcessRawText = async () => {
    setIsAiProcessing(true);
    try {
      const res = await fetch("/api/broadcasts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: rawInputText,
          tone,
          messageType,
          apiKey: geminiApiKey.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setDraft(data.draft);
        setAiEngineUsed(data.poweredBy === "gemini" ? "gemini" : "smart_local_nlp");
      } else {
        // Fallback to local parser
        const local = parseRawTextToBroadcastDraft(rawInputText, draft);
        setDraft(local);
        setAiEngineUsed("smart_local_nlp");
      }
    } catch {
      const local = parseRawTextToBroadcastDraft(rawInputText, draft);
      setDraft(local);
      setAiEngineUsed("smart_local_nlp");
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Auto-fill from an existing event or project
  const handleLoadSource = (sourceId: string) => {
    const found = sources.find((s) => s.id === sourceId);
    if (!found) return;

    const newDraft: BroadcastDraft = {
      title: found.title,
      organizer: "Rotaract Club of San Pedro East · District 3820",
      category: "COMMUNITY_SERVICE",
      date: found.dateStr,
      time: found.timeStr,
      callTime: found.callTimeStr,
      venue: found.venue,
      volunteersNeeded: 15,
      volunteersConfirmed: found.volunteersConfirmed || 0,
      volunteerRoles: "Logistics, Crowd Marshalling, and Program Facilitation",
      attire: "Official Club Shirt or Red T-shirt + jeans/sneakers",
      thingsToBring: ["Personal water tumbler", "Extra shirt", "Face towel", "Valid ID"],
      perks: [
        "Free hearty meals & snacks",
        "Official Certificate of Volunteer Service",
        `${found.volunteerHours || 4} Verified Volunteer Hours credited in RACSPEED`,
      ],
      contactPerson: "Club Secretariat",
      registrationLink: "",
      notes: found.description || "Prompt assembly is requested so we can distribute assignments seamlessly.",
      customHashtags: "#RotaractSanPedroEast #District3820 #ServiceAboveSelf",
    };

    setDraft(newDraft);
    setRawInputText(
      `${found.title}\nDate: ${found.dateStr}\nTime: ${found.timeStr}\nCall Time: ${found.callTimeStr}\nVenue: ${found.venue}\nHours: ${found.volunteerHours}\n${found.description}`
    );
  };

  // Load starter preset
  const handleSelectPreset = (presetId: string) => {
    const preset = STARTER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setDraft(preset.draft);
    setRawInputText(preset.sampleInput);
  };

  // Save custom Gemini API key
  const handleSaveApiKey = (key: string) => {
    setGeminiApiKey(key);
    try {
      localStorage.setItem("racspeed_gemini_key", key);
    } catch {}
    setShowApiKeyModal(false);
  };

  // Webhook dispatch execution
  const handleDispatchWebhook = async () => {
    if (!webhookUrl.trim()) {
      setWebhookStatus({ message: "Please specify a valid Webhook URL", type: "error" });
      return;
    }
    setIsSendingWebhook(true);
    setWebhookStatus(null);

    try {
      // Save webhook config to storage
      try {
        localStorage.setItem("racspeed_broadcast_webhook", webhookUrl.trim());
        localStorage.setItem("racspeed_broadcast_platform", webhookPlatform);
      } catch {}

      const res = await fetch("/api/broadcasts/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: webhookPlatform,
          webhookUrl: webhookUrl.trim(),
          content: formattedOutput,
          eventTitle: draft.title,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setWebhookStatus({
          message: `Broadcast successfully pushed to ${webhookPlatform.toUpperCase()}!`,
          type: "success",
        });
      } else {
        setWebhookStatus({
          message: data.error || "Failed to deliver webhook payload.",
          type: "error",
        });
      }
    } catch (err: any) {
      setWebhookStatus({
        message: err?.message || "Network error sending to webhook.",
        type: "error",
      });
    } finally {
      setIsSendingWebhook(false);
    }
  };

  // Remaining slots calculation
  const remainingSlots = Math.max(draft.volunteersNeeded - draft.volunteersConfirmed, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Title & Status Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-600 text-white rounded-xl shadow-md shadow-rose-600/20">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                GC Broadcast Studio
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-semibold uppercase tracking-wider">
                  AI Powered
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Transform Facebook posts, raw event notes, or scheduled club projects into ready-to-copy volunteer invitations for Messenger, WhatsApp, and Telegram group chats.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Toolbar */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowApiKeyModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-xs transition"
          >
            <Bot className="w-3.5 h-3.5 text-rose-600" />
            {geminiApiKey ? "AI Engine: Custom Gemini" : "AI Engine: Built-in (Free)"}
          </button>
        </div>
      </div>

      {/* Preset Starters & Club Event Quick-Loader Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Zap className="w-4 h-4 text-amber-500" />
            Quick Starters & 1-Click Import
          </div>

          {/* Event/Project Dropdown Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">Import from:</span>
            <select
              aria-label="Import from scheduled event or project"
              onChange={(e) => {
                if (e.target.value) handleLoadSource(e.target.value);
              }}
              defaultValue=""
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
            >
              <option value="" disabled>
                Select scheduled event / project...
              </option>
              {sources.map((src) => (
                <option key={src.id} value={src.id}>
                  [{src.type.toUpperCase()}] {src.title} ({src.dateStr})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Preset Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Templates:</span>
          {STARTER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelectPreset(preset.id)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 hover:border-rose-400 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 transition flex items-center gap-1.5 shadow-2xs"
            >
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input, Extractor & Configuration (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Tone Selector & Message Type Pills */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                1. Select GC Tone / Style
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { id: "energetic", label: "⚡ Energetic", desc: "Rotaract Youth Vibe" },
                  { id: "taglish", label: "🇵🇭 Taglish", desc: "Friendly Pinoy GC" },
                  { id: "formal", label: "📜 Formal", desc: "Official Memo" },
                  { id: "bullet", label: "📱 Quick Drop", desc: "Compact TL;DR" },
                  { id: "urgent", label: "🔥 Urgent", desc: "Last Slots Alert" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTone(item.id as BroadcastTone)}
                    className={`p-2 rounded-xl text-left border transition flex flex-col justify-between ${
                      tone === item.id
                        ? "border-rose-600 bg-rose-50/80 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/30"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800/50"
                    }`}
                  >
                    <span className="text-xs font-bold">{item.label}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                2. Select Message Lifecycle Stage
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "invitation", label: "🌟 Initial Call", desc: "Primary Invite" },
                  { id: "reminder_3d", label: "⏳ 3-Day Countdown", desc: "Prep Checklist" },
                  { id: "reminder_1d", label: "🚨 Bukas Na!", desc: "Final Briefing" },
                  { id: "post_event", label: "🎉 Recap & Wrap", desc: "Thank You & Hours" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMessageType(item.id as BroadcastMessageType)}
                    className={`p-2 rounded-xl text-left border transition flex flex-col justify-between ${
                      messageType === item.id
                        ? "border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/30"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800/50"
                    }`}
                  >
                    <span className="text-xs font-bold">{item.label}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Input Tabs: AI Smart Converter vs Structured Fields */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("ai_parser")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    activeTab === "ai_parser"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                  AI Smart Converter (Paste Post)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("structured_fields")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    activeTab === "structured_fields"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 inline mr-1" />
                  Edit Event Fields & Quota
                </button>
              </div>

              <span className="text-[11px] text-slate-400 hidden sm:inline">
                {aiEngineUsed === "gemini" ? "✨ Gemini Enhanced" : "⚡ Local Parser Ready"}
              </span>
            </div>

            {/* TAB 1: Raw Facebook Post / Freeform Notes */}
            {activeTab === "ai_parser" && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Paste Facebook post, club advisory, or project notes:
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {rawInputText.length} characters
                    </span>
                  </div>
                  <textarea
                    rows={8}
                    value={rawInputText}
                    onChange={(e) => setRawInputText(e.target.value)}
                    placeholder="e.g. CALL FOR VOLUNTEERS: Project Kwento at Pangarap&#10;Date: Saturday, Dec 5, 2026&#10;Time: 8:00 AM - 12:00 PM&#10;Venue: San Pedro Central Elementary School&#10;Needs: 15 volunteers..."
                    className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    💡 The AI extracts: Date, Time, Call-time, Attire, Slots, Perks, and Contact Person automatically.
                  </div>

                  <button
                    type="button"
                    onClick={handleProcessRawText}
                    disabled={isAiProcessing || !rawInputText.trim()}
                    className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isAiProcessing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Analyzing & Formatting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Extract & Compose GC Invite
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: Structured Fields Editor & Slot Tracker */}
            {activeTab === "structured_fields" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Event / Activity Title
                    </label>
                    <input
                      type="text"
                      value={draft.title}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Event Date
                    </label>
                    <input
                      type="text"
                      value={draft.date}
                      onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                      placeholder="e.g. Saturday, November 14, 2026"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Activity Time & Duration
                    </label>
                    <input
                      type="text"
                      value={draft.time}
                      onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                      placeholder="e.g. 8:00 AM – 12:00 PM"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Call Time / Assembly Time
                    </label>
                    <input
                      type="text"
                      value={draft.callTime}
                      onChange={(e) => setDraft({ ...draft, callTime: e.target.value })}
                      placeholder="e.g. 7:00 AM (Assembly at Plaza)"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Venue / Assembly Location
                    </label>
                    <input
                      type="text"
                      value={draft.venue}
                      onChange={(e) => setDraft({ ...draft, venue: e.target.value })}
                      placeholder="e.g. Barangay Cuyab Covered Court"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Volunteer Slots Tracker Box */}
                <div className="p-3.5 rounded-xl border border-rose-100 dark:border-rose-950/60 bg-rose-50/50 dark:bg-rose-950/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      Volunteer Capacity & Quota Tracker
                    </span>
                    <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                      {remainingSlots > 0 ? `${remainingSlots} Slots Left` : "Target Filled!"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        Target Volunteers Needed
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={draft.volunteersNeeded}
                        onChange={(e) =>
                          setDraft({ ...draft, volunteersNeeded: parseInt(e.target.value, 10) || 1 })
                        }
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        Currently Confirmed
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={draft.volunteersNeeded}
                        value={draft.volunteersConfirmed}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            volunteersConfirmed: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-rose-600 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          (draft.volunteersConfirmed / (draft.volunteersNeeded || 1)) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Attire / Dress Code
                    </label>
                    <input
                      type="text"
                      value={draft.attire}
                      onChange={(e) => setDraft({ ...draft, attire: e.target.value })}
                      placeholder="e.g. Official Club Shirt or Red T-shirt"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Contact Person / POC
                    </label>
                    <input
                      type="text"
                      value={draft.contactPerson}
                      onChange={(e) => setDraft({ ...draft, contactPerson: e.target.value })}
                      placeholder="e.g. Dir. Angel Dimalanta (0917-889-2341)"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Registration Form Link (Google Form / Linktree)
                    </label>
                    <input
                      type="text"
                      value={draft.registrationLink || ""}
                      onChange={(e) => setDraft({ ...draft, registrationLink: e.target.value })}
                      placeholder="e.g. https://forms.gle/sampleBusogLusog2026"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Webhook Dispatch & Automation Box */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-blue-500" />
                Webhook Dispatch Automation
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 font-semibold">
                Discord / Telegram / Slack
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Push your GC composition directly to an announcement channel or community bot with one click.
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <select
                aria-label="Webhook platform selector"
                value={webhookPlatform}
                onChange={(e) => setWebhookPlatform(e.target.value as any)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
              >
                <option value="discord">Discord Webhook</option>
                <option value="slack">Slack Incoming</option>
                <option value="telegram">Telegram Bot</option>
                <option value="generic">Generic Webhook</option>
              </select>

              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="Paste Webhook URL (https://discord.com/api/webhooks/...)"
                className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />

              <button
                type="button"
                onClick={handleDispatchWebhook}
                disabled={isSendingWebhook || !webhookUrl.trim()}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSendingWebhook ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Dispatch
              </button>
            </div>

            {webhookStatus && (
              <div
                className={`text-xs p-2.5 rounded-lg ${
                  webhookStatus.type === "success"
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                }`}
              >
                {webhookStatus.message}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Mobile / Group Chat Mockup Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 text-slate-100 rounded-3xl p-4 shadow-xl border border-slate-800 flex flex-col min-h-[640px]">
            {/* Mock Chat Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 px-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-rose-600 flex items-center justify-center text-white font-black text-xs">
                  R
                </div>
                <div>
                  <div className="text-xs font-bold leading-none text-slate-100">
                    Rotaract San Pedro East [GC]
                  </div>
                  <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    48 members online
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <span>{tone.toUpperCase()}</span>
                <span>·</span>
                <span>{messageType.toUpperCase()}</span>
              </div>
            </div>

            {/* Simulated Chat Window Body */}
            <div className="flex-1 py-4 overflow-y-auto space-y-3 font-sans">
              <div className="flex items-center justify-center">
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400">
                  Today at 8:00 AM
                </span>
              </div>

              {/* Chat Message Bubble */}
              <div className="bg-slate-800/90 text-slate-100 p-4 rounded-2xl rounded-tl-xs text-xs whitespace-pre-wrap leading-relaxed shadow-sm font-sans border border-slate-700/60 select-text">
                {formattedOutput}
              </div>
            </div>

            {/* Chat Stats Bar */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>{formattedOutput.length} chars</span>
              <span>{formattedOutput.split(/\s+/).filter(Boolean).length} words</span>
              <span>~{Math.ceil(formattedOutput.split(/\s+/).filter(Boolean).length / 150)} min read</span>
            </div>

            {/* Big Primary Action: Copy for GC */}
            <div className="pt-3 space-y-2">
              <button
                type="button"
                onClick={handleCopy}
                className={`w-full py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all ${
                  copied
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white scale-[1.02]"
                    : "bg-rose-600 hover:bg-rose-700 text-white hover:scale-[1.01]"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    COPIED TO CLIPBOARD! Ready to paste into GC
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    COPY COMPOSITION FOR GROUP CHAT
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-3 pt-1 text-[11px] text-slate-400">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(formattedOutput)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-slate-200 transition flex items-center gap-1"
                >
                  <Share2 className="w-3 h-3 text-emerald-400" />
                  Share to WhatsApp
                </a>
                <span>•</span>
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent("https://racspeed.rotaract")}&text=${encodeURIComponent(formattedOutput)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-slate-200 transition flex items-center gap-1"
                >
                  <Share2 className="w-3 h-3 text-sky-400" />
                  Share to Telegram
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Optional Gemini API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Bot className="w-4 h-4 text-rose-600" />
                Gemini AI Engine Settings
              </h3>
              <button
                type="button"
                onClick={() => setShowApiKeyModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              RACSPEED includes a high-speed local smart parser that works 100% offline with zero setup. You can optionally attach a Google Gemini API key to enable deeper creative rewriting.
            </p>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Google Gemini API Key (Optional)
              </label>
              <input
                type="password"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Saved securely in your browser&apos;s localStorage only.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowApiKeyModal(false)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveApiKey(geminiApiKey)}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
              >
                Save Engine Preference
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
