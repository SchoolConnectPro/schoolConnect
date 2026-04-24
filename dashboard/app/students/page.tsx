'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, Student, Class, PageMeta } from '@/lib/api';
import {
  GraduationCap, Search, CheckCircle, XCircle,
  Plus, Pencil, Trash2, X, AlertTriangle, Loader2,
  ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { langLabel } from '@/lib/utils';

type SortBy = 'name' | 'rollNumber' | 'grade' | 'parentName' | 'optedIn';
type SortOrder = 'asc' | 'desc';

interface Filters {
  search: string;
  classId: string;
  optedIn: '' | 'true' | 'false';
  sortBy: SortBy;
  sortOrder: SortOrder;
  page: number;
}

interface FormState {
  studentName: string;
  rollNumber: string;
  classId: string;
  parentName: string;
  parentPhone: string;
  languagePreference: 'EN' | 'HI' | 'PA';
}

const EMPTY_FORM: FormState = {
  studentName: '', rollNumber: '', classId: '',
  parentName: '', parentPhone: '', languagePreference: 'EN',
};

const LIMIT = 50;

// ─── Sort Header ──────────────────────────────────────────────────────────────

function SortHeader({ label, field, current, order, onClick }: {
  label: string; field: SortBy; current: SortBy; order: SortOrder;
  onClick: (f: SortBy) => void;
}) {
  const active = current === field;
  return (
    <th className="table-th cursor-pointer select-none hover:bg-gray-100 transition-colors"
      onClick={() => onClick(field)}>
      <span className="flex items-center gap-1">
        {label}
        {active
          ? order === 'asc'
            ? <ChevronUp className="w-3.5 h-3.5 text-indigo-600" />
            : <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
          : <ChevronsUpDown className="w-3.5 h-3.5 text-gray-300" />}
      </span>
    </th>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ meta, onPage }: { meta: PageMeta; onPage: (p: number) => void }) {
  const { page, totalPages, total, limit } = meta;
  if (totalPages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const range = new Set<number>();
  [1, 2, page - 1, page, page + 1, totalPages - 1, totalPages].forEach((p) => {
    if (p >= 1 && p <= totalPages) range.add(p);
  });
  const sorted = Array.from(range).sort((a, b) => a - b);
  const pages: (number | '...')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) pages.push('...');
    pages.push(p);
  });

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
      <p className="text-sm text-gray-500">
        Showing <span className="font-medium">{from}–{to}</span> of{' '}
        <span className="font-medium">{total.toLocaleString()}</span> students
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page === 1}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pages.map((p, i) =>
          p === '...'
            ? <span key={`e${i}`} className="px-1 text-gray-400 text-sm">…</span>
            : <button key={p} onClick={() => onPage(p as number)}
                className={`min-w-[32px] h-8 rounded-lg text-sm font-medium transition-colors ${
                  p === page ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-200'
                }`}>{p}</button>
        )}
        <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

