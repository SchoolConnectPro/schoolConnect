'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Papa from 'papaparse';
import { api, Class } from '@/lib/api';
import { Upload, Download, FileText, X, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'students' | 'teachers';

interface ParsedRow {
  raw: Record<string, string>;
  errors: string[];
}

interface UploadResult {
  total: number;
  success: number;
  failed: number;
  errors: { row: number; name: string; error: string }[];
}

const STUDENT_HEADERS = ['studentName', 'rollNumber', 'grade', 'section', 'parentName', 'parentPhone', 'languagePreference'];
const TEACHER_HEADERS = ['name', 'phone', 'subject', 'schoolId', 'classIds'];

function buildCSV(headers: string[], rows: string[][]): string {
  return [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
}

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function validateStudentRow(row: Record<string, string>): string[] {
  const errs: string[] = [];
  if (!row.studentName?.trim()) errs.push('studentName is required');
  if (!row.grade?.trim()) errs.push('grade is required');
  if (!row.section?.trim()) errs.push('section is required');
  if (!row.parentName?.trim()) errs.push('parentName is required');
  if (!row.parentPhone?.trim()) errs.push('parentPhone is required');
  else if (!/^\+\d{7,15}$/.test(row.parentPhone.trim())) errs.push('parentPhone must start with + and country code');
  if (row.languagePreference && !['EN', 'HI', 'PA'].includes(row.languagePreference.trim().toUpperCase()))
    errs.push('languagePreference must be EN, HI, or PA');
  return errs;
}

function validateTeacherRow(row: Record<string, string>): string[] {
  const errs: string[] = [];
  if (!row.name?.trim()) errs.push('name is required');
  if (!row.phone?.trim()) errs.push('phone is required');
  else if (!/^\+\d{7,15}$/.test(row.phone.trim())) errs.push('phone must start with + and country code');
  if (!row.schoolId?.trim()) errs.push('schoolId is required');
  return errs;
}

export default function UploadPage() {
  const [tab, setTab] = useState<Tab>('students');
  const [classes, setClasses] = useState<Class[]>([]);

  useEffect(() => {
    api.classes.list().then(setClasses).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <strong>Why separate CSV files?</strong> SchoolConnect uses <strong>2 separate CSVs</strong>:
          one for <strong>Students + Parents</strong> (created together via one API call) and one for <strong>Teachers</strong>.
          Students and parents are always linked — each student has exactly one parent record.
          Teachers are independent entities linked to a school. Separate files let you update each independently.
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['students', 'teachers'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-5 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === t ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            )}
          >
            {t === 'students' ? '👨‍🎓 Students & Parents' : '👩‍🏫 Teachers'}
          </button>
        ))}
      </div>

      {tab === 'students' && <StudentUpload classes={classes} />}
      {tab === 'teachers' && <TeacherUpload classes={classes} />}
    </div>
  );
}

// ─── Student Upload Panel ─────────────────────────────────────────────────────

