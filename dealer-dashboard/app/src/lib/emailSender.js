/**
 * Sends a dealer report PDF via the Cloudflare Worker.
 * The worker handles Gmail OAuth2 and sends the email.
 */

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://dealer-mailer.YOUR_SUBDOMAIN.workers.dev'

/**
 * @param {object} opts
 * @param {string} opts.to           - recipient email
 * @param {string} opts.subject      - email subject
 * @param {string} opts.bodyHtml     - HTML body
 * @param {string} opts.pdfBase64    - PDF as base64
 * @param {string} opts.pdfFilename  - attachment filename
 */
export async function sendReportEmail({ to, subject, bodyHtml, pdfBase64, pdfFilename }) {
  const res = await fetch(`${WORKER_URL}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, bodyHtml, pdfBase64, pdfFilename }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Worker error ${res.status}: ${err}`)
  }

  return res.json()
}

/**
 * Build a standard email body for a dealer report.
 */
export function buildEmailBody({ groupName, branchName, fromDate, toDate }) {
  const name = branchName ? `${groupName} — ${branchName}` : groupName
  return `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #0f0e0d;">
      <div style="background: #c8420a; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">Dealer Intelligence Report</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 6px 0 0; font-size: 14px;">
          Period: ${fromDate} → ${toDate}
        </p>
      </div>
      <div style="background: #f5f2ed; padding: 28px 32px; border-radius: 0 0 8px 8px; border: 1px solid #ddd8cf;">
        <p style="font-size: 16px; margin: 0 0 16px;">Dear ${name} team,</p>
        <p style="font-size: 14px; line-height: 1.7; color: #3a3835; margin: 0 0 16px;">
          Please find attached your dealer performance report for the period
          <strong>${fromDate}</strong> to <strong>${toDate}</strong>.
          This report includes your event activity data from Mixpanel and a summary
          of your data records.
        </p>
        <p style="font-size: 14px; line-height: 1.7; color: #3a3835; margin: 0 0 24px;">
          If you have any questions about this report, please don't hesitate to reach out.
        </p>
        <p style="font-size: 13px; color: #8a8580; border-top: 1px solid #ddd8cf; padding-top: 16px; margin: 0;">
          This report was generated automatically by the Dealer Intelligence Dashboard.
        </p>
      </div>
    </div>
  `
}
