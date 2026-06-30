/**
 * Data Import utilities for bulk uploads and restoration
 */

export const importFromJSON = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        resolve(data)
      } catch (error) {
        reject(new Error('Invalid JSON file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

export const importFromCSV = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const csv = e.target.result
        const lines = csv.split('\n').filter((line) => line.trim())
        const headers = parseCSVLine(lines[0])
        const data = lines.slice(1).map((line) => {
          const values = parseCSVLine(line)
          const obj = {}
          headers.forEach((header, index) => {
            obj[header] = values[index] || ''
          })
          return obj
        })
        resolve(data)
      } catch (error) {
        reject(new Error('Failed to parse CSV file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

const parseCSVLine = (line) => {
  const result = []
  let current = ''
  let insideQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        insideQuotes = !insideQuotes
      }
    } else if (char === ',' && !insideQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

const safeFloat = (val) => {
  const n = parseFloat(val)
  return isNaN(n) ? 0 : n
}

const safeInt = (val) => {
  const n = parseInt(val, 10)
  return isNaN(n) ? 0 : n
}

export const importCustomersFromCSV = (data) => {
  return data.map((row) => ({
    type: row['Type'] || row['type'] || 'regular',
    name: row['Name'] || row['name'] || 'Unnamed',
    phone: row['Phone'] || row['phone'] || '',
    email: row['Email'] || row['email'] || '',
    creditBalance: safeFloat(row['Credit Balance'] || row['creditBalance'] || 0),
    status: row['Status'] || row['status'] || 'active',
  }))
}

export const importInventoryFromCSV = (data) => {
  return data.map((row) => ({
    name: row['Name'] || row['name'] || 'Unnamed Item',
    colorSingle: safeFloat(row['Color Single'] || row['colorSingle'] || 0),
    colorDouble: safeFloat(row['Color Double'] || row['colorDouble'] || 0),
    bwSingle: safeFloat(row['B/W Single'] || row['bwSingle'] || 0),
    bwDouble: safeFloat(row['B/W Double'] || row['bwDouble'] || 0),
    stock: safeInt(row['Stock'] || row['stock'] || 0),
  }))
}

export const validateBackupFile = (data) => {
  if (!data.data) return false
  const required = ['business', 'customers', 'inventory', 'bills', 'payments', 'settings']
  return required.every((key) => key in data.data)
}

export const restoreFromBackup = (backupData) => {
  if (!validateBackupFile(backupData)) {
    throw new Error('Invalid backup file format')
  }
  return backupData.data
}
