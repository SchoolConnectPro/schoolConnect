// ─── API client for SchoolConnect backend ───────────────────────────────────

export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('sc_api_base') || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000/api';
  }
  return process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000/api';
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const base = getApiBase();
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Request failed: ${res.status}`);
  }
  return json.data as T;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface School {
  id: string;
  name: string;
  whatsappNumber: string;
  _count?: { teachers: number; classes: number };
}

export interface Class {
  id: string;
  grade: number;
  section: string;
  schoolId: string;
  school?: { name: string };
  _count?: { students: number };
}

export interface Parent {
  id: string;
  name: string;
  phone: string;
  optedIn: boolean;
  languagePreference: 'EN' | 'HI' | 'PA';
  student?: Student;
}

export interface Student {
  id: string;
  name: string;
  rollNumber?: string;
  classId: string;
  class?: { grade: number; section: string };
  parent?: Parent;
}

export interface Teacher {
  id: string;
  name: string;
  phone: string;
  subject?: string;
  schoolId: string;
  school?: { name: string };
  classes?: { class: { grade: number; section: string } }[];
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  status: string;
  createdAt: string;
  targetClass?: { grade: number; section: string };
  createdByTeacher?: { name: string; phone: string };
  _count?: { messageLogs: number };
}

export interface AttendanceLog {
  id: string;
  status: string;
  createdAt: string;
  student?: {
    name: string;
    class?: { grade: number; section: string };
    parent?: { name: string; phone: string };
  };
  markedByTeacher?: { name: string };
}

// ─── API calls ───────────────────────────────────────────────────────────────

export const api = {
  schools: {
    list: () => request<School[]>('/schools'),
  },
  classes: {
    list: () => request<Class[]>('/classes'),
    parents: (id: string) => request<Parent[]>(`/classes/${id}/parents`),
  },
  students: {
    list: () => request<Student[]>('/students'),
    get: (id: string) => request<Student>(`/students/${id}`),
    create: (data: {
      studentName: string;
      rollNumber?: string;
      classId: string;
      parentName: string;
      parentPhone: string;
      languagePreference?: string;
    }) => request<Student>('/students', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: {
      studentName?: string;
      rollNumber?: string;
      classId?: string;
      parentName?: string;
      parentPhone?: string;
      languagePreference?: string;
    }) => request<Student>(`/students/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ id: string; name: string }>(`/students/${id}`, { method: 'DELETE' }),
  },
  teachers: {
    list: () => request<Teacher[]>('/teachers'),
    create: (data: {
      name: string;
      phone: string;
      subject?: string;
      schoolId: string;
      classIds?: string[];
    }) => request<Teacher>('/teachers', { method: 'POST', body: JSON.stringify(data) }),
  },
  parents: {
    list: (params?: { schoolId?: string; classId?: string; optedIn?: boolean }) => {
      const qs = new URLSearchParams();
      if (params?.schoolId) qs.set('schoolId', params.schoolId);
      if (params?.classId) qs.set('classId', params.classId);
      if (params?.optedIn !== undefined) qs.set('optedIn', String(params.optedIn));
      return request<Parent[]>(`/parents${qs.toString() ? '?' + qs.toString() : ''}`);
    },
    update: (id: string, data: { optedIn?: boolean; languagePreference?: string }) =>
      request<Parent>(`/parents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    optIn: (id: string, lang?: string) =>
      request<Parent>(`/parents/${id}/opt-in`, {
        method: 'POST',
        body: JSON.stringify(lang ? { languagePreference: lang } : {}),
      }),
    optOut: (id: string) =>
      request<Parent>(`/parents/${id}/opt-out`, { method: 'POST', body: '{}' }),
  },
  attendance: {
    list: () => request<AttendanceLog[]>('/attendance'),
  },
  notifications: {
    list: () => request<Notification[]>('/notifications'),
    get: (id: string) => request<Notification>(`/notifications/${id}`),
  },
  testMessage: (phone: string, message: string) =>
    request<{ messageSid: string }>('/test-message', {
      method: 'POST',
      body: JSON.stringify({ phone, message }),
    }),
};