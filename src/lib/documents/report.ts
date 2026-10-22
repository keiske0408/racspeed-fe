export interface ProjectReportData {
  title: string;
  category: string;
  status: string;
  areasOfFocus: string[];
  sdgs: number[];
  beneficiaries: number;
  volunteerHours: number;
  fundsRaised: number;
  venue?: string;
  startDate?: string;
  endDate?: string;
  narrative?: string;
  clubName?: string;
  district?: string;
}

export function generatePrintableReportHTML(data: ProjectReportData): string {
  const {
    title,
    category,
    status,
    areasOfFocus,
    sdgs,
    beneficiaries,
    volunteerHours,
    fundsRaised,
    venue = "San Pedro, Laguna",
    startDate = "2026-10-01",
    endDate = "2026-10-15",
    narrative = "The project successfully executed all community outreach activities with verified volunteer turnout and measurable beneficiary impact.",
    clubName = "Rotaract Club of San Pedro East",
    district = "District 3820",
  } = data;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Accomplishment Report - ${title}</title>
  <style>
    @page { size: portrait; margin: 25mm 20mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
      color: #0f172a;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      border-bottom: 3px solid #e11d48;
      padding-bottom: 16px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .club-title {
      font-size: 20px;
      font-weight: 800;
      color: #e11d48;
      text-transform: uppercase;
      margin: 0;
    }
    .meta-subtitle {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
    }
    .report-title {
      font-size: 24px;
      font-weight: bold;
      color: #0f172a;
      margin-top: 20px;
      margin-bottom: 8px;
    }
    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: bold;
      background: #e2e8f0;
      color: #334155;
      margin-right: 6px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin: 24px 0;
      background: #f8fafc;
      padding: 16px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
    }
    .stat-label {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
    }
    .stat-val {
      font-size: 20px;
      font-weight: bold;
      color: #0f172a;
      margin-top: 4px;
    }
    .section-heading {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #475569;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
      margin-top: 24px;
      margin-bottom: 12px;
    }
    .narrative {
      font-size: 13px;
      color: #334155;
      white-space: pre-wrap;
      line-height: 1.6;
    }
    .signatures {
      margin-top: 50px;
      display: flex;
      justify-content: space-between;
    }
    .sig-col {
      width: 200px;
      text-align: center;
      border-top: 1px solid #94a3b8;
      padding-top: 8px;
      font-size: 12px;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="club-title">${clubName}</h1>
      <p class="meta-subtitle">Rotary International ${district} · Official Accomplishment Report</p>
    </div>
    <div>
      <span class="badge">RY 2026-27</span>
      <span class="badge">${category}</span>
    </div>
  </div>

  <h2 class="report-title">${title}</h2>
  <div>
    <span class="badge" style="background:#fef2f2;color:#991b1b;border:1px solid #fecaca;">Status: ${status}</span>
    <span class="badge">Venue: ${venue}</span>
    <span class="badge">Period: ${startDate} to ${endDate}</span>
  </div>

  <div class="grid">
    <div>
      <div class="stat-label">Direct Beneficiaries</div>
      <div class="stat-val">${beneficiaries}</div>
    </div>
    <div>
      <div class="stat-label">Volunteer Hours</div>
      <div class="stat-val">${volunteerHours} hrs</div>
    </div>
    <div>
      <div class="stat-label">Funds Raised / Spent</div>
      <div class="stat-val">PHP ${fundsRaised.toLocaleString()}</div>
    </div>
  </div>

  <div class="section-heading">Rotary International Focus & SDGs</div>
  <p style="font-size: 13px; color: #334155;">
    <strong>Areas of Focus:</strong> ${areasOfFocus.join(", ")}<br>
    <strong>United Nations Sustainable Development Goals:</strong> ${sdgs.map(s => "SDG " + s).join(", ")}
  </p>

  <div class="section-heading">Project Narrative & Community Impact</div>
  <div class="narrative">${narrative}</div>

  <div class="signatures">
    <div class="sig-col">
      <strong>Project Chair</strong><br>
      Rotaract San Pedro East
    </div>
    <div class="sig-col">
      <strong>Club President</strong><br>
      RY 2026-27
    </div>
    <div class="sig-col">
      <strong>Club Secretary</strong><br>
      RY 2026-27
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(() => window.print(), 400);
    };
  </script>
</body>
</html>`;
}
