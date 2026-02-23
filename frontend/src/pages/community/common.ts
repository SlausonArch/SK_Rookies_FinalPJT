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

export const API_BASE = 'http://localhost:8080';

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

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return date.toLocaleString('ko-KR');
}
