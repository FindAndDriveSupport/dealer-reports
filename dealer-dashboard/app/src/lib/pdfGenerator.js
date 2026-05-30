import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const BRAND_COLOR = [200, 66, 10]      // #c8420a
const INK = [15, 14, 13]              // #0f0e0d
const MUTED = [138, 133, 128]         // #8a8580
const LIGHT_BG = [245, 242, 237]      // #f5f2ed
const WARM_BG = [237, 233, 226]       // #ede9e2

/**
 * Generate a PDF report for a single dealer (group or branch).
 * @param {object} opts
 * @param {string} opts.groupName
 * @param {string|null} opts.branchName  — null means group-level summary
 * @param {object} opts.csvSummary       — { rowCount, numericSummary }
 * @param {object|null} opts.mixpanelData — { eventName: count }
 * @param {string} opts.fromDate
 * @param {string} opts.toDate
 * @param {string[]} opts.csvHeaders
 * @returns {jsPDF}
 */
export function generateDealerPDF({ groupName, branchName, csvSummary, mixpanelData, fromDate, toDate, csvHeaders }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 18
  const contentW = pageW - margin * 2
  let y = 0

  // ── Header bar ────────────────────────────────────────────────────────────
  doc.setFillColor(...BRAND_COLOR)
  doc.rect(0, 0, pageW, 38, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Dealer Intelligence Report', margin, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Period: ${fromDate} → ${toDate}`, margin, 24)
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, margin, 30)

  // ── Dealer identity ───────────────────────────────────────────────────────
  y = 48
  doc.setFillColor(...WARM_BG)
  doc.roundedRect(margin, y, contentW, branchName ? 22 : 16, 2, 2, 'F')

  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(groupName, margin + 6, y + 9)

  if (branchName) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.text(`Branch: ${branchName}`, margin + 6, y + 17)
  }

  y += branchName ? 32 : 26

  // ── KPI boxes ─────────────────────────────────────────────────────────────
  const totalEvents = mixpanelData
    ? Object.values(mixpanelData).reduce((a, b) => a + b, 0)
    : null

  const kpis = [
    { label: 'CSV Records', value: csvSummary.rowCount.toLocaleString() },
    { label: 'Total Events', value: totalEvents !== null ? totalEvents.toLocaleString() : '—' },
    { label: 'Event Types', value: mixpanelData ? Object.keys(mixpanelData).length.toString() : '—' },
  ]

  const boxW = (contentW - 8) / 3
  kpis.forEach((kpi, i) => {
    const bx = margin + i * (boxW + 4)
    doc.setFillColor(...LIGHT_BG)
    doc.roundedRect(bx, y, boxW, 22, 2, 2, 'F')
    doc.setDrawColor(...BRAND_COLOR)
    doc.setLineWidth(0.5)
    doc.line(bx, y, bx, y + 22)

    doc.setTextColor(...BRAND_COLOR)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text(kpi.value, bx + 5, y + 13)

    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(kpi.label.toUpperCase(), bx + 5, y + 19)
  })

  y += 30

  // ── Mixpanel Events Table ─────────────────────────────────────────────────
  if (mixpanelData && Object.keys(mixpanelData).length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...INK)
    doc.text('Event Activity', margin, y)
    doc.setDrawColor(...BRAND_COLOR)
    doc.setLineWidth(0.8)
    doc.line(margin, y + 2, margin + 36, y + 2)
    y += 8

    const eventRows = Object.entries(mixpanelData)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => [name, count.toLocaleString()])

    autoTable(doc, {
      startY: y,
      head: [['Event Name', 'Total Count']],
      body: eventRows,
      margin: { left: margin, right: margin },
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 4,
        textColor: INK,
        lineColor: [220, 215, 208],
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: INK,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      alternateRowStyles: { fillColor: LIGHT_BG },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 35, halign: 'right', fontStyle: 'bold', textColor: BRAND_COLOR },
      },
    })

    y = doc.lastAutoTable.finalY + 10
  }

  // ── CSV Numeric Summary ───────────────────────────────────────────────────
  const numericCols = Object.entries(csvSummary.numericSummary || {})
  if (numericCols.length > 0) {
    // New page if running low
    if (y > pageH - 70) { doc.addPage(); y = margin }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...INK)
    doc.text('CSV Data Summary', margin, y)
    doc.setDrawColor(...BRAND_COLOR)
    doc.setLineWidth(0.8)
    doc.line(margin, y + 2, margin + 42, y + 2)
    y += 8

    const csvRows = numericCols.map(([col, stats]) => [
      col,
      stats.count.toLocaleString(),
      stats.total.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      stats.avg.toLocaleString(undefined, { maximumFractionDigits: 2 }),
    ])

    autoTable(doc, {
      startY: y,
      head: [['Column', 'Records', 'Total', 'Average']],
      body: csvRows,
      margin: { left: margin, right: margin },
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 4,
        textColor: INK,
        lineColor: [220, 215, 208],
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: INK,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      alternateRowStyles: { fillColor: LIGHT_BG },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right', fontStyle: 'bold' },
        3: { halign: 'right' },
      },
    })

    y = doc.lastAutoTable.finalY + 10
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFillColor(...WARM_BG)
    doc.rect(0, pageH - 10, pageW, 10, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text('Dealer Intelligence Dashboard — Confidential', margin, pageH - 3.5)
    doc.text(`Page ${i} of ${totalPages}`, pageW - margin, pageH - 3.5, { align: 'right' })
  }

  return doc
}

/**
 * Trigger browser download for a jsPDF instance.
 */
export function downloadPDF(doc, filename) {
  doc.save(filename)
}

/**
 * Get PDF as base64 string (for emailing via Worker).
 */
export function pdfToBase64(doc) {
  return doc.output('datauristring').split(',')[1]
}