function StudentUpload({ classes }: { classes: Class[] }) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const parseFile = (file: File) => {
    setFileName(file.name);
    setResult(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const parsed = res.data.map((raw) => ({
          raw,
          errors: validateStudentRow(raw),
        }));
        setRows(parsed);
      },
    });
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.csv')) parseFile(file);
  }, []);

  const upload = async () => {
    const valid = rows.filter((r) => r.errors.length === 0);
    setUploading(true);
    setProgress(0);
    const result: UploadResult = { total: valid.length, success: 0, failed: 0, errors: [] };

    for (let i = 0; i < valid.length; i++) {
      const row = valid[i].raw;
      // Resolve classId from grade+section
      const cls = classes.find(
        (c) => String(c.grade) === row.grade?.trim() && c.section === row.section?.trim().toUpperCase()
      );
      if (!cls) {
        result.failed++;
        result.errors.push({ row: i + 2, name: row.studentName, error: `Class Grade ${row.grade} Section ${row.section} not found` });
        setProgress(Math.round(((i + 1) / valid.length) * 100));
        continue;
      }
      try {
        await api.students.create({
          studentName: row.studentName.trim(),
          rollNumber: row.rollNumber?.trim() || undefined,
          classId: cls.id,
          parentName: row.parentName.trim(),
          parentPhone: row.parentPhone.trim(),
          languagePreference: row.languagePreference?.trim().toUpperCase() || 'EN',
        });
        result.success++;
      } catch (e: unknown) {
        result.failed++;
        result.errors.push({
          row: i + 2,
          name: row.studentName,
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
      setProgress(Math.round(((i + 1) / valid.length) * 100));
    }

    setResult(result);
    setUploading(false);
  };

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const errorCount = rows.filter((r) => r.errors.length > 0).length;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Format Guide */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">students.csv — Format Guide</h2>
          <button
            onClick={() => downloadCSV('students_template.csv', buildCSV(STUDENT_HEADERS, [
              ['Arjun Sharma', '2024-A-01', '5', 'A', 'Rajesh Sharma', '+919876543210', 'HI'],
              ['Priya Patel', '2024-A-02', '5', 'A', 'Meena Patel', '+919876543211', 'EN'],
              ['Rohan Singh', '2024-B-01', '5', 'B', 'Gurpreet Singh', '+919876543212', 'PA'],
              ['Ananya Gupta', '', '6', 'A', 'Suresh Gupta', '+919876543213', 'EN'],
            ]))}
            className="btn-secondary text-xs"
          >
            <Download className="w-3.5 h-3.5" /> Download Template
          </button>
        </div>

        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="table-th">Column</th>
              <th className="table-th">Required</th>
              <th className="table-th">Description</th>
              <th className="table-th">Example</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['studentName', true, 'Full name of student', 'Arjun Sharma'],
              ['rollNumber', false, 'Roll number / student ID', '2024-A-01'],
              ['grade', true, 'Class grade number', '5'],
              ['section', true, 'Class section letter', 'A'],
              ['parentName', true, 'Parent / guardian full name', 'Rajesh Sharma'],
              ['parentPhone', true, 'WhatsApp number with country code', '+919876543210'],
              ['languagePreference', false, 'EN, HI, or PA (default: EN)', 'HI'],
            ].map(([col, req, desc, ex]) => (
              <tr key={col as string} className="hover:bg-gray-50">
                <td className="table-td font-mono text-indigo-700">{col as string}</td>
                <td className="table-td">
                  <span className={cn('badge', req ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600')}>
                    {req ? 'Required' : 'Optional'}
                  </span>
                </td>
                <td className="table-td text-gray-600">{desc as string}</td>
                <td className="table-td font-mono text-gray-500">{ex as string}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
          <p className="text-xs text-gray-400 mb-2 font-mono">Sample CSV:</p>
          <pre className="text-xs text-green-400 font-mono whitespace-pre">{`studentName,rollNumber,grade,section,parentName,parentPhone,languagePreference
Arjun Sharma,2024-A-01,5,A,Rajesh Sharma,+919876543210,HI
Priya Patel,2024-A-02,5,A,Meena Patel,+919876543211,EN
Rohan Singh,2024-B-01,5,B,Gurpreet Singh,+919876543212,PA
Ananya Gupta,,6,A,Suresh Gupta,+919876543213,EN`}</pre>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800 space-y-1">
          <p className="font-semibold">⚠️ Important Notes</p>
          <ul className="list-disc list-inside space-y-1 text-amber-700">
            <li>Phone numbers must include country code (e.g. <code>+91</code> for India)</li>
            <li>Each student gets exactly <strong>one parent</strong> — they are created together</li>
            <li><code>grade</code> + <code>section</code> must match an existing class in the system</li>
            <li>Language: <code>EN</code> = English, <code>HI</code> = Hindi, <code>PA</code> = Punjabi</li>
            <li>Duplicate parent phone numbers will cause an error</li>
          </ul>
        </div>

        {/* Available classes */}
        {classes.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">Available Classes (grade + section):</p>
            <div className="flex flex-wrap gap-2">
              {classes.map((c) => (
                <span key={c.id} className="badge bg-indigo-50 text-indigo-700 font-mono">
                  Grade {c.grade}{c.section}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Upload Zone */}
      <div className="space-y-4">
        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
            dragging ? 'border-indigo-500 bg-indigo-50 drop-active' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
          )}
        >
          <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">
            {fileName ? fileName : 'Drop students.csv here or click to browse'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Accepts .csv files only</p>
          <input ref={inputRef} type="file" accept=".csv" hidden onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])} />
        </div>

        {/* Preview */}
        {rows.length > 0 && (
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Preview — {rows.length} rows</h3>
              <div className="flex gap-2">
                <span className="badge bg-green-100 text-green-700">{validCount} valid</span>
                {errorCount > 0 && <span className="badge bg-red-100 text-red-700">{errorCount} errors</span>}
              </div>
            </div>

            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="table-th">#</th>
                    {STUDENT_HEADERS.map((h) => <th key={h} className="table-th">{h}</th>)}
                    <th className="table-th">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((row, i) => (
                    <tr key={i} className={row.errors.length > 0 ? 'bg-red-50' : ''}>
                      <td className="table-td text-gray-400">{i + 2}</td>
                      {STUDENT_HEADERS.map((h) => (
                        <td key={h} className="table-td font-mono">{row.raw[h] || '—'}</td>
                      ))}
                      <td className="table-td">
                        {row.errors.length === 0 ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <span title={row.errors.join(', ')}>
                            <XCircle className="w-4 h-4 text-red-500" />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 20 && <p className="text-xs text-gray-400 text-center py-2">Showing first 20 of {rows.length} rows</p>}
            </div>

            {/* Errors list */}
            {errorCount > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold text-red-700">Validation Errors (will be skipped):</p>
                {rows.filter((r) => r.errors.length > 0).slice(0, 5).map((r, i) => (
                  <p key={i} className="text-xs text-red-600">Row {rows.indexOf(r) + 2}: {r.errors.join(', ')}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upload button */}
        {validCount > 0 && !result && (
          <div className="space-y-3">
            {uploading && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Uploading...</span><span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            <button
              onClick={upload}
              disabled={uploading}
              className="btn-primary w-full justify-center"
            >
              <Upload className="w-4 h-4" />
              {uploading ? `Uploading... ${progress}%` : `Upload ${validCount} Students & Parents`}
            </button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={cn('card p-5 space-y-3', result.failed === 0 ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50')}>
            <div className="flex items-center gap-2">
              {result.failed === 0 ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              )}
              <h3 className="font-semibold text-gray-900">Upload Complete</h3>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white rounded-lg p-3">
                <p className="text-2xl font-bold text-gray-900">{result.total}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
              <div className="bg-white rounded-lg p-3">
                <p className="text-2xl font-bold text-green-600">{result.success}</p>
                <p className="text-xs text-gray-500">Imported</p>
              </div>
              <div className="bg-white rounded-lg p-3">
                <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                <p className="text-xs text-gray-500">Failed</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-700">Errors:</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">Row {e.row} ({e.name}): {e.error}</p>
                ))}
              </div>
            )}
            <button onClick={() => { setRows([]); setFileName(''); setResult(null); }} className="btn-secondary text-xs w-full justify-center">
              Upload Another File
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Teacher Upload Panel ─────────────────────────────────────────────────────

function TeacherUpload({ classes }: { classes: Class[] }) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const parseFile = (file: File) => {
    setFileName(file.name);
    setResult(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        setRows(res.data.map((raw) => ({ raw, errors: validateTeacherRow(raw) })));
      },
    });
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.csv')) parseFile(file);
  }, []);

  const upload = async () => {
    const valid = rows.filter((r) => r.errors.length === 0);
    setUploading(true);
    setProgress(0);
    const result: UploadResult = { total: valid.length, success: 0, failed: 0, errors: [] };

    for (let i = 0; i < valid.length; i++) {
      const row = valid[i].raw;
      const classIds = row.classIds?.trim()
        ? row.classIds.split('|').map((s) => s.trim()).filter(Boolean)
        : undefined;
      try {
        await api.teachers.create({
          name: row.name.trim(),
          phone: row.phone.trim(),
          subject: row.subject?.trim() || undefined,
          schoolId: row.schoolId.trim(),
          classIds,
        });
        result.success++;
      } catch (e: unknown) {
        result.failed++;
        result.errors.push({
          row: i + 2,
          name: row.name,
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
      setProgress(Math.round(((i + 1) / valid.length) * 100));
    }

    setResult(result);
    setUploading(false);
  };

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const errorCount = rows.filter((r) => r.errors.length > 0).length;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Format Guide */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">teachers.csv — Format Guide</h2>
          <button
            onClick={() => downloadCSV('teachers_template.csv', buildCSV(TEACHER_HEADERS, [
              ['Mrs. Sunita Verma', '+919876500001', 'Mathematics', 'SCHOOL_ID_HERE', 'CLASS_ID_1|CLASS_ID_2'],
              ['Mr. Ramesh Kumar', '+919876500002', 'Science', 'SCHOOL_ID_HERE', 'CLASS_ID_3'],
              ['Ms. Priya Nair', '+919876500003', 'English', 'SCHOOL_ID_HERE', ''],
            ]))}
            className="btn-secondary text-xs"
          >
            <Download className="w-3.5 h-3.5" /> Download Template
          </button>
        </div>

        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="table-th">Column</th>
              <th className="table-th">Required</th>
              <th className="table-th">Description</th>
              <th className="table-th">Example</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['name', true, 'Full name of teacher', 'Mrs. Sunita Verma'],
              ['phone', true, 'WhatsApp number with country code', '+919876500001'],
              ['subject', false, 'Subject taught', 'Mathematics'],
              ['schoolId', true, 'School ID from system', 'clx1abc123'],
              ['classIds', false, 'Pipe-separated class IDs', 'clxA|clxB'],
            ].map(([col, req, desc, ex]) => (
              <tr key={col as string} className="hover:bg-gray-50">
                <td className="table-td font-mono text-indigo-700">{col as string}</td>
                <td className="table-td">
                  <span className={cn('badge', req ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600')}>
                    {req ? 'Required' : 'Optional'}
                  </span>
                </td>
                <td className="table-td text-gray-600">{desc as string}</td>
                <td className="table-td font-mono text-gray-500">{ex as string}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
          <p className="text-xs text-gray-400 mb-2 font-mono">Sample CSV:</p>
          <pre className="text-xs text-green-400 font-mono whitespace-pre">{`name,phone,subject,schoolId,classIds
Mrs. Sunita Verma,+919876500001,Mathematics,clx1abc123,clxA|clxB
Mr. Ramesh Kumar,+919876500002,Science,clx1abc123,clxC
Ms. Priya Nair,+919876500003,English,clx1abc123,`}</pre>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800 space-y-1">
          <p className="font-semibold">⚠️ Important Notes</p>
          <ul className="list-disc list-inside space-y-1 text-amber-700">
            <li>Phone numbers must include country code (e.g. <code>+91</code> for India)</li>
            <li>Teachers use WhatsApp to send attendance & notifications</li>
            <li><code>schoolId</code> must match an existing school — get it from Settings page</li>
            <li>Multiple class IDs separated by pipe <code>|</code> character</li>
            <li>Leave <code>classIds</code> empty to assign classes later</li>
          </ul>
        </div>

        {/* Available classes for reference */}
        {classes.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">Class IDs for reference:</p>
            <div className="overflow-x-auto max-h-40">
              <table className="w-full text-xs">
                <thead><tr><th className="table-th">Grade</th><th className="table-th">Section</th><th className="table-th">Class ID</th></tr></thead>
                <tbody>
                  {classes.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="table-td">{c.grade}</td>
                      <td className="table-td">{c.section}</td>
                      <td className="table-td font-mono text-xs text-gray-500 select-all">{c.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Upload Zone */}
      <div className="space-y-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
            dragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
          )}
        >
          <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">
            {fileName ? fileName : 'Drop teachers.csv here or click to browse'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Accepts .csv files only</p>
          <input ref={inputRef} type="file" accept=".csv" hidden onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])} />
        </div>

        {rows.length > 0 && (
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Preview — {rows.length} rows</h3>
              <div className="flex gap-2">
                <span className="badge bg-green-100 text-green-700">{validCount} valid</span>
                {errorCount > 0 && <span className="badge bg-red-100 text-red-700">{errorCount} errors</span>}
              </div>
            </div>
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="table-th">#</th>
                    {TEACHER_HEADERS.map((h) => <th key={h} className="table-th">{h}</th>)}
                    <th className="table-th">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((row, i) => (
                    <tr key={i} className={row.errors.length > 0 ? 'bg-red-50' : ''}>
                      <td className="table-td text-gray-400">{i + 2}</td>
                      {TEACHER_HEADERS.map((h) => (
                        <td key={h} className="table-td font-mono">{row.raw[h] || '—'}</td>
                      ))}
                      <td className="table-td">
                        {row.errors.length === 0 ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <span title={row.errors.join(', ')}>
                            <XCircle className="w-4 h-4 text-red-500" />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {errorCount > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold text-red-700">Validation Errors (will be skipped):</p>
                {rows.filter((r) => r.errors.length > 0).slice(0, 5).map((r, i) => (
                  <p key={i} className="text-xs text-red-600">Row {rows.indexOf(r) + 2}: {r.errors.join(', ')}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {validCount > 0 && !result && (
          <div className="space-y-3">
            {uploading && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Uploading...</span><span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            <button onClick={upload} disabled={uploading} className="btn-primary w-full justify-center">
              <Upload className="w-4 h-4" />
              {uploading ? `Uploading... ${progress}%` : `Upload ${validCount} Teachers`}
            </button>
          </div>
        )}

        {result && (
          <div className={cn('card p-5 space-y-3', result.failed === 0 ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50')}>
            <div className="flex items-center gap-2">
              {result.failed === 0 ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-yellow-600" />}
              <h3 className="font-semibold text-gray-900">Upload Complete</h3>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white rounded-lg p-3"><p className="text-2xl font-bold text-gray-900">{result.total}</p><p className="text-xs text-gray-500">Total</p></div>
              <div className="bg-white rounded-lg p-3"><p className="text-2xl font-bold text-green-600">{result.success}</p><p className="text-xs text-gray-500">Imported</p></div>
              <div className="bg-white rounded-lg p-3"><p className="text-2xl font-bold text-red-600">{result.failed}</p><p className="text-xs text-gray-500">Failed</p></div>
            </div>
            {result.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-700">Errors:</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">Row {e.row} ({e.name}): {e.error}</p>
                ))}
              </div>
            )}
            <button onClick={() => { setRows([]); setFileName(''); setResult(null); }} className="btn-secondary text-xs w-full justify-center">
              Upload Another File
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
