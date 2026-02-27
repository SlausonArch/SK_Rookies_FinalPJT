export interface Post {
  postId: number;
  memberId: number | null;
  authorName: string;
  title: string;
  content: string;
  attachmentUrl: string | null;
  notice: boolean;
  hidden: boolean;
  viewCount: number;
  likeCount: number;
  commentCount?: number;
  createdAt: string | null;
  updatedAt: string | null;
  canEdit: boolean;
  canDelete: boolean;
  userLiked?: boolean;
}

export interface Comment {
  commentId: number;
  memberId: number | null;
  authorName: string;
  content: string;
  createdAt: string | null;
  canDelete: boolean;
}

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const KST_TIME_ZONE = 'Asia/Seoul';

export function getAccessToken(): string | null {
  return localStorage.getItem('accessToken') || localStorage.getItem('token');
}

export function getAuthHeaders(token: string | null): Record<string, string> {
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

export function parseRoleFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized));
    if (typeof decoded.role === 'string') {
      return decoded.role;
    }
    return null;
  } catch {
    return null;
  }
}

export function formatDate(value: string | null): string {
  if (!value) {
    return '-';
  }

  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const hasTimezone = /([zZ]|[+\-]\d{2}:\d{2})$/.test(normalized);
  const date = new Date(hasTimezone ? normalized : `${normalized}Z`);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return date.toLocaleString('ko-KR', {
    timeZone: KST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function formatDateOnly(value: string | null): string {
  if (!value) {
    return '-';
  }

  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const hasTimezone = /([zZ]|[+\-]\d{2}:\d{2})$/.test(normalized);
  const date = new Date(hasTimezone ? normalized : `${normalized}Z`);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('ko-KR', {
    timeZone: KST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}
