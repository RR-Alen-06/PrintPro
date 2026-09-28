import React from 'react'
import { Hash, CheckCircle, Save } from 'lucide-react'

export interface SequenceConfigData {
  invPrefix: string
  cusPrefix: string
  itmPrefix: string
  payPrefix: string
  expPrefix: string
  grpPrefix: string
  cnPrefix: string
  seqPadding: number
}

interface SequencesTabProps {
  seqConfigs: SequenceConfigData
  setSeqConfigs: React.Dispatch<React.SetStateAction<SequenceConfigData>>
  handleSeqSave: (e: React.FormEvent) => Promise<void>
  seqSaved: boolean
}

export const SequencesTab: React.FC<SequencesTabProps> = ({
  seqConfigs,
  setSeqConfigs,
  handleSeqSave,
  seqSaved,
}) => {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            background: 'rgba(59, 130, 246, 0.15)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#3b82f6',
          }}
        >
          <Hash size={18} />
        </div>
        <div>
          <h2 style={{ margin: 0 }}>Sequence &amp; Human-Readable ID Format</h2>
          <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>
            Customize code prefixes and zero-padding across all registers.
          </p>
        </div>
      </div>

      <form onSubmit={handleSeqSave} autoComplete="off">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">Invoice / Bill Prefix</label>
            <input
              className="form-input"
              type="text"
              value={seqConfigs.invPrefix}
              onChange={(e) => setSeqConfigs((c) => ({ ...c, invPrefix: e.target.value.toUpperCase() }))}
              placeholder="INV"
              maxLength={8}
            />
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Preview:{' '}
              <code style={{ color: 'var(--accent)' }}>{`${seqConfigs.invPrefix || 'INV'}-${'1'.padStart(
                Number(seqConfigs.seqPadding) || 6,
                '0'
              )}`}</code>
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Customer Code Prefix</label>
            <input
              className="form-input"
              type="text"
              value={seqConfigs.cusPrefix}
              onChange={(e) => setSeqConfigs((c) => ({ ...c, cusPrefix: e.target.value.toUpperCase() }))}
              placeholder="CUS"
              maxLength={8}
            />
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Preview:{' '}
              <code style={{ color: 'var(--accent)' }}>{`${seqConfigs.cusPrefix || 'CUS'}-${'1'.padStart(
                Number(seqConfigs.seqPadding) || 6,
                '0'
              )}`}</code>
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Inventory Item Prefix</label>
            <input
              className="form-input"
              type="text"
              value={seqConfigs.itmPrefix}
              onChange={(e) => setSeqConfigs((c) => ({ ...c, itmPrefix: e.target.value.toUpperCase() }))}
              placeholder="ITM"
              maxLength={8}
            />
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Preview:{' '}
              <code style={{ color: 'var(--accent)' }}>{`${seqConfigs.itmPrefix || 'ITM'}-${'1'.padStart(
                Number(seqConfigs.seqPadding) || 6,
                '0'
              )}`}</code>
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Payment Receipt Prefix</label>
            <input
              className="form-input"
              type="text"
              value={seqConfigs.payPrefix}
              onChange={(e) => setSeqConfigs((c) => ({ ...c, payPrefix: e.target.value.toUpperCase() }))}
              placeholder="PAY"
              maxLength={8}
            />
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Preview:{' '}
              <code style={{ color: 'var(--accent)' }}>{`${seqConfigs.payPrefix || 'PAY'}-${'1'.padStart(
                Number(seqConfigs.seqPadding) || 6,
                '0'
              )}`}</code>
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Expense Entry Prefix</label>
            <input
              className="form-input"
              type="text"
              value={seqConfigs.expPrefix}
              onChange={(e) => setSeqConfigs((c) => ({ ...c, expPrefix: e.target.value.toUpperCase() }))}
              placeholder="EXP"
              maxLength={8}
            />
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Preview:{' '}
              <code style={{ color: 'var(--accent)' }}>{`${seqConfigs.expPrefix || 'EXP'}-${'1'.padStart(
                Number(seqConfigs.seqPadding) || 6,
                '0'
              )}`}</code>
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Group Invoice Prefix</label>
            <input
              className="form-input"
              type="text"
              value={seqConfigs.grpPrefix}
              onChange={(e) => setSeqConfigs((c) => ({ ...c, grpPrefix: e.target.value.toUpperCase() }))}
              placeholder="GRP"
              maxLength={8}
            />
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Preview:{' '}
              <code style={{ color: 'var(--accent)' }}>{`${seqConfigs.grpPrefix || 'GRP'}-${'1'.padStart(
                Number(seqConfigs.seqPadding) || 6,
                '0'
              )}`}</code>
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Credit Note / Return Prefix</label>
            <input
              className="form-input"
              type="text"
              value={seqConfigs.cnPrefix}
              onChange={(e) => setSeqConfigs((c) => ({ ...c, cnPrefix: e.target.value.toUpperCase() }))}
              placeholder="CN"
              maxLength={8}
            />
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Preview:{' '}
              <code style={{ color: 'var(--accent)' }}>{`${seqConfigs.cnPrefix || 'CN'}-${'1'.padStart(
                Number(seqConfigs.seqPadding) || 6,
                '0'
              )}`}</code>
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Zero-Padding Digits</label>
            <select
              className="form-select"
              value={seqConfigs.seqPadding}
              onChange={(e) => setSeqConfigs((c) => ({ ...c, seqPadding: Number(e.target.value) }))}
            >
              <option value={4}>4 digits (e.g. 0001)</option>
              <option value={5}>5 digits (e.g. 00001)</option>
              <option value={6}>6 digits (e.g. 000001)</option>
              <option value={8}>8 digits (e.g. 00000001)</option>
            </select>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Zero-padding width applied to newly generated codes.
            </p>
          </div>
        </div>

        {seqSaved && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              marginBottom: '12px',
              marginTop: '12px',
              background: 'var(--success-bg)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--success)',
              fontSize: '0.875rem',
            }}
          >
            <CheckCircle size={16} /> Sequence format settings saved!
          </div>
        )}

        <button type="submit" className="btn btn-primary" style={{ marginTop: '14px' }}>
          <Save size={16} /> Save Sequence Settings
        </button>
      </form>
    </div>
  )
}
export default SequencesTab
