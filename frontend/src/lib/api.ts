// Typed client for the SecureDeploy API.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export type Role = 'ADMIN' | 'SECURITY_LEAD' | 'DEVELOPER' | 'AUDITOR';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type FindingStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'IGNORED' | 'FALSE_POSITIVE';

export interface User { id: string; email: string; name: string; role: Role; services: string[]; createdAt: string }
export interface Mapping { id: string; framework: string; controlId: string; controlTitle: string; clause?: string; riskScore: number }
export interface Finding {
  id: string; tool: string; category: string; scanId: string; service: string; environment: string; severity: Severity; status: FindingStatus;
  title: string; description: string; filePath?: string; lineNumber?: number; cveId?: string; cvssScore?: number; packageName?: string;
  installedVersion?: string; fixedVersion?: string; remediation?: string; statusNote?: string; resolvedAt?: string; resolvedBy?: string;
  firstSeenAt: string; lastSeenAt: string; complianceMappings?: Mapping[];
}
export interface Deployment {
  id: string; service: string; environment: string; version: string; commitSha: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEPLOYED' | 'ROLLED_BACK';
  requestedBy: string; requestedAt: string; approvedBy?: string; rejectionReason?: string; gateBlocked: boolean;
  criticalCount: number; highCount: number; findingsCount: number; exceptions: string[]; exceptionReason?: string;
  approvals?: { id: string; decision: string; comments?: string; createdAt: string; approver?: { email: string; name: string } }[];
}
export interface Score { framework: string; score: number; totalControls: number; compliantControls: number; openFindings: number; totalFindings: number }
export interface Control { id: string; framework: string; title: string; clause: string; description: string; openFindings: number; maxRiskScore: number; compliant: boolean }
export interface Report { id: string; title: string; framework: string; startDate: string; endDate: string; generatedBy: string; generatedAt: string; findingsCount: number; complianceScore: number }

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function getToken(): string | null {
  try { return localStorage.getItem('sd.token'); } catch { return null; }
}
export function setToken(t: string | null) {
  try { if (t) localStorage.setItem('sd.token', t); else localStorage.removeItem('sd.token'); } catch { /* ignore */ }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.json !== undefined) headers.set('content-type', 'application/json');
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message || body.error || res.statusText;
    if (res.status === 401 && token) setToken(null);
    throw new ApiError(res.status, typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Downloads a binary endpoint (PDF report) with the auth header. */
export async function download(path: string, fallbackName: string) {
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: { authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new ApiError(res.status, 'Download failed');
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export const PRIVILEGED: Role[] = ['ADMIN', 'SECURITY_LEAD'];
