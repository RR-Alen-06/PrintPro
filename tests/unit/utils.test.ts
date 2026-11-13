import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadCSV } from '@/lib/utils/csv';
import { formatCurrency, formatDateIndian } from '@/lib/utils/format';

describe('format utilities', () => {
  it('formats currency with default symbol and precision', () => {
    expect(formatCurrency(123.4)).toBe('₹123.40');
    expect(formatCurrency(null)).toBe('₹0.00');
    expect(formatCurrency('50', '$', 0)).toBe('$50');
  });

  it('formats Indian date strings and handles empty values', () => {
    expect(formatDateIndian(null)).toBe('');
    expect(formatDateIndian(undefined)).toBe('');
    const formatted = formatDateIndian('2026-11-13T10:30:00.000Z');
    expect(formatted).toContain('2026');
  });
});

describe('downloadCSV', () => {
  let capturedBlobText = '';
  let capturedFilename = '';

  beforeEach(() => {
    capturedBlobText = '';
    capturedFilename = '';

    class MockBlob {
      constructor(parts: BlobPart[]) {
        capturedBlobText = parts.map((p) => String(p)).join('');
      }
    }

    const mockLink = {
      setAttribute: vi.fn((k: string, v: string) => {
        if (k === 'download') capturedFilename = v;
      }),
      click: vi.fn(),
    };

    vi.stubGlobal('Blob', MockBlob);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal('document', {
      createElement: vi.fn(() => mockLink),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('neutralizes CSV formula injection prefixes (=, +, -, @, tab, CR) and quotes headers', () => {
    downloadCSV('report', ['Name, Role', '=Header'], [
      ['=CMD()', '+1234', '-500', '@SUM(A1)', 'Normal "Text"', null],
    ]);

    expect(capturedFilename).toBe('report.csv');
    const lines = capturedBlobText.replace(/^\uFEFF/, '').split('\n');
    expect(lines[0]).toBe('"Name, Role","\'=Header"');
    expect(lines[1]).toBe('"\'=CMD()","\'+1234","\'-500","\'@SUM(A1)","Normal ""Text""",""');
  });
});

