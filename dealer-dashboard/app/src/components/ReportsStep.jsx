import { useState } from 'react'
import { FileText, Mail, Download, ChevronDown, ChevronUp, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { generateDealerPDF, downloadPDF, pdfToBase64 } from '../lib/pdfGenerator'
import { summariseRows } from '../lib/csvParser'
import { sendReportEmail, buildEmailBody } from '../lib/emailSender'
import styles from './ReportsStep.module.css'

export default function ReportsStep({ csvData, mixpanelData }) {
  const { groups, headers } = csvData
  const { mixpanelResults, fromDate, toDate } = mixpanelData

  const [expandedGroup, setExpandedGroup] = useState(null)
  const [reportStates, setReportStates] = useState({}) // key: "group" or "group::branch"
  const [emailOverrides, setEmailOverrides] = useState({})

  function getKey(groupName, branchName = null) {
    return branchName ? `${groupName}::${branchName}` : groupName
  }

  function setReportState(key, patch) {
    setReportStates(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  function getMixpanelForDomain(domain) {
    if (!domain || !mixpanelResults) return null
    return mixpanelResults[domain] || null
  }

  async function handleGenerate(groupName, branchName = null) {
    const key = getKey(groupName, branchName)
    setReportState(key, { genStatus: 'loading', sendStatus: null })

    try {
      let csvRows, domain, email
      if (branchName) {
        const branch = groups[groupName].branches[branchName]
        csvRows = branch.rows
        domain = branch.domain || groups[groupName].domain
        email = emailOverrides[key] || branch.email || groups[groupName].email
      } else {
        // Group summary: aggregate all branch rows
        csvRows = Object.values(groups[groupName].branches).flatMap(b => b.rows)
        domain = groups[groupName].domain
        email = emailOverrides[key] || groups[groupName].email
      }

      const csvSummary = summariseRows(csvRows, headers)
      const mixpanelForDealer = getMixpanelForDomain(domain)

      const doc = generateDealerPDF({
        groupName, branchName, csvSummary,
        mixpanelData: mixpanelForDealer,
        fromDate, toDate, csvHeaders: headers,
      })

      setReportState(key, { genStatus: 'done', doc, csvSummary, domain, email })
    } catch (err) {
      setReportState(key, { genStatus: 'error', genError: err.message })
    }
  }

  async function handleDownload(key) {
    const state = reportStates[key]
    if (!state?.doc) return
    const [groupName, branchName] = key.split('::')
    const filename = branchName
      ? `report-${slugify(groupName)}-${slugify(branchName)}.pdf`
      : `report-${slugify(groupName)}.pdf`
    downloadPDF(state.doc, filename)
  }

  async function handleSend(key, groupName, branchName = null) {
    const state = reportStates[key]
    if (!state?.doc) return

    const email = emailOverrides[key] || state.email
    if (!email) {
      setReportState(key, { sendStatus: 'error', sendError: 'No email address set for this dealer.' })
      return
    }

    setReportState(key, { sendStatus: 'loading' })

    try {
      const pdfBase64 = pdfToBase64(state.doc)
      const pdfFilename = branchName
        ? `report-${slugify(groupName)}-${slugify(branchName)}.pdf`
        : `report-${slugify(groupName)}.pdf`

      await sendReportEmail({
        to: email,
        subject: `Dealer Intelligence Report — ${branchName || groupName} (${fromDate} to ${toDate})`,
        bodyHtml: buildEmailBody({ groupName, branchName, fromDate, toDate }),
        pdfBase64,
        pdfFilename,
      })

      setReportState(key, { sendStatus: 'done' })
    } catch (err) {
      setReportState(key, { sendStatus: 'error', sendError: err.message })
    }
  }

  const groupNames = Object.keys(groups)

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.stepBadge}>03</span>
        <div>
          <h2 className={styles.title}>Generate & Send Reports</h2>
          <p className={styles.subtitle}>{groupNames.length} group{groupNames.length !== 1 ? 's' : ''} · {countBranches(groups)} branches</p>
        </div>
      </div>

      <div className={styles.list}>
        {groupNames.map(groupName => {
          const group = groups[groupName]
          const branchNames = Object.keys(group.branches)
          const groupKey = getKey(groupName)
          const groupState = reportStates[groupKey] || {}
          const isExpanded = expandedGroup === groupName

          return (
            <div key={groupName} className={styles.groupCard}>
              {/* Group header row */}
              <div className={styles.groupHeader}>
                <button
                  className={styles.expandBtn}
                  onClick={() => setExpandedGroup(isExpanded ? null : groupName)}
                  type="button"
                >
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  <span className={styles.groupName}>{groupName}</span>
                  <span className={styles.branchPill}>{branchNames.length} branch{branchNames.length !== 1 ? 'es' : ''}</span>
                </button>

                <div className={styles.actions}>
                  <EmailInput
                    value={emailOverrides[groupKey] ?? group.email ?? ''}
                    onChange={v => setEmailOverrides(prev => ({ ...prev, [groupKey]: v }))}
                    placeholder="group@email.com"
                  />
                  <ActionButtons
                    state={groupState}
                    onGenerate={() => handleGenerate(groupName)}
                    onDownload={() => handleDownload(groupKey)}
                    onSend={() => handleSend(groupKey, groupName)}
                  />
                </div>
              </div>

              {groupState.genStatus === 'error' && (
                <ErrorRow msg={groupState.genError} />
              )}
              {groupState.sendStatus === 'error' && (
                <ErrorRow msg={groupState.sendError} />
              )}

              {/* Branches */}
              {isExpanded && (
                <div className={styles.branches}>
                  {branchNames.map(branchName => {
                    const branch = group.branches[branchName]
                    const bKey = getKey(groupName, branchName)
                    const bState = reportStates[bKey] || {}

                    return (
                      <div key={branchName} className={styles.branchRow}>
                        <div className={styles.branchInfo}>
                          <span className={styles.branchName}>{branchName}</span>
                          {branch.domain && <span className={styles.domainTag}>{branch.domain}</span>}
                          <span className={styles.rowCount}>{branch.rows.length} rows</span>
                        </div>
                        <div className={styles.actions}>
                          <EmailInput
                            value={emailOverrides[bKey] ?? branch.email ?? ''}
                            onChange={v => setEmailOverrides(prev => ({ ...prev, [bKey]: v }))}
                            placeholder="branch@email.com"
                          />
                          <ActionButtons
                            state={bState}
                            onGenerate={() => handleGenerate(groupName, branchName)}
                            onDownload={() => handleDownload(bKey)}
                            onSend={() => handleSend(bKey, groupName, branchName)}
                          />
                        </div>
                        {bState.genStatus === 'error' && <ErrorRow msg={bState.genError} />}
                        {bState.sendStatus === 'error' && <ErrorRow msg={bState.sendError} />}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Send All button */}
      <SendAllButton groups={groups} reportStates={reportStates} onSendAll={async () => {
        for (const groupName of groupNames) {
          const branchNames = Object.keys(groups[groupName].branches)
          for (const branchName of branchNames) {
            const bKey = getKey(groupName, branchName)
            const bState = reportStates[bKey]
            if (bState?.genStatus === 'done' && bState?.sendStatus !== 'done') {
              await handleSend(bKey, groupName, branchName)
            }
          }
        }
      }} />
    </div>
  )
}

function EmailInput({ value, onChange, placeholder }) {
  return (
    <input
      className={styles.emailInput}
      type="email"
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  )
}

function ActionButtons({ state, onGenerate, onDownload, onSend }) {
  const isGenerating = state.genStatus === 'loading'
  const isGenerated = state.genStatus === 'done'
  const isSending = state.sendStatus === 'loading'
  const isSent = state.sendStatus === 'done'

  return (
    <div className={styles.btnGroup}>
      <button
        className={`${styles.btn} ${styles.btnGenerate} ${isGenerating ? styles.busy : ''} ${isGenerated ? styles.regenerate : ''}`}
        onClick={onGenerate}
        disabled={isGenerating}
        title={isGenerated ? 'Re-generate PDF' : 'Generate PDF'}
        type="button"
      >
        {isGenerating ? <Loader size={13} className={styles.spin} /> : <FileText size={13} />}
        {isGenerated ? 'Re-gen' : 'Generate'}
      </button>

      {isGenerated && (
        <>
          <button
            className={`${styles.btn} ${styles.btnDownload}`}
            onClick={onDownload}
            title="Download PDF"
            type="button"
          >
            <Download size={13} />
          </button>

          <button
            className={`${styles.btn} ${styles.btnSend} ${isSending ? styles.busy : ''} ${isSent ? styles.sent : ''}`}
            onClick={onSend}
            disabled={isSending || isSent}
            title={isSent ? 'Sent!' : 'Send via email'}
            type="button"
          >
            {isSending ? <Loader size={13} className={styles.spin} /> :
             isSent ? <CheckCircle size={13} /> : <Mail size={13} />}
            {isSent ? 'Sent' : 'Send'}
          </button>
        </>
      )}
    </div>
  )
}

function ErrorRow({ msg }) {
  return (
    <div className={styles.errorRow}>
      <AlertCircle size={13} />
      <span>{msg}</span>
    </div>
  )
}

function SendAllButton({ groups, reportStates, onSendAll }) {
  const [sending, setSending] = useState(false)

  const readyCount = Object.entries(reportStates).filter(
    ([, s]) => s.genStatus === 'done' && s.sendStatus !== 'done'
  ).length

  if (readyCount === 0) return null

  async function handle() {
    setSending(true)
    await onSendAll()
    setSending(false)
  }

  return (
    <div className={styles.sendAllBar}>
      <span>{readyCount} report{readyCount !== 1 ? 's' : ''} ready to send</span>
      <button
        className={`${styles.btn} ${styles.btnSend} ${sending ? styles.busy : ''}`}
        onClick={handle}
        disabled={sending}
        type="button"
      >
        {sending ? <Loader size={13} className={styles.spin} /> : <Mail size={13} />}
        {sending ? 'Sending all…' : `Send All (${readyCount})`}
      </button>
    </div>
  )
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function countBranches(groups) {
  return Object.values(groups).reduce((sum, g) => sum + Object.keys(g.branches).length, 0)
}
