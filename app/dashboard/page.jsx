'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { useTheme } from '@/components/ThemeProvider';

const STATUS_OPTIONS = ['Released', 'In Transit', 'Delivered'];

function StatusBadge({ status }) {
  const styles = {
    Released: { bg: 'var(--status-released-bg)', color: 'var(--status-released-text)', border: 'var(--status-released-border)', dot: 'var(--status-released-dot)' },
    'In Transit': { bg: 'var(--status-transit-bg)', color: 'var(--status-transit-text)', border: 'var(--status-transit-border)', dot: 'var(--status-transit-dot)' },
    Delivered: { bg: 'var(--status-delivered-bg)', color: 'var(--status-delivered-text)', border: 'var(--status-delivered-border)', dot: 'var(--status-delivered-dot)' },
  };
  const s = styles[status] || styles.Released;
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold">
      <span style={{ background: s.dot }} className="w-1.5 h-1.5 rounded-full" />
      {status}
    </span>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button onClick={toggleTheme} title="Toggle theme"
      style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
      className="w-9 h-9 flex items-center justify-center rounded-lg text-base hover:opacity-80 transition-opacity">
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}

function Spinner({ size = 'h-4 w-4' }) {
  return (
    <svg className={`animate-spin ${size} text-indigo-500`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

function UploadModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [personInCharge, setPersonInCharge] = useState('');
  const [status, setStatus] = useState('Released');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const handleFile = (f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) { setError('Upload a valid .xlsx, .xls, or .csv file.'); return; }
    setError(''); setFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return setError('Please select a file.');
    if (!personInCharge.trim()) return setError('Person in Charge is required.');
    setLoading(true); setError('');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];

      // Parse as a 2D array first to find the actual header row
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      let headerRowIdx = -1;

      for (let i = 0; i < aoa.length; i++) {
        const rowString = aoa[i].map(cell => String(cell).toLowerCase().replace(/\s/g, '')).join('|');
        if (rowString.includes('s/n') || rowString.includes('sn|') || rowString.includes('waybill') || rowString.includes('address')) {
          headerRowIdx = i;
          break;
        }
      }

      if (headerRowIdx === -1) {
        throw new Error('Could not find column headers (S/N, WAYBILLS, or ADDRESS) in the file.');
      }

      // Re-parse the sheet starting exactly at the header row
      const rows = XLSX.utils.sheet_to_json(sheet, { range: headerRowIdx, defval: '' });
      if (!rows.length) throw new Error('The file appears to have no data rows below the headers.');
      const res = await fetch('/api/records/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, personInCharge: personInCharge.trim(), status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="relative w-full max-w-md rounded-2xl shadow-2xl"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Add Upload</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Import records from Excel or CSV</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:opacity-70 transition-opacity">✕</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Dropzone */}
          <div onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            className="cursor-pointer rounded-xl p-6 text-center transition-all"
            style={{
              border: `2px dashed ${dragOver ? 'var(--accent)' : file ? 'var(--status-delivered-border)' : 'var(--border)'}`,
              background: dragOver ? 'var(--accent-subtle)' : file ? 'var(--status-delivered-bg)' : 'var(--bg-input)'
            }}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
            {file ? (
              <>
                <div className="text-2xl mb-1">✅</div>
                <p className="text-sm font-medium" style={{ color: 'var(--status-delivered-text)' }}>{file.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(1)} KB · Click to replace</p>
              </>
            ) : (
              <>
                <div className="text-3xl mb-2">📂</div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Drop file here or click to browse</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Supports .xlsx, .xls, .csv</p>
              </>
            )}
          </div>

          {/* Person in Charge */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>Person in Charge</label>
            <input type="text" value={personInCharge} onChange={(e) => setPersonInCharge(e.target.value)}
              placeholder="Enter name…" style={inputStyle}
              className="w-full px-3.5 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder:opacity-40" />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, backgroundImage: 'none' }}
              className="w-full px-3.5 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer appearance-none">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-lg text-sm"
              style={{ background: 'var(--status-released-bg)', border: '1px solid var(--status-released-border)', color: 'var(--status-released-text)' }}>
              <span>⚠</span><span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={loading}
              style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40">Cancel</button>
            <button type="submit" disabled={loading}
              style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', boxShadow: '0 0 20px var(--accent-glow)' }}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-60">
              {loading ? <span className="flex items-center justify-center gap-2"><Spinner />Uploading…</span> : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [records, setRecords] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterBatch, setFilterBatch] = useState('All');
  const [updatingId, setUpdatingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;
  const router = useRouter();

  // Extract unique batches from records for the filter dropdown
  const uniqueBatches = Array.from(new Set(records.map(r => r.batchId))).filter(Boolean).sort();

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch('/api/records');
      if (!res.ok) throw new Error();
      setRecords(await res.json());
    } catch { showToast('Failed to load records', 'error'); }
    finally { setFetching(false); }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleStatusChange = async (id, newStatus) => {
    setUpdatingId(id);
    try {
      const res = await fetch('/api/records', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setRecords((prev) => prev.map((r) => r._id === updated._id ? { ...r, status: updated.status } : r));
      showToast(`Status updated to "${newStatus}"`);
    } catch { showToast('Failed to update status', 'error'); }
    finally { setUpdatingId(null); }
  };

  const handleUploadSuccess = async (data) => {
    setShowModal(false);
    showToast(`${data.totalInserted} record(s) uploaded — ${data.batchId}`);
    await fetchRecords();
  };

  const handleDeleteBatch = async () => {
    if (filterBatch === 'All') return;
    if (!window.confirm(`Are you sure you want to delete all records in batch ${filterBatch}? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/records/bulk?batchId=${encodeURIComponent(filterBatch)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      showToast(`Deleted ${data.recordsDeleted} records from ${filterBatch}`);
      setFilterBatch('All'); // Reset filter after deletion
      await fetchRecords();
    } catch {
      showToast('Failed to delete batch', 'error');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const filtered = records.filter((r) => {
    const matchStatus = filterStatus === 'All' || r.status === filterStatus;
    const matchBatch = filterBatch === 'All' || r.batchId === filterBatch;
    const q = search.toLowerCase();
    const matchSearch = !q || [r.waybill, r.serialNumber, r.address, r.personInCharge, r.batchId]
      .some((v) => v?.toLowerCase().includes(q));
    return matchStatus && matchBatch && matchSearch;
  });

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterStatus, filterBatch]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedRecords = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIdx = (currentPage - 1) * pageSize;

  const stats = [
    { label: 'Total', value: records.length, icon: '📋', color: 'var(--stat-total-color)' },
    { label: 'Released', value: records.filter((r) => r.status === 'Released').length, icon: '🚀', color: 'var(--stat-released-color)' },
    { label: 'In Transit', value: records.filter((r) => r.status === 'In Transit').length, icon: '🚚', color: 'var(--stat-transit-color)' },
    { label: 'Delivered', value: records.filter((r) => r.status === 'Delivered').length, icon: '✅', color: 'var(--stat-delivered-color)' },
  ];

  const inputStyle = { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium"
          style={{
            background: toast.type === 'error' ? 'var(--status-released-bg)' : 'var(--status-delivered-bg)',
            border: `1px solid ${toast.type === 'error' ? 'var(--status-released-border)' : 'var(--status-delivered-border)'}`,
            color: toast.type === 'error' ? 'var(--status-released-text)' : 'var(--status-delivered-text)',
          }}>
          <span>{toast.type === 'error' ? '⚠' : '✓'}</span>{toast.message}
        </div>
      )}

      {showModal && <UploadModal onClose={() => setShowModal(false)} onSuccess={handleUploadSuccess} />}

      {/* Navbar */}
      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>📦</div>
            <div>
              <h1 className="text-base font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>LogiDMS</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Logistics Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />Admin Logged In
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button onClick={handleLogout} title="Log out"
                style={{ background: 'var(--status-released-bg)', border: '1px solid var(--border)', color: 'var(--status-released-text)' }}
                className="px-3 h-9 flex items-center justify-center rounded-lg text-xs font-semibold hover:opacity-80 transition-opacity">
                Log Out
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Manage and track all logistics manifests</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                <span className="text-xl">{s.icon}</span>
              </div>
              <div className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Table Card */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          {/* Controls */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 px-4 sm:px-6 py-4"
            style={{ borderBottom: '1px solid var(--border)' }}>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 sm:w-64 lg:w-72">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }}>🔍</span>
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search waybill, address…" style={inputStyle}
                  className="w-full pl-8 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder:opacity-40" />
              </div>

              <div className="flex gap-3 flex-1 sm:flex-none">
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                  style={{ ...inputStyle, backgroundImage: 'none' }}
                  className="w-full sm:w-auto px-3 py-2 rounded-lg text-sm focus:outline-none cursor-pointer appearance-none flex-1">
                  <option value="All">All Statuses</option>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>

                <select value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}
                  style={{ ...inputStyle, backgroundImage: 'none' }}
                  className="w-full sm:w-auto px-3 py-2 rounded-lg text-sm focus:outline-none cursor-pointer appearance-none flex-1">
                  <option value="All">All Batches</option>
                  {uniqueBatches.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full lg:w-auto">
              {filterBatch !== 'All' && (
                <button onClick={handleDeleteBatch}
                  style={{ background: 'var(--status-released-bg)', color: 'var(--status-released-text)', border: '1px solid var(--status-released-border)' }}
                  className="flex items-center justify-center px-4 py-2.5 sm:py-2 rounded-lg text-sm font-semibold hover:opacity-80 active:scale-95 transition-all whitespace-nowrap">
                  🗑️ Delete Batch
                </button>
              )}
              <button onClick={() => setShowModal(true)}
                style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', boxShadow: '0 0 20px var(--accent-glow)' }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 active:scale-95 transition-all whitespace-nowrap">
                <span>+</span> Add Upload
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>S/N</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Waybill</th>
                  <th className="hidden md:table-cell px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Address</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Person in Charge</th>
                  <th className="hidden lg:table-cell px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Batch ID</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Status</th>
                  <th className="hidden lg:table-cell px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Date / Time</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {fetching ? (
                  <tr><td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3"><Spinner size="h-7 w-7" />
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading records…</span></div>
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-4xl">📭</span>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {records.length === 0 ? 'No records yet. Upload a manifest to get started.' : 'No records match your search.'}
                      </p>
                    </div>
                  </td></tr>
                ) : (
                  paginatedRecords.map((record, idx) => (
                    <tr key={record._id} style={{ borderBottom: '1px solid var(--border)' }}
                      className="transition-colors hover:bg-[var(--bg-hover)]"
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = ''}>
                      <td className="px-4 py-3.5 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{record.serialNumber || startIdx + idx + 1}</td>
                      <td className="px-4 py-3.5 text-sm font-semibold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{record.waybill || '—'}</td>
                      <td className="hidden md:table-cell px-4 py-3.5 text-sm max-w-[200px] truncate" style={{ color: 'var(--text-secondary)' }}>{record.address || '—'}</td>
                      <td className="px-4 py-3.5 text-sm whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{record.personInCharge}</td>
                      <td className="hidden lg:table-cell px-4 py-3.5">
                        <span className="text-xs font-mono px-2 py-0.5 rounded-md"
                          style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>{record.batchId}</span>
                      </td>
                      <td className="px-4 py-3.5"><StatusBadge status={record.status} /></td>
                      <td className="hidden lg:table-cell px-4 py-3.5 text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                        {new Date(record.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5">
                        {updatingId === record._id ? (
                          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                            <Spinner /><span>Saving…</span>
                          </div>
                        ) : (
                          <select value={record.status} onChange={(e) => handleStatusChange(record._id, e.target.value)}
                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', backgroundImage: 'none' }}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer appearance-none hover:border-indigo-400/50 transition-colors">
                            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer / Pagination */}
          {!fetching && filtered.length > 0 && (
            <div className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Showing <span style={{ color: 'var(--text-secondary)' }} className="font-semibold">{startIdx + 1}</span> to{' '}
                <span style={{ color: 'var(--text-secondary)' }} className="font-semibold">{Math.min(startIdx + pageSize, filtered.length)}</span> of{' '}
                <span style={{ color: 'var(--text-secondary)' }} className="font-semibold">{filtered.length}</span> records
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-input)' }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-sm disabled:opacity-30 hover:opacity-80 transition-all active:scale-90">
                    ←
                  </button>

                  {/* Simple numeric pagination */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = currentPage - 2 + i;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        style={{
                          background: currentPage === pageNum ? 'var(--accent)' : 'var(--bg-input)',
                          color: currentPage === pageNum ? 'white' : 'var(--text-secondary)',
                          border: '1px solid var(--border)'
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold hover:opacity-80 transition-all">
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-input)' }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-sm disabled:opacity-30 hover:opacity-80 transition-all active:scale-90">
                    →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
