const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function fetchAPI(endpoint: string, options?: RequestInit) {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}

// Findings API
export const findingsAPI = {
  getAll: (filters?: any) => fetchAPI('/findings', { 
    method: 'POST',
    body: JSON.stringify(filters)
  }),
  getById: (id: string) => fetchAPI(`/findings/${id}`),
  resolve: (id: string, resolvedBy: string) => fetchAPI(`/findings/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ resolvedBy })
  }),
  getStats: () => fetchAPI('/findings/stats/summary'),
  getMTTR: () => fetchAPI('/findings/stats/mttr'),
};

// Compliance API
export const complianceAPI = {
  getStatus: (framework?: string) => fetchAPI(`/compliance/status?framework=${framework || ''}`),
  getFrameworks: () => fetchAPI('/compliance/frameworks'),
  getControls: (framework: string) => fetchAPI(`/compliance/controls?framework=${framework}`),
  getScore: (framework: string, service?: string) => 
    fetchAPI(`/compliance/score?framework=${framework}${service ? `&service=${service}` : ''}`),
};

// Approvals API
export const approvalsAPI = {
  requestDeployment: (data: any) => fetchAPI('/approvals/deployments', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  approve: (id: string, data: any) => fetchAPI(`/approvals/deployments/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  reject: (id: string, data: any) => fetchAPI(`/approvals/deployments/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getStatus: (id: string) => fetchAPI(`/approvals/deployments/${id}/status`),
  getPending: (service?: string) => fetchAPI(`/approvals/deployments?service=${service || ''}`),
  getHistory: "id" => fetchAPI(`/approvals/deployments/${id}/history`),
};

// Users API
export const usersAPI = {
  login: (email: string, password: string) => fetchAPI('/users/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }),
  register: (data: any) => fetchAPI('/users/register', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getProfile: (userId: string) => fetchAPI('/users/profile', {
    method: 'POST',
    body: JSON.stringify({ userId })
  }),
};
