import { useState, useRef } from 'react'
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react'
import { parseCSV } from '../lib/csvParser'
import styles from './UploadStep.module.css'

export default function UploadStep({ onParsed }) {
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState('idle') // idle | parsing | success | error
  const [errorMsg, setErrorMsg] = useState('')
  const [fileName, setFileName] = useState('')
  const inputRef = useRef()

  async function handleFile(file) {
    if (!file || !file.name.endsWith('.csv')) {
      setErrorMsg('Please upload a .csv file')
      setStatus('error')
      return
    }
    setFileName(file.name)
    setStatus('parsing')
    setErrorMsg('')

    try {
      const result = await parseCSV(file)
      setStatus('success')
      onParsed(result)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err.message)
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.stepBadge}>01</span>
        <div>
          <h2 className={styles.title}>Upload Data Dump</h2>
          <p className={styles.subtitle}>CSV with Group and Branch columns</p>
        </div>
      </div>

      <div
        className={`${styles.dropzone} ${dragging ? styles.dragging : ''} ${status === 'success' ? styles.success : ''} ${status === 'error' ? styles.errored : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className={styles.hiddenInput}
          onChange={(e) => handleFile(e.target.files[0])}
        />

        {status === 'success' ? (
          <div className={styles.successState}>
            <CheckCircle size={32} />
            <span>{fileName}</span>
            <small>Click to replace</small>
          </div>
        ) : status === 'parsing' ? (
          <div className={styles.parsingState}>
            <div className={styles.spinner} />
            <span>Parsing CSV…</span>
          </div>
        ) : (
          <div className={styles.idleState}>
            <Upload size={32} />
            <span>Drop CSV file here or click to browse</span>
            <small>Required columns: group, branch (+ optional: domain, email)</small>
          </div>
        )}
      </div>

      {status === 'error' && (
        <div className={styles.errorBanner}>
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  )
}
