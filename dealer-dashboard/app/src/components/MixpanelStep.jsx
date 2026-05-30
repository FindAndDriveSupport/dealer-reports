import { useState } from 'react'
import { Zap, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { fetchEventsForDomains } from '../lib/mixpanel'
import styles from './MixpanelStep.module.css'

export default function MixpanelStep({ csvData, onFetched }) {
  const [projectId, setProjectId] = useState('')
  const [secret, setSecret] = useState('')
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0])
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [results, setResults] = useState(null)

  // Collect all unique domains from CSV
  const domains = csvData ? collectDomains(csvData) : []

  async function handleFetch() {
    if (!projectId || !secret) {
      setErrorMsg('Project ID and API Secret are required.')
      setStatus('error')
      return
    }
    if (!domains.length) {
      setErrorMsg('No domains found in CSV. Ensure a "domain" or "referring_domain" column exists.')
      setStatus('error')
      return
    }

    setStatus('loading')
    setErrorMsg('')

    try {
      const { results: fetchedResults, errors } = await fetchEventsForDomains({
        projectId, secret, domains, fromDate, toDate,
      })

      const errorEntries = Object.entries(errors)
      if (errorEntries.length > 0) {
        console.warn('Some domains failed:', errors)
      }

      setResults(fetchedResults)
      setStatus('success')
      onFetched({ mixpanelResults: fetchedResults, fromDate, toDate, errors })
    } catch (err) {
      setStatus('error')
      setErrorMsg(err.message)
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.stepBadge}>02</span>
        <div>
          <h2 className={styles.title}>Mixpanel Data</h2>
          <p className={styles.subtitle}>
            Fetching events for {domains.length} domain{domains.length !== 1 ? 's' : ''} from CSV
          </p>
        </div>
      </div>

      {domains.length === 0 && (
        <div className={styles.warningBanner}>
          <AlertCircle size={14} />
          <span>No domains detected in CSV. Add a <code>domain</code> column to enable Mixpanel fetch.</span>
        </div>
      )}

      <div className={styles.fields}>
        <label className={styles.field}>
          <span>Mixpanel Project ID</span>
          <input
            className={styles.input}
            type="text"
            placeholder="e.g. 1234567"
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>API Secret</span>
          <input
            className={styles.input}
            type="password"
            placeholder="Your Mixpanel API secret"
            value={secret}
            onChange={e => setSecret(e.target.value)}
          />
          <small>Found under Project Settings → Service Accounts / API Secret</small>
        </label>
      </div>

      <button
        className={styles.advancedToggle}
        onClick={() => setShowAdvanced(v => !v)}
        type="button"
      >
        Date Range & Options
        {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {showAdvanced && (
        <div className={`${styles.fields} ${styles.advancedFields}`}>
          <label className={styles.field}>
            <span>From Date</span>
            <input className={styles.input} type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span>To Date</span>
            <input className={styles.input} type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </label>
        </div>
      )}

      <button
        className={`${styles.btn} ${status === 'loading' ? styles.loading : ''} ${status === 'success' ? styles.done : ''}`}
        onClick={handleFetch}
        disabled={status === 'loading' || !domains.length}
        type="button"
      >
        {status === 'loading' ? (
          <><div className={styles.spinner} /> Fetching events…</>
        ) : status === 'success' ? (
          <>✓ Fetched — click to re-fetch</>
        ) : (
          <><Zap size={15} /> Fetch Mixpanel Events</>
        )}
      </button>

      {status === 'error' && (
        <div className={styles.errorBanner}>
          <AlertCircle size={15} />
          <span>{errorMsg}</span>
        </div>
      )}

      {status === 'success' && results && (
        <div className={styles.resultSummary}>
          {Object.entries(results).map(([domain, data]) => (
            <div key={domain} className={styles.domainRow}>
              <span className={styles.domainName}>{domain || '(no domain)'}</span>
              <span className={styles.domainCount}>
                {data ? `${Object.values(data).reduce((a,b) => a+b, 0).toLocaleString()} events` : 'failed'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function collectDomains(csvData) {
  const domains = new Set()
  const { groups } = csvData

  Object.values(groups).forEach(group => {
    if (group.domain) domains.add(group.domain)
    Object.values(group.branches).forEach(branch => {
      if (branch.domain) domains.add(branch.domain)
    })
  })

  return [...domains].filter(Boolean)
}
