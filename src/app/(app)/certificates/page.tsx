"use client";

import React, { useState } from "react";
import { Award, Download, CheckCircle, FileText, Plus, X } from "lucide-react";

interface Certificate {
  id: string;
  recipientName: string;
  category: string;
  eventTitle: string;
  certificateNumber: string;
  issueDate: string;
}

const SAMPLE_CERTIFICATES: Certificate[] = [
  {
    id: "cert-1",
    recipientName: "Maria Santos",
    category: "Participation & Service",
    eventTitle: "Tubig Para sa Barangay Clean Water Filtration",
    certificateNumber: "CERT-2026-0089",
    issueDate: "2026-10-15",
  },
  {
    id: "cert-2",
    recipientName: "John Carlos Reyes",
    category: "Leadership Recognition",
    eventTitle: "Laguna Bay Greening Initiative",
    certificateNumber: "CERT-2026-0090",
    issueDate: "2026-10-18",
  },
];

import { generatePrintableCertificateHTML } from "@/lib/documents/certificate";

export default function CertificatesPage() {
  const [certs, setCerts] = useState<Certificate[]>(SAMPLE_CERTIFICATES);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  function handleDownloadCert(cert: Certificate) {
    setDownloadingId(cert.id);
    const html = generatePrintableCertificateHTML({
      recipientName: cert.recipientName,
      category: cert.category,
      eventOrProjectTitle: cert.eventTitle,
      certificateNumber: cert.certificateNumber,
      issueDate: cert.issueDate,
    });

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
    setDownloadingId(null);
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Certificates of Recognition
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Generate and issue verifiable certificates for members, volunteers, and partners
          </p>
        </div>
      </div>

      {/* Certificates List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
          Issued Certificates
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                <th className="py-2.5 px-3">Certificate #</th>
                <th className="py-2.5 px-3">Recipient</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Associated Event / Project</th>
                <th className="py-2.5 px-3">Issue Date</th>
                <th className="py-2.5 px-3 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {certs.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-3 px-3 font-mono font-medium text-slate-600 dark:text-slate-400">
                    {c.certificateNumber}
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-900 dark:text-slate-100">
                    {c.recipientName}
                  </td>
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{c.category}</td>
                  <td className="py-3 px-3 text-slate-500">{c.eventTitle}</td>
                  <td className="py-3 px-3 text-slate-500">{c.issueDate}</td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => handleDownloadCert(c)}
                      disabled={downloadingId === c.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-medium text-xs transition cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {downloadingId === c.id ? "Preparing..." : "Download"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
