"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  HelpCircle,
  Search,
  BookOpen,
  QrCode,
  Users,
  Receipt,
  FileSpreadsheet,
  Mail,
  Phone,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Send,
  X,
  ShieldAlert,
} from "lucide-react";

interface FAQItem {
  id: string;
  category: "MEMBERSHIP" | "EVENTS" | "TREASURY" | "REPORTING" | "GENERAL";
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    id: "faq-1",
    category: "MEMBERSHIP",
    question: "How does the 5-stage recruitment and onboarding pipeline work?",
    answer:
      "Candidates start as 'Inquiry/Prospect'. When they attend an orientation, their status is updated to 'Qualified'. Next, they join at least 1 community service project, settle their annual club dues, and are finally inducted by the Club President and Board into active member status.",
  },
  {
    id: "faq-2",
    category: "MEMBERSHIP",
    question: "How are Retention Alerts triggered?",
    answer:
      "The system monitors attendance logs. If an active member misses 3 consecutive General Assemblies without an excused absence, an automated retention flag is raised for the Membership Committee to conduct personal check-ins.",
  },
  {
    id: "faq-3",
    category: "EVENTS",
    question: "How does the dynamic QR rolling-code check-in operate?",
    answer:
      "When the Event Chair starts a session, the system generates a cryptographic QR code that updates every 15 seconds to prevent screenshot sharing. Members scan the QR via camera or in-app scanner to record GPS-verified timestamps.",
  },
  {
    id: "faq-4",
    category: "EVENTS",
    question: "What if a member's smartphone has no internet or camera issues?",
    answer:
      "Authorized club officers (Secretary or Attendance Marshals) can open the event roster and manually verify the member's presence with an officer override flag.",
  },
  {
    id: "faq-5",
    category: "TREASURY",
    question: "How are project budgets disbursed and liquidated?",
    answer:
      "Project Chairs submit a Budget Request with itemized line items. It requires dual authorization (Treasurer + President). After the project, all receipts must be uploaded for liquidation within 14 calendar days.",
  },
  {
    id: "faq-6",
    category: "REPORTING",
    question: "How do we generate District 3820 Monthly Reports?",
    answer:
      "Navigate to 'Projects & Reports'. Select the project and click 'Generate District Report'. The platform bundles attendance counts, volunteer hours, and funds raised into a compliant PDF/HTML document ready for the District Governor.",
  },
  {
    id: "faq-7",
    category: "GENERAL",
    question: "Where can I find official Rotaract logos and social media assets?",
    answer:
      "Visit the 'Resources & Links Hub' in the sidebar or directly access the Rotary Brand Center via our pinned links to download high-resolution vectors and color guidelines.",
  },
];

const CATEGORIES = [
  { key: "ALL", label: "All Questions" },
  { key: "MEMBERSHIP", label: "Membership & Recruitment" },
  { key: "EVENTS", label: "Events & QR Check-ins" },
  { key: "TREASURY", label: "Treasury & Dues" },
  { key: "REPORTING", label: "District 3820 Reporting" },
  { key: "GENERAL", label: "General & Guidelines" },
];

