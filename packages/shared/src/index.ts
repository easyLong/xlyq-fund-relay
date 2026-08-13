export const TASK_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_PUBLISH: 'PENDING_PUBLISH',
  PUBLISHED: 'PUBLISHED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  UNPUBLISHED: 'UNPUBLISHED',
  EXPIRED: 'EXPIRED',
  CLOSED: 'CLOSED',
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

export const CLAIM_STATUS = {
  PENDING_SUBMIT: 'PENDING_SUBMIT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  REWORKING: 'REWORKING',
  APPROVED: 'APPROVED',
  INVALIDATED: 'INVALIDATED',
  ABANDONED: 'ABANDONED',
  EXPIRED: 'EXPIRED',
} as const;

export type ClaimStatus = (typeof CLAIM_STATUS)[keyof typeof CLAIM_STATUS];

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  PENDING_SUBMIT: '待提交',
  PENDING_REVIEW: '审核中',
  REWORKING: '待补充',
  APPROVED: '已通过',
  INVALIDATED: '已作废',
  ABANDONED: '已放弃',
  EXPIRED: '已过期',
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  DRAFT: '草稿',
  PENDING_PUBLISH: '待发布',
  PUBLISHED: '可领取',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  UNPUBLISHED: '已下架',
  EXPIRED: '已过期',
  CLOSED: '已关闭',
};

export interface ApiResponse<T> {
  data: T;
  requestId: string;
}

export interface PageMeta {
  pageNo: number;
  pageSize: number;
  total: number;
}

export interface PageResponse<T> {
  data: T[];
  page: PageMeta;
  requestId: string;
}

export interface TaskListItem {
  id: string;
  title: string;
  description?: string | null;
  taskType: string;
  platform: string;
  campaignName?: string | null;
  status: TaskStatus;
  quota: number;
  claimedCount: number;
  approvedCount: number;
  rewardPoints: number;
  dueAt: string;
  organization: {
    id: string;
    name: string;
  };
  fundProduct?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
}

export interface DashboardSummary {
  pendingPublish: number;
  published: number;
  inProgress: number;
  pendingReview: number;
  completed: number;
  expired: number;
  recentTasks: TaskListItem[];
  totalPoints: number;
  todayDue: number;
  taskStats: Array<{
    key: TaskStatus | 'PENDING_REVIEW';
    label: string;
    count: number;
  }>;
  actionQueue: OperatorAction[];
  customerSnapshot: CustomerSnapshot | null;
}

export interface OperatorAction {
  id: string;
  type: 'REVIEW_SUBMISSION' | 'PUBLISH_TASK' | 'EXPIRING_TASK' | 'EXPIRED_TASK';
  title: string;
  description: string;
  taskId: string;
  taskTitle: string;
  dueAt?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface CustomerSnapshot {
  organizationName: string;
  fundProductName: string;
  activeTasks: number;
  totalTasks: number;
  claimedCount: number;
  approvedCount: number;
  pendingReview: number;
  completionRate: number;
  availablePoints: number;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  database: 'ok' | 'error';
  checkedAt: string;
  message?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  originalText?: string;
  taskType: string;
  platform: string;
  campaignName?: string;
  organizationId: string;
  fundProductId?: string;
  quota: number;
  dueAt: string;
}

export interface DemoAccount {
  id: string;
  name: string;
  username: string;
  role: 'operator' | 'executor';
  availablePoints?: number;
}

export interface DemoContext {
  operator: DemoAccount;
  executors: Array<DemoAccount & { availablePoints: number }>;
  executor: DemoAccount & { availablePoints: number };
  organization: { id: string; name: string };
  fundProduct: { id: string; name: string; code: string };
}

export interface TaskDetail extends TaskListItem {
  originalText?: string | null;
  originalTextVisible?: boolean;
  submitRequirements?: Record<string, unknown> | null;
  complianceRequirements?: string | null;
  claims: Array<{
    id: string;
    userId: string;
    userName: string;
    status: string;
    claimedAt: string;
    submission?: {
      id: string;
      linkUrl?: string | null;
      textContent?: string | null;
      screenshots?: string[];
      status: string;
      reviewComment?: string | null;
      submittedAt: string;
    } | null;
  }>;
}

export interface MyTaskItem extends TaskListItem {
  claimId: string;
  claimStatus: ClaimStatus;
  claimedAt: string;
  submittedAt?: string | null;
  reviewComment?: string | null;
}

export interface PointSummary {
  availablePoints: number;
  frozenPoints: number;
  withdrawnPoints: number;
  cashValue: number;
}
