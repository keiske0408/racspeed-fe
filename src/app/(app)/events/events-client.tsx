"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
  Camera,
  CameraOff,
  FlipHorizontal,
  ScanLine,
  RefreshCw,
  Radio,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { formatManilaDate } from "@/lib/utils/dates";
import { createClient } from "@/lib/supabase/client";
import { createEventAction, startQrAttendanceSessionAction } from "@/features/events/actions";
import { EventDTO } from "@/features/events/queries";

export function extractSessionToken(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();

  // 1. If full URL, parse query param
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const parsed = new URL(trimmed);
      const qToken =
        parsed.searchParams.get("token") ||
        parsed.searchParams.get("sessionToken") ||
        parsed.searchParams.get("checkInToken");
      if (qToken) return qToken.trim();
    }
  } catch {}

  // 2. Query param regex match
  const match = trimmed.match(/[?&](?:token|sessionToken|checkInToken)=([^&#\s]+)/i);
  if (match) {
    return decodeURIComponent(match[1]).trim();
  }

  // 3. Raw token
  return trimmed;
}

interface EventsClientProps {
  initialEvents: EventDTO[];
  initialToken?: string;
  canCreate?: boolean;
  canManageAttendance?: boolean;
  initialAction?: string;
}

export function EventsClient({
  initialEvents,
  initialToken,
  canCreate = false,
  canManageAttendance = false,
  initialAction,
}: EventsClientProps) {
  const [events, setEvents] = useState<EventDTO[]>(initialEvents);
  const [selectedEvent, setSelectedEvent] = useState<EventDTO | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(canCreate && initialAction === "new");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string>("");
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkInTokenInput, setCheckInTokenInput] = useState(initialToken ? extractSessionToken(initialToken) : "");
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const hasAutoCheckedInRef = React.useRef(false);

  // In-Browser Camera Scanner States
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const controlsRef = React.useRef<any>(null);

  // Realtime Supabase Channel for live attendance increments
  useEffect(() => {
    let channel: any = null;
    try {
      const supabase = createClient();
      channel = supabase
        .channel("realtime-attendance")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "attendance_records" },
          (payload: any) => {
            const newRec = payload.new as any;
            if (newRec?.event_id) {
              setEvents((prev) =>
                prev.map((ev) =>
                  ev.id === newRec.event_id
                    ? { ...ev, attendeesCount: (ev.attendeesCount || 0) + 1 }
                    : ev
                )
              );
              setNotification({
                message: "Live check-in received! Verified attendee recorded in real time.",
                type: "success",
              });
              setTimeout(() => setNotification(null), 4000);
            }
          }
        )
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") {
            setIsRealtimeActive(true);
          }
        });
    } catch {
      // Graceful offline fallback
    }

    return () => {
      if (channel) {
        try {
          const supabase = createClient();
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, []);

  // Stop camera stream on unmount
  useEffect(() => {
    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
    };
  }, []);

  async function startCameraScanner(deviceId?: string) {
    setScannerError(null);
    setIsScanning(true);
    setScannerOpen(true);

    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const codeReader = new BrowserQRCodeReader();

      if (typeof navigator !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter((d) => d.kind === "videoinput");
          setVideoDevices(videoInputs);
          if (!deviceId && videoInputs.length > 0) {
            const backCam = videoInputs.find(
              (d) => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("rear") || d.label.toLowerCase().includes("environment")
            );
            deviceId = backCam ? backCam.deviceId : videoInputs[0].deviceId;
            setSelectedCameraId(deviceId);
          }
        } catch {
          // Non-critical device enumeration
        }
      }

      // Small delay for modal render
      setTimeout(async () => {
        if (!videoRef.current) return;

        if (controlsRef.current) {
          controlsRef.current.stop();
          controlsRef.current = null;
        }

        try {
          const controls = await codeReader.decodeFromVideoDevice(
            deviceId || undefined,
            videoRef.current,
            (result, error, ctrls) => {
              if (result) {
                const scannedText = result.getText();
                ctrls.stop();
                controlsRef.current = null;
                setScannerOpen(false);
                setIsScanning(false);
                submitScannedToken(scannedText);
              }
            }
          );
          controlsRef.current = controls;
        } catch (videoErr: any) {
          setIsScanning(false);
          setScannerError(videoErr?.message || "Could not start video stream.");
        }
      }, 250);
    } catch (err: any) {
      setIsScanning(false);
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setScannerError("Camera permission denied. Please allow camera access in your browser settings.");
      } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        setScannerError("No camera device found on this system.");
      } else {
        setScannerError(err?.message || "Failed to initialize camera scanner.");
      }
    }
  }

  function stopCameraScanner() {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    setIsScanning(false);
    setScannerOpen(false);
    setScannerError(null);
  }

  async function submitScannedToken(tokenText: string) {
    const cleanToken = extractSessionToken(tokenText);
    if (!cleanToken) return;

    setCheckInTokenInput(cleanToken);
    setNotification({ message: `Verifying attendance token "${cleanToken}"...`, type: "success" });

    try {
      const response = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken: cleanToken,
          token: cleanToken,
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setNotification({
          message: `Attendance confirmed! ${result.volunteerHours || 3} volunteer hours logged to your record.`,
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
    } catch {
      setNotification({
        message: "Network error during check-in. Please try again.",
        type: "error",
      });
    } finally {
      setTimeout(() => setNotification(null), 6000);
    }
  }

  // Auto-check in if token was passed in URL query param
  useEffect(() => {
    if (initialToken && !hasAutoCheckedInRef.current) {
      hasAutoCheckedInRef.current = true;
      const clean = extractSessionToken(initialToken);
      if (clean) {
        submitScannedToken(clean);
      }
    }
  }, [initialToken]);

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
      const QRCode = (await import("qrcode")).default;
      const res = await startQrAttendanceSessionAction(event.id);
      const activeToken =
        res.success && res.sessionToken
          ? res.sessionToken
          : `racspeed-${event.id.slice(0, 8)}-${Date.now().toString(36)}`;
      setSessionToken(activeToken);

      // Encode universal check-in URL so standard camera apps navigate to check-in directly
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const checkInUrl = `${origin}/events?token=${encodeURIComponent(activeToken)}`;

      const dataUrl = await QRCode.toDataURL(checkInUrl, {
        width: 320,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      setQrCodeDataUrl(dataUrl);
    } catch {
      try {
        const QRCode = (await import("qrcode")).default;
        const fallbackToken = `racspeed-${event.id.slice(0, 8)}-${Date.now().toString(36)}`;
        setSessionToken(fallbackToken);
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const checkInUrl = `${origin}/events?token=${encodeURIComponent(fallbackToken)}`;
        const dataUrl = await QRCode.toDataURL(checkInUrl, {
          width: 320,
          margin: 2,
          color: { dark: "#0f172a", light: "#ffffff" },
        });
        setQrCodeDataUrl(dataUrl);
      } catch {}
    }
  }

  function handleOpenQr(event: EventDTO) {
    if (!canManageAttendance) {
      setNotification({ message: "You lack permission to launch QR attendance sessions.", type: "error" });
      return;
    }
    setSelectedEvent(event);
    setQrModalOpen(true);
    setSecondsRemaining(60);
    generateFreshToken(event);
  }

  async function handleManualCheckIn(e: React.FormEvent) {
    e.preventDefault();
    const cleanToken = extractSessionToken(checkInTokenInput);
    if (!cleanToken) return;
    await submitScannedToken(cleanToken);
    setCheckInTokenInput("");
  }

  async function handleCreateEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canCreate) {
      setNotification({ message: "You do not have permission to create club events.", type: "error" });
      return;
    }
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
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-500" />
            <span>Realtime Live</span>
          </div>
          <Link
            href="/broadcasts"
            className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs transition shadow-2xs shrink-0"
          >
            <Megaphone className="w-3.5 h-3.5 text-rose-600" />
            GC Broadcast Studio
          </Link>
          {canCreate && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 py-2 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-xs cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              Create New Event
            </button>
          )}
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

            <div className={`mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 ${canManageAttendance ? "grid grid-cols-2 gap-2" : "flex"}`}>
              {canManageAttendance && (
                <button
                  onClick={() => handleOpenQr(event)}
                  className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-xs transition cursor-pointer shadow-xs"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  QR Session
                </button>
              )}
              <Link
                href={`/broadcasts?eventId=${event.id}`}
                className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-semibold text-xs transition shadow-2xs ${!canManageAttendance ? "w-full" : ""}`}
              >
                <Megaphone className="w-3.5 h-3.5" />
                Share to GC
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Attendance Check-in Section: Camera & Manual */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-0.5">
              Event Attendance Check-In
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Scan the event rolling QR code using your device camera or enter the session token:
            </p>
          </div>
          <button
            type="button"
            onClick={() => startCameraScanner(selectedCameraId || undefined)}
            className="inline-flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-xs cursor-pointer shrink-0"
          >
            <Camera className="w-4 h-4" />
            Scan via Camera
          </button>
        </div>

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
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-xs transition shadow-xs cursor-pointer shrink-0"
          >
            Submit Token
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
            <div className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500">Live Token:</span>
                <span className="text-rose-600 dark:text-rose-400 font-mono font-bold">
                  Refreshes in {secondsRemaining}s
                </span>
              </div>
              <p className="font-mono text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 truncate select-all">
                {sessionToken}
              </p>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const origin = typeof window !== "undefined" ? window.location.origin : "";
                    const checkInUrl = `${origin}/events?token=${encodeURIComponent(sessionToken)}`;
                    navigator.clipboard.writeText(checkInUrl);
                    setCopiedLink(true);
                    setNotification({ message: "Direct check-in link copied to clipboard!", type: "success" });
                    setTimeout(() => setCopiedLink(false), 3000);
                  }}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-200/70 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? "Link Copied!" : "Copy Link"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCheckInTokenInput(sessionToken);
                    submitScannedToken(sessionToken);
                    setQrModalOpen(false);
                  }}
                  className="py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-[11px] font-semibold text-white transition shadow-xs cursor-pointer shrink-0"
                >
                  Check In as Me
                </button>
              </div>
            </div>

            <p className="mt-3 text-[11px] text-slate-400">
              Point your smartphone camera at this QR code or click Copy Link to share with attendees.
            </p>
          </div>
        </div>
      )}

      {/* Modal: Create Event */}
      {canCreate && showAddModal && (
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
      {/* Camera QR Scanner Modal */}
      {scannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ScanLine className="w-4 h-4 text-rose-600 animate-pulse" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Mobile QR Attendance Scanner
                </h3>
              </div>
              <button
                onClick={stopCameraScanner}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Viewfinder */}
            <div className="relative w-full aspect-square bg-slate-950 rounded-2xl overflow-hidden mt-4 border border-slate-800 flex items-center justify-center shadow-inner">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Reticle Overlay */}
              <div className="absolute inset-10 border-2 border-rose-500/60 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                <div className="flex justify-between">
                  <div className="w-4 h-4 border-t-2 border-l-2 border-rose-500 rounded-tl-sm" />
                  <div className="w-4 h-4 border-t-2 border-r-2 border-rose-500 rounded-tr-sm" />
                </div>
                <div className="w-full h-0.5 bg-rose-500/80 shadow-[0_0_8px_#f43f5e] animate-pulse" />
                <div className="flex justify-between">
                  <div className="w-4 h-4 border-b-2 border-l-2 border-rose-500 rounded-bl-sm" />
                  <div className="w-4 h-4 border-b-2 border-r-2 border-rose-500 rounded-br-sm" />
                </div>
              </div>

              {/* Scanning status banner */}
              {isScanning && !scannerError && (
                <div className="absolute bottom-3 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-xs text-[11px] text-white font-medium flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Position QR code inside box
                </div>
              )}
            </div>

            {/* Camera Controls & Device Picker */}
            {videoDevices.length > 1 && (
              <div className="w-full mt-3 flex items-center justify-between gap-2">
                <label className="text-xs text-slate-500 flex items-center gap-1.5 shrink-0">
                  <FlipHorizontal className="w-3.5 h-3.5" />
                  Camera:
                </label>
                <select
                  value={selectedCameraId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedCameraId(id);
                    startCameraScanner(id);
                  }}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  {videoDevices.map((dev, idx) => (
                    <option key={dev.deviceId || idx} value={dev.deviceId}>
                      {dev.label || `Camera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {scannerError && (
              <div className="w-full mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs text-left">
                <div className="flex items-center gap-1.5 font-semibold mb-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Scanner Notification
                </div>
                <p>{scannerError}</p>
                <button
                  type="button"
                  onClick={() => startCameraScanner(selectedCameraId || undefined)}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Retry Camera
                </button>
              </div>
            )}

            <div className="w-full mt-4 flex justify-between items-center text-xs">
              <span className="text-slate-400">Powered by @zxing/browser</span>
              <button
                type="button"
                onClick={stopCameraScanner}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Close Scanner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
