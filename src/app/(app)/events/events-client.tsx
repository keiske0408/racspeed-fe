"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Search,
  Award,
  Sparkles,
} from "lucide-react";
import { formatManilaDate, formatManila } from "@/lib/utils/dates";
import { createClient } from "@/lib/supabase/client";
import {
  createEventAction,
  startQrAttendanceSessionAction,
  getEventAttendeesAction,
} from "@/features/events/actions";
import { EventDTO, EventAttendeeDTO } from "@/features/events/queries";

export function extractSessionToken(raw: string): string {
  if (!raw) return "";
  let trimmed = raw.trim();

  // Strip wrapping quotes if any
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  // 1. If JSON payload string
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const obj = JSON.parse(trimmed);
      const val = obj.token || obj.sessionToken || obj.session_token || obj.checkInToken;
      if (val) return String(val).trim();
    } catch {}
  }

  // 2. If full URL or URL path with query params
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.includes("?")) {
      const parsed = trimmed.startsWith("http")
        ? new URL(trimmed)
        : new URL(trimmed, "http://localhost");
      const qToken =
        parsed.searchParams.get("token") ||
        parsed.searchParams.get("sessionToken") ||
        parsed.searchParams.get("checkInToken");
      if (qToken) return qToken.trim();
    }
  } catch {}

  // 3. Query param regex match
  const match = trimmed.match(/[?&](?:token|sessionToken|checkInToken)=([^&#\s]+)/i);
  if (match) {
    return decodeURIComponent(match[1]).trim();
  }

  // 4. Raw token
  return trimmed;
}

interface NotificationState {
  title?: string;
  message: string;
  type: "success" | "info" | "error";
  eventId?: string;
  eventTitle?: string;
  volunteerHours?: number;
}

interface EventsClientProps {
  initialEvents: EventDTO[];
  initialToken?: string;
  initialCheckedInEventIds?: string[];
  currentUserId?: string;
  canCreate?: boolean;
  canManageAttendance?: boolean;
  initialAction?: string;
}

export function EventsClient({
  initialEvents,
  initialToken,
  initialCheckedInEventIds = [],
  currentUserId,
  canCreate = false,
  canManageAttendance = false,
  initialAction,
}: EventsClientProps) {
  const [events, setEvents] = useState<EventDTO[]>(initialEvents);
  const [checkedInEventIds, setCheckedInEventIds] = useState<string[]>(initialCheckedInEventIds);
  const [selectedEvent, setSelectedEvent] = useState<EventDTO | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(canCreate && initialAction === "new");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string>("");
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkInTokenInput, setCheckInTokenInput] = useState(
    initialToken ? extractSessionToken(initialToken) : ""
  );
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const hasAutoCheckedInRef = useRef(false);

  // Admin Attendee Inspection Roster Modal State
  const [attendeesModalOpen, setAttendeesModalOpen] = useState(false);
  const [inspectingEvent, setInspectingEvent] = useState<EventDTO | null>(null);
  const [attendeesList, setAttendeesList] = useState<EventAttendeeDTO[]>([]);
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false);
  const [attendeesSearch, setAttendeesSearch] = useState("");

  // Live session attendee feed for Active QR modal
  const [liveSessionAttendees, setLiveSessionAttendees] = useState<EventAttendeeDTO[]>([]);

  // Refs for tracking active modal events in realtime
  const selectedEventRef = useRef<EventDTO | null>(null);
  selectedEventRef.current = selectedEvent;
  const inspectingEventRef = useRef<EventDTO | null>(null);
  inspectingEventRef.current = inspectingEvent;

  // In-Browser Camera Scanner States
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<any>(null);

  // Auto-dismiss top floating toast notification after 6 seconds
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      setNotification(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [notification]);

  // Realtime Supabase Channel for live attendance increments & attendee roster updates
  useEffect(() => {
    let channel: any = null;
    try {
      const supabase = createClient();
      channel = supabase
        .channel("realtime-attendance")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "attendance_records" },
          async (payload: any) => {
            const newRec = payload.new as any;
            if (newRec?.event_id) {
              setEvents((prev) =>
                prev.map((ev) =>
                  ev.id === newRec.event_id
                    ? { ...ev, attendeesCount: (ev.attendeesCount || 0) + 1 }
                    : ev
                )
              );

              // If current user was the attendee who checked in
              if (currentUserId && newRec.profile_id === currentUserId) {
                setCheckedInEventIds((prev) => Array.from(new Set([...prev, newRec.event_id])));
              }

              // If the attendee roster modal or active QR modal is open for this event, refresh attendees
              const curInspecting = inspectingEventRef.current;
              const curSelected = selectedEventRef.current;
              if (curInspecting && curInspecting.id === newRec.event_id) {
                const res = await getEventAttendeesAction(newRec.event_id);
                if (res.success && res.attendees) {
                  setAttendeesList(res.attendees);
                }
              }
              if (curSelected && curSelected.id === newRec.event_id) {
                const res = await getEventAttendeesAction(newRec.event_id);
                if (res.success && res.attendees) {
                  setLiveSessionAttendees(res.attendees);
                }
              }

              setNotification({
                title: "Live Attendance Update",
                message: "A verified attendee just scanned into the event in real time!",
                type: "success",
              });
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
  }, [currentUserId]);

  // Stop camera stream on unmount
  useEffect(() => {
    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
    };
  }, []);

  async function openAttendeesModal(event: EventDTO) {
    setInspectingEvent(event);
    setAttendeesSearch("");
    setAttendeesModalOpen(true);
    setIsLoadingAttendees(true);

    try {
      const res = await getEventAttendeesAction(event.id);
      if (res.success && res.attendees) {
        setAttendeesList(res.attendees);
      } else {
        setAttendeesList([]);
      }
    } catch {
      setAttendeesList([]);
    } finally {
      setIsLoadingAttendees(false);
    }
  }

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
              (d) =>
                d.label.toLowerCase().includes("back") ||
                d.label.toLowerCase().includes("rear") ||
                d.label.toLowerCase().includes("environment")
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

                // Tactile haptic feedback if available
                if (typeof navigator !== "undefined" && navigator.vibrate) {
                  try {
                    navigator.vibrate([100, 50, 100]);
                  } catch {}
                }

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
        setScannerError(
          "Camera permission denied. Please allow camera access in your browser settings to scan QR codes."
        );
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
    if (!cleanToken) {
      setNotification({
        title: "Invalid QR Code",
        message: "No valid session token found in the scanned code.",
        type: "error",
      });
      return;
    }

    setCheckInTokenInput(cleanToken);
    setNotification({
      title: "Verifying Attendance...",
      message: `Checking token "${cleanToken}" against active event sessions...`,
      type: "info",
    });

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
        const matchedEventId = result.eventId || selectedEvent?.id;
        if (matchedEventId) {
          setCheckedInEventIds((prev) => Array.from(new Set([...prev, matchedEventId])));
          setEvents((prev) =>
            prev.map((ev) =>
              ev.id === matchedEventId
                ? { ...ev, attendeesCount: (ev.attendeesCount || 0) + 1 }
                : ev
            )
          );
        }

        setNotification({
          title: "Attendance Confirmed!",
          message:
            result.message ||
            `Attendance confirmed! ${result.volunteerHours || 3.0} volunteer hours recorded.`,
          type: "success",
          eventId: matchedEventId,
          eventTitle: result.eventTitle,
          volunteerHours: result.volunteerHours,
        });
      } else if (result.alreadyCheckedIn) {
        const matchedEventId = result.eventId || selectedEvent?.id;
        if (matchedEventId) {
          setCheckedInEventIds((prev) => Array.from(new Set([...prev, matchedEventId])));
        }

        setNotification({
          title: "Already Registered & Scanned",
          message:
            result.error ||
            `You have already checked in for this event! Your attendance is verified and volunteer hours are recorded.`,
          type: "info",
          eventId: matchedEventId,
          eventTitle: result.eventTitle,
        });
      } else {
        setNotification({
          title: "Check-In Notice",
          message: result.error || "Attendance verification failed.",
          type: "error",
        });
      }
    } catch {
      setNotification({
        title: "Network Notice",
        message: "Could not reach check-in server. Please verify connection and retry.",
        type: "error",
      });
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

      // Fetch live attendees for this event
      const attendeesRes = await getEventAttendeesAction(event.id);
      if (attendeesRes.success && attendeesRes.attendees) {
        setLiveSessionAttendees(attendeesRes.attendees);
      }

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
      setNotification({
        title: "Access Restricted",
        message: "You lack permission to launch QR attendance sessions.",
        type: "error",
      });
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
      setNotification({
        title: "Access Restricted",
        message: "You do not have permission to create club events.",
        type: "error",
      });
      return;
    }
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    try {
      const res = await createEventAction(formData);
      if (res.success) {
        setNotification({
          title: "Event Registered",
          message: res.message || "Event created successfully!",
          type: "success",
        });
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
    }
  }

  // Filter attendees for Roster Modal
  const filteredAttendees = attendeesList.filter((a) => {
    if (!attendeesSearch) return true;
    const q = attendeesSearch.toLowerCase();
    return (
      a.fullName.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.checkInMethod.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 relative pb-16">
      {/* ========================================================================= */}
      {/* FLOATING TOP STICKER / TOAST NOTIFICATION BANNER (STICKY & VISIBLE ALWAYS) */}
      {/* ========================================================================= */}
      {notification && (
        <div
          role="alert"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-[200] max-w-lg w-[calc(100%-2rem)] animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto"
        >
          <div
            className={`p-4 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-start gap-3.5 text-xs transition ${
              notification.type === "success"
                ? "bg-slate-900/95 text-white border-emerald-500/50 shadow-emerald-950/40"
                : notification.type === "info"
                ? "bg-slate-900/95 text-white border-sky-500/50 shadow-sky-950/40"
                : "bg-slate-900/95 text-white border-rose-500/50 shadow-rose-950/40"
            }`}
          >
            <div
              className={`p-2.5 rounded-xl shrink-0 ${
                notification.type === "success"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : notification.type === "info"
                  ? "bg-sky-500/20 text-sky-400"
                  : "bg-rose-500/20 text-rose-400"
              }`}
            >
              {notification.type === "success" ? (
                <CheckCircle className="w-5 h-5" />
              ) : notification.type === "info" ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <h4
                  className={`font-bold text-sm tracking-tight ${
                    notification.type === "success"
                      ? "text-emerald-400"
                      : notification.type === "info"
                      ? "text-sky-400"
                      : "text-rose-400"
                  }`}
                >
                  {notification.title ||
                    (notification.type === "success"
                      ? "Attendance Confirmed!"
                      : notification.type === "info"
                      ? "Already Registered"
                      : "Check-in Status")}
                </h4>
                <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                  Live Status
                </span>
              </div>
              <p className="mt-1 text-slate-200 leading-relaxed font-medium">
                {notification.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setNotification(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FLOATING ACTION BUTTON (FAB) FOR SCAN VIA CAMERA (ACCESSIBLE FROM ANYWHERE) */}
      {/* ========================================================================= */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => startCameraScanner(selectedCameraId || undefined)}
          className="group relative flex items-center gap-2.5 px-5 py-3.5 rounded-full bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 hover:from-rose-500 hover:to-rose-400 text-white font-bold text-xs tracking-wide shadow-2xl hover:shadow-rose-500/30 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border border-rose-400/40 ring-4 ring-rose-500/20"
          title="Scan QR Attendance Code via Camera"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
          </span>
          <ScanLine className="w-4 h-4 text-white animate-pulse" />
          <span className="font-semibold text-white drop-shadow-xs">Scan via Camera</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TITLE & HEADER BAR */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
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

      {/* ========================================================================= */}
      {/* EVENTS GRID */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {events.map((event) => {
          const isCheckedIn = checkedInEventIds.includes(event.id);

          return (
            <div
              key={event.id}
              className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between shadow-xs transition hover:shadow-md ${
                isCheckedIn
                  ? "border-emerald-300 dark:border-emerald-800/80 ring-1 ring-emerald-500/20"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                      {event.category}
                    </span>
                    {isCheckedIn && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shadow-2xs">
                        <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Registered & Scanned</span>
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {event.volunteerHours} hrs
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                  {event.title}
                </h3>

                {isCheckedIn && (
                  <div className="mt-3 p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="font-semibold">You are registered for this event!</span>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      +{event.volunteerHours} hrs
                    </span>
                  </div>
                )}

                <div className="mt-3 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{formatManilaDate(event.startTime)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{event.location}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium">
                        {event.attendeesCount} Verified Attendees
                      </span>
                    </div>
                    {canManageAttendance && (
                      <button
                        type="button"
                        onClick={() => openAttendeesModal(event)}
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 transition hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <span>View Scanned Users</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Action Footer */}
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                {canManageAttendance ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenQr(event)}
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-xs transition cursor-pointer shadow-xs"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      QR Session
                    </button>
                    <button
                      type="button"
                      onClick={() => openAttendeesModal(event)}
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition shadow-2xs cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 text-rose-600" />
                      Scanned ({event.attendeesCount})
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {isCheckedIn ? (
                      <div className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold text-xs">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Attendance Verified
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startCameraScanner(selectedCameraId || undefined)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-xs cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Check In Now
                      </button>
                    )}
                    <Link
                      href={`/broadcasts?eventId=${event.id}`}
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-semibold text-xs transition shadow-2xs"
                    >
                      <Megaphone className="w-3.5 h-3.5" />
                      Share
                    </Link>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* ATTENDANCE CHECK-IN SECTION: MANUAL TOKEN & CAMERA TRIGGER */}
      {/* ========================================================================= */}
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

      {/* ========================================================================= */}
      {/* ADMIN MODAL: ATTENDEE INSPECTION ROSTER (SCANNED USERS VIEW) */}
      {/* ========================================================================= */}
      {attendeesModalOpen && inspectingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                    {inspectingEvent.category}
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {inspectingEvent.volunteerHours} hrs credit
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
                  Scanned Users & Attendance Roster
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {inspectingEvent.title} &bull; {formatManilaDate(inspectingEvent.startTime)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAttendeesModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Stats & Search Bar */}
            <div className="pt-4 pb-3 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 font-medium">Scanned Attendees</span>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {attendeesList.length}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 font-medium">Total Hours Logged</span>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {attendeesList.reduce((acc, a) => acc + a.volunteerHours, 0).toFixed(1)} hrs
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 font-medium">Status</span>
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
                    <Radio className="w-3 h-3 animate-pulse text-emerald-500" />
                    Verified Live
                  </p>
                </div>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by attendee name or email..."
                  value={attendeesSearch}
                  onChange={(e) => setAttendeesSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            {/* Attendees List / Table */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {isLoadingAttendees ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Loading verified attendee roster...
                </div>
              ) : filteredAttendees.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  {attendeesSearch
                    ? "No scanned attendees match your search."
                    : "No members have scanned into this event yet. Open the QR session to allow members to scan."}
                </div>
              ) : (
                filteredAttendees.map((attendee) => {
                  const initials = attendee.fullName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <div
                      key={attendee.id}
                      className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 hover:border-slate-200 dark:hover:border-slate-700 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {attendee.avatarUrl ? (
                          <img
                            src={attendee.avatarUrl}
                            alt={attendee.fullName}
                            className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-200"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-rose-600 to-rose-400 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {attendee.fullName}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {attendee.email || "Member"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-right">
                        <div>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle className="w-3 h-3" />
                            {attendee.checkInMethod === "QR" ? "QR Scanned" : attendee.checkInMethod}
                          </span>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {formatManila(attendee.checkInTime, "MMM d, h:mm a")}
                          </p>
                        </div>
                        <span className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono text-xs font-bold border border-emerald-200 dark:border-emerald-800">
                          +{attendee.volunteerHours} hrs
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => openAttendeesModal(inspectingEvent)}
                className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Roster
              </button>
              <button
                type="button"
                onClick={() => setAttendeesModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-xs transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QR CODE DYNAMIC SESSION MODAL (WITH LIVE ATTENDEE STREAM FOR ADMIN) */}
      {/* ========================================================================= */}
      {qrModalOpen && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center max-h-[90vh] overflow-y-auto">
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
                Scan with any phone camera or the RacSpeed PWA Scanner
              </p>
            </div>

            {/* QR Display */}
            <div className="my-4 p-3 rounded-2xl bg-white border border-slate-200 shadow-inner">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="Live Attendance QR Code"
                  className="w-60 h-60 mx-auto rounded-lg"
                />
              ) : (
                <div className="w-60 h-60 flex items-center justify-center text-xs text-slate-400">
                  Generating rolling code...
                </div>
              )}
            </div>

            {/* Rotating countdown token */}
            <div className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 space-y-2 text-left">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500">Live Session Token:</span>
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
                    setNotification({
                      title: "Direct Link Copied",
                      message: "Direct check-in link copied to clipboard! Share with attendees.",
                      type: "success",
                    });
                    setTimeout(() => setCopiedLink(false), 3000);
                  }}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-200/70 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedLink ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
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

            {/* LIVE SCANNED USERS STREAM INSIDE QR MODAL */}
            <div className="w-full mt-4 text-left">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-rose-600" />
                  Live Scanned Attendees ({liveSessionAttendees.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setQrModalOpen(false);
                    openAttendeesModal(selectedEvent);
                  }}
                  className="text-rose-600 hover:underline text-[11px] font-semibold cursor-pointer"
                >
                  View Full Roster &rarr;
                </button>
              </div>

              <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {liveSessionAttendees.length === 0 ? (
                  <p className="text-[11px] text-slate-400 text-center py-3">
                    Waiting for members to scan the code...
                  </p>
                ) : (
                  liveSessionAttendees.slice(0, 5).map((att) => (
                    <div
                      key={att.id}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {att.fullName}
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                        {formatManila(att.checkInTime, "h:mm a")}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE EVENT */}
      {/* ========================================================================= */}
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
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Creating..." : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CAMERA QR SCANNER MODAL */}
      {/* ========================================================================= */}
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
                type="button"
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