export function HelpClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [expandedId, setExpandedId] = useState<string | null>("faq-1");

  // Support ticket modal
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);

  const filteredFaqs = FAQS.filter((faq) => {
    if (selectedCategory !== "ALL" && faq.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q);
    }
    return true;
  });

  function handleSubmitTicket(e: React.FormEvent) {
    e.preventDefault();
    setSubmittedMessage("Your inquiry has been logged with the District 3820 Secretariat & IT Team.");
    setTicketSubject("");
    setTicketMessage("");
    setTimeout(() => {
      setShowSupportModal(false);
      setSubmittedMessage(null);
    }, 3000);
  }

  return (
    <div className="space-y-6 select-none max-w-6xl mx-auto pb-12">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-[#0D3594] via-[#103EAE] to-[#0D3594] text-white rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-xs">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/90 border border-white/20 mb-3">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>District 3820 Operational Knowledge Hub</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            How can we assist you today?
          </h1>
          <p className="mt-2 text-xs md:text-sm text-blue-100 leading-relaxed">
            Find answers to standard operating procedures, attendance verification, membership onboarding, project liquidations, and district compliance rules.
          </p>

          {/* Search Bar in Banner */}
          <div className="mt-5 relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search guides, QR check-in, dues, reports..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white text-[#111625] text-xs font-medium placeholder-slate-400 focus:outline-hidden shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* 2. Quick Topic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => setSelectedCategory("MEMBERSHIP")}
          className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-4 text-left hover:border-slate-300 dark:hover:border-slate-700 transition cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-[#E2EBFF] text-[#2563EB] flex items-center justify-center mb-3">
            <Users className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold text-[#111625] dark:text-white">Recruitment & Dues</h3>
          <p className="mt-1 text-[11px] text-[#8E95A5]">
            Prospect pipelines & induction criteria
          </p>
        </button>

        <button
          onClick={() => setSelectedCategory("EVENTS")}
          className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-4 text-left hover:border-slate-300 dark:hover:border-slate-700 transition cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-[#E7F8F0] text-[#17A863] flex items-center justify-center mb-3">
            <QrCode className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold text-[#111625] dark:text-white">QR Code Attendance</h3>
          <p className="mt-1 text-[11px] text-[#8E95A5]">
            Rolling sessions & attendance overrides
          </p>
        </button>

        <button
          onClick={() => setSelectedCategory("TREASURY")}
          className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-4 text-left hover:border-slate-300 dark:hover:border-slate-700 transition cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-[#FFF3E4] text-[#D97706] flex items-center justify-center mb-3">
            <Receipt className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold text-[#111625] dark:text-white">Treasury & Audits</h3>
          <p className="mt-1 text-[11px] text-[#8E95A5]">
            Liquidation vouchers & dues receipts
          </p>
        </button>

        <button
          onClick={() => setSelectedCategory("REPORTING")}
          className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-4 text-left hover:border-slate-300 dark:hover:border-slate-700 transition cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-[#F4EDFE] text-[#8244E8] flex items-center justify-center mb-3">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold text-[#111625] dark:text-white">District 3820 Reports</h3>
          <p className="mt-1 text-[11px] text-[#8E95A5]">
            Monthly project & foundation filing
          </p>
        </button>
      </div>

      {/* 3. Category Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            className={`px-3 py-1.5 rounded-xl font-semibold transition shrink-0 cursor-pointer ${
              selectedCategory === cat.key
                ? "bg-[#0D3594] text-white shadow-xs"
                : "bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800 text-[#6B7280] dark:text-slate-400 hover:text-[#111625] dark:hover:text-white"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 4. Frequently Asked Questions Accordion */}
      <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-6 transition">
        <h2 className="text-base font-bold text-[#111625] dark:text-white mb-4">
          Frequently Asked Questions
        </h2>

        {filteredFaqs.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#8E95A5]">
            No answers match your search term "{searchQuery}".
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredFaqs.map((faq) => {
              const isOpen = expandedId === faq.id;
              return (
                <div key={faq.id} className="py-3.5">
                  <button
                    onClick={() => setExpandedId(isOpen ? null : faq.id)}
                    className="w-full flex items-center justify-between text-left gap-4 cursor-pointer"
                  >
                    <span className="text-xs font-bold text-[#111625] dark:text-white">
                      {faq.question}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#0D3594] shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#8E95A5] shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <p className="mt-2.5 text-xs text-[#6B7280] dark:text-slate-300 leading-relaxed pr-6">
                      {faq.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Emergency Contacts & Contact Support Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#0D3594]" />
            <h3 className="text-xs font-bold text-[#111625] dark:text-white">Club Secretariat</h3>
          </div>
          <p className="text-[11px] text-[#8E95A5]">
            For membership certificates, roster updates, and general assembly inquiries.
          </p>
          <p className="text-xs font-semibold text-[#111625] dark:text-white">
            rotaract.sanpedroeast@gmail.com
          </p>
        </div>

        <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-[#17A863]" />
            <h3 className="text-xs font-bold text-[#111625] dark:text-white">District 3820 Secretariat</h3>
          </div>
          <p className="text-[11px] text-[#8E95A5]">
            District Governor monthly report compliance, citation goals, and DISAS inquiries.
          </p>
          <p className="text-xs font-semibold text-[#111625] dark:text-white">
            district3820.rotaract@gmail.com
          </p>
        </div>

        <div className="bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800/80 rounded-2xl p-5 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#8244E8]" />
              <h3 className="text-xs font-bold text-[#111625] dark:text-white">Need Platform Help?</h3>
            </div>
            <p className="text-[11px] text-[#8E95A5] mt-1">
              Submit an operational question or bug report directly to our IT committee.
            </p>
          </div>
          <button
            onClick={() => setShowSupportModal(true)}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#0D3594] hover:bg-[#092569] text-white text-xs font-semibold transition cursor-pointer shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit Inquiry</span>
          </button>
        </div>
      </div>

      {/* Support Ticket Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setShowSupportModal(false)}
          />
          <div className="relative w-full max-w-md bg-white dark:bg-[#111622] border border-[#EDEDF2] dark:border-slate-800 rounded-2xl elevation-popover p-6 z-10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-[#111625] dark:text-white">
                Contact Platform Support
              </h2>
              <button
                onClick={() => setShowSupportModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {submittedMessage ? (
              <div className="p-4 rounded-xl bg-[#E7F8F0] border border-[#17A863]/20 text-[#17A863] text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{submittedMessage}</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitTicket} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#111625] dark:text-slate-200 mb-1">
                    Subject / Concern *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Question about QR Attendance session reset"
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#EDEDF2] dark:border-slate-800 bg-white dark:bg-[#161B26] text-[#111625] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0D3594]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#111625] dark:text-slate-200 mb-1">
                    Detailed Message *
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Describe your question, request, or issue with steps to reproduce..."
                    value={ticketMessage}
                    onChange={(e) => setTicketMessage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#EDEDF2] dark:border-slate-800 bg-white dark:bg-[#161B26] text-[#111625] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#0D3594]"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSupportModal(false)}
                    className="px-4 py-2 rounded-xl border border-[#EDEDF2] dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#0D3594] hover:bg-[#092569] text-white font-semibold shadow-xs transition cursor-pointer"
                  >
                    Send to Secretariat
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
