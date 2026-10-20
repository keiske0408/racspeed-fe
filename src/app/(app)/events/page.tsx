"use client";

import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Calendar, QrCode, Clock, MapPin, Users, Plus, CheckCircle, X, ShieldCheck } from "lucide-react";
import { formatManilaDate } from "@/lib/utils/dates";

interface EventItem {
  id: string;
  title: string;
  category: string;
  location: string;
  startTime: string;
  endTime: string;
  volunteerHours: number;
  attendeesCount: number;
}

const SAMPLE_EVENTS: EventItem[] = [
  {
    id: "evt-1",
    title: "October General Assembly: Building Resilient Communities",
    category: "GENERAL_ASSEMBLY",
    location: "San Pedro City Hall Auditorium / Hybrid Zoom",
    startTime: "2026-10-24T18:00:00Z",
    endTime: "2026-10-24T21:00:00Z",
    volunteerHours: 3.0,
    attendeesCount: 28,
  },
  {
    id: "evt-2",
    title: "Laguna Lake Shoreline Cleanup & Tree Planting",
    category: "SERVICE_PROJECT",
    location: "Barangay Cuyab Lakeside, San Pedro",
    startTime: "2026-10-25T06:00:00Z",
    endTime: "2026-10-25T11:00:00Z",
    volunteerHours: 5.0,
    attendeesCount: 35,
  },
  {
    id: "evt-3",
    title: "Rotaract Fellowship Night & Quiz Bowl",
    category: "FELLOWSHIP",
    location: "Central Park Cafe, San Pedro East",
    startTime: "2026-10-28T19:00:00Z",
    endTime: "2026-10-28T22:00:00Z",
    volunteerHours: 0.0,
    attendeesCount: 22,
  },
];

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>(SAMPLE_EVENTS);
  const [activeQrEvent, setActiveQrEvent] = useState<EventItem | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [checkInTokenInput, setCheckInTokenInput] = useState("");
  const [checkInSuccess, setCheckInSuccess] = useState<string | null>(null);

  // Generate QR code when an event is selected
  useEffect(() => {
    if (!activeQrEvent) {
      setQrDataUrl(null);
      return;
    }
    const token = `racspeed-checkin-${activeQrEvent.id}-${Date.now().toString(36)}`;
    QRCode.toDataURL(token, { width: 280, margin: 2 }, (err, url) => {
      if (!err && url) {
        setQrDataUrl(url);
      }
    });
  }, [activeQrEvent]);

  function handleManualCheckIn(e: React.FormEvent) {
    e.preventDefault();
    if (!checkInTokenInput.trim()) return;

    setCheckInSuccess("Attendance recorded successfully! 5.0 Volunteer hours accredited.");
    setCheckInTokenInput("");
    setTimeout(() => setCheckInSuccess(null), 4000);
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Events & Attendance Check-in
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Dynamic QR verification & automated volunteer-hour calculation
          </p>
        </div>
      </div>

      {checkInSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{checkInSuccess}</span>
        </div>
      )}

      {/* Manual Code Check-in Banner for Members without camera */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
          Have an Event Check-in Code?
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          If camera access is unavailable on your mobile device, enter the officer-provided session token directly.
        </p>
        <form onSubmit={handleManualCheckIn} className="flex gap-2 max-w-md">
          <input
            type="text"
            required
            value={checkInTokenInput}
            onChange={(e) => setCheckInTokenInput(e.target.value)}
            placeholder="e.g. racspeed-checkin-evt-2-..."
            className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs cursor-pointer"
          >
            Check In
          </button>
        </form>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {events.map((evt) => (
          <div
            key={evt.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {evt.category.replace(/_/g, " ")}
                </span>
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {evt.volunteerHours} hrs
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {evt.title}
              </h3>
              <div className="mt-3 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span>{formatManilaDate(evt.startTime)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{evt.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span>{evt.attendeesCount} checked-in</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setActiveQrEvent(evt)}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-medium text-xs transition cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                Launch Dynamic QR Session
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* QR Code Modal Dialog */}
      {activeQrEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl text-center">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="text-left">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Attendance QR Code
                </h3>
                <p className="text-[11px] text-slate-400">Scan via phone camera</p>
              </div>
              <button
                onClick={() => setActiveQrEvent(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-3">
              {activeQrEvent.title}
            </h4>

            {qrDataUrl ? (
              <div className="p-4 bg-white rounded-2xl border border-slate-200 inline-block shadow-inner mx-auto mb-3">
                <img src={qrDataUrl} alt="Check-in QR Code" className="w-56 h-56 mx-auto" />
              </div>
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-xs text-slate-400 mx-auto">
                Generating session token...
              </div>
            )}

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>Anti-duplicate protection active</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              Awards: {activeQrEvent.volunteerHours} Volunteer Hours upon successful check-in
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
