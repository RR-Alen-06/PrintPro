/**
 * Neutralize spreadsheet formula injection (=, +, -, @, tab, CR) and quote CSV cells.
 */
function sanitizeCSVCell(cell: string | number | null | undefined): string {
  if (cell === null || cell === undefined) return '""';
  let str = String(cell);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Utility for exporting and downloading tabular data as CSV files.
 */
export function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): void {
  const csvContent = [
    headers.map((h) => sanitizeCSVCell(h)).join(','),
    ...rows.map((row) => row.map((cell) => sanitizeCSVCell(cell)).join(',')),
  ].join('\n');

  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
