export interface CertificateData {
  recipientName: string;
  category: string;
  eventOrProjectTitle: string;
  certificateNumber: string;
  issueDate: string;
  signatoryOneTitle?: string;
  signatoryTwoTitle?: string;
  district?: string;
  clubName?: string;
}

export function generatePrintableCertificateHTML(data: CertificateData): string {
  const {
    recipientName,
    category,
    eventOrProjectTitle,
    certificateNumber,
    issueDate,
    signatoryOneTitle = "Club President, RY 2026-27",
    signatoryTwoTitle = "Club Secretary, RY 2026-27",
    district = "District 3820",
    clubName = "Rotaract Club of San Pedro East",
  } = data;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Certificate of Appreciation - ${recipientName}</title>
  <style>
    @page { size: landscape; margin: 0; }
    body {
      margin: 0;
      padding: 40px;
      font-family: 'Times New Roman', Georgia, serif;
      background: #faf8f5;
      color: #1a1a1a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .cert-frame {
      width: 100%;
      max-width: 960px;
      height: 640px;
      border: 14px solid #b45309;
      padding: 10px;
      position: relative;
      background: #ffffff;
      box-shadow: 0 10px 30px rgba(0,0,0,0.15);
      box-sizing: border-box;
    }
    .cert-inner {
      width: 100%;
      height: 100%;
      border: 2px solid #e11d48;
      padding: 30px 40px;
      text-align: center;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .crest {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #e11d48;
      text-transform: uppercase;
      margin: 0;
    }
    .subhead {
      font-size: 13px;
      letter-spacing: 3px;
      color: #78350f;
      text-transform: uppercase;
      margin: 4px 0 0 0;
      font-weight: bold;
    }
    .title {
      font-size: 32px;
      font-weight: bold;
      color: #0f172a;
      margin: 15px 0 5px 0;
      letter-spacing: 1px;
    }
    .presented-to {
      font-size: 14px;
      font-style: italic;
      color: #64748b;
      margin: 0;
    }
    .recipient {
      font-size: 34px;
      font-weight: bold;
      color: #e11d48;
      margin: 10px 0;
      border-bottom: 2px solid #fde047;
      display: inline-block;
      padding: 0 40px 6px 40px;
      font-family: Arial, sans-serif;
    }
    .reason {
      font-size: 14px;
      color: #334155;
      line-height: 1.6;
      max-width: 680px;
      margin: 0 auto;
    }
    .event-name {
      font-weight: bold;
      color: #0f172a;
    }
    .footer-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 20px;
      padding-top: 20px;
    }
    .sig-block {
      text-align: center;
      width: 240px;
    }
    .sig-line {
      border-top: 1px solid #334155;
      margin-bottom: 6px;
    }
    .sig-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #64748b;
      font-weight: bold;
    }
    .cert-meta {
      font-size: 10px;
      color: #94a3b8;
      letter-spacing: 1px;
    }
    @media print {
      body { padding: 0; background: none; }
      .cert-frame { box-shadow: none; width: 100vw; height: 100vh; border-width: 10px; }
    }
  </style>
</head>
<body>
  <div class="cert-frame">
    <div class="cert-inner">
      <div>
        <h1 class="crest">${clubName}</h1>
        <p class="subhead">Rotary International ${district} · Laguna, Philippines</p>
        <h2 class="title">Certificate of Recognition</h2>
        <p class="presented-to">This certificate is proudly presented to</p>
        <div>
          <div class="recipient">${recipientName}</div>
        </div>
        <p class="reason">
          In sincere appreciation for outstanding dedication, active service, and invaluable participation in 
          <span class="event-name">"${eventOrProjectTitle}"</span>, embodying the highest ideals of <em>Fellowship Through Service</em>.
        </p>
      </div>

      <div class="footer-section">
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-title">${signatoryOneTitle}</div>
        </div>
        <div class="cert-meta">
          <div>Certificate No.: ${certificateNumber}</div>
          <div>Issued on: ${issueDate}</div>
        </div>
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-title">${signatoryTwoTitle}</div>
        </div>
      </div>
    </div>
  </div>
  <script>
    window.onload = function() {
      // Auto-trigger print window when opened directly
      setTimeout(() => window.print(), 400);
    };
  </script>
</body>
</html>`;
}
