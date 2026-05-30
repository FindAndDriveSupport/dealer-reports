import Papa from 'papaparse'

/**
 * Parse CSV and extract dealer hierarchy.
 * Expects columns: group, branch (case-insensitive detection).
 * Returns: { groups: { [groupName]: { branches: [branchName], rows: [] } } }
 */
export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn('CSV parse warnings:', results.errors)
        }

        const rows = results.data
        if (!rows.length) return reject(new Error('CSV is empty'))

        const headers = Object.keys(rows[0])

        // Detect group/branch columns flexibly
        const groupCol = headers.find(h =>
          ['group', 'group_name', 'dealer_group', 'dealergroup'].includes(h)
        )
        const branchCol = headers.find(h =>
          ['branch', 'branch_name', 'dealer', 'dealer_name', 'dealerbranch', 'dealer_branch'].includes(h)
        )
        const emailCol = headers.find(h =>
          ['email', 'contact_email', 'dealer_email', 'branch_email'].includes(h)
        )
        const domainCol = headers.find(h =>
          ['domain', 'referring_domain', 'website', 'url', 'dealer_domain'].includes(h)
        )

        if (!groupCol) return reject(new Error(`Could not find a "group" column. Found: ${headers.join(', ')}`))
        if (!branchCol) return reject(new Error(`Could not find a "branch" column. Found: ${headers.join(', ')}`))

        const groups = {}

        rows.forEach((row) => {
          const groupName = (row[groupCol] || '').trim()
          const branchName = (row[branchCol] || '').trim()
          if (!groupName || !branchName) return

          if (!groups[groupName]) {
            groups[groupName] = { branches: {}, email: '', domain: '' }
          }

          // Group-level email/domain (first occurrence wins)
          if (emailCol && !groups[groupName].email) {
            groups[groupName].email = (row[emailCol] || '').trim()
          }
          if (domainCol && !groups[groupName].domain) {
            groups[groupName].domain = (row[domainCol] || '').trim()
          }

          if (!groups[groupName].branches[branchName]) {
            groups[groupName].branches[branchName] = {
              rows: [],
              email: emailCol ? (row[emailCol] || '').trim() : '',
              domain: domainCol ? (row[domainCol] || '').trim() : '',
            }
          }

          groups[groupName].branches[branchName].rows.push(row)
        })

        resolve({ groups, headers, rawRows: rows, groupCol, branchCol, emailCol, domainCol })
      },
      error: reject,
    })
  })
}

/**
 * Summarise CSV rows for a branch into simple key metrics.
 */
export function summariseRows(rows, headers) {
  const numericCols = headers.filter(h =>
    rows.some(r => r[h] !== '' && !isNaN(Number(r[h])))
  )

  const summary = {}
  numericCols.forEach(col => {
    const vals = rows.map(r => Number(r[col])).filter(v => !isNaN(v))
    if (!vals.length) return
    summary[col] = {
      total: vals.reduce((a, b) => a + b, 0),
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      count: vals.length,
    }
  })

  return { rowCount: rows.length, numericSummary: summary }
}
