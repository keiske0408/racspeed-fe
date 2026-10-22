"use client";

import React, { useState } from "react";
import {
  Award,
  Download,
  CheckCircle,
  FileText,
  Plus,
  X,
  Edit2,
  Users,
  Search,
  Calendar,
  Sparkles,
  Printer,
  ChevronRight,
} from "lucide-react";
import { generatePrintableCertificateHTML } from "@/lib/documents/certificate";
import {
  CertificateTemplateDTO,
  IssuedCertificateDTO,
} from "@/features/certificates/queries";
import {
  saveCertificateTemplateAction,
  issueCertificateAction,
} from "@/features/certificates/actions";
import { MemberDTO } from "@/features/members/queries";

interface CertificatesClientProps {
  initialTemplates: CertificateTemplateDTO[];
  initialIssuedCerts: IssuedCertificateDTO[];
  members: MemberDTO[];
}

export function CertificatesClient({
  initialTemplates,
  initialIssuedCerts,
  members,
}: CertificatesClientProps) {
  const [activeTab, setActiveTab] = useState<"ISSUED" | "TEMPLATES">("ISSUED");
  const [templates, setTemplates] = useState<CertificateTemplateDTO[]>(initialTemplates);
  const [issuedCerts, setIssuedCerts] = useState<IssuedCertificateDTO[]>(initialIssuedCerts);
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Modals
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CertificateTemplateDTO | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Issue Form State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    initialTemplates[0]?.id || "tmpl-appreciation"
  );
  const [selectedMemberProfileId, setSelectedMemberProfileId] = useState<string>("");
  const [customRecipientName, setCustomRecipientName] = useState("");
  const [customRecipientEmail, setCustomRecipientEmail] = useState("");
  const [eventOrProjectTitle, setEventOrProjectTitle] = useState("Oplan Kalusugan Community Mission");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);

  // Download / Print Certificate
  function handleDownloadCert(cert: IssuedCertificateDTO) {
    setDownloadingId(cert.id);
    const tmpl = templates.find((t) => t.id === cert.templateId) || templates[0];

    const html = generatePrintableCertificateHTML({
      recipientName: cert.recipientName,
      category: cert.category,
      eventOrProjectTitle: cert.eventOrProjectTitle,
      certificateNumber: cert.certificateNumber,
      issueDate: cert.issueDate,
      signatoryOneTitle: tmpl?.signatory1Title || "Club President, RY 2026-27",
      signatoryTwoTitle: tmpl?.signatory2Title || "Club Secretary, RY 2026-27",
      clubName: "Rotaract Club of San Pedro East",
      district: "District 3820",
    });

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
    }
    setDownloadingId(null);
  }

  // Submit Issue Certificate
  async function handleIssueCertificate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    let recipientName = customRecipientName;
    let recipientEmail = customRecipientEmail;

    if (selectedMemberProfileId) {
      const selectedMember = members.find((m) => m.id === selectedMemberProfileId);
      if (selectedMember) {
        recipientName = selectedMember.name;
        recipientEmail = selectedMember.email;
      }
    }

    formData.set("recipientName", recipientName);
    formData.set("recipientEmail", recipientEmail);
    formData.set("profileId", selectedMemberProfileId || "");
    formData.set("templateId", selectedTemplateId);
    formData.set("eventOrProjectTitle", eventOrProjectTitle);
    formData.set("issueDate", issueDate);

    try {
      const res = await issueCertificateAction(formData);
      if (res.success) {
        const tmpl = templates.find((t) => t.id === selectedTemplateId);
        const newCert: IssuedCertificateDTO = {
          id: `cert-${Date.now()}`,
          recipientName,
          recipientEmail: recipientEmail || undefined,
          profileId: selectedMemberProfileId || undefined,
          certificateNumber: res.certificateNumber || `CERT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
          templateId: selectedTemplateId,
          templateName: tmpl?.name || "Certificate of Appreciation",
          category: tmpl?.category || "Appreciation",
          eventOrProjectTitle,
          issueDate,
        };

        setIssuedCerts((prev) => [newCert, ...prev]);
        setNotification(res.message || `Certificate issued to ${recipientName}!`);
        setShowIssueModal(false);
        setSelectedMemberProfileId("");
        setCustomRecipientName("");
      } else {
        alert(res.error || "Failed to issue certificate");
      }
    } catch (err: any) {
      alert(err?.message || "Failed to issue certificate");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 4000);
    }
  }

  // Save / Edit Template
  async function handleSaveTemplate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    if (editingTemplate) {
      formData.set("id", editingTemplate.id);
    }

    try {
      const res = await saveCertificateTemplateAction(formData);
      if (res.success) {
        const updatedDTO: CertificateTemplateDTO = {
          id: editingTemplate?.id || `tmpl-${Date.now()}`,
          name: formData.get("name") as string,
          category: (formData.get("category") as any) || "APPRECIATION",
          titleText: (formData.get("titleText") as string) || "Certificate of Appreciation",
          bodyTemplate: formData.get("bodyTemplate") as string,
          signatory1Name: formData.get("signatory1Name") as string,
          signatory1Title: formData.get("signatory1Title") as string,
          signatory2Name: (formData.get("signatory2Name") as string) || "Maria Santos",
          signatory2Title: (formData.get("signatory2Title") as string) || "Club Secretary",
          createdAt: editingTemplate?.createdAt || new Date().toISOString().split("T")[0],
        };

        setTemplates((prev) => {
          if (editingTemplate) {
            return prev.map((t) => (t.id === editingTemplate.id ? updatedDTO : t));
          }
          return [updatedDTO, ...prev];
        });

        setNotification(res.message || "Certificate template saved!");
        setShowTemplateModal(false);
        setEditingTemplate(null);
      } else {
        alert(res.error || "Failed to save template");
      }
    } catch (err: any) {
      alert(err?.message || "Failed to save template");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 4000);
    }
  }

  const filteredCerts = issuedCerts.filter(
    (c) =>
      c.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.certificateNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.eventOrProjectTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Certificates of Recognition & Templates
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Design customizable templates, issue verifiable citations to club members, and print official diplomas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingTemplate(null);
              setShowTemplateModal(true);
            }}
            className="inline-flex items-center gap-2 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 text-rose-500" />
            New Template
          </button>
          <button
            onClick={() => setShowIssueModal(true)}
            className="inline-flex items-center gap-2 py-2 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs transition cursor-pointer"
          >
            <Award className="w-4 h-4" />
            Issue Certificate
          </button>
        </div>
      </div>

      {notification && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1">
        <button
          onClick={() => setActiveTab("ISSUED")}
          className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === "ISSUED"
              ? "bg-slate-900 text-white dark:bg-slate-800"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <Award className="w-4 h-4" />
          Issued Certificates ({issuedCerts.length})
        </button>
        <button
          onClick={() => setActiveTab("TEMPLATES")}
          className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === "TEMPLATES"
              ? "bg-slate-900 text-white dark:bg-slate-800"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <FileText className="w-4 h-4" />
          Certificate Templates ({templates.length})
        </button>
      </div>

      {/* TAB 1: ISSUED CERTIFICATES */}
      {activeTab === "ISSUED" && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 w-full max-w-sm">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search member, cert #, or event..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs w-full text-slate-900 dark:text-slate-100 focus:outline-none"
            />
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold bg-slate-50/50 dark:bg-slate-800/40">
                    <th className="py-3 px-4">Certificate #</th>
                    <th className="py-3 px-4">Recipient Member</th>
                    <th className="py-3 px-4">Template / Category</th>
                    <th className="py-3 px-4">Associated Event / Project</th>
                    <th className="py-3 px-4">Issue Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCerts.map((cert) => (
                    <tr
                      key={cert.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-rose-600 dark:text-rose-400">
                        {cert.certificateNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900 dark:text-slate-100">
                          {cert.recipientName}
                        </p>
                        {cert.recipientEmail && (
                          <p className="text-[11px] text-slate-400">{cert.recipientEmail}</p>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {cert.templateName}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {cert.eventOrProjectTitle}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">{cert.issueDate}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleDownloadCert(cert)}
                          disabled={downloadingId === cert.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-medium text-xs transition cursor-pointer disabled:opacity-50"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          {downloadingId === cert.id ? "Preparing..." : "Print / PDF"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredCerts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                        No certificates found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CERTIFICATE TEMPLATES */}
      {activeTab === "TEMPLATES" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900 uppercase">
                    {tmpl.category}
                  </span>
                  <button
                    onClick={() => {
                      setEditingTemplate(tmpl);
                      setShowTemplateModal(true);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-semibold hover:underline"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit Template
                  </button>
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {tmpl.name}
                </h3>
                <p className="text-xs font-serif italic text-amber-600 dark:text-amber-400 mt-1">
                  "{tmpl.titleText}"
                </p>

                <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-serif">
                  {tmpl.bodyTemplate}
                </div>

                {/* Signatories */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Signatory 1</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{tmpl.signatory1Name}</p>
                    <p className="text-[11px] text-slate-500">{tmpl.signatory1Title}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Signatory 2</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{tmpl.signatory2Name}</p>
                    <p className="text-[11px] text-slate-500">{tmpl.signatory2Title}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => {
                    setSelectedTemplateId(tmpl.id);
                    setShowIssueModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs transition"
                >
                  <Award className="w-3.5 h-3.5" />
                  Use This Template
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: Issue Certificate */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Award className="w-4 h-4 text-rose-500" />
                Issue Certificate to Member
              </h3>
              <button
                onClick={() => setShowIssueModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleIssueCertificate} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Certificate Template *
                </label>
                <select
                  required
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Choose Member from Club Roster
                </label>
                <select
                  value={selectedMemberProfileId}
                  onChange={(e) => {
                    const profId = e.target.value;
                    setSelectedMemberProfileId(profId);
                    if (profId) {
                      const m = members.find((x) => x.id === profId);
                      if (m) {
                        setCustomRecipientName(m.name);
                        setCustomRecipientEmail(m.email);
                      }
                    } else {
                      setCustomRecipientName("");
                      setCustomRecipientEmail("");
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="">-- Or enter custom guest / speaker below --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role}) · {m.status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Recipient Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customRecipientName}
                    onChange={(e) => setCustomRecipientName(e.target.value)}
                    placeholder="e.g. Maria Santos"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    value={customRecipientEmail}
                    onChange={(e) => setCustomRecipientEmail(e.target.value)}
                    placeholder="member@email.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Associated Event or Service Project
                </label>
                <input
                  type="text"
                  required
                  value={eventOrProjectTitle}
                  onChange={(e) => setEventOrProjectTitle(e.target.value)}
                  placeholder="e.g. Tubig Para sa Barangay Clean Water Drive"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Issue Date
                </label>
                <input
                  type="date"
                  required
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !customRecipientName}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? "Generating..." : "Issue & Save Certificate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create / Edit Template */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-rose-500" />
                {editingTemplate ? "Edit Certificate Template" : "Create New Template"}
              </h3>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editingTemplate?.name || ""}
                  placeholder="e.g. Outstanding Volunteer Citation"
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
                    defaultValue={editingTemplate?.category || "APPRECIATION"}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="APPRECIATION">Appreciation</option>
                    <option value="PARTICIPATION">Participation</option>
                    <option value="VOLUNTEER">Volunteer Service</option>
                    <option value="SPEAKER">Resource Speaker</option>
                    <option value="PARTNER">Partner Club</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Certificate Header Title *
                  </label>
                  <input
                    type="text"
                    name="titleText"
                    required
                    defaultValue={editingTemplate?.titleText || "Certificate of Appreciation"}
                    placeholder="e.g. Certificate of Appreciation"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Citation Body Text *
                </label>
                <textarea
                  name="bodyTemplate"
                  required
                  rows={3}
                  defaultValue={
                    editingTemplate?.bodyTemplate ||
                    "In grateful recognition of outstanding dedication, volunteer leadership, and invaluable contribution to Rotary's motto of Service Above Self."
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 font-serif"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Signatory 1 Name *
                  </label>
                  <input
                    type="text"
                    name="signatory1Name"
                    required
                    defaultValue={editingTemplate?.signatory1Name || "John Carlos Reyes"}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Signatory 1 Title *
                  </label>
                  <input
                    type="text"
                    name="signatory1Title"
                    required
                    defaultValue={editingTemplate?.signatory1Title || "Club President, RY 2026-27"}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Signatory 2 Name
                  </label>
                  <input
                    type="text"
                    name="signatory2Name"
                    defaultValue={editingTemplate?.signatory2Name || "Maria Santos"}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Signatory 2 Title
                  </label>
                  <input
                    type="text"
                    name="signatory2Title"
                    defaultValue={editingTemplate?.signatory2Title || "Club Secretary, RY 2026-27"}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
