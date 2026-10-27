import { createAdminClient } from "@/lib/supabase/admin";

export interface CertificateTemplateDTO {
  id: string;
  name: string;
  category: "PARTICIPATION" | "APPRECIATION" | "VOLUNTEER" | "SPEAKER" | "PARTNER";
  titleText: string;
  bodyTemplate: string;
  signatory1Name: string;
  signatory1Title: string;
  signatory2Name: string;
  signatory2Title: string;
  createdAt: string;
}

export interface IssuedCertificateDTO {
  id: string;
  recipientName: string;
  recipientEmail?: string;
  profileId?: string;
  certificateNumber: string;
  templateId: string;
  templateName: string;
  category: string;
  eventOrProjectTitle: string;
  issueDate: string;
}

export const DEFAULT_TEMPLATES: CertificateTemplateDTO[] = [
  {
    id: "tmpl-appreciation",
    name: "Certificate of Appreciation (Standard)",
    category: "APPRECIATION",
    titleText: "Certificate of Appreciation",
    bodyTemplate: "In grateful recognition and appreciation of exceptional leadership, dedication, and selfless commitment to service above self.",
    signatory1Name: "John Carlos Reyes",
    signatory1Title: "Club President, RY 2026-27",
    signatory2Name: "Maria Santos",
    signatory2Title: "Club Secretary, RY 2026-27",
    createdAt: "2026-07-01",
  },
  {
    id: "tmpl-participation",
    name: "General Assembly & Meeting Attendance",
    category: "PARTICIPATION",
    titleText: "Certificate of Participation",
    bodyTemplate: "For active and valued participation during the regular assembly, contributing significantly to club discussions and fellowship.",
    signatory1Name: "John Carlos Reyes",
    signatory1Title: "Club President, RY 2026-27",
    signatory2Name: "Maria Santos",
    signatory2Title: "Club Secretary, RY 2026-27",
    createdAt: "2026-07-01",
  },
  {
    id: "tmpl-volunteer",
    name: "Outstanding Service Volunteer Citation",
    category: "VOLUNTEER",
    titleText: "Certificate of Commendation",
    bodyTemplate: "For dedicated volunteer service rendered during community project execution, empowering families and upholding Rotary's core values.",
    signatory1Name: "Danilo Cruz",
    signatory1Title: "Community Service Director",
    signatory2Name: "John Carlos Reyes",
    signatory2Title: "Club President, RY 2026-27",
    createdAt: "2026-07-01",
  },
  {
    id: "tmpl-speaker",
    name: "Distinguished Guest Speaker Recognition",
    category: "SPEAKER",
    titleText: "Certificate of Recognition",
    bodyTemplate: "For generously sharing expert insights, inspiring knowledge, and thought leadership as our distinguished resource speaker.",
    signatory1Name: "Kirsten Lim",
    signatory1Title: "Professional Development Chair",
    signatory2Name: "John Carlos Reyes",
    signatory2Title: "Club President, RY 2026-27",
    createdAt: "2026-07-01",
  },
];

export const INITIAL_ISSUED_CERTS: IssuedCertificateDTO[] = [
  {
    id: "cert-1",
    recipientName: "Maria Santos",
    recipientEmail: "maria.santos@rotaract3820.org",
    certificateNumber: "CERT-2026-0089",
    templateId: "tmpl-volunteer",
    templateName: "Outstanding Service Volunteer Citation",
    category: "Volunteer Service",
    eventOrProjectTitle: "Tubig Para sa Barangay Clean Water Filtration",
    issueDate: "2026-10-15",
  },
  {
    id: "cert-2",
    recipientName: "Danilo Cruz",
    recipientEmail: "danilo.cruz@rotaract3820.org",
    certificateNumber: "CERT-2026-0090",
    templateId: "tmpl-appreciation",
    templateName: "Certificate of Appreciation (Standard)",
    category: "Leadership Appreciation",
    eventOrProjectTitle: "Project EduKariton Literacy Launch",
    issueDate: "2026-10-18",
  },
];

export async function getCertificatesData(clubId = "00000000-0000-0000-0000-000000000001") {
  let templates = [...DEFAULT_TEMPLATES];
  let issuedCerts = [...INITIAL_ISSUED_CERTS];

  try {
    const admin = createAdminClient();

    // Query templates
    const { data: dbTemplates, error: tmplErr } = await admin
      .from("certificate_templates")
      .select("*")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false });

    if (!tmplErr && dbTemplates) {
      if (dbTemplates.length > 0) {
        templates = dbTemplates.map((t) => ({
          id: t.id,
          name: t.name,
          category: t.category,
          titleText: t.title_text || "Certificate of Recognition",
          bodyTemplate: t.body_template,
          signatory1Name: t.signatory_1_name || "Club President",
          signatory1Title: t.signatory_1_title || "Club President",
          signatory2Name: t.signatory_2_name || "Club Secretary",
          signatory2Title: t.signatory_2_title || "Club Secretary",
          createdAt: t.created_at,
        }));
      }
    }

    // Query issued certificates
    const { data: dbRecipients, error: recErr } = await admin
      .from("certificate_recipients")
      .select(`
        id,
        recipient_name,
        recipient_email,
        certificate_number,
        created_at,
        certificate_issuances (
          issue_date,
          template_id,
          events ( title ),
          projects ( title ),
          certificate_templates ( name, category, title_text )
        )
      `)
      .order("created_at", { ascending: false });

    if (!recErr && dbRecipients) {
      issuedCerts = dbRecipients.map((r: any) => {
        const issuance = r.certificate_issuances as any;
        const tmpl = issuance?.certificate_templates as any;
        const eventTitle = issuance?.events?.title || issuance?.projects?.title || "Club Activity";

        return {
          id: r.id,
          recipientName: r.recipient_name,
          recipientEmail: r.recipient_email || undefined,
          certificateNumber: r.certificate_number,
          templateId: issuance?.template_id || "tmpl-appreciation",
          templateName: tmpl?.name || "Certificate of Appreciation",
          category: tmpl?.category || "Appreciation",
          eventOrProjectTitle: eventTitle,
          issueDate: issuance?.issue_date || r.created_at?.split("T")[0] || "2026-10-22",
        };
      });
    }
  } catch (err) {
    console.warn("Could not query certificates from Supabase:", err);
  }

  return { templates, issuedCerts };
}
