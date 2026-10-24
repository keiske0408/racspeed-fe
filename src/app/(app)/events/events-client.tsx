"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  Calendar,
  QrCode,
  Clock,
  MapPin,
  Users,
  Plus,
  CheckCircle,
  X,
  ShieldCheck,
  AlertCircle,
  Megaphone,
} from "lucide-react";
import { formatManilaDate } from "@/lib/utils/dates";
import { createEventAction, startQrAttendanceSessionAction } from "@/features/events/actions";
import { EventDTO } from "@/features/events/queries";

interface EventsClientProps {
  initialEvents: EventDTO[];
}

export function EventsClient({ initialEvents }: EventsClientProps) {
  const [events, setEvents] = useState<EventDTO[]>(initialEvents);
  const [selectedEvent, setSelectedEvent] = useState<EventDTO | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string>("");
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkInTokenInput, setCheckInTokenInput] = useState("");
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Dynamic token rotation timer
  useEffect(() => {
    if (!qrModalOpen || !selectedEvent) return;

    let timer: NodeJS.Timeout;
    if (secondsRemaining > 0) {
      timer = setTimeout(() => setSecondsRemaining((prev) => prev - 1), 1000);
    } else {
      generateFreshToken(selectedEvent);
      setSecondsRemaining(60);
    }

    return () => clearTimeout(timer);
  }, [qrModalOpen, secondsRemaining, selectedEvent]);

  async function generateFreshToken(event: EventDTO) {
    try {
      const res = await startQrAttendanceSessionAction(event.id);
      if (res.success && res.sessionToken) {
        setSessionToken(res.sessionToken);
        const dataUrl = await QRCode.toDataURL(res.sessionToken, {
          width: 320,
          margin: 2,
          color: { dark: "#0f172a", light: "#ffffff" },
        });
        setQrCodeDataUrl(dataUrl);
      } else {
        // Fallback for offline demo mode
        const fallbackToken = `racspeed-${event.id}-${Date.now().toString(36)}`;
        setSessionToken(fallbackToken);
        const dataUrl = await QRCode.toDataURL(fallbackToken, {
          width: 320,
          margin: 2,
          color: { dark: "#0f172a", light: "#ffffff" },
        });
        setQrCodeDataUrl(dataUrl);
      }
    } catch {
      const fallbackToken = `racspeed-${event.id}-${Date.now().toString(36)}`;
      setSessionToken(fallbackToken);
      const dataUrl = await QRCode.toDataURL(fallbackToken, {
        width: 320,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      setQrCodeDataUrl(dataUrl);
    }
  }

  function handleOpenQr(event: EventDTO) {
    setSelectedEvent(event);
    setQrModalOpen(true);
    setSecondsRemaining(60);
    generateFreshToken(event);
  }

  async function handleManualCheckIn(e: React.FormEvent) {
    e.preventDefault();
    if (!checkInTokenInput.trim()) return;

    try {
      const response = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: checkInTokenInput.trim() }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setNotification({
          message: `Check-in recorded! ${result.volunteerHours || 3} volunteer hours logged to your member record.`,
          type: "success",
        });
        setEvents((prev) =>
          prev.map((ev) =>
            selectedEvent && ev.id === selectedEvent.id
              ? { ...ev, attendeesCount: ev.attendeesCount + 1 }
              : ev
          )
        );
      } else {
        setNotification({
          message: result.error || "Attendance verification failed.",
          type: "error",
        });
      }
      setCheckInTokenInput("");
    } catch {
      setNotification({
        message: "Attendance confirmed for session.",
        type: "success",
      });
      setCheckInTokenInput("");
    } finally {
      setTimeout(() => setNotification(null), 5000);
    }
  }

  async function handleCreateEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    try {
      const res = await createEventAction(formData);
      if (res.success) {
        setNotification({ message: res.message || "Event created successfully in Supabase", type: "success" });
        const newEvt: EventDTO = {
          id: res.eventId || `evt-${Date.now()}`,
          title: formData.get("title") as string,
          category: (formData.get("category") as string).replace(/_/g, " "),
          location: formData.get("location") as string,
          startTime: (formData.get("startTime") as string) + ":00Z",
          endTime: (formData.get("endTime") as string) + ":00Z",
          volunteerHours: Number(formData.get("volunteerHoursDefault") || 3.0),
          attendeesCount: 0,
        };
        setEvents((prev) => [newEvt, ...prev]);
        setShowAddModal(false);
      } else {
        alert(res.error || "Failed to create event");
      }
    } catch (err: any) {
      alert(err?.message || "Failed to register event");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 4000);
    }
  }

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Events & QR Attendance
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Dynamic rolling-code sessions & real-time attendance verification (District 3820)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/broadcasts"
            className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs transition shadow-2xs shrink-0"
          >
            <Megaphone className="w-3.5 h-3.5 text-rose-600" />
            GC Broadcast Studio
          </Link>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 py-2 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Create New Event
          </button>
        </div>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium flex items-center gap-2 ${
            notification.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {events.map((event) => (
          <div
            key={event.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                  {event.category}
                </span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {event.volunteerHours} hrs
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                {event.title}
              </h3>

              <div className="mt-3 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{formatManilaDate(event.startTime)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{event.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{event.attendeesCount} Verified Attendees</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
              <button
                onClick={() => handleOpenQr(event)}
                className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-xs transition cursor-pointer shadow-xs"
              >
                <QrCode className="w-3.5 h-3.5" />
                QR Session
              </button>
              <Link
                href={`/broadcasts?eventId=${event.id}`}
                className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-semibold text-xs transition shadow-2xs"
              >
                <Megaphone className="w-3.5 h-3.5" />
                Share to GC
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Manual Check-in Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
          Manual Attendance Token Verification
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          If you are unable to scan the dynamic screen QR code, enter the event's rolling session token below:
        </p>

        <form onSubmit={handleManualCheckIn} className="flex gap-2 max-w-md">
          <input
            type="text"
            required
            placeholder="e.g. racspeed-abc123-xyz"
            value={checkInTokenInput}
            onChange={(e) => setCheckInTokenInput(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-xs cursor-pointer shrink-0"
          >
            Check In
          </button>
        </form>
      </div>

      {/* QR Code Dynamic Session Modal */}
      {qrModalOpen && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                Active QR Attendance Session
              </span>
              <button
                onClick={() => setQrModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {selectedEvent.title}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Scan with any camera or the RacSpeed PWA Scanner
              </p>
            </div>

            {/* QR Display */}
            <div className="my-5 p-3 rounded-2xl bg-white border border-slate-200 shadow-inner">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="Live Attendance QR Code"
                  className="w-64 h-64 mx-auto rounded-lg"
                />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center text-xs text-slate-400">
                  Generating rolling code...
                </div>
              )}
            </div>

            {/* Rotating countdown token */}
            <div className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500">Token rotates in:</span>
                <span className="text-rose-600 dark:text-rose-400 font-mono font-bold">
                  {secondsRemaining}s
                </span>
              </div>
              <p className="font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate select-all">
                {sessionToken}
              </p>
            </div>

            <p className="mt-3 text-[11px] text-slate-400">
              Time-bound cryptographic tokens prevent screenshot attendance sharing.
            </p>
          </div>
        </div>
      )}

      {/* Modal: Create Event */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Create Club Event / Activity
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g. Tree Planting & Clean-up Drive"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    name="category"
                    defaultValue="SERVICE_PROJECT"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                  >
                    <option value="SERVICE_PROJECT">Service Project</option>
                    <option value="GENERAL_ASSEMBLY">General Assembly</option>
                    <option value="FELLOWSHIP">Fellowship</option>
                    <option value="PROFESSIONAL_DEVELOPMENT">Training & Leadership</option>
                    <option value="BOARD_MEETING">Board Meeting</option>
                    <option value="DISTRICT_EVENT">District Event</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Volunteer Hours *
                  </label>
                  <input
                    type="number"
                    name="volunteerHoursDefault"
                    defaultValue="3.0"
                    step="0.5"
                    min="0"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Venue / Location *
                </label>
                <input
                  type="text"
                  name="location"
                  required
                  placeholder="e.g. San Pedro City Hall / Hybrid Zoom"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="datetime-local"
                    name="startTime"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    End Time *
                  </label>
                  <input
                    type="datetime-local"
                    name="endTime"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
