/**
 * Mixpanel Data Export API — fetches event counts filtered by referring_domain.
 * Uses the /api/2.0/segmentation endpoint (JQL-style aggregation).
 *
 * Mixpanel requires Basic auth: base64(secret:)
 */

const MIXPANEL_BASE = 'https://mixpanel.com/api/2.0'

function basicAuth(secret) {
  return 'Basic ' + btoa(secret + ':')
}

/**
 * Fetch total event counts per event name for a given referring domain + date range.
 * Returns: { eventName: count, ... }
 */
export async function fetchEventsByDomain({ projectId, secret, domain, fromDate, toDate }) {
  const params = new URLSearchParams({
    project_id: projectId,
    event: '["$all"]',  // all events — can be narrowed
    type: 'general',
    unit: 'day',
    interval: 1,
    from_date: fromDate,   // YYYY-MM-DD
    to_date: toDate,
    where: `properties["$referring_domain"] == "${domain}"`,
  })

  const url = `${MIXPANEL_BASE}/segmentation?${params.toString()}`

  const res = await fetch(url, {
    headers: {
      Authorization: basicAuth(secret),
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Mixpanel API error ${res.status}: ${text}`)
  }

  const json = await res.json()

  // Response shape: { data: { series: [...dates], values: { eventName: { date: count } } } }
  const values = json?.data?.values || {}
  const summary = {}

  Object.entries(values).forEach(([eventName, dateCounts]) => {
    const total = Object.values(dateCounts).reduce((a, b) => a + (b || 0), 0)
    summary[eventName] = total
  })

  return summary
}

/**
 * Fetch events for multiple domains in parallel.
 * Returns: { domain: { eventName: count } }
 */
export async function fetchEventsForDomains({ projectId, secret, domains, fromDate, toDate }) {
  const results = {}
  const errors = {}

  await Promise.all(
    domains.map(async (domain) => {
      if (!domain) return
      try {
        results[domain] = await fetchEventsByDomain({ projectId, secret, domain, fromDate, toDate })
      } catch (err) {
        errors[domain] = err.message
        results[domain] = null
      }
    })
  )

  return { results, errors }
}

/**
 * Top-level events list for the project (to show available events in UI).
 */
export async function fetchEventNames({ secret, projectId }) {
  const url = `${MIXPANEL_BASE}/events/names?type=general&project_id=${projectId}`
  const res = await fetch(url, {
    headers: { Authorization: basicAuth(secret) },
  })
  if (!res.ok) throw new Error(`Mixpanel ${res.status}`)
  const json = await res.json()
  return json?.data || []
}