function StudentModal({ mode, initial, classes, onSave, onClose }: {
  mode: 'add' | 'edit'; initial?: Student; classes: Class[];
  onSave: (data: FormState) => Promise<void>; onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(
    initial ? {
      studentName: initial.name, rollNumber: initial.rollNumber || '',
      classId: initial.classId, parentName: initial.parent?.name || '',
      parentPhone: initial.parent?.phone || '',
      languagePreference: (initial.parent?.languagePreference as 'EN' | 'HI' | 'PA') || 'EN',
    } : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.studentName.trim()) { setError('Student name is required'); return; }
    if (!form.classId) { setError('Class is required'); return; }
    if (!form.parentName.trim()) { setError('Parent name is required'); return; }
    if (!form.parentPhone.trim()) { setError('Parent phone is required'); return; }
    setSaving(true); setError(null);
    try { await onSave(form); onClose(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{mode === 'add' ? 'Add Student' : 'Edit Student'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Student</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input className="input w-full" placeholder="e.g. Arjun Sharma"
                  value={form.studentName} onChange={(e) => set('studentName', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number</label>
                <input className="input w-full" placeholder="e.g. 2024-A-01"
                  value={form.rollNumber} onChange={(e) => set('rollNumber', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class *</label>
                <select className="input w-full" value={form.classId} onChange={(e) => set('classId', e.target.value)}>
                  <option value="">Select class…</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>Grade {c.grade}{c.section}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Parent / Guardian</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input className="input w-full" placeholder="e.g. Rajesh Sharma"
                  value={form.parentName} onChange={(e) => set('parentName', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Phone *</label>
                <input className="input w-full" placeholder="+919876543210"
                  value={form.parentPhone} onChange={(e) => set('parentPhone', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                <select className="input w-full" value={form.languagePreference}
                  onChange={(e) => set('languagePreference', e.target.value as 'EN' | 'HI' | 'PA')}>
                  <option value="EN">English</option>
                  <option value="HI">Hindi</option>
                  <option value="PA">Punjabi</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'add' ? 'Add Student' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirmation ──────────────────────────────────────────────────────

function DeleteDialog({ student, onConfirm, onClose }: {
  student: Student; onConfirm: () => Promise<void>; onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true); setError(null);
    try { await onConfirm(); onClose(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to delete'); setDeleting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Delete Student</h2>
            <p className="text-sm text-gray-500 mt-1">
              Are you sure you want to delete <strong>{student.name}</strong>?
              {student.parent && <> Parent <strong>{student.parent.name}</strong> will also be removed.</>}
            </p>
            <p className="text-xs text-red-600 mt-2 font-medium">
              This permanently deletes the student, parent, and all attendance records. This cannot be undone.
            </p>
          </div>
        </div>
        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ total: 0, page: 1, limit: LIMIT, totalPages: 0 });
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [optedInFilter, setOptedInFilter] = useState<'' | 'true' | 'false'>('');
  const [filters, setFilters] = useState<Filters>({
    search: '', classId: '', optedIn: '', sortBy: 'name', sortOrder: 'asc', page: 1,
  });
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<Student | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);

  const fetchStudents = useCallback(async (f: Filters) => {
    setLoading(true); setError(null);
    try {
      const result = await api.students.list({
        page: f.page, limit: LIMIT,
        search: f.search || undefined,
        classId: f.classId || undefined,
        optedIn: f.optedIn !== '' ? f.optedIn === 'true' : undefined,
        sortBy: f.sortBy, sortOrder: f.sortOrder,
      });
      setStudents(result.data);
      setMeta(result.meta);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { api.classes.list().then(setClasses).catch(() => {}); }, []);
  useEffect(() => { fetchStudents(filters); }, [filters, fetchStudents]);

  const applySearch = () => setFilters((f) => ({ ...f, search: searchInput.trim(), page: 1 }));
  const handleSearchKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') applySearch(); };

  const handleClassChange = (v: string) => {
    setClassFilter(v);
    setFilters((f) => ({ ...f, classId: v, page: 1 }));
  };

  const handleOptedInChange = (v: '' | 'true' | 'false') => {
    setOptedInFilter(v);
    setFilters((f) => ({ ...f, optedIn: v, page: 1 }));
  };

  const clearFilters = () => {
    setSearchInput(''); setClassFilter(''); setOptedInFilter('');
    setFilters({ search: '', classId: '', optedIn: '', sortBy: 'name', sortOrder: 'asc', page: 1 });
  };

  const handleSort = (field: SortBy) => {
    setFilters((f) => ({
      ...f, sortBy: field,
      sortOrder: f.sortBy === field && f.sortOrder === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  };

  const handleAdd = async (form: FormState) => {
    await api.students.create({
      studentName: form.studentName, rollNumber: form.rollNumber || undefined,
      classId: form.classId, parentName: form.parentName,
      parentPhone: form.parentPhone, languagePreference: form.languagePreference,
    });
    fetchStudents(filters);
  };

  const handleEdit = async (form: FormState) => {
    if (!editTarget) return;
    await api.students.update(editTarget.id, {
      studentName: form.studentName, rollNumber: form.rollNumber || undefined,
      classId: form.classId, parentName: form.parentName,
      parentPhone: form.parentPhone, languagePreference: form.languagePreference,
    });
    fetchStudents(filters);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api.students.delete(deleteTarget.id);
    fetchStudents(filters);
  };

  const hasActiveFilters = !!(filters.search || filters.classId || filters.optedIn);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Search with button */}
          <div className="flex-1 min-w-[220px] max-w-sm">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Student, parent, or roll no…"
                  value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchKeyDown} className="input pl-9 w-full" />
              </div>
              <button onClick={applySearch} className="btn-primary px-4 whitespace-nowrap">Search</button>
            </div>
          </div>

          {/* Class filter */}
          <div className="min-w-[150px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Class</label>
            <select className="input w-full" value={classFilter} onChange={(e) => handleClassChange(e.target.value)}>
              <option value="">All classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>Grade {c.grade}{c.section}</option>)}
            </select>
          </div>

          {/* Opted-in filter */}
          <div className="min-w-[130px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Opted In</label>
            <select className="input w-full" value={optedInFilter}
              onChange={(e) => handleOptedInChange(e.target.value as '' | 'true' | 'false')}>
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-end gap-2 ml-auto">
            {hasActiveFilters && (
              <button onClick={clearFilters} className="btn-secondary flex items-center gap-1.5 text-sm">
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
            <button onClick={() => setModal('add')} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Student
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <SortHeader label="Student" field="name" current={filters.sortBy} order={filters.sortOrder} onClick={handleSort} />
                <SortHeader label="Roll No." field="rollNumber" current={filters.sortBy} order={filters.sortOrder} onClick={handleSort} />
                <SortHeader label="Class" field="grade" current={filters.sortBy} order={filters.sortOrder} onClick={handleSort} />
                <SortHeader label="Parent" field="parentName" current={filters.sortBy} order={filters.sortOrder} onClick={handleSort} />
                <th className="table-th">Phone</th>
                <th className="table-th">Language</th>
                <SortHeader label="Opted In" field="optedIn" current={filters.sortBy} order={filters.sortOrder} onClick={handleSort} />
                <th className="table-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="table-td"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-td text-center py-12 text-gray-400">
                    <GraduationCap className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    {hasActiveFilters ? 'No students match your filters.' : 'No students yet. Upload a CSV or add one above.'}
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="table-td font-medium text-gray-900">{s.name}</td>
                    <td className="table-td font-mono text-gray-500 text-sm">{s.rollNumber || '—'}</td>
                    <td className="table-td">
                      {s.class
                        ? <span className="badge bg-indigo-50 text-indigo-700">Grade {s.class.grade}{s.class.section}</span>
                        : '—'}
                    </td>
                    <td className="table-td text-gray-600">{s.parent?.name || '—'}</td>
                    <td className="table-td font-mono text-sm text-gray-500">{s.parent?.phone || '—'}</td>
                    <td className="table-td">
                      <span className="badge bg-gray-100 text-gray-600">{langLabel(s.parent?.languagePreference || 'EN')}</span>
                    </td>
                    <td className="table-td">
                      {s.parent?.optedIn
                        ? <CheckCircle className="w-4 h-4 text-green-500" />
                        : <XCircle className="w-4 h-4 text-red-400" />}
                    </td>
                    <td className="table-td">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditTarget(s); setModal('edit'); }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteTarget(s)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination meta={meta} onPage={(p) => setFilters((f) => ({ ...f, page: p }))} />
      </div>

      {/* Modals */}
      {modal === 'add' && (
        <StudentModal mode="add" classes={classes} onSave={handleAdd} onClose={() => setModal(null)} />
      )}
      {modal === 'edit' && editTarget && (
        <StudentModal mode="edit" initial={editTarget} classes={classes} onSave={handleEdit}
          onClose={() => { setModal(null); setEditTarget(null); }} />
      )}
      {deleteTarget && (
        <DeleteDialog student={deleteTarget} onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}