/**
 * Cloudflare Worker — Dealer Report Email Sender
 *
 * Secrets required (set with `wrangler secret put`):
 *   GMAIL_CLIENT_ID       — Google OAuth2 client ID
 *   GMAIL_CLIENT_SECRET   — Google OAuth2 client secret
 *   GMAIL_REFRESH_TOKEN   — Long-lived refresh token (from OAuth2 Playground)
 *   GMAIL_SENDER_EMAIL    — The Gmail address sending the emails
 *   ALLOWED_ORIGIN        — Your Cloudflare Pages URL (for CORS)
 *
 * Routes:
 *   POST /send   — Send a PDF report email
 *   GET  /health — Health check
 */

const GMAIL_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const allowedOrigin = env.ALLOWED_ORIGIN || '*'

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204, allowedOrigin)
    }

    const url = new URL(request.url)

    if (url.pathname === '/health' && request.method === 'GET') {
      return corsResponse(JSON.stringify({ ok: true }), 200, allowedOrigin)
    }

    if (url.pathname === '/send' && request.method === 'POST') {
      return handleSend(request, env, allowedOrigin)
    }

    return corsResponse(JSON.stringify({ error: 'Not found' }), 404, allowedOrigin)
  },
}

async function handleSend(request, env, allowedOrigin) {
  let body
  try {
    body = await request.json()
  } catch {
    return corsResponse(JSON.stringify({ error: 'Invalid JSON body' }), 400, allowedOrigin)
  }

  const { to, subject, bodyHtml, pdfBase64, pdfFilename } = body

  if (!to || !subject || !pdfBase64 || !pdfFilename) {
    return corsResponse(
      JSON.stringify({ error: 'Missing required fields: to, subject, pdfBase64, pdfFilename' }),
      400, allowedOrigin
    )
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return corsResponse(JSON.stringify({ error: 'Invalid email address' }), 400, allowedOrigin)
  }

  try {
    const accessToken = await getAccessToken(env)
    await sendGmailWithAttachment({
      accessToken,
      from: env.GMAIL_SENDER_EMAIL,
      to,
      subject,
      bodyHtml: bodyHtml || '<p>Please find your dealer report attached.</p>',
      pdfBase64,
      pdfFilename,
    })

    return corsResponse(JSON.stringify({ ok: true, message: `Email sent to ${to}` }), 200, allowedOrigin)
  } catch (err) {
    console.error('Send error:', err)
    return corsResponse(JSON.stringify({ error: err.message }), 500, allowedOrigin)
  }
}

/**
 * Exchange refresh token for a fresh access token.
 */
async function getAccessToken(env) {
  const res = await fetch(GMAIL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      refresh_token: env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to refresh Gmail token: ${text}`)
  }

  const json = await res.json()
  return json.access_token
}

/**
 * Build a MIME message with HTML body + PDF attachment and send via Gmail API.
 */
async function sendGmailWithAttachment({ accessToken, from, to, subject, bodyHtml, pdfBase64, pdfFilename }) {
  const boundary = `boundary_${crypto.randomUUID().replace(/-/g, '')}`

  const mimeLines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    bodyHtml,
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${pdfFilename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${pdfFilename}"`,
    '',
    // Split base64 into 76-char lines (RFC 2045)
    pdfBase64.match(/.{1,76}/g).join('\n'),
    '',
    `--${boundary}--`,
  ]

  const rawMessage = mimeLines.join('\r\n')

  // Gmail API requires URL-safe base64
  const encoded = btoa(rawMessage)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const res = await fetch(GMAIL_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gmail API error ${res.status}: ${text}`)
  }

  return res.json()
}

function corsResponse(body, status, allowedOrigin) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
