import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatPhone(phone: string) {
  return phone.replace(/(\+\d{2})(\d{5})(\d{5})/, '$1 $2 $3');
}

export function langLabel(code: string) {
  const map: Record<string, string> = { EN: 'English', HI: 'Hindi', PA: 'Punjabi' };
  return map[code] || code;
}