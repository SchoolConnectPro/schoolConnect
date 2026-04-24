'use client';

import { useEffect, useState } from 'react';
import { api, Student, Class } from '@/lib/api';
import {
  GraduationCap, Search, RefreshCw, CheckCircle, XCircle,
  Plus, Pencil, Trash2, X, AlertTriangle, Loader2,
} from 'lucide-react';
import { langLabel } from '@/lib/utils';

interface FormState {
  studentName: string;
  rollNumber: string;
  classId: string;
  parentName: string;
  parentPhone: string;
  languagePreference: 'EN' | 'HI' | 'PA';
}

const EMPTY_FORM: FormState = {
  studentName: '',
  rollNumber: '',
  classId: '',
  parentName: '',
  parentPhone: '',
  languagePreference: 'EN',
};

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

function StudentModal({
  mode, initial, classes, onSave, onClose,
}: {
  mode: 'add' | 'edit';
  initial?: Student;
  classes: Class[];
  onSave: (data: FormState) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(
    initial
      ? {
          studentName: initial.name,
          rollNumber: initial.rollNumber || '',
          classId: initial.classId,
          parentName: initial.parent?.name || '',
          parentPhone: initial.parent?.phone || '',
          languagePreference: (initial.parent?.languagePreference as 'EN' | 'HI' | 'PA') || 'EN',
        }
      : EMPTY_FORM
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
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            {mode === 'add' ? 'Add Student' : 'Edit Student'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
          )}

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
                <select className="input w-full" value={form.classId}
                  onChange={(e) => set('classId', e.target.value)}>
                  <option value="">Select class…</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>Grade {c.grade}{c.section}</option>
                  ))}
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

function DeleteDialog({
  student, onConfirm, onClose,
}: {
  student: Student;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setDeleting(false);
    }
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

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
        )}

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
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<Student | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, c] = await Promise.all([api.students.list(), api.classes.list()]);
      setStudents(s);
      setClasses(c);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.parent?.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.rollNumber?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (form: FormState) => {
    const student = await api.students.create({
      studentName: form.studentName,
      rollNumber: form.rollNumber || undefined,
      classId: form.classId,
      parentName: form.parentName,
      parentPhone: form.parentPhone,
      languagePreference: form.languagePreference,
    });
    setStudents((prev) => [...prev, student].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const handleEdit = async (form: FormState) => {
    if (!editTarget) return;
    const updated = await api.students.update(editTarget.id, {
      studentName: form.studentName,
      rollNumber: form.rollNumber || undefined,
      classId: form.classId,
      parentName: form.parentName,
      parentPhone: form.parentPhone,
      languagePreference: form.languagePreference,
    });
    setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api.students.delete(deleteTarget.id);
    setStudents((prev) => prev.filter((s) => s.id !== deleteTarget.id));
  };

  const openEdit = (s: Student) => { setEditTarget(s); setModal('edit'); };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search students or parents…" value={search}
            onChange={(e) => setSearch(e.target.value)} className="input pl-9 w-full" />
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
        <span className="text-sm text-gray-500 hidden sm:block">{filtered.length} students</span>
        <button onClick={() => setModal('add')} className="btn-primary flex items-center gap-2 ml-auto">
          <Plus className="w-4 h-4" /> Add Student
        </button>
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
                <th className="table-th">Student</th>
                <th className="table-th">Roll No.</th>
                <th className="table-th">Class</th>
                <th className="table-th">Parent</th>
                <th className="table-th">Phone</th>
                <th className="table-th">Language</th>
                <th className="table-th">Opted In</th>
                <th className="table-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="table-td">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-td text-center py-12 text-gray-400">
                    <GraduationCap className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    {search ? 'No students match your search' : 'No students yet. Upload a CSV or add one above.'}
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 group">
                    <td className="table-td font-medium text-gray-900">{s.name}</td>
                    <td className="table-td font-mono text-gray-500 text-sm">{s.rollNumber || '—'}</td>
                    <td className="table-td">
                      {s.class ? (
                        <span className="badge bg-indigo-50 text-indigo-700">
                          Grade {s.class.grade}{s.class.section}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="table-td text-gray-600">{s.parent?.name || '—'}</td>
                    <td className="table-td font-mono text-sm text-gray-500">{s.parent?.phone || '—'}</td>
                    <td className="table-td">
                      <span className="badge bg-gray-100 text-gray-600">
                        {langLabel(s.parent?.languagePreference || 'EN')}
                      </span>
                    </td>
                    <td className="table-td">
                      {s.parent?.optedIn ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                    </td>
                    <td className="table-td">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(s)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Edit student"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(s)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete student"
                        >
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
      </div>

      {/* Add Modal */}
      {modal === 'add' && (
        <StudentModal
          mode="add"
          classes={classes}
          onSave={handleAdd}
          onClose={() => setModal(null)}
        />
      )}

      {/* Edit Modal */}
      {modal === 'edit' && editTarget && (
        <StudentModal
          mode="edit"
          initial={editTarget}
          classes={classes}
          onSave={handleEdit}
          onClose={() => { setModal(null); setEditTarget(null); }}
        />
      )}

      {/* Delete Dialog */}
      {deleteTarget && (
        <DeleteDialog
          student={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}