import { useState } from 'react'
import UploadStep from './components/UploadStep'
import MixpanelStep from './components/MixpanelStep'
import ReportsStep from './components/ReportsStep'
import styles from './App.module.css'

export default function App() {
  const [csvData, setCsvData] = useState(null)
  const [mixpanelData, setMixpanelData] = useState(null)

  function handleCSVParsed(data) {
    setCsvData(data)
    setMixpanelData(null) // reset downstream on new upload
  }

  function handleMixpanelFetched(data) {
    setMixpanelData(data)
  }

  const step = !csvData ? 1 : !mixpanelData ? 2 : 3

  return (
    <div className={styles.root}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>◈</span>
          <span className={styles.logoText}>Dealer<br />Intelligence</span>
        </div>

        <nav className={styles.nav}>
          <StepNav number="01" label="Upload CSV" active={step >= 1} done={!!csvData} />
          <StepNav number="02" label="Mixpanel Data" active={step >= 2} done={!!mixpanelData} disabled={!csvData} />
          <StepNav number="03" label="Reports & Send" active={step >= 3} done={false} disabled={!mixpanelData} />
        </nav>

        {csvData && (
          <div className={styles.sidebarStats}>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{Object.keys(csvData.groups).length}</span>
              <span className={styles.statLabel}>Groups</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>
                {Object.values(csvData.groups).reduce((s, g) => s + Object.keys(g.branches).length, 0)}
              </span>
              <span className={styles.statLabel}>Branches</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{csvData.rawRows.length}</span>
              <span className={styles.statLabel}>Rows</span>
            </div>
          </div>
        )}

        <div className={styles.sidebarFooter}>
          <p>Dealer Intelligence Dashboard</p>
          <p className={styles.version}>v1.0</p>
        </div>
      </aside>

      {/* Main content */}
      <main className={styles.main}>
        <header className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}>
              {step === 1 && 'Import Data'}
              {step === 2 && 'Fetch Mixpanel Events'}
              {step === 3 && 'Reports'}
            </h1>
            <p className={styles.pageSubtitle}>
              {step === 1 && 'Upload your dealer CSV to get started'}
              {step === 2 && 'Connect Mixpanel to enrich reports with event data'}
              {step === 3 && 'Generate PDFs and send to each dealer'}
            </p>
          </div>
        </header>

        <div className={styles.content}>
          {/* Step 1 always visible */}
          <div className={`${styles.stepWrapper} ${step > 1 ? styles.collapsed : ''}`}>
            <UploadStep onParsed={handleCSVParsed} />
          </div>

          {/* Step 2 unlocks after CSV */}
          {csvData && (
            <div className={`${styles.stepWrapper} animate-fade-up`}>
              <MixpanelStep csvData={csvData} onFetched={handleMixpanelFetched} />
            </div>
          )}

          {/* Step 3 unlocks after Mixpanel */}
          {csvData && mixpanelData && (
            <div className={`${styles.stepWrapper} animate-fade-up`}>
              <ReportsStep csvData={csvData} mixpanelData={mixpanelData} />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function StepNav({ number, label, active, done, disabled }) {
  return (
    <div className={`${styles.navItem} ${active ? styles.navActive : ''} ${done ? styles.navDone : ''} ${disabled ? styles.navDisabled : ''}`}>
      <span className={styles.navNumber}>{done ? '✓' : number}</span>
      <span className={styles.navLabel}>{label}</span>
    </div>
  )
}
