import type { TaskListItem } from '@xlyq/shared';

type TaskWithRelations = {
  id: bigint;
  title: string;
  description: string | null;
  originalText?: string | null;
  taskType: string;
  platform: string;
  campaignName: string | null;
  status: string;
  quota: number;
  claimedCount: number;
  approvedCount: number;
  rewardPoints: number;
  dueAt: Date;
  organization: {
    id: bigint;
    name: string;
  };
  fundProduct: {
    id: bigint;
    name: string;
    code: string | null;
  } | null;
};

export function toTaskListItem(task: TaskWithRelations): TaskListItem {
  return {
    id: task.id.toString(),
    title: task.title,
    description: task.description,
    taskType: task.taskType,
    platform: task.platform,
    campaignName: task.campaignName,
    status: task.status as TaskListItem['status'],
    quota: task.quota,
    claimedCount: task.claimedCount,
    approvedCount: task.approvedCount,
    rewardPoints: task.rewardPoints,
    dueAt: task.dueAt.toISOString(),
    organization: {
      id: task.organization.id.toString(),
      name: task.organization.name,
    },
    fundProduct: task.fundProduct
      ? {
          id: task.fundProduct.id.toString(),
          name: task.fundProduct.name,
          code: task.fundProduct.code,
        }
      : null,
  };
}
