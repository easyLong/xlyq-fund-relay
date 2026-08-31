import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { tokenFromAuthorization, verifySessionToken, type SessionUser } from './session';

@Injectable()
export class SessionGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ method: string; path?: string; headers: { authorization?: string }; user?: unknown; params?: Record<string, string>; query?: Record<string, string>; body?: Record<string, unknown> }>();
    const path = request.path ?? '';
    if (path.endsWith('/health') || path.endsWith('/auth/login') || (path.endsWith('/demo/bootstrap') && process.env.ENABLE_DEMO_BOOTSTRAP !== 'false')) return true;
    const user = verifySessionToken(tokenFromAuthorization(request.headers.authorization));
    if (!user) throw new UnauthorizedException('登录状态已失效，请重新登录');
    this.authorize(request.method, path, user, request);
    request.user = user;
    return true;
  }

  private authorize(method: string, path: string, user: SessionUser, request: { params?: Record<string, string>; query?: Record<string, string>; body?: Record<string, unknown> }) {
    const paramUserId = request.params?.userId;
    const bodyUserId = typeof request.body?.userId === 'string' ? request.body.userId : undefined;
    const queryUserId = typeof request.query?.userId === 'string' ? request.query.userId : undefined;
    const requestedUserId = paramUserId ?? bodyUserId ?? queryUserId;
    if (requestedUserId && requestedUserId !== user.id) throw new ForbiddenException('无权操作其他用户的数据');

    const viewerId = request.query?.viewerId;
    const viewerRole = request.query?.viewerRole;
    if (viewerId && viewerId !== user.id) throw new ForbiddenException('无权查看其他用户的任务详情');
    if (viewerRole && viewerRole !== (user.role === 'OPERATOR' ? 'operator' : user.role === 'EXECUTOR' ? 'executor' : 'fund')) throw new ForbiddenException('无权使用其他角色查看数据');

    if (path.includes('/executor-accounts') || path.includes('/point-accounts/') || path.includes('/users/')) {
      if (user.role !== 'EXECUTOR') throw new ForbiddenException('仅兼职角色可访问该资源');
    }
    if (path.includes('/uploads/submission-screenshots') && user.role !== 'EXECUTOR') {
      throw new UnauthorizedException('Only executor users can upload submission screenshots');
    }
    if (path.includes('/fund-posts')) {
      if (method === 'GET' && !['OPERATOR', 'FUND'].includes(user.role)) throw new ForbiddenException('仅运营或基金角色可查看帖子');
      if (method !== 'GET' && user.role !== 'FUND') throw new ForbiddenException('仅基金角色可维护帖子');
      if (method === 'GET' && path.endsWith('/progress') && user.role !== 'FUND') throw new ForbiddenException('仅基金角色可查看进度');
      if (method === 'PUT' && typeof request.query?.userId === 'string' && request.query.userId !== user.id) throw new ForbiddenException('无权修改其他用户的帖子');
    }
    if (path.endsWith('/tasks') && !path.includes('/users/') && method === 'GET' && user.role !== 'OPERATOR') throw new ForbiddenException('仅运营角色可查看全部任务');
    if (/\/tasks\/\d+$/.test(path) && method === 'GET' && !['OPERATOR', 'EXECUTOR'].includes(user.role)) throw new ForbiddenException('仅运营或兼职角色可查看任务详情');
    if (path.includes('/dashboards/operator') || (path.endsWith('/tasks') || path.endsWith('/tasks/import')) && method === 'POST' || path.includes('/publish') || path.includes('/unpublish') || path.includes('/review') || path.includes('/remind')) {
      if (user.role !== 'OPERATOR') throw new ForbiddenException('仅运营角色可执行该操作');
    }
    if (path.includes('/task-market') || path.includes('/task-submissions') && method !== 'POST' || path.includes('/claims')) {
      if (user.role !== 'EXECUTOR') throw new ForbiddenException('仅兼职角色可执行该操作');
    }
    if (path.includes('/dashboards/fund') && user.role !== 'FUND') throw new ForbiddenException('仅基金角色可查看该看板');
    if (method === 'POST' && path.includes('/tasks/') && path.endsWith('/claims') && bodyUserId !== user.id) throw new ForbiddenException('无权代替其他兼职领取任务');
    if ((bodyUserId && ['POST', 'PUT'].includes(method)) && user.role !== 'EXECUTOR' && path.includes('/task-submissions')) throw new ForbiddenException('无权提交其他用户的任务结果');
    const reviewerId = typeof request.body?.reviewerId === 'string' ? request.body.reviewerId : undefined;
    const operatorId = typeof request.body?.operatorId === 'string' ? request.body.operatorId : undefined;
    if ((reviewerId ?? operatorId) && (reviewerId ?? operatorId) !== user.id) throw new ForbiddenException('无权使用其他运营账号操作');
  }
}
