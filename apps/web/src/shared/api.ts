import type { ApiResponse, CreateTaskInput, DashboardSummary, DemoAccount, DemoContext, HealthStatus, MyTaskItem, PageResponse, PointSummary, TaskDetail, TaskListItem } from '@xlyq/shared';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, {
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      ...init,
    });
    if (!response.ok) {
      throw new Error(`请求失败：${response.status}`);
    }
    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${url} ${error.message}`);
    }
    throw error;
  }
}

export function getHealth() {
  return request<ApiResponse<HealthStatus>>('/api/v1/health');
}

export function getOperatorDashboard() {
  return request<ApiResponse<DashboardSummary>>('/api/v1/dashboards/operator');
}

export function getTasks() {
  return request<PageResponse<TaskListItem>>('/api/v1/tasks?pageNo=1&pageSize=20');
}

export function getTaskMarket(viewerId?: string, viewerRole?: string) {
  const params = new URLSearchParams({ pageNo: '1', pageSize: '20' });
  if (viewerId) params.set('viewerId', viewerId);
  if (viewerRole) params.set('viewerRole', viewerRole);
  return request<PageResponse<TaskListItem>>(`/api/v1/task-market?${params.toString()}`);
}

export function bootstrapDemo() {
  return request<ApiResponse<DemoContext>>('/api/v1/demo/bootstrap', { method: 'POST' });
}

export function login(input: { username: string; password: string }) {
  return request<ApiResponse<DemoAccount>>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getTaskDetail(id: string, viewerId?: string, viewerRole?: string) {
  const params = new URLSearchParams();
  if (viewerId) params.set('viewerId', viewerId);
  if (viewerRole) params.set('viewerRole', viewerRole);
  const query = params.toString();
  return request<ApiResponse<TaskDetail>>(`/api/v1/tasks/${id}${query ? `?${query}` : ''}`);
}

export function claimTask(taskId: string, userId: string) {
  return request<ApiResponse<{ id: string; status: string; rewardPoints: number }>>(`/api/v1/tasks/${taskId}/claims`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export function submitTask(input: { claimId: string; userId: string; linkUrl: string; textContent?: string; screenshots: string[] }) {
  return request<ApiResponse<{ id: string; status: string }>>('/api/v1/task-submissions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function reviewSubmission(id: string, input: { approved: boolean; reviewerId: string; comment?: string }) {
  return request<ApiResponse<{ id: string; status: string }>>(`/api/v1/task-submissions/${id}/review`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getPoints(userId: string) {
  return request<ApiResponse<PointSummary>>(`/api/v1/point-accounts/${userId}`);
}

export function getMyTasks(userId: string) {
  return request<ApiResponse<MyTaskItem[]>>(`/api/v1/users/${userId}/tasks`);
}

export function createTask(input: CreateTaskInput) {
  return request<ApiResponse<TaskListItem>>('/api/v1/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function publishTask(taskId: string) {
  return request<ApiResponse<TaskListItem>>(`/api/v1/tasks/${taskId}/publish`, { method: 'POST' });
}

export function unpublishTask(taskId: string) {
  return request<ApiResponse<TaskListItem>>(`/api/v1/tasks/${taskId}/unpublish`, { method: 'POST' });
}

export function remindTask(taskId: string, input: { operatorId: string; message?: string }) {
  return request<ApiResponse<{ taskId: string; recipientCount: number; message: string; sentAt: string }>>(`/api/v1/tasks/${taskId}/remind`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateSubmission(id: string, input: { userId: string; linkUrl: string; textContent?: string; screenshots: string[] }) {
  return request<ApiResponse<{ id: string; status: string }>>(`/api/v1/task-submissions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}
