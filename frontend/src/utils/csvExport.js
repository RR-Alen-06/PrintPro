export const exportToCSV = (filename, rows, headers) => {
  if (!rows || !rows.length) return

  const csvRows = []
  
  if (headers && headers.length) {
    csvRows.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','))
  }

  for (const row of rows) {
    const values = Array.isArray(row) ? row : Object.values(row)
    csvRows.push(values.map(val => {
      const sanitized = val === null || val === undefined ? '' : String(val)
      return `"${sanitized.replace(/"/g, '""')}"`
    }).join(','))
  }

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csvRows.join('\r\n'))
  const downloadAnchor = document.createElement('a')
  downloadAnchor.setAttribute('href', csvContent)
  downloadAnchor.setAttribute('download', `${filename || 'export'}.csv`)
  document.body.appendChild(downloadAnchor)
  downloadAnchor.click()
  document.body.removeChild(downloadAnchor)
}
