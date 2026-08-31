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

export const PLATFORM_OPTIONS = [
  '小红书',
  '微信公众号',
  '抖音',
  '微博',
  '招商银行',
  '建设银行',
  '蚂蚁财富',
  '理财通',
  '天天基金',
  '京东金融',
  '雪球',
  '同花顺',
] as const;

export type Platform = (typeof PLATFORM_OPTIONS)[number];

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
  fundTaskPost?: {
    id: string;
    taskName: string;
    platform: string;
    postTitle?: string | null;
    postUrl?: string | null;
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
  customerSnapshots: CustomerSnapshot[];
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
  organizationId?: string;
  fundProductId?: string | null;
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
  fundTaskPostId?: string;
  fundTaskId?: string;
}

export interface DemoAccount {
  id: string;
  name: string;
  username: string;
  role: 'operator' | 'executor' | 'fund';
  fundProductId?: string | null;
  availablePoints?: number;
  token?: string;
}

export interface DemoContext {
  operator: DemoAccount;
  executors: Array<DemoAccount & { availablePoints: number }>;
  executor: DemoAccount & { availablePoints: number };
  fund: DemoAccount;
  organization: { id: string; name: string };
  fundProduct: { id: string; name: string; code: string; organizationId?: string; organizationName?: string };
  fundProducts: Array<{ id: string; name: string; code: string; organizationId: string; organizationName: string }>;
}

export interface ExecutorAccount {
  id: string;
  platform: string;
  accountName: string;
  accountUid?: string | null;
  status: string;
  passwordSet: boolean;
}

export interface ExecutorAccountSummary {
  accounts: ExecutorAccount[];
  accountCount: number;
  activeTaskCount: number;
  availableTaskSlots: number;
}

export interface FundTaskPost {
  id: string;
  fundProductId: string;
  taskName: string;
  platform: string;
  postTitle?: string | null;
  postContent?: string | null;
  postUrl?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface FundTask {
  id: string;
  fundProductId: string;
  taskName: string;
  platform: string;
  status: string;
  postCount: number;
  posts: Array<{ id: string; title: string; content: string; url?: string | null; platform: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface FundDashboardSummary {
  taskCount: number;
  postCount: number;
  claimedCount: number;
  submittedCount: number;
  pendingReviewCount: number;
  approvedCount: number;
  tasks: Array<{
    id: string;
    taskName: string;
    platform: string;
    postCount: number;
    claimedCount: number;
    submittedCount: number;
    approvedCount: number;
    pendingReviewCount: number;
    completionRate: number;
  }>;
}

export interface FundTaskProgress {
  id: string;
  taskName: string;
  platform: string;
  postCount: number;
  publishedTaskCount: number;
  claimedCount: number;
  pendingSubmitCount: number;
  submittedCount: number;
  pendingReviewCount: number;
  reworkingCount: number;
  approvedCount: number;
  completionRate: number;
  status: string;
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
    executorAccountId?: string | null;
    executorAccountName?: string | null;
    fundTaskPostId?: string | null;
    fundTaskPostTitle?: string | null;
    fundTaskPostContent?: string | null;
    fundTaskPostUrl?: string | null;
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
  executorAccountId?: string | null;
  executorAccountName?: string | null;
  assignedPostTitle?: string | null;
  assignedPostContent?: string | null;
  assignedPostUrl?: string | null;
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

export interface NotificationItem {
  id: string;
  templateCode: string;
  title: string;
  content?: string | null;
  status: 'UNREAD' | 'READ';
  createdAt: string;
  readAt?: string | null;
  details?: {
    taskId?: string;
    claimId?: string;
    submissionId?: string;
    platform?: string;
    role?: string;
    [key: string]: unknown;
  } | null;
}

export interface NotificationSummary {
  unreadCount: number;
  items: NotificationItem[];
}
