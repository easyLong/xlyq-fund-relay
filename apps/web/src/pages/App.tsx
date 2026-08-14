import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CLAIM_STATUS_LABEL, PLATFORM_OPTIONS, TASK_STATUS_LABEL, type CreateTaskInput, type DashboardSummary, type DemoAccount, type FundTask, type FundTaskPost, type FundTaskProgress, type NotificationItem, type NotificationSummary, type TaskDetail, type TaskListItem } from '@xlyq/shared';
import { BarChart3, Bell, Building2, CheckCircle2, ClipboardCheck, ClipboardList, Clock3, Coins, Copy, ExternalLink, FileText, Home, ImagePlus, Layers, Link2, ListChecks, PencilLine, Plus, Send, ShieldCheck, Target, Trash2, UserRound, WalletCards, WifiOff, XCircle, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  bootstrapDemo,
  claimTask,
  createExecutorAccount,
  createFundPost,
  createTask,
  getHealth,
  getExecutorAccounts,
  getFundPosts,
  getFundTaskProgress,
  getOperatorDashboard,
  getMyTasks,
  getNotifications,
  getPoints,
  getTaskDetail,
  getTaskMarket,
  getTasks,
  login,
  markNotificationsRead,
  publishTask,
  remindTask,
  reviewSubmission,
  submitTask,
  unpublishTask,
  updateExecutorAccount,
  updateSubmission,
} from '../shared/api';

type Role = 'operator' | 'user' | 'fund';
type ActionKind = 'claim' | 'submit' | 'update' | 'approve' | 'reject' | 'publish' | 'unpublish' | 'remind';
type View = 'home' | 'tasks' | 'review' | 'mine';

const roleLabels: Record<Role, string> = { operator: '运营工作台', user: '执行工作台', fund: '基金内容工作台' };

function IconTitle({ icon: Icon, title, caption }: { icon: LucideIcon; title: string; caption?: string }) {
  return <div className="icon-title"><span className="section-icon"><Icon size={15} /></span><div><h2>{title}</h2>{caption ? <p className="section-caption">{caption}</p> : null}</div></div>;
}

function InlineIconText({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return <span className="inline-icon-text"><Icon size={12} />{children}</span>;
}

function withFundNamePrefix(title: string, fundName?: string | null) {
  const cleanTitle = title.trim();
  const cleanFundName = fundName?.trim();
  if (!cleanFundName || !cleanTitle) return cleanTitle;
  if (cleanTitle === cleanFundName || cleanTitle.startsWith(`${cleanFundName}｜`) || cleanTitle.startsWith(`${cleanFundName} - `) || cleanTitle.startsWith(`${cleanFundName}·`) || cleanTitle.startsWith(`${cleanFundName} `)) return cleanTitle;
  return `${cleanFundName}｜${cleanTitle}`;
}

function readStoredAccount(): DemoAccount | undefined {
  const raw = window.localStorage.getItem('xlyq_account');
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as DemoAccount;
  } catch {
    return undefined;
  }
}

export function App() {
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState(() => window.localStorage.getItem('xlyq_account_id') ?? '');
  const [sessionAccount, setSessionAccount] = useState<DemoAccount | undefined>(() => readStoredAccount());
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const [selectedClaimId, setSelectedClaimId] = useState<string>();
  const [demo, setDemo] = useState<Awaited<ReturnType<typeof bootstrapDemo>>['data']>();
  const [notice, setNotice] = useState<string>();
  const [showCreate, setShowCreate] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [operatorFundProductId, setOperatorFundProductId] = useState<string>();
  const [myTaskTab, setMyTaskTab] = useState<'available' | 'todo' | 'review' | 'done'>('available');
  const [view, setView] = useState<View>('home');

  const boot = useMutation({ mutationFn: bootstrapDemo, onSuccess: (result) => setDemo(result.data) });
  const auth = useMutation({ mutationFn: login, onSuccess: (result) => { queryClient.clear(); setSessionAccount(result.data); setAccountId(result.data.id); window.localStorage.setItem('xlyq_account', JSON.stringify(result.data)); window.localStorage.setItem('xlyq_account_id', result.data.id); if (result.data.token) window.localStorage.setItem('xlyq_session_token', result.data.token); setView('home'); setMyTaskTab('available'); setNotice(undefined); } });
  useEffect(() => { boot.mutate(); }, []);

  const health = useQuery({ queryKey: ['health'], queryFn: getHealth, retry: 1 });
  const accounts = demo ? [demo.operator, demo.fund, ...demo.executors] : [];
  const account = sessionAccount ?? accounts.find((item) => item.id === accountId);
  const role: Role = account?.role === 'operator' ? 'operator' : account?.role === 'fund' ? 'fund' : 'user';
  const executorId = account?.role === 'executor' ? account.id : undefined;
  const scopedFundProductId = account?.fundProductId ?? demo?.fundProduct.id;
  const operatorFundProducts = demo?.fundProducts?.length ? demo.fundProducts : demo ? [{ ...demo.fundProduct, organizationId: demo.organization.id, organizationName: demo.organization.name }] : [];
  const activeFundProductId = role === 'operator' ? (operatorFundProductId ?? operatorFundProducts[0]?.id) : scopedFundProductId;
  const dashboard = useQuery({ queryKey: ['operator-dashboard'], queryFn: getOperatorDashboard, retry: 1, enabled: Boolean(demo && role === 'operator') });
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: getTasks, retry: 1, enabled: Boolean(demo && role === 'operator') });
  const market = useQuery({ queryKey: ['task-market', executorId], queryFn: () => getTaskMarket(executorId, 'executor'), retry: 1, enabled: Boolean(demo && role === 'user'), refetchInterval: 8000 });
  const points = useQuery({ queryKey: ['points', executorId], queryFn: () => getPoints(executorId!), enabled: Boolean(executorId) });
  const myTasks = useQuery({ queryKey: ['my-tasks', executorId], queryFn: () => getMyTasks(executorId!), enabled: Boolean(executorId), refetchInterval: 12000 });
  const executorAccounts = useQuery({ queryKey: ['executor-accounts', executorId], queryFn: () => getExecutorAccounts(executorId!), enabled: Boolean(executorId) });
  const fundPosts = useQuery({ queryKey: ['fund-posts', activeFundProductId], queryFn: () => getFundPosts(activeFundProductId!), enabled: Boolean(activeFundProductId && ['operator', 'fund'].includes(role)) });
  const fundProgress = useQuery({ queryKey: ['fund-task-progress', account?.id, scopedFundProductId], queryFn: () => getFundTaskProgress(account!.id, scopedFundProductId!), enabled: Boolean(scopedFundProductId && role === 'fund' && account) });
  const detailViewerId = role === 'operator' ? account?.id : executorId;
  const detailViewerRole = role === 'operator' ? 'operator' : 'executor';
  const detail = useQuery({ queryKey: ['task-detail', selectedTaskId, detailViewerId, detailViewerRole], queryFn: () => getTaskDetail(selectedTaskId!, detailViewerId, detailViewerRole), enabled: Boolean(selectedTaskId && detailViewerId) });
  const notifications = useQuery({ queryKey: ['notifications', account?.id], queryFn: getNotifications, retry: 1, enabled: Boolean(account), refetchInterval: 45000 });

  const refresh = () => {
    for (const key of ['operator-dashboard', 'tasks', 'task-market', 'task-detail', 'points', 'my-tasks', 'executor-accounts', 'fund-posts', 'fund-task-progress', 'notifications']) void queryClient.invalidateQueries({ queryKey: [key] });
  };
  const action = useMutation({
    mutationFn: async (input: { kind: ActionKind; taskId?: string; submissionId?: string; claimId?: string; linkUrl?: string; textContent?: string; screenshots?: string[] }) => {
      if (input.kind === 'claim') return claimTask(input.taskId!, executorId!);
      if (input.kind === 'submit') return submitTask({ claimId: input.claimId!, userId: executorId!, linkUrl: input.linkUrl!, textContent: input.textContent, screenshots: input.screenshots ?? [] });
      if (input.kind === 'update') return updateSubmission(input.submissionId!, { userId: executorId!, linkUrl: input.linkUrl!, textContent: input.textContent, screenshots: input.screenshots ?? [] });
      if (input.kind === 'publish') return publishTask(input.taskId!);
      if (input.kind === 'unpublish') return unpublishTask(input.taskId!);
      if (input.kind === 'remind') return remindTask(input.taskId!, { operatorId: demo!.operator.id });
      return reviewSubmission(input.submissionId!, { approved: input.kind === 'approve', reviewerId: demo!.operator.id, comment: input.kind === 'approve' ? '内容与任务要求一致，审核通过。' : '请补充可访问的发布链接和内容截图。' });
    },
    onSuccess: (result, input) => {
      const payload = result.data as Record<string, unknown>;
      const claimCount = typeof payload.count === 'number' ? payload.count : 0;
      setNotice(input.kind === 'claim' ? `已领取 ${claimCount} 个名额，请按对应发布账号完成提交` : input.kind === 'submit' ? '结果已提交，等待运营审核' : input.kind === 'update' ? '提交材料已更新，等待运营审核' : input.kind === 'approve' ? '审核通过，积分已到账' : input.kind === 'reject' ? '已退回执行人员补充材料' : input.kind === 'unpublish' ? '任务已下架，兼职将无法继续领取' : input.kind === 'remind' ? '已提醒当前任务的执行人员' : '任务已发布');
      refresh();
      return;
      setNotice(input.kind === 'claim' ? '已领取任务，请完成发布后提交结果' : input.kind === 'submit' ? '结果已提交，等待运营审核' : input.kind === 'update' ? '提交材料已更新，等待运营审核' : input.kind === 'approve' ? '审核通过，积分已到账' : input.kind === 'reject' ? '已退回执行员补充材料' : input.kind === 'unpublish' ? '任务已下架，兼职将无法继续领取' : input.kind === 'remind' ? '已提醒当前任务的执行人员' : '任务已发布');
      refresh();
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : '操作失败，请稍后重试'),
  });
  const readNotifications = useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: (result) => queryClient.setQueryData(['notifications', account?.id], result),
  });

  const visibleTasks = role === 'operator' ? (tasks.data?.data ?? []) : (market.data?.data ?? []);
  const notificationSummary = notifications.data?.data;
  const unreadCount = notificationSummary?.unreadCount ?? 0;
  const myTaskRows = myTasks.data?.data ?? [];
  const operatorReviewCount = dashboard.data?.data.actionQueue.filter((action) => action.type === 'REVIEW_SUBMISSION').length ?? 0;
  const executorTodoCount = myTaskRows.filter((task) => ['PENDING_SUBMIT', 'REWORKING'].includes(task.claimStatus)).length;
  const executorReviewCount = myTaskRows.filter((task) => task.claimStatus === 'PENDING_REVIEW').length;
  const activeAccountCount = executorAccounts.data?.data.accounts.filter((item) => item.status === 'ACTIVE').length ?? 0;
  const claimingTaskId = action.isPending && action.variables?.kind === 'claim' ? action.variables.taskId : undefined;
  const navItems: Array<[View, string, LucideIcon, number?]> = role === 'fund'
    ? [['home', '首页', Home, fundProgress.data?.data.length ?? 0], ['mine', '我的', UserRound]]
    : role === 'operator'
      ? [['home', '首页', Home, dashboard.data?.data.actionQueue.length ?? 0], ['tasks', '任务', ClipboardList, tasks.data?.data.length ?? 0], ['review', '审核', ShieldCheck, operatorReviewCount], ['mine', '我的', UserRound]]
      : [['home', '可接', ClipboardList, visibleTasks.length], ['review', '进度', ShieldCheck, executorReviewCount], ['mine', '我的', UserRound, activeAccountCount]];
  const accountDescription = role === 'operator' ? '运营账号 · 发布任务、审核内容、管理结算' : role === 'fund' ? '基金账号 · 填报任务、查看执行进度' : '兼职账号 · 领取、发布、提交结果';
  const openTask = (taskId: string, claimId?: string) => { setSelectedClaimId(claimId); setSelectedTaskId(taskId); };
  const closeTask = () => { setSelectedClaimId(undefined); setSelectedTaskId(undefined); };
  const selectedClaim = selectedClaimId ? detail.data?.data.claims.find((claim) => claim.id === selectedClaimId) : detail.data?.data.claims.find((claim) => claim.userId === executorId);
  const pendingSubmission = detail.data?.data.claims.find((claim) => claim.submission?.status === 'PENDING_REVIEW')?.submission ?? undefined;

  const authenticate = (username: string, password: string) => {
    auth.mutate({ username, password });
  };

  const logout = () => {
    queryClient.clear();
    setSessionAccount(undefined);
    setAccountId('');
    window.localStorage.removeItem('xlyq_account');
    window.localStorage.removeItem('xlyq_account_id');
    window.localStorage.removeItem('xlyq_session_token');
    setSelectedClaimId(undefined);
    setSelectedTaskId(undefined);
    setNotice(undefined);
    setView('home');
  };

  useEffect(() => {
    const handleAuthExpired = () => {
      queryClient.clear();
      setSessionAccount(undefined);
      setAccountId('');
      window.localStorage.removeItem('xlyq_account');
      window.localStorage.removeItem('xlyq_account_id');
      window.localStorage.removeItem('xlyq_session_token');
      setSelectedClaimId(undefined);
      setSelectedTaskId(undefined);
      setView('home');
    };
    window.addEventListener('xlyq-auth-expired', handleAuthExpired);
    return () => window.removeEventListener('xlyq-auth-expired', handleAuthExpired);
  }, [queryClient]);

  if (!account) return <LoginPage loading={boot.isPending} submitting={auth.isPending} error={auth.error || boot.error} onLogin={authenticate} />;

  return <main className="app-shell">
    <header className="topbar"><div><div className="eyebrow">公募基金营销任务跟踪系统</div><h1>{roleLabels[role]}</h1></div><button className={`icon-button notification-button${unreadCount ? ' has-unread' : ''}`} aria-label={`消息通知${unreadCount ? `，${unreadCount} 条未读` : ''}`} type="button" onClick={() => setShowNotifications(true)}><Bell size={19} />{unreadCount ? <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}</button></header>
    {showNotifications ? <NotificationPanel summary={notificationSummary} loading={notifications.isLoading} marking={readNotifications.isPending} onClose={() => setShowNotifications(false)} onMarkAll={() => readNotifications.mutate()} onSelectTask={(taskId) => { setShowNotifications(false); openTask(taskId); }} /> : null}
    <section className="account-strip"><span className="identity-icon">{role === 'operator' ? <ClipboardCheck size={18} /> : role === 'fund' ? <ShieldCheck size={18} /> : <UserRound size={18} />}</span><span><strong>{account.name}</strong><small>{accountDescription}</small></span><button type="button" onClick={logout}>退出登录</button></section>
    <ServiceStatus loading={health.isLoading || boot.isPending} error={health.error || boot.error} status={health.data?.data.status} database={health.data?.data.database} />
    {notice ? <section className="notice-panel"><CheckCircle2 size={16} /><span>{notice}</span><button type="button" onClick={() => setNotice(undefined)} aria-label="关闭提示">×</button></section> : null}
    {view === 'home' && demo && role === 'operator' ? <OperatorHome summary={dashboard.data?.data} tasks={visibleTasks} loading={dashboard.isLoading} onSelect={openTask} onCreate={() => setShowCreate(true)} onViewTasks={() => setView('tasks')} onViewReview={() => setView('review')} /> : null}
    {view === 'home' && demo && role === 'user' ? <UserHome market={visibleTasks} myTasks={myTasks.data?.data ?? []} points={points.data?.data} tab={myTaskTab} onTabChange={setMyTaskTab} onSelect={openTask} onClaim={(taskId) => action.mutate({ kind: 'claim', taskId })} claimingTaskId={claimingTaskId} /> : null}
    {view === 'home' && demo && role === 'fund' && scopedFundProductId ? <FundPostWorkspaceV2 posts={fundPosts.data?.data ?? []} progress={fundProgress.data?.data ?? []} onCreate={async (input) => { await createFundPost(account.id, scopedFundProductId, input); refresh(); }} /> : null}
    {view === 'tasks' && demo ? <TaskWorkspace role={role} tasks={tasks.data?.data ?? []} market={market.data?.data ?? []} myTasks={myTasks.data?.data ?? []} onSelect={openTask} /> : null}
    {view === 'review' && demo ? <ReviewWorkspace role={role} tasks={tasks.data?.data ?? []} actions={dashboard.data?.data.actionQueue ?? []} myTasks={myTasks.data?.data ?? []} onSelect={openTask} /> : null}
    {view === 'mine' && demo ? <MineWorkspaceV3 role={role} accountName={account.name} username={account.username} points={points.data?.data} onLogout={logout} accountSummary={executorAccounts.data?.data} onAddAccount={executorId ? async (input) => { await createExecutorAccount(executorId, input); refresh(); } : undefined} /> : null}
    {!demo && !boot.isPending ? <section className="panel error-panel"><strong>演示数据初始化失败</strong><span>{boot.error?.message ?? '请刷新页面重试'}</span></section> : null}
    {selectedTaskId && detail.data?.data && role === 'operator' ? <CleanOperatorTaskDetailPage detail={detail.data.data} actionPending={action.isPending} onAction={(input) => action.mutate(input)} onClose={closeTask} /> : null}
    {selectedTaskId && detail.data?.data && role === 'user' && selectedClaim && ['PENDING_SUBMIT', 'REWORKING', 'PENDING_REVIEW'].includes(selectedClaim.status) ? <CleanSubmissionPage detail={detail.data.data} selectedClaim={selectedClaim} actionPending={action.isPending} onAction={(input) => action.mutate(input)} onClose={closeTask} /> : null}
    {selectedTaskId && detail.isLoading ? <section className="detail-loading" role="status">正在加载任务详情...</section> : null}
    {selectedTaskId && detail.error ? <section className="detail-loading detail-error" role="alert"><strong>任务详情加载失败</strong><span>{detail.error.message}</span><button type="button" onClick={() => void detail.refetch()}>重新加载</button></section> : null}
    {selectedTaskId && detail.data?.data && role === 'user' && !['PENDING_SUBMIT', 'REWORKING', 'PENDING_REVIEW'].includes(selectedClaim?.status ?? '') ? <CleanTaskDetailPanel detail={detail.data.data} selectedClaim={selectedClaim} accountSummary={executorAccounts.data?.data} actionPending={action.isPending} onAction={(input) => action.mutate(input)} onClose={closeTask} /> : null}
    {showCreate && demo ? <CreateTaskPanelV2 demo={demo} fundProducts={operatorFundProducts} selectedFundProductId={activeFundProductId ?? ''} onFundProductChange={setOperatorFundProductId} posts={fundPosts.data?.data ?? []} loadingPosts={fundPosts.isLoading} pending={action.isPending} onClose={() => setShowCreate(false)} onCreated={(task) => { setShowCreate(false); openTask(task.id); setNotice('任务已创建，名额已按帖子数量设置'); refresh(); }} onCreate={async (input) => createTask(input)} /> : null}
    <nav className="bottom-nav" aria-label="底部导航" style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}>{navItems.map(([key, label, Icon, count]) => <button className={view === key ? 'active' : ''} type="button" key={key} onClick={() => { closeTask(); setView(key); }}><Icon size={18} /><span>{label}{count !== undefined ? <strong className="nav-count">{count}</strong> : null}</span></button>)}</nav>
  </main>;
}

function NotificationPanel({ summary, loading, marking, onClose, onMarkAll, onSelectTask }: { summary?: NotificationSummary; loading: boolean; marking: boolean; onClose: () => void; onMarkAll: () => void; onSelectTask: (taskId: string) => void }) {
  const items = summary?.items ?? [];
  const unreadCount = summary?.unreadCount ?? 0;
  return <section className="notification-layer" role="dialog" aria-modal="true" aria-label="消息通知" onClick={onClose}>
    <div className="notification-sheet" onClick={(event) => event.stopPropagation()}>
      <header className="notification-head">
        <div>
          <div className="eyebrow">MESSAGE CENTER</div>
          <h2>消息通知</h2>
        </div>
        <button className="notification-close" type="button" onClick={onClose} aria-label="关闭消息通知">×</button>
      </header>
      <div className="notification-summary">
        <span>{unreadCount ? `${unreadCount} 条未读提醒` : '暂无未读消息'}</span>
        <button type="button" disabled={!unreadCount || marking} onClick={onMarkAll}>{marking ? '处理中...' : '全部已读'}</button>
      </div>
      {loading ? <div className="notification-empty">正在加载消息...</div> : null}
      {!loading && items.length === 0 ? <div className="notification-empty"><Bell size={22} /><strong>消息箱很安静</strong><span>任务提醒、审核结果和系统通知会出现在这里。</span></div> : null}
      {!loading && items.length > 0 ? <div className="notification-list">{items.map((item) => <NotificationCard item={item} key={item.id} onSelectTask={onSelectTask} />)}</div> : null}
    </div>
  </section>;
}

function NotificationCard({ item, onSelectTask }: { item: NotificationItem; onSelectTask: (taskId: string) => void }) {
  const taskId = item.details?.taskId;
  const canOpenTask = Boolean(taskId);
  const label = item.templateCode === 'TASK_REMIND' ? '任务提醒' : item.templateCode.includes('SUBMISSION') ? '审核通知' : item.templateCode.includes('FUND') ? '基金任务' : '系统消息';
  return <button className={`notification-card ${item.status === 'UNREAD' ? 'unread' : 'read'}`} type="button" disabled={!canOpenTask} onClick={() => { if (taskId) onSelectTask(taskId); }}>
    <span className="notification-dot" />
    <span className="notification-copy">
      <span className="notification-meta"><span>{label}</span><time dateTime={item.createdAt}>{formatNotificationTime(item.createdAt)}</time></span>
      <strong>{item.title}</strong>
      {item.content ? <small>{item.content}</small> : null}
    </span>
    {canOpenTask ? <span className="notification-jump">查看</span> : null}
  </button>;
}

function formatNotificationTime(isoDate: string) {
  const timestamp = new Date(isoDate).getTime();
  const diff = Date.now() - timestamp;
  if (Number.isFinite(diff)) {
    if (diff < 60_000) return '刚刚';
    if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))} 分钟前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  }
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(isoDate));
}

function LoginPage({ loading, submitting, error, onLogin }: { loading: boolean; submitting: boolean; error?: Error | null; onLogin: (username: string, password: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const canSubmit = username.trim().length > 0 && password.length > 0;
  if (loading) return <main className="login-shell"><section className="login-panel"><div className="eyebrow">公募基金营销任务跟踪系统</div><h1>正在准备登录</h1><p>正在连接业务服务，请稍候...</p></section></main>;
  return <main className="login-shell"><section className="login-panel"><div className="eyebrow">公募基金营销任务跟踪系统</div><h1>账号登录</h1><p>请输入账号和密码进入对应工作台。</p><form className="login-form" onSubmit={(event) => { event.preventDefault(); if (canSubmit) onLogin(username.trim(), password); }}><label>账号<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="请输入账号" /></label><label>密码<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="请输入密码" /></label>{error ? <div className="form-error">{error.message}</div> : null}<button className="primary-action" type="submit" disabled={!canSubmit || submitting}>{submitting ? '登录中...' : '登录'}</button></form><div className="login-hint">运营账号：admin<br />兼职账号：staff1、staff2、staff3<br />基金公司：fund1、fund2</div></section></main>;
}

type MyTaskRow = TaskListItem & { claimId: string; executorAccountName?: string | null; claimStatus: keyof typeof CLAIM_STATUS_LABEL; reviewComment?: string | null };

function TaskWorkspace({ role, tasks, market, myTasks, onSelect }: { role: Role; tasks: TaskListItem[]; market: TaskListItem[]; myTasks: MyTaskRow[]; onSelect: (id: string, claimId?: string) => void }) {
  return <section className="workspace-page"><div className="page-heading"><div><div className="eyebrow">{role === 'operator' ? '运营管理' : '兼职大厅'}</div><h2>{role === 'operator' ? '任务' : '可接任务'}</h2></div><span>{role === 'operator' ? `${tasks.length} 个任务` : `${market.length} 个可领取`}</span></div>{role === 'operator' ? <TaskSection title="全部任务" tasks={tasks} onSelect={onSelect} /> : <TaskSection title="可领取任务" tasks={market} onSelect={onSelect} statusLabel={availableTaskStatusLabel} subtitle={executorTaskSubtitle} />}</section>;
}

function ReviewWorkspace({ role, tasks, actions, myTasks, onSelect }: { role: Role; tasks: TaskListItem[]; actions: DashboardSummary['actionQueue']; myTasks: MyTaskRow[]; onSelect: (id: string, claimId?: string) => void }) {
  const reviewTasks = role === 'operator' ? tasks.filter((task) => actions.some((action) => action.type === 'REVIEW_SUBMISSION' && action.taskId === task.id)) : myTasks.filter((task) => task.claimStatus === 'PENDING_REVIEW');
  return <section className="workspace-page"><div className="page-heading"><div><div className="eyebrow">{role === 'operator' ? '运营审核' : '兼职进度'}</div><h2>{role === 'operator' ? '待审核' : '审核结果'}</h2></div><span>{reviewTasks.length} 项</span></div>{reviewTasks.length ? <TaskSection title={role === 'operator' ? '待处理提交' : '审核中的任务'} tasks={reviewTasks} onSelect={onSelect} /> : <div className="panel empty-state">当前没有需要处理的审核事项</div>}</section>;
}

function LegacyMineWorkspace({ role, accountName, username, points, onLogout }: { role: Role; accountName: string; username: string; points?: { availablePoints: number; cashValue: number }; onLogout: () => void }) {
  return <section className="workspace-page"><div className="page-heading"><div><div className="eyebrow">账号中心</div><h2>我的</h2></div></div><section className="profile-panel"><div className="profile-avatar">{accountName.slice(-1)}</div><div><strong>{accountName}</strong><small>{username} · {role === 'operator' ? '运营人员' : '兼职人员'}</small></div></section>{role === 'user' ? <section className="points-banner mine-points"><div><span>可用积分</span><strong>{points?.availablePoints ?? 0}</strong></div><div><span>可兑换</span><strong>¥{points?.cashValue?.toFixed(2) ?? '0.00'}</strong></div></section> : <section className="panel mine-note">运营账号可在首页和审核页管理任务、提交材料与结算。</section>}<button className="secondary-action" type="button" onClick={onLogout}>退出登录</button></section>;
}

function MineWorkspace({ role, accountName, username, points, onLogout, accountSummary, onAddAccount }: { role: Role; accountName: string; username: string; points?: { availablePoints: number; cashValue: number }; onLogout: () => void; accountSummary?: { accounts: Array<{ id: string; platform: string; accountName: string; accountUid?: string | null; status: string; passwordSet?: boolean }>; accountCount: number; activeTaskCount: number; availableTaskSlots: number }; onAddAccount?: (input: { platform: string; accountName: string; accountUid?: string; password?: string }) => Promise<void> }) {
  const [platform, setPlatform] = useState('小红书');
  const [name, setName] = useState('');
  const [uid, setUid] = useState('');
  const submit = async () => { if (!name.trim() || !onAddAccount) return; await onAddAccount({ platform, accountName: name, accountUid: uid }); setName(''); setUid(''); };
  return <section className="workspace-page"><div className="page-heading"><div><div className="eyebrow">账号中心</div><h2>我的</h2></div></div><section className="profile-panel"><div className="profile-avatar">{accountName.slice(-1)}</div><div><strong>{accountName}</strong><small>{username} · {role === 'operator' ? '运营人员' : role === 'fund' ? '基金人员' : '兼职人员'}</small></div></section>{role === 'user' ? <><section className="points-banner mine-points"><div><span>可用积分</span><strong>{points?.availablePoints ?? 0}</strong></div><div><span>可兑换</span><strong>¥{points?.cashValue?.toFixed(2) ?? '0.00'}</strong></div></section><section className="panel"><div className="section-heading"><div><h2>我的发布账号</h2><p className="section-caption">每个启用账号可同时领取 1 个进行中任务</p></div><span>{accountSummary?.availableTaskSlots ?? 0} 个可领取名额</span></div><div className="form-grid"><label>平台<select value={platform} onChange={(event) => setPlatform(event.target.value)}>{PLATFORM_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label><label>账号名称<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：理财笔记号" /></label></div><label>账号 ID / 主页标识<input value={uid} onChange={(event) => setUid(event.target.value)} placeholder="可选，用于运营核验" /></label><button className="primary-action" type="button" disabled={!name.trim()} onClick={() => void submit()}><Plus size={16} />添加发布账号</button><div className="task-list">{accountSummary?.accounts.map((item) => <div className="task-item" key={item.id}><div className="task-title-row"><h3>{item.accountName}</h3><span>{item.status === 'ACTIVE' ? '已启用' : '已停用'}</span></div><p>{item.platform}{item.accountUid ? ` · ${item.accountUid}` : ''}</p></div>)}</div></section></> : <section className="panel mine-note">{role === 'fund' ? '基金人员可在首页维护任务名称与对应帖子内容。' : '运营账号可在首页和审核页管理任务、提交材料与结算。'}</section>}<button className="secondary-action" type="button" onClick={onLogout}>退出登录</button></section>;
}

function MineWorkspaceV2Legacy({ role, accountName, username, points, onLogout, accountSummary, onAddAccount }: { role: Role; accountName: string; username: string; points?: { availablePoints: number; cashValue: number }; onLogout: () => void; accountSummary?: { accounts: Array<{ id: string; platform: string; accountName: string; accountUid?: string | null; status: string; passwordSet?: boolean }>; accountCount: number; activeTaskCount: number; availableTaskSlots: number }; onAddAccount?: (input: { platform: string; accountName: string; accountUid?: string; password?: string }) => Promise<void> }) {
  const [platform, setPlatform] = useState('小红书');
  const [name, setName] = useState('');
  const [uid, setUid] = useState('');
  const submit = async () => { if (!name.trim() || !onAddAccount) return; await onAddAccount({ platform, accountName: name, accountUid: uid }); setName(''); setUid(''); };
  if (role !== 'user') return <MineWorkspace role={role} accountName={accountName} username={username} points={points} onLogout={onLogout} accountSummary={accountSummary} onAddAccount={onAddAccount} />;
  const activeAccounts = accountSummary?.accounts.filter((item) => item.status === 'ACTIVE') ?? [];
  return <section className="workspace-page"><div className="page-heading"><div><div className="eyebrow">账号中心</div><h2>我的</h2></div></div><section className="profile-panel"><div className="profile-avatar">{accountName.slice(-1)}</div><div><strong>{accountName}</strong><small>{username} · 兼职人员</small></div></section><section className="points-banner mine-points"><div><span>可用积分</span><strong>{points?.availablePoints ?? 0}</strong></div><div><span>可兑换</span><strong>¥{points?.cashValue?.toFixed(2) ?? '0.00'}</strong></div></section><section className="panel account-manager"><div className="section-heading"><div><h2>我的发布账号</h2><p className="section-caption">单任务可领取名额：{activeAccounts.length} 个</p></div><span>已填写 {activeAccounts.length} 个</span></div><div className="account-rows">{activeAccounts.length ? activeAccounts.map((item) => <div className="account-row" key={item.id}><strong>{item.accountName}</strong><span>{item.platform}</span><small>{item.accountUid || '未填写账号标识'}</small><em>可用</em></div>) : <div className="empty-state">还没有填写发布账号</div>}</div><div className="account-add-heading"><strong>新增发布账号</strong><span>填写后即可用于领取对应平台任务</span></div><div className="account-add-row"><select value={platform} onChange={(event) => setPlatform(event.target.value)}>{PLATFORM_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select><input value={name} onChange={(event) => setName(event.target.value)} placeholder="账号名称" /><input value={uid} onChange={(event) => setUid(event.target.value)} placeholder="账号 ID / 主页标识（选填）" /><button className="primary-action" type="button" disabled={!name.trim()} onClick={() => void submit()}><Plus size={16} />添加</button></div></section><button className="secondary-action" type="button" onClick={onLogout}>退出登录</button></section>;
}

function MineWorkspaceV2({ role, accountName, username, points, onLogout, accountSummary, onAddAccount, onUpdateAccount }: { role: Role; accountName: string; username: string; points?: { availablePoints: number; cashValue: number }; onLogout: () => void; accountSummary?: { accounts: Array<{ id: string; platform: string; accountName: string; accountUid?: string | null; status: string; passwordSet?: boolean }>; accountCount: number; activeTaskCount: number; availableTaskSlots: number }; onAddAccount?: (input: { platform: string; accountName: string; accountUid?: string; password?: string }) => Promise<void>; onUpdateAccount?: (accountId: string, input: { platform: string; accountName: string; accountUid?: string; password?: string }) => Promise<void> }) {
  const [platform, setPlatform] = useState<string>(PLATFORM_OPTIONS[0]);
  const [name, setName] = useState('');
  const [uid, setUid] = useState('');
  const [password, setPassword] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [editPassword, setEditPassword] = useState('');
  if (role !== 'user') return <MineWorkspace role={role} accountName={accountName} username={username} points={points} onLogout={onLogout} accountSummary={accountSummary} onAddAccount={onAddAccount} />;
  const activeAccounts = accountSummary?.accounts.filter((item) => item.status === 'ACTIVE') ?? [];
  const submit = async () => {
    if (!name.trim() || !onAddAccount) return;
    await onAddAccount({ platform, accountName: name, accountUid: uid, password });
    setName(''); setUid(''); setPassword('');
  };
  const savePassword = async () => {
    const item = activeAccounts.find((account) => account.id === editingId);
    if (!item || !onUpdateAccount || !editPassword.trim()) return;
    await onUpdateAccount(item.id, { platform: item.platform, accountName: item.accountName, accountUid: item.accountUid ?? undefined, password: editPassword });
    setEditingId(undefined); setEditPassword('');
  };
  return <section className="workspace-page"><div className="page-heading"><div><div className="eyebrow">账号中心</div><h2>我的</h2></div></div><section className="profile-panel"><div className="profile-avatar">{accountName.slice(-1)}</div><div><strong>{accountName}</strong><small>{username} · 兼职人员</small></div></section><section className="points-banner mine-points"><div><span>可用积分</span><strong>{points?.availablePoints ?? 0}</strong></div><div><span>可兑换</span><strong>¥{points?.cashValue?.toFixed(2) ?? '0.00'}</strong></div></section><section className="panel account-manager"><div className="section-heading"><div><h2>我的发布账号</h2><p className="section-caption">单任务可领取名额：{activeAccounts.length} 个</p></div><span>已填写 {activeAccounts.length} 个</span></div><div className="account-rows">{activeAccounts.length ? activeAccounts.map((item) => <div className="account-row" key={item.id}><strong>{item.accountName}</strong><span>{item.platform}</span><small>{item.accountUid || '未填写账号标识'}</small><em>{item.passwordSet ? '密码已保存' : '未设置密码'}</em><button className="account-edit-button" type="button" onClick={() => { setEditingId(item.id); setEditPassword(''); }}>修改密码</button></div>) : <div className="empty-state">还没有填写发布账号</div>}</div>{editingId ? <div className="account-password-editor"><input type="password" value={editPassword} onChange={(event) => setEditPassword(event.target.value)} placeholder="输入新密码" autoComplete="new-password" /><button className="primary-action" type="button" disabled={!editPassword.trim()} onClick={() => void savePassword()}>保存密码</button><button className="secondary-action" type="button" onClick={() => setEditingId(undefined)}>取消</button></div> : null}<div className="account-add-heading"><strong>新增发布账号</strong><span>账号密码只保存加密结果，不会在页面回显</span></div><div className="account-add-row"><select value={platform} onChange={(event) => setPlatform(event.target.value)}>{PLATFORM_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select><input value={name} onChange={(event) => setName(event.target.value)} placeholder="账号名称" /><input value={uid} onChange={(event) => setUid(event.target.value)} placeholder="账号 ID / 主页标识（选填）" /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="账号密码（选填）" autoComplete="new-password" /><button className="primary-action" type="button" disabled={!name.trim()} onClick={() => void submit()}><Plus size={16} />添加</button></div></section><button className="secondary-action" type="button" onClick={onLogout}>退出登录</button></section>;
}

function MineWorkspaceV3({ role, accountName, username, points, onLogout, accountSummary, onAddAccount }: { role: Role; accountName: string; username: string; points?: { availablePoints: number; cashValue: number }; onLogout: () => void; accountSummary?: { accounts: Array<{ id: string; platform: string; accountName: string; accountUid?: string | null; status: string }>; accountCount: number; activeTaskCount: number; availableTaskSlots: number }; onAddAccount?: (input: { platform: string; accountName: string; accountUid?: string }) => Promise<void> }) {
  const [platform, setPlatform] = useState<string>(PLATFORM_OPTIONS[0]);
  const [accountUid, setAccountUid] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string>();
  const activeAccounts = accountSummary?.accounts.filter((item) => item.status === 'ACTIVE') ?? [];

  const submit = async () => {
    const uid = accountUid.trim();
    if (!uid || !onAddAccount || adding) return;
    setAdding(true);
    setError(undefined);
    try {
      await onAddAccount({ platform, accountName: uid, accountUid: uid });
      setAccountUid('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '账号保存失败，请稍后重试');
    } finally {
      setAdding(false);
    }
  };

  if (role !== 'user') return <MineWorkspace role={role} accountName={accountName} username={username} points={points} onLogout={onLogout} accountSummary={accountSummary} onAddAccount={onAddAccount} />;

  return <section className="workspace-page"><div className="page-heading"><div><div className="eyebrow">账号中心</div><h2><UserRound size={20} />我的</h2></div></div><section className="profile-panel"><div className="profile-avatar">{accountName.slice(-1)}</div><div><strong>{accountName}</strong><small>{username} · 兼职执行人员</small></div></section><section className="points-banner mine-points"><div><span><Coins size={13} />可用积分</span><strong>{points?.availablePoints ?? 0}</strong></div><div><span><WalletCards size={13} />可兑换</span><strong>¥{points?.cashValue?.toFixed(2) ?? '0.00'}</strong></div></section><section className="panel account-manager account-manager-v3"><div className="account-manager-heading"><IconTitle icon={UserRound} title="发布账号" caption="每个平台配置一个账号 ID，用于领取对应平台任务" /><strong>{activeAccounts.length}<small> 个可用</small></strong></div><div className="publishing-account-list">{activeAccounts.length ? activeAccounts.map((item) => <article className="publishing-account-card" key={item.id}><div className="publishing-account-meta"><span>{item.platform}</span><strong>{item.accountName}</strong><em>可用</em></div><div className="publishing-account-id"><span><Link2 size={12} />账号 ID</span><code>{item.accountUid || item.accountName}</code></div></article>) : <div className="empty-state">还没有发布账号，请先添加</div>}</div><div className="account-add-form"><div className="account-add-form-heading"><div><h3><Plus size={15} />新增发布账号</h3><p>只需要填写平台和账号 ID，不需要密码</p></div></div><div className="account-add-fields"><label>发布平台<select value={platform} onChange={(event) => setPlatform(event.target.value)}>{PLATFORM_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label><label className="account-id-field">账号 ID<input value={accountUid} onChange={(event) => setAccountUid(event.target.value)} placeholder="请输入平台账号 ID" autoComplete="off" /></label></div>{error ? <div className="form-error">{error}</div> : null}<button className="primary-action" type="button" disabled={!accountUid.trim() || adding} onClick={() => void submit()}><Plus size={16} />{adding ? '保存中...' : '保存发布账号'}</button></div></section><button className="secondary-action" type="button" onClick={onLogout}>退出登录</button></section>;
}

function FundPostWorkspace({ posts, onCreate }: { posts: FundTaskPost[]; onCreate: (input: { taskName: string; platform: string; postTitle?: string; postContent?: string; postUrl?: string }) => Promise<void> }) {
  const [form, setForm] = useState({ taskName: '', platform: '小红书', postTitle: '', postContent: '', postUrl: '' });
  const submit = async () => { if (!form.taskName.trim()) return; await onCreate(form); setForm({ taskName: '', platform: '小红书', postTitle: '', postContent: '', postUrl: '' }); };
  return <section className="workspace-page"><div className="page-heading"><div><div className="eyebrow">基金内容协同</div><h2>任务帖子填报</h2></div><span>{posts.length} 条配置</span></div><section className="panel"><div className="section-heading"><div><h2>新增任务对应帖子</h2><p className="section-caption">运营创建任务时会选择这里的任务名称和帖子</p></div></div><label>任务名称<input value={form.taskName} onChange={(event) => setForm({ ...form, taskName: event.target.value })} placeholder="例如：八月稳健理财内容" /></label><div className="form-grid"><label>发布平台<select value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value })}><option>小红书</option><option>微信公众号</option><option>抖音</option><option>微博</option></select></label><label>帖子标题<input value={form.postTitle} onChange={(event) => setForm({ ...form, postTitle: event.target.value })} /></label></div><label>帖子内容<textarea value={form.postContent} onChange={(event) => setForm({ ...form, postContent: event.target.value })} placeholder="填写基金确认后的帖子正文" /></label><label>帖子链接<input value={form.postUrl} onChange={(event) => setForm({ ...form, postUrl: event.target.value })} placeholder="可选" /></label><button className="primary-action" type="button" disabled={!form.taskName.trim()} onClick={() => void submit()}><Plus size={16} />保存帖子配置</button></section><section className="panel task-panel"><div className="section-heading"><h2>已填报帖子</h2><span>{posts.length} 条</span></div>{posts.length === 0 ? <div className="empty-state">暂无帖子配置</div> : posts.map((post) => <article className="task-item" key={post.id}><div className="task-title-row"><h3>{post.taskName}</h3><span>{post.platform}</span></div><p>{post.postTitle || '未填写标题'}</p><small>{post.postContent || '未填写正文'}</small>{post.postUrl ? <a href={post.postUrl} target="_blank" rel="noreferrer">打开帖子链接</a> : null}</article>)}</section></section>;
}

function FundPostEditor({ posts, onCreate }: { posts: FundTask[]; onCreate: (input: { taskName: string; platform: string; posts: Array<{ title: string; content: string; url?: string }> }) => Promise<void> }) {
  const [form, setForm] = useState({ taskName: '', platform: '小红书' });
  const [items, setItems] = useState([{ title: '', content: '', url: '' }]);
  const updateItem = (index: number, key: 'title' | 'content' | 'url', value: string) => setItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  const submit = async () => { if (!form.taskName.trim() || !form.platform || items.some((item) => !item.title.trim() || !item.content.trim())) return; await onCreate({ taskName: form.taskName, platform: form.platform, posts: items.map((item) => ({ title: item.title, content: item.content, url: item.url || undefined })) }); setForm({ taskName: '', platform: '小红书' }); setItems([{ title: '', content: '', url: '' }]); };
  return <section className="workspace-page"><div className="page-heading"><div><div className="eyebrow">基金内容协同</div><h2>任务帖子填报</h2></div><span>{posts.length} 个基金任务</span></div><section className="panel"><div className="section-heading"><div><h2>新增基金任务</h2><p className="section-caption">任务名和发布平台必填；一个任务可添加 N 个帖子，运营按帖子数量设置名额</p></div></div><label>任务名称（必填）<input value={form.taskName} onChange={(event) => setForm({ ...form, taskName: event.target.value })} /></label><label>发布平台（必填）<select value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value })}>{PLATFORM_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label><div className="section-heading"><h3>帖子列表（至少 1 条）</h3><button className="secondary-action" type="button" onClick={() => setItems([...items, { title: '', content: '', url: '' }])}><Plus size={16} />添加帖子</button></div>{items.map((item, index) => <div className="panel" key={index}><strong>帖子 {index + 1}</strong><label>标题（必填）<input value={item.title} onChange={(event) => updateItem(index, 'title', event.target.value)} /></label><label>正文（必填）<textarea value={item.content} onChange={(event) => updateItem(index, 'content', event.target.value)} /></label><label>链接（选填）<input value={item.url} onChange={(event) => updateItem(index, 'url', event.target.value)} /></label>{items.length > 1 ? <button className="secondary-action" type="button" onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))}>删除此帖子</button> : null}</div>)}<button className="primary-action" type="button" disabled={!form.taskName.trim() || items.some((item) => !item.title.trim() || !item.content.trim())} onClick={() => void submit()}><Plus size={16} />保存基金任务</button></section><section className="panel task-panel"><div className="section-heading"><h2>已填报基金任务</h2><span>{posts.length} 个</span></div>{posts.map((task) => <article className="task-item" key={task.id}><div className="task-title-row"><h3>{task.taskName}</h3><span>{task.platform} · {task.postCount} 个名额</span></div>{task.posts.map((post, index) => <p key={post.id}>帖子 {index + 1}：{post.title}</p>)}</article>)}</section></section>;
}

type DraftFundPost = { title: string; content: string };

function FundPostEditorV2({ posts, progress, onCreate }: { posts: FundTask[]; progress: FundTaskProgress[]; onCreate: (input: { taskName: string; platform: string; posts: Array<{ title: string; content: string; url?: string }> }) => Promise<void> }) {
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [taskName, setTaskName] = useState('');
  const [platform, setPlatform] = useState<string>(PLATFORM_OPTIONS[0]);
  const [taskUrl, setTaskUrl] = useState('');
  const [items, setItems] = useState<DraftFundPost[]>([{ title: '', content: '' }]);
  const [expandedTaskId, setExpandedTaskId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const reset = () => {
    setMode('list');
    setTaskName('');
    setPlatform(PLATFORM_OPTIONS[0]);
    setTaskUrl('');
    setItems([{ title: '', content: '' }]);
    setExpandedTaskId(undefined);
    setError(undefined);
  };

  const updateItem = (targetIndex: number, key: keyof DraftFundPost, value: string) => {
    setItems((current) => current.map((item, index) => index === targetIndex ? { ...item, [key]: value } : item));
  };

  const addItem = () => {
    setItems((current) => [...current, { title: '', content: '' }]);
    setError(undefined);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const save = async () => {
    if (!taskName.trim()) return setError('请先填写任务名称');
    if (items.some((item) => !item.title.trim() || !item.content.trim())) return setError('请补全每条帖子的标题和正文');
    if (saving) return;
    setSaving(true);
    setError(undefined);
    try {
      await onCreate({ taskName: taskName.trim(), platform, posts: items.map((item) => ({ title: item.title.trim(), content: item.content.trim(), url: taskUrl.trim() || undefined })) });
      reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  if (mode === 'list') {
    return <section className="fund-post-workspace"><div className="fund-post-heading"><div><div className="eyebrow">内容协同看板</div><h2><BarChart3 size={21} />基金任务进度</h2><p>默认只展示任务状态和执行进度；帖子明细收起，需要核对时再打开。</p></div><button className="primary-action fund-new-task-button" type="button" onClick={() => { setMode('create'); setError(undefined); }}><Plus size={17} />新建任务</button></div><section className="fund-task-list"><div className="fund-section-heading"><div><h3><ListChecks size={15} />任务列表</h3><span>1 个基金任务对应 1 个运营任务，名额按帖子数设置</span></div><strong>{posts.length} 个</strong></div>{posts.length === 0 ? <div className="fund-empty-state">还没有填报任务，点击上方开始创建</div> : posts.map((task) => { const taskProgress = progress.find((item) => item.id === task.id); const completionRate = taskProgress?.completionRate ?? 0; const claimedCount = taskProgress?.claimedCount ?? 0; const submittedCount = taskProgress?.submittedCount ?? 0; const approvedCount = taskProgress?.approvedCount ?? 0; const pendingReviewCount = Math.max(0, submittedCount - approvedCount); const stage = fundTaskStage(task.postCount, taskProgress); const expanded = expandedTaskId === task.id; return <article className="fund-task-card fund-task-overview-card" key={task.id}><div className="fund-task-card-head"><div><span className="fund-platform-tag">{task.platform}</span><h3>{task.taskName}</h3><small><FileText size={12} />内容任务 · {task.postCount} 条帖子 / {task.postCount} 个名额</small></div><strong className={`fund-stage-badge stage-${stage.tone}`}>{stage.label}</strong></div><div className="fund-task-card-progress"><span><BarChart3 size={12} />完成率</span><div><i style={{ width: `${Math.min(100, completionRate)}%` }} /></div><b>{completionRate}%</b></div><div className="fund-task-status-grid"><span><Layers size={12} />已领取<strong>{claimedCount}</strong></span><span><Send size={12} />已提交<strong>{submittedCount}</strong></span><span><ClipboardCheck size={12} />待审核<strong>{pendingReviewCount}</strong></span><span><CheckCircle2 size={12} />已通过<strong>{approvedCount}</strong></span></div><button className="fund-task-toggle" type="button" onClick={() => setExpandedTaskId(expanded ? undefined : task.id)}><FileText size={14} />{expanded ? '收起帖子清单' : `查看 ${task.postCount} 条帖子清单`}</button>{expanded ? <div className="fund-post-preview fund-post-preview-compact">{task.posts.map((post, index) => <div key={post.id}><span>{index + 1}</span><p>{post.title || '未命名帖子'}</p></div>)}</div> : null}</article>; })}</section></section>;
  }

  return <section className="fund-post-workspace"><div className="fund-post-heading fund-create-heading"><div><button className="text-back-button" type="button" onClick={reset}>‹ 返回任务列表</button><div className="eyebrow">新建内容任务</div><h2><PencilLine size={21} />一个任务，多条帖子</h2><p>填写一次任务名称、平台和原帖链接，下方可连续添加多条帖子；保存后运营按帖子数设置任务名额。</p></div></div><section className="fund-create-form"><div className="fund-form-section"><div className="fund-section-heading"><div><h3><PencilLine size={15} />1. 任务基本信息</h3><span>原帖链接属于整个任务，只需填写一次</span></div></div><label>任务名称<input value={taskName} onChange={(event) => setTaskName(event.target.value)} placeholder="例如：八月稳健理财内容推广" /></label><label>发布平台<select value={platform} onChange={(event) => setPlatform(event.target.value)}>{PLATFORM_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label><label><span className="label-with-icon"><Link2 size={13} />原帖链接 <span className="optional-label">选填</span></span><input value={taskUrl} onChange={(event) => setTaskUrl(event.target.value)} placeholder="如有基金公司原帖或参考链接，填一次即可" /></label></div><div className="fund-form-section"><div className="fund-section-heading fund-post-count-heading"><div><h3><FileText size={15} />2. 帖子列表</h3><span>当前 {items.length} 条帖子，将设置 {items.length} 个执行名额</span></div></div><div className="fund-post-editor-list">{items.map((item, index) => <article className="fund-post-editor-card" key={index}><div className="fund-editor-card-head"><div><span>第 {index + 1} 条帖子</span><h3>{item.title.trim() || '未命名帖子'}</h3></div>{items.length > 1 ? <button className="icon-button" type="button" aria-label={`删除第 ${index + 1} 条帖子`} onClick={() => removeItem(index)}><Trash2 size={16} /></button> : null}</div><label>帖子标题<input value={item.title} onChange={(event) => updateItem(index, 'title', event.target.value)} placeholder="输入本条帖子的标题" /></label><label>帖子正文<textarea value={item.content} onChange={(event) => updateItem(index, 'content', event.target.value)} placeholder="粘贴或填写基金公司确认后的正式发布正文" /></label></article>)}</div><button className="secondary-action fund-add-post-wide" type="button" onClick={addItem}><Plus size={15} />新增一条帖子</button></div></section>{error ? <div className="form-error fund-form-error">{error}</div> : null}<div className="fund-create-actions"><button className="secondary-action" type="button" onClick={reset}>取消</button><button className="primary-action" type="button" disabled={saving} onClick={() => void save()}><CheckCircle2 size={16} />{saving ? '保存中...' : `保存任务 · ${items.length} 条帖子`}</button></div></section>;
}

function FundPostWorkspaceV2({ posts, progress, onCreate }: { posts: FundTask[]; progress: FundTaskProgress[]; onCreate: (input: { taskName: string; platform: string; posts: Array<{ title: string; content: string; url?: string }> }) => Promise<void> }) {
  return <><FundProgressPanel progress={progress} /><FundPostEditorV2 posts={posts} progress={progress} onCreate={onCreate} /></>;
}

function fundTaskStage(postCount: number, progress?: FundTaskProgress) {
  if (!progress?.publishedTaskCount) return { label: '待运营发布', tone: 'muted' };
  if (progress.approvedCount >= postCount && postCount > 0) return { label: '已完成', tone: 'done' };
  if (progress.submittedCount > progress.approvedCount) return { label: '待运营审核', tone: 'warn' };
  if (progress.claimedCount > 0) return { label: '执行中', tone: 'active' };
  return { label: '待领取', tone: 'idle' };
}

function FundProgressPanel({ progress }: { progress: FundTaskProgress[] }) {
  const totals = progress.reduce((sum, item) => ({ postCount: sum.postCount + item.postCount, claimedCount: sum.claimedCount + item.claimedCount, submittedCount: sum.submittedCount + item.submittedCount, approvedCount: sum.approvedCount + item.approvedCount }), { postCount: 0, claimedCount: 0, submittedCount: 0, approvedCount: 0 });
  const rate = totals.postCount ? Math.round((totals.approvedCount / totals.postCount) * 100) : 0;
  const pendingReviewCount = Math.max(0, totals.submittedCount - totals.approvedCount);
  const activeCount = progress.filter((item) => item.claimedCount > item.approvedCount).length;
  return <section className="panel fund-progress-panel"><div className="section-heading"><IconTitle icon={BarChart3} title="执行总览" caption="关注任务是否发布、是否有人领取、是否需要运营审核" /><span>{rate}% 总完成率</span></div><div className="fund-progress-hero"><div><span><Layers size={13} />总名额</span><strong>{totals.postCount}</strong><small>来自 {progress.length} 个基金任务</small></div><div className="fund-progress-ring"><b>{rate}%</b><span>已通过</span></div></div><div className="fund-progress-mini-grid"><article><span><Layers size={12} />已领取</span><strong>{totals.claimedCount}</strong></article><article><span><ClipboardCheck size={12} />待审核</span><strong>{pendingReviewCount}</strong></article><article><span><Send size={12} />已提交</span><strong>{totals.submittedCount}</strong></article><article><span><Target size={12} />执行中任务</span><strong>{activeCount}</strong></article></div>{progress.length ? <div className="fund-progress-list">{progress.slice(0, 4).map((item) => <div className="fund-progress-row" key={item.id}><div><strong>{item.taskName}</strong><span>{item.platform} · {item.postCount} 个名额</span></div><em>{item.approvedCount}/{item.postCount}</em></div>)}</div> : null}</section>;
}

function ServiceStatus({ loading, error, status, database }: { loading: boolean; error: Error | null; status?: 'ok' | 'degraded'; database?: 'ok' | 'error' }) {
  if (loading) return <section className="service-status">正在准备演示环境...</section>;
  if (error || status !== 'ok' || database !== 'ok') return <section className="service-status warning"><WifiOff size={16} /><span>接口或数据库暂不可用</span></section>;
  return <section className="service-status ok"><CheckCircle2 size={16} />服务连接正常</section>;
}

function OperatorHome({ summary, tasks, loading, onSelect, onCreate, onViewTasks, onViewReview }: { summary?: DashboardSummary; tasks: TaskListItem[]; loading: boolean; onSelect: (id: string) => void; onCreate: () => void; onViewTasks: () => void; onViewReview: () => void }) {
  const urgentCount = (summary?.pendingReview ?? 0) + (summary?.pendingPublish ?? 0) + (summary?.todayDue ?? 0);
  const focusText = urgentCount > 0 ? `今天优先处理 ${urgentCount} 项：审核、发布和临期任务。` : '当前没有紧急事项，可以补充客户任务或巡检执行进度。';
  const keyTasks = tasks.slice(0, 5);
  const customerSnapshots = summary?.customerSnapshots ?? (summary?.customerSnapshot ? [summary.customerSnapshot] : []);
  return <section className="operator-home">
    <section className="operator-hero-panel">
      <div><div className="eyebrow">运营驾驶舱</div><h2>今天先把关键节点清掉</h2><p>{focusText}</p></div>
    </section>
    <section className="operator-kpi-strip">
      <OperatorKpiCard icon={ClipboardCheck} label="待审核" value={summary?.pendingReview ?? 0} hint="兼职已提交" tone="warn" loading={loading} onClick={onViewReview} />
      <OperatorKpiCard icon={Send} label="待发布" value={summary?.pendingPublish ?? 0} hint="草稿需上线" tone="active" loading={loading} onClick={onViewTasks} />
      <OperatorKpiCard icon={Target} label="进行中" value={summary?.inProgress ?? 0} hint="正在执行" tone="normal" loading={loading} onClick={onViewTasks} />
      <OperatorKpiCard icon={Clock3} label="三日截止" value={summary?.todayDue ?? 0} hint="需要催办" tone="danger" loading={loading} onClick={onViewTasks} />
    </section>
    <section className="operator-quick-actions">
      <button type="button" onClick={onCreate}><Plus size={16} /><span>新建任务</span></button>
      <button type="button" onClick={() => summary?.actionQueue[0] ? onSelect(summary.actionQueue[0].taskId) : undefined}><ClipboardCheck size={16} /><span>处理待办</span><strong>{summary?.actionQueue.length ?? 0}</strong></button>
      <button type="button" onClick={onViewTasks}><ClipboardList size={16} /><span>查看任务池</span><strong>{tasks.length}</strong></button>
    </section>
    <OperatorQueue actions={summary?.actionQueue ?? []} onSelect={onSelect} />
    <CustomerPortfolioCard snapshots={customerSnapshots} tasks={tasks} onSelectTask={onSelect} />
    <TaskHealthCard stats={summary?.taskStats ?? []} />
    <TaskSection title="最近任务池" tasks={keyTasks} onSelect={onSelect} />
  </section>;
}

function OperatorKpiCard({ icon: Icon, label, value, hint, tone, loading, onClick }: { icon: LucideIcon; label: string; value: number; hint: string; tone: 'normal' | 'active' | 'warn' | 'danger'; loading: boolean; onClick?: () => void }) {
  return <button className={`operator-kpi-card kpi-${tone}`} type="button" onClick={onClick}><span className="operator-kpi-label"><Icon size={13} />{label}</span><strong>{loading ? '-' : value}</strong><small>{hint}</small></button>;
}

function OperatorQueue({ actions, onSelect }: { actions: DashboardSummary['actionQueue']; onSelect: (id: string) => void }) {
  return <section className="panel queue-panel">
    <div className="section-heading"><IconTitle icon={ClipboardCheck} title="今日待办" caption="按优先级处理：先审核，再发布，再催办临期" /><span>{actions.length} 项</span></div>
    {actions.length === 0 ? <div className="empty-state compact-empty">当前没有待处理事项</div> : <div className="action-queue">{actions.map((action) => <button className={`queue-item priority-${action.priority.toLowerCase()}`} key={action.id} type="button" onClick={() => onSelect(action.taskId)}><span className="queue-mark">{action.type === 'REVIEW_SUBMISSION' ? <ClipboardCheck size={17} /> : action.type === 'PUBLISH_TASK' ? <Send size={17} /> : <Bell size={17} />}</span><span className="queue-copy"><strong>{action.title}</strong><small>{action.description}</small></span><span className="queue-arrow">›</span></button>)}</div>}
  </section>;
}

function CustomerPortfolioCard({ snapshots, tasks, onSelectTask }: { snapshots: DashboardSummary['customerSnapshots']; tasks: TaskListItem[]; onSelectTask: (id: string) => void }) {
  const [selectedKey, setSelectedKey] = useState<string>();
  if (!snapshots.length) return null;
  const totals = snapshots.reduce((sum, item) => ({ companies: sum.companies + 1, tasks: sum.tasks + item.totalTasks, active: sum.active + item.activeTasks, review: sum.review + item.pendingReview }), { companies: 0, tasks: 0, active: 0, review: 0 });
  const visibleSnapshots = snapshots.slice(0, 4);
  const selectedSnapshot = visibleSnapshots.find((snapshot) => customerSnapshotKey(snapshot) === selectedKey);
  const selectedTasks = selectedSnapshot ? tasks.filter((task) => taskBelongsToCustomer(task, selectedSnapshot)) : [];
  return <section className="panel customer-panel customer-portfolio-panel"><div className="section-heading"><IconTitle icon={Building2} title="客户项目池" caption="按基金公司 / 产品聚合，点击客户可下钻任务明细" /><span>{totals.companies} 个客户</span></div><div className="customer-portfolio-summary"><button type="button" onClick={() => setSelectedKey(undefined)}><ClipboardList size={13} />总任务<strong>{totals.tasks}</strong></button><button type="button" onClick={() => setSelectedKey(undefined)}><Target size={13} />进行中<strong>{totals.active}</strong></button><button type="button" onClick={() => setSelectedKey(undefined)}><ClipboardCheck size={13} />待审核<strong>{totals.review}</strong></button></div><div className="customer-project-list">{visibleSnapshots.map((snapshot) => { const key = customerSnapshotKey(snapshot); const active = key === selectedKey; const productName = customerProductLabel(snapshot); return <button className={`customer-project-row${active ? ' active' : ''}`} type="button" key={key} onClick={() => setSelectedKey(active ? undefined : key)}><div className="customer-project-main"><strong>{snapshot.organizationName}</strong>{productName ? <span>{productName}</span> : null}</div><div className="customer-project-metrics"><InlineIconText icon={ClipboardList}>任务 {snapshot.totalTasks}</InlineIconText><InlineIconText icon={ClipboardCheck}>待审 {snapshot.pendingReview}</InlineIconText><em>{snapshot.completionRate}%</em></div><div className="customer-progress"><span style={{ width: `${Math.min(100, snapshot.completionRate)}%` }} /></div></button>; })}</div>{selectedSnapshot ? <CustomerDrilldownPanel snapshot={selectedSnapshot} tasks={selectedTasks} onSelectTask={onSelectTask} /> : null}{snapshots.length > 4 ? <div className="customer-foot"><span>还有 {snapshots.length - 4} 个客户项目，可在任务池继续筛查</span></div> : null}</section>;
}

function customerSnapshotKey(snapshot: DashboardSummary['customerSnapshots'][number]) {
  return `${snapshot.organizationId ?? snapshot.organizationName}-${snapshot.fundProductId ?? snapshot.fundProductName}`;
}

function customerProductLabel(snapshot: DashboardSummary['customerSnapshots'][number]) {
  const productName = snapshot.fundProductName?.trim();
  const organizationName = snapshot.organizationName.trim();
  if (!productName || productName === '未关联基金产品' || productName === organizationName) return '';
  return productName;
}

function taskBelongsToCustomer(task: TaskListItem, snapshot: DashboardSummary['customerSnapshots'][number]) {
  const sameOrganization = snapshot.organizationId ? task.organization.id === snapshot.organizationId : task.organization.name === snapshot.organizationName;
  const sameProduct = snapshot.fundProductId ? task.fundProduct?.id === snapshot.fundProductId : (task.fundProduct?.name ?? '未关联基金产品') === snapshot.fundProductName;
  return sameOrganization && sameProduct;
}

function CustomerDrilldownPanel({ snapshot, tasks, onSelectTask }: { snapshot: DashboardSummary['customerSnapshots'][number]; tasks: TaskListItem[]; onSelectTask: (id: string) => void }) {
  const productName = customerProductLabel(snapshot);
  return <section className="customer-drilldown"><div className="customer-drilldown-head"><div><strong>{snapshot.organizationName}</strong>{productName ? <span>{productName}</span> : null}</div><em>{snapshot.completionRate}% 完成</em></div><div className="customer-drilldown-kpis"><span>任务<strong>{snapshot.totalTasks}</strong></span><span>进行中<strong>{snapshot.activeTasks}</strong></span><span>待审核<strong>{snapshot.pendingReview}</strong></span><span>已通过<strong>{snapshot.approvedCount}</strong></span></div><div className="customer-drilldown-list">{tasks.length === 0 ? <div className="empty-state compact-empty">暂无可下钻任务</div> : tasks.slice(0, 5).map((task) => <button type="button" key={task.id} onClick={() => onSelectTask(task.id)}><div><strong>{task.title}</strong><span>{task.platform} · {TASK_STATUS_LABEL[task.status]}</span></div><em>{task.claimedCount}/{task.quota}</em></button>)}</div></section>;
}

function TaskHealthCard({ stats }: { stats: DashboardSummary['taskStats'] }) {
  const total = stats.reduce((sum, item) => sum + item.count, 0);
  return <section className="panel health-panel"><div className="section-heading"><IconTitle icon={BarChart3} title="任务池健康度" caption="看是否有积压、空转和临近风险" /><span>{total} 项</span></div><div className="health-list">{stats.map((item) => <div className="health-row" key={item.key}><InlineIconText icon={BarChart3}>{item.label}</InlineIconText><div className="health-bar"><i style={{ width: `${total ? Math.min(100, Math.round((item.count / total) * 100)) : 0}%` }} /></div><strong>{item.count}</strong></div>)}</div></section>;
}

function UserHome({ market, myTasks, points, tab, onTabChange, onSelect, onClaim, claimingTaskId }: { market: TaskListItem[]; myTasks: Array<TaskListItem & { claimId: string; executorAccountName?: string | null; claimStatus: keyof typeof CLAIM_STATUS_LABEL; reviewComment?: string | null }>; points?: { availablePoints: number; cashValue: number }; tab: 'available' | 'todo' | 'review' | 'done'; onTabChange: (tab: 'available' | 'todo' | 'review' | 'done') => void; onSelect: (id: string, claimId?: string) => void; onClaim: (id: string) => void; claimingTaskId?: string }) {
  const filtered = myTasks.filter((task) => (tab === 'todo' && ['PENDING_SUBMIT', 'REWORKING'].includes(task.claimStatus)) || (tab === 'review' && task.claimStatus === 'PENDING_REVIEW') || (tab === 'done' && task.claimStatus === 'APPROVED'));
  const todoCount = myTasks.filter((task) => ['PENDING_SUBMIT', 'REWORKING'].includes(task.claimStatus)).length;
  const reviewCount = myTasks.filter((task) => task.claimStatus === 'PENDING_REVIEW').length;
  const doneCount = myTasks.filter((task) => task.claimStatus === 'APPROVED').length;
  const tabItems = [['available', '可接任务', market.length], ['todo', '待处理', todoCount], ['review', '审核中', reviewCount], ['done', '已完成', doneCount]] as const;
  return <><section className="points-banner"><div><span><Coins size={13} />可用积分</span><strong>{points?.availablePoints ?? 0}</strong></div><div><span><WalletCards size={13} />可兑换</span><strong>¥{points?.cashValue?.toFixed(2) ?? '0.00'}</strong></div></section><section className="personal-tabs">{tabItems.map(([key, label, count]) => <button key={key} className={tab === key ? 'active' : ''} type="button" onClick={() => onTabChange(key)}><span>{label}</span><strong>{count}</strong></button>)}</section>{tab === 'available' ? <ExecutorAvailableTaskList tasks={market} onClaim={onClaim} claimingTaskId={claimingTaskId} /> : <section className="panel task-panel"><div className="section-heading"><IconTitle icon={ListChecks} title="我的任务" caption="按任务状态快速处理已领取内容" /><span>{filtered.length} 条</span></div>{filtered.length === 0 ? <div className="empty-state">当前没有对应任务</div> : <div className="my-task-list">{filtered.map((task) => <button className="my-task-item" type="button" key={task.claimId} onClick={() => onSelect(task.id, task.claimId)}><div><strong>{task.title}</strong><small>{task.platform}{task.executorAccountName ? ` · ${task.executorAccountName}` : ''} · {daysLeft(task.dueAt)} 天截止</small></div><span className={`claim-badge claim-${task.claimStatus.toLowerCase()}`}>{CLAIM_STATUS_LABEL[task.claimStatus]}</span>{task.reviewComment ? <p>{task.reviewComment}</p> : null}</button>)}</div>}</section>}</>;
}

function StatGrid({ stats, loading = false }: { stats: Array<[string, number]>; loading?: boolean }) { return <section className="stat-grid">{stats.map(([label, value]) => <article className="stat-card" key={label}><span>{label}</span><strong>{loading ? '-' : value}</strong></article>)}</section>; }

function ExecutorAvailableTaskList({ tasks, onClaim, claimingTaskId }: { tasks: TaskListItem[]; onClaim: (id: string) => void; claimingTaskId?: string }) {
  return <section className="executor-task-panel compact-market-panel"><div className="executor-section-head compact-section-head"><IconTitle icon={ClipboardList} title="可领取任务" caption="整行点击即可领取，先抢到再处理" /><span>{tasks.length} 条</span></div>{tasks.length === 0 ? <div className="executor-empty-card"><strong>当前没有可领取任务</strong><span>可能是该平台账号正在执行中，或任务已被领满。</span></div> : <div className="compact-task-list">{tasks.map((task) => { const claiming = claimingTaskId === task.id; return <button className={`compact-task-row${claiming ? ' claiming' : ''}`} type="button" key={task.id} disabled={claiming} onClick={() => onClaim(task.id)}><div className="compact-row-main"><div className="compact-row-title"><strong>{task.platform}内容发布</strong><span>任务信息</span><em>{availableTaskStatusLabel(task)}</em></div><small>{task.title}</small></div><div className="compact-row-metrics"><span><Coins size={11} /><b>{task.rewardPoints}</b>分</span><span><Layers size={11} />余<b>{Math.max(0, task.quota - task.claimedCount)}</b></span><span><Clock3 size={11} /><b>{daysLeft(task.dueAt)}</b>天</span><span className="compact-row-action">{claiming ? '领取中' : '领取'}</span></div></button>; })}</div>}</section>;
}

function ExecutorMyTaskList({ tasks, onSelect }: { tasks: Array<TaskListItem & { claimId: string; executorAccountName?: string | null; claimStatus: keyof typeof CLAIM_STATUS_LABEL; reviewComment?: string | null }>; onSelect: (id: string, claimId?: string) => void }) {
  return <section className="executor-task-panel"><div className="executor-section-head"><div><h2>我的任务</h2><p>按任务状态快速处理已领取内容</p></div><span>{tasks.length} 条</span></div>{tasks.length === 0 ? <div className="executor-empty-card"><strong>当前没有对应任务</strong><span>切换其它状态，或去可接任务里看看新机会。</span></div> : <div className="executor-task-list">{tasks.map((task) => <button className="executor-task-card my-executor-task-card" type="button" key={task.claimId} onClick={() => onSelect(task.id, task.claimId)}><div className="executor-card-top"><span>{task.organization.name}</span><em>{task.platform}</em><strong>{CLAIM_STATUS_LABEL[task.claimStatus]}</strong></div><h3>{task.title}</h3><div className="executor-card-facts"><span>账号<strong>{task.executorAccountName ?? '未记录'}</strong></span><span>奖励<strong>{task.rewardPoints} 分</strong></span><span>截止<strong>{daysLeft(task.dueAt)} 天</strong></span></div>{task.reviewComment ? <p className="executor-review-note">{task.reviewComment}</p> : null}<div className="executor-card-foot"><small>{executorTaskSubtitle(task)}</small><i>查看详情 ›</i></div></button>)}</div>}</section>;
}

function TaskSection({ title, tasks, onSelect, statusLabel, subtitle }: { title: string; tasks: Array<TaskListItem & { claimId?: string; executorAccountName?: string | null }>; onSelect: (id: string, claimId?: string) => void; statusLabel?: (task: TaskListItem) => string; subtitle?: (task: TaskListItem & { executorAccountName?: string | null }) => string }) {
  return <section className="panel task-panel"><div className="section-heading"><IconTitle icon={ClipboardList} title={title} /><span>{tasks.length} 条</span></div>{tasks.length === 0 ? <div className="empty-state">暂无任务</div> : <div className="task-list">{tasks.map((task) => <button className="task-item" key={task.claimId ?? task.id} type="button" onClick={() => onSelect(task.id, task.claimId)}><div className="task-title-row"><h3>{task.title}</h3><span>{statusLabel ? statusLabel(task) : TASK_STATUS_LABEL[task.status]}</span></div><p>{subtitle ? subtitle(task) : `${task.fundProduct?.name ?? '任务信息'} / ${task.organization.name} / ${task.platform}${task.executorAccountName ? ` / ${task.executorAccountName}` : ''}`}</p><div className="task-meta"><span><Layers size={12} />名额 {task.claimedCount}/{task.quota}</span><span><Coins size={12} />奖励 {task.rewardPoints} 分</span><span><Clock3 size={12} />{daysLeft(task.dueAt)} 天截止</span></div></button>)}</div>}</section>;
}

function executorTaskSubtitle(task: TaskListItem) {
  return `${task.organization.name} / ${task.platform}`;
}

function availableTaskStatusLabel(task: TaskListItem) {
  const left = Math.max(0, task.quota - task.claimedCount);
  return left > 1 ? `剩余 ${left} 个` : '可领取';
}

type CleanActionInput = { kind: ActionKind; taskId?: string; submissionId?: string; claimId?: string; linkUrl?: string; textContent?: string; screenshots?: string[] };

function CleanOperatorTaskDetailPage({ detail, actionPending, onAction, onClose }: { detail: TaskDetail; actionPending: boolean; onAction: (input: CleanActionInput) => void; onClose: () => void }) {
  const submittedCount = detail.claims.filter((claim) => Boolean(claim.submission)).length;
  const reviewCount = detail.claims.filter((claim) => claim.submission?.status === 'PENDING_REVIEW').length;
  const approvedCount = detail.claims.filter((claim) => claim.status === 'APPROVED').length;
  return <section className="clean-task-page">
    <header className="clean-task-header"><button className="back-button" type="button" onClick={onClose} aria-label="返回">‹</button><div><div className="eyebrow">运营任务详情</div><h2>{detail.title}</h2></div><span className="operator-detail-status">{TASK_STATUS_LABEL[detail.status]}</span></header>
    <section className="clean-task-overview"><p>{detail.description || '暂无任务说明'}</p><TaskFacts detail={detail} />{detail.status === 'DRAFT' ? <button className="primary-action" type="button" disabled={actionPending} onClick={() => onAction({ kind: 'publish', taskId: detail.id })}><Send size={17} />发布任务</button> : null}{['PUBLISHED', 'IN_PROGRESS'].includes(detail.status) ? <div className="clean-action-grid"><button className="secondary-action" type="button" disabled={actionPending} onClick={() => onAction({ kind: 'remind', taskId: detail.id })}><Bell size={16} />提醒执行人员</button><button className="danger-action" type="button" disabled={actionPending} onClick={() => onAction({ kind: 'unpublish', taskId: detail.id })}><XCircle size={16} />下架任务</button></div> : null}</section>
    <div className="clean-flow"><FlowStep done={detail.status !== 'DRAFT'} label="发布" /><FlowStep done={detail.claimedCount > 0} label="领取" /><FlowStep done={submittedCount > 0} label="提交" /><FlowStep done={approvedCount > 0} label="结算" /></div>
    <section className="clean-kpi-grid"><div><span>已领取</span><strong>{detail.claimedCount}/{detail.quota}</strong></div><div><span>已提交</span><strong>{submittedCount}</strong></div><div><span>待审核</span><strong className={reviewCount ? 'operator-kpi-alert' : ''}>{reviewCount}</strong></div><div><span>已通过</span><strong>{approvedCount}</strong></div></section>
    <section className="clean-materials"><div className="clean-section-title"><div><h3>执行提交材料</h3><p>逐人查看链接、截图和说明</p></div><span>{detail.claims.length} 人</span></div>{detail.claims.length === 0 ? <div className="empty-state">暂无兼职领取记录</div> : detail.claims.map((claim) => <CleanClaimCard key={claim.id} claim={claim} actionPending={actionPending} onAction={onAction} />)}</section>
    <section className="clean-requirements"><strong>提交要求</strong><span>{detail.submitRequirements?.note as string ?? '请提交公开可访问链接和发布截图。'}</span>{detail.complianceRequirements ? <small>{detail.complianceRequirements}</small> : null}</section>
  </section>;
}

function CleanClaimCard({ claim, actionPending, onAction }: { claim: TaskDetail['claims'][number]; actionPending: boolean; onAction: (input: CleanActionInput) => void }) {
  const submission = claim.submission;
  return <article className="clean-claim-card"><div className="clean-claim-head"><div><strong>{claim.userName}{claim.executorAccountName ? ` · ${claim.executorAccountName}` : ''}</strong><small>领取于 {new Date(claim.claimedAt).toLocaleString()}</small></div><span className="claim-badge">{CLAIM_STATUS_LABEL[claim.status as keyof typeof CLAIM_STATUS_LABEL] ?? claim.status}</span></div>{!submission ? <p className="clean-muted">尚未提交结果</p> : <><div className="clean-submission-status"><span>提交于 {new Date(submission.submittedAt).toLocaleString()}</span><strong>{submission.status === 'PENDING_REVIEW' ? '待审核' : submission.status === 'APPROVED' ? '已通过' : '待补充'}</strong></div>{submission.linkUrl ? <a className="clean-link" href={submission.linkUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} />打开发布链接</a> : <p className="clean-muted">未提交发布链接</p>}{submission.screenshots?.length ? <div className="clean-image-grid">{submission.screenshots.map((src, index) => <a href={src} target="_blank" rel="noreferrer" key={`${submission.id}-${index}`}><img src={src} alt={`提交截图 ${index + 1}`} /></a>)}</div> : null}{submission.textContent ? <div className="clean-note"><strong>提交说明</strong><p>{submission.textContent}</p></div> : null}{submission.reviewComment ? <div className="clean-review-note"><strong>审核意见</strong><p>{submission.reviewComment}</p></div> : null}{submission.status === 'PENDING_REVIEW' ? <div className="clean-review-buttons"><button className="approve-action" type="button" disabled={actionPending} onClick={() => onAction({ kind: 'approve', submissionId: submission.id })}><CheckCircle2 size={16} />通过</button><button className="reject-action" type="button" disabled={actionPending} onClick={() => onAction({ kind: 'reject', submissionId: submission.id })}><XCircle size={16} />退回</button></div> : null}</>}</article>;
}

function CleanSubmissionPage({ detail, selectedClaim, actionPending, onAction, onClose }: { detail: TaskDetail; selectedClaim: NonNullable<TaskDetail['claims'][number]>; actionPending: boolean; onAction: (input: CleanActionInput) => void; onClose: () => void }) {
  const [linkUrl, setLinkUrl] = useState(selectedClaim.submission?.linkUrl ?? '');
  const [textContent, setTextContent] = useState(selectedClaim.submission?.textContent ?? '');
  const [screenshots, setScreenshots] = useState<string[]>(selectedClaim.submission?.screenshots ?? []);
  const editing = Boolean(selectedClaim.submission);
  const ready = /^https?:\/\/.+/.test(linkUrl) && screenshots.length > 0;
  return <section className="clean-task-page"><header className="clean-task-header"><button className="back-button" type="button" onClick={onClose} aria-label="返回">‹</button><div><div className="eyebrow">兼职任务</div><h2>{editing ? '修改提交材料' : '提交任务结果'}</h2></div><span className="operator-detail-status">{CLAIM_STATUS_LABEL[selectedClaim.status as keyof typeof CLAIM_STATUS_LABEL]}</span></header><section className="clean-task-overview"><h3>{detail.title}</h3><p>{detail.description || '暂无任务说明'}</p><TaskFacts detail={detail} /></section>{selectedClaim.submission?.reviewComment ? <div className="clean-review-note"><strong>运营退回说明</strong><p>{selectedClaim.submission.reviewComment}</p></div> : null}<section className="clean-form-section"><label>发布链接<input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="粘贴公开可访问的内容链接" /></label><label>发布截图<CleanScreenshotPicker screenshots={screenshots} onChange={setScreenshots} /></label><label>提交说明<textarea value={textContent} onChange={(event) => setTextContent(event.target.value)} placeholder="填写发布账号、内容场景或补充说明" /></label></section><div className="clean-confirm">提交前确认：链接真实有效，截图与发布内容一致，且内容符合平台及基金宣传合规要求。</div><button className="primary-action" type="button" disabled={!ready || actionPending} onClick={() => onAction(editing ? { kind: 'update', submissionId: selectedClaim.submission?.id, linkUrl, textContent, screenshots } : { kind: 'submit', claimId: selectedClaim.id, linkUrl, textContent, screenshots })}><Send size={17} />{editing ? '保存修改并重新提交' : '提交审核'}</button></section>;
}

function CleanTaskDetailPanel({ detail, selectedClaim, accountSummary, actionPending, onAction, onClose }: { detail: TaskDetail; selectedClaim?: TaskDetail['claims'][number]; accountSummary?: { accounts: Array<{ id: string; platform: string; accountName: string; accountUid?: string | null; status: string }>; accountCount: number; activeTaskCount: number; availableTaskSlots: number }; actionPending: boolean; onAction: (input: CleanActionInput) => void; onClose: () => void }) {
  const canClaim = !selectedClaim && ['PUBLISHED', 'IN_PROGRESS'].includes(detail.status);
  const matchingAccounts = accountSummary?.accounts.filter((account) => account.status === 'ACTIVE' && account.platform === detail.platform) ?? [];
  const remaining = Math.max(0, detail.quota - detail.claimedCount);
  const claimableCount = Math.min(matchingAccounts.length, remaining);
  return <section className="clean-task-page"><header className="clean-task-header"><button className="back-button" type="button" onClick={onClose} aria-label="返回">‹</button><div><div className="eyebrow">任务详情</div><h2>{detail.title}</h2></div><span className="operator-detail-status">{TASK_STATUS_LABEL[detail.status]}</span></header><section className="clean-task-overview"><p>{detail.description || '暂无任务说明'}</p><TaskFacts detail={detail} /></section>{detail.complianceRequirements ? <section className="clean-requirements"><strong>合规要求</strong><span>{detail.complianceRequirements}</span></section> : null}{canClaim ? <section className="claim-capacity-panel"><div><strong>{claimableCount}</strong><span>本次可领取名额</span></div><p>你有 {matchingAccounts.length} 个{detail.platform}发布账号，任务剩余 {remaining} 个名额，系统会按较小值分配。</p>{matchingAccounts.length ? <small>{matchingAccounts.slice(0, 3).map((account) => account.accountName).join('、')}{matchingAccounts.length > 3 ? ` 等 ${matchingAccounts.length} 个账号` : ''}</small> : <small>请先到「我的」添加{detail.platform}发布账号。</small>}</section> : null}{canClaim ? <button className="primary-action" type="button" disabled={actionPending || claimableCount <= 0} onClick={() => onAction({ kind: 'claim', taskId: detail.id })}><ListChecks size={17} />{claimableCount > 0 ? `领取 ${claimableCount} 个名额` : '暂无可用账号'}</button> : null}{selectedClaim ? <CleanClaimCard claim={selectedClaim} actionPending={actionPending} onAction={onAction} /> : null}</section>;
}

function CleanScreenshotPicker({ screenshots, onChange }: { screenshots: string[]; onChange: (items: string[]) => void }) {
  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 3 - screenshots.length);
    Promise.all(files.map((file) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); }))).then((items) => onChange([...screenshots, ...items]));
    event.target.value = '';
  };
  return <div className="clean-screenshot-picker"><div className="clean-image-grid">{screenshots.map((src, index) => <div className="clean-image-item" key={src}><img src={src} alt={`发布截图 ${index + 1}`} /><button type="button" aria-label="删除截图" onClick={() => onChange(screenshots.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14} /></button></div>)}{screenshots.length < 3 ? <label className="clean-image-add"><ImagePlus size={18} /><span>添加截图</span><input type="file" accept="image/*" multiple onChange={handleFiles} /></label> : null}</div><small>至少 1 张，最多 3 张</small></div>;
}

function OperatorTaskDetailPage({ detail, actionPending, onAction, onClose }: { detail: TaskDetail; actionPending: boolean; onAction: (input: { kind: ActionKind; taskId?: string; submissionId?: string }) => void; onClose: () => void }) {
  const submittedCount = detail.claims.filter((claim) => Boolean(claim.submission)).length;
  const reviewCount = detail.claims.filter((claim) => claim.submission?.status === 'PENDING_REVIEW').length;
  const approvedCount = detail.claims.filter((claim) => claim.status === 'APPROVED').length;

  return <section className="operator-detail-page">
    <header className="operator-detail-topbar">
      <button className="back-button" type="button" onClick={onClose} aria-label="返回">‹</button>
      <div><div className="eyebrow">运营查看 · 任务详情</div><h2>{detail.title}</h2></div>
      <span className="operator-detail-status">{TASK_STATUS_LABEL[detail.status]}</span>
    </header>
    <section className="operator-overview">
      <p className="operator-description">{detail.description || '暂无任务说明'}</p>
      <div className="operator-meta-grid">
        <span>基金公司<strong>{detail.organization.name}</strong></span>
        <span>基金产品<strong>{detail.fundProduct?.name ?? '未关联'}</strong></span>
        <span>发布平台<strong>{detail.platform}</strong></span>
        <span>截止时间<strong>{new Date(detail.dueAt).toLocaleString()}</strong></span>
        <span>执行名额<strong>{detail.quota} 人</strong></span>
        <span>单人奖励<strong>{detail.rewardPoints} 分</strong></span>
      </div>
      {detail.status === 'DRAFT' ? <div className="operator-page-actions"><button className="primary-action" type="button" disabled={actionPending} onClick={() => onAction({ kind: 'publish', taskId: detail.id })}><Send size={17} />发布任务</button></div> : null}
      {['PUBLISHED', 'IN_PROGRESS'].includes(detail.status) ? <div className="operator-page-actions operator-page-actions-grid"><button className="secondary-action" type="button" disabled={actionPending} onClick={() => onAction({ kind: 'remind', taskId: detail.id })}><Bell size={16} />提醒执行人员</button><button className="danger-action" type="button" disabled={actionPending} onClick={() => onAction({ kind: 'unpublish', taskId: detail.id })}><XCircle size={16} />下架任务</button></div> : null}
    </section>
    <div className="operator-flow"><FlowStep done={detail.status !== 'DRAFT'} label="任务发布" /><FlowStep done={detail.claimedCount > 0} label="兼职领取" /><FlowStep done={submittedCount > 0} label="提交材料" /><FlowStep done={approvedCount > 0} label="审核结算" /></div>
    <section className="operator-kpi-grid"><div><span>已领取</span><strong>{detail.claimedCount}/{detail.quota}</strong></div><div><span>已提交</span><strong>{submittedCount}</strong></div><div><span>待审核</span><strong className={reviewCount ? 'operator-kpi-alert' : ''}>{reviewCount}</strong></div><div><span>已通过</span><strong>{approvedCount}</strong></div></section>
    <section className="operator-materials">
      <div className="operator-section-heading"><div><h3>执行提交材料</h3><p>逐人查看发布链接、截图和提交说明</p></div><span>{detail.claims.length} 人</span></div>
      {detail.claims.length === 0 ? <div className="empty-state">暂无兼职领取，任务发布后会在这里显示执行记录</div> : <div className="operator-claim-list">{detail.claims.map((claim) => <OperatorClaimCard key={claim.id} claim={claim} actionPending={actionPending} onAction={onAction} />)}</div>}
    </section>
    <section className="operator-requirements"><strong>提交要求</strong><span>{detail.submitRequirements?.note as string ?? '请提交公开可访问链接和发布截图，内容需符合平台及基金宣传合规要求。'}</span>{detail.complianceRequirements ? <small>{detail.complianceRequirements}</small> : null}</section>
  </section>;
}

function OperatorClaimCard({ claim, actionPending, onAction }: { claim: TaskDetail['claims'][number]; actionPending: boolean; onAction: (input: { kind: ActionKind; submissionId?: string }) => void }) {
  const submission = claim.submission;
  const claimLabel = CLAIM_STATUS_LABEL[claim.status as keyof typeof CLAIM_STATUS_LABEL] ?? claim.status;
  return <article className="operator-claim-card">
    <div className="operator-claim-heading"><div><strong>{claim.userName}{claim.executorAccountName ? ` · ${claim.executorAccountName}` : ''}</strong><small>领取于 {new Date(claim.claimedAt).toLocaleString()}</small></div><span className={`claim-badge claim-${claim.status.toLowerCase()}`}>{claimLabel}</span></div>
    {!submission ? <div className="operator-no-submission">尚未提交结果，等待兼职完成发布。</div> : <>
      <div className="operator-submission-heading"><span>提交于 {new Date(submission.submittedAt).toLocaleString()}</span><span className={`submission-status status-${submission.status.toLowerCase()}`}>{submission.status === 'PENDING_REVIEW' ? '待审核' : submission.status === 'APPROVED' ? '已通过' : '已退回'}</span></div>
      {submission.linkUrl ? <a className="operator-material-link" href={submission.linkUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} />打开发布链接<span>{submission.linkUrl}</span></a> : <div className="operator-missing-material">未提交发布链接</div>}
      {submission.screenshots?.length ? <div className="operator-screenshot-grid">{submission.screenshots.map((src, index) => <a href={src} target="_blank" rel="noreferrer" key={`${submission.id}-${index}`}><img src={src} alt={`提交截图 ${index + 1}`} /></a>)}</div> : <div className="operator-missing-material">未提交截图</div>}
      {submission.textContent ? <div className="operator-text-content"><strong>提交说明</strong><p>{submission.textContent}</p></div> : null}
      {submission.reviewComment ? <div className="operator-review-comment"><strong>审核意见</strong><span>{submission.reviewComment}</span></div> : null}
      {submission.status === 'PENDING_REVIEW' ? <div className="operator-review-actions"><button className="approve-action" type="button" disabled={actionPending} onClick={() => onAction({ kind: 'approve', submissionId: submission.id })}><CheckCircle2 size={16} />通过并结算</button><button className="reject-action" type="button" disabled={actionPending} onClick={() => onAction({ kind: 'reject', submissionId: submission.id })}><XCircle size={16} />退回补充</button></div> : null}
    </>}
  </article>;
}

function TaskDetailPanel({ role, detail, selectedClaim, pendingSubmission, actionPending, onAction, onClose }: { role: Role; detail: TaskDetail; demo: Awaited<ReturnType<typeof bootstrapDemo>>['data']; selectedClaim?: TaskDetail['claims'][number]; pendingSubmission?: NonNullable<TaskDetail['claims'][number]['submission']>; actionPending: boolean; onAction: (input: { kind: ActionKind; taskId?: string; submissionId?: string; claimId?: string; linkUrl?: string; textContent?: string; screenshots?: string[] }) => void; onClose: () => void }) {
  const hasPendingClaim = selectedClaim?.status === 'PENDING_SUBMIT' || selectedClaim?.status === 'REWORKING';
  const canClaim = role === 'user' && !selectedClaim && ['PUBLISHED', 'IN_PROGRESS'].includes(detail.status);
  const [linkUrl, setLinkUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const submitReady = linkUrl.startsWith('http://') || linkUrl.startsWith('https://');
  return <section className="detail-drawer"><div className="detail-header"><div><div className="eyebrow">任务提交详情 · {TASK_STATUS_LABEL[detail.status]}</div><h2>{detail.title}</h2></div><button className="icon-button" type="button" aria-label="关闭" onClick={onClose}>×</button></div><p>{detail.description}</p><div className="detail-grid"><span>平台<strong>{detail.platform}</strong></span><span>奖励<strong>{detail.rewardPoints} 分</strong></span><span>截止<strong>{new Date(detail.dueAt).toLocaleDateString()}</strong></span><span>进度<strong>{detail.claimedCount}/{detail.quota}</strong></span></div><div className="flow-steps"><FlowStep done={detail.status !== 'DRAFT'} label="任务发布" /><FlowStep done={Boolean(selectedClaim)} label="执行领取" /><FlowStep done={Boolean(selectedClaim?.submission)} label="提交结果" /><FlowStep done={selectedClaim?.status === 'APPROVED'} label="审核结算" /></div><div className="compliance-note"><strong>提交要求</strong><span>{detail.submitRequirements?.note as string ?? '请提交公开可访问链接和发布截图，内容需符合平台及基金宣传合规要求。'}</span></div><div className="detail-actions">{role === 'operator' && detail.status === 'DRAFT' ? <button className="primary-action" type="button" disabled={actionPending} onClick={() => onAction({ kind: 'publish', taskId: detail.id })}><Send size={17} />发布任务</button> : null}{canClaim ? <button className="primary-action" type="button" disabled={actionPending} onClick={() => onAction({ kind: 'claim', taskId: detail.id })}><ListChecks size={17} />领取任务</button> : null}{hasPendingClaim ? <div className="submit-form"><label>发布链接<input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://..." /></label><ScreenshotPicker screenshots={screenshots} onChange={setScreenshots} /><label>提交说明<textarea value={textContent} onChange={(event) => setTextContent(event.target.value)} placeholder="补充发布账号、内容场景和截图说明" /></label><button className="primary-action" type="button" disabled={actionPending || !submitReady || screenshots.length === 0} onClick={() => onAction({ kind: 'submit', claimId: selectedClaim?.id, linkUrl, textContent, screenshots })}><Send size={17} />提交链接和截图</button></div> : null}{role === 'operator' && pendingSubmission ? <div className="review-actions"><button className="approve-action" type="button" disabled={actionPending} onClick={() => onAction({ kind: 'approve', submissionId: pendingSubmission.id })}><CheckCircle2 size={17} />通过并结算</button><button className="reject-action" type="button" disabled={actionPending} onClick={() => onAction({ kind: 'reject', submissionId: pendingSubmission.id })}><XCircle size={17} />退回补充</button></div> : null}</div><div className="claim-list"><strong>执行记录</strong>{detail.claims.length === 0 ? <span className="muted">暂无领取记录</span> : detail.claims.map((claim) => <div className="claim-row" key={claim.id}><span>{claim.userName}<small>{CLAIM_STATUS_LABEL[claim.status as keyof typeof CLAIM_STATUS_LABEL] ?? claim.status}</small></span>{claim.submission?.linkUrl ? <a href={claim.submission.linkUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /></a> : <span className="muted">待提交</span>}</div>)}</div></section>;
}

function ScreenshotPicker({ screenshots, onChange }: { screenshots: string[]; onChange: (items: string[]) => void }) {
  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 3 - screenshots.length);
    if (!files.length) return;
    Promise.all(files.map((file) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); }))).then((items) => onChange([...screenshots, ...items]));
    event.target.value = '';
  };
  return <div className="screenshot-field"><div className="field-label"><span>发布截图</span><small>至少 1 张，最多 3 张</small></div><div className="screenshot-grid">{screenshots.map((src, index) => <div className="screenshot-thumb" key={src}><img src={src} alt={`发布截图 ${index + 1}`} /><button type="button" aria-label="删除截图" onClick={() => onChange(screenshots.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14} /></button></div>)}{screenshots.length < 3 ? <label className="screenshot-add"><ImagePlus size={20} /><span>添加截图</span><input type="file" accept="image/*" multiple onChange={handleFiles} /></label> : null}</div></div>;
}

function FlowStep({ done, label }: { done: boolean; label: string }) { return <span className={done ? 'flow-step done' : 'flow-step'}><i />{label}</span>; }

function SubmissionPage({ detail, selectedClaim, actionPending, onAction, onClose }: { detail: TaskDetail; selectedClaim: NonNullable<TaskDetail['claims'][number]>; actionPending: boolean; onAction: (input: { kind: ActionKind; claimId?: string; submissionId?: string; linkUrl?: string; textContent?: string; screenshots?: string[] }) => void; onClose: () => void }) {
  const [linkUrl, setLinkUrl] = useState(selectedClaim.submission?.linkUrl ?? '');
  const [textContent, setTextContent] = useState(selectedClaim.submission?.textContent ?? '');
  const [screenshots, setScreenshots] = useState<string[]>(selectedClaim.submission?.screenshots ?? []);
  const submitReady = (linkUrl.startsWith('http://') || linkUrl.startsWith('https://')) && screenshots.length > 0;
  const editing = Boolean(selectedClaim.submission);
  return <section className="submission-page"><header className="submission-topbar"><button className="back-button" type="button" onClick={onClose} aria-label="返回">‹</button><div><div className="eyebrow">任务提交</div><h2>{editing ? '修改提交材料' : '提交完成结果'}</h2></div><span className="submission-step">3 / 4</span></header><section className="submission-task-card"><div className="submission-task-status">{daysLeft(detail.dueAt)} 天后截止 · {detail.platform}</div><h3>{detail.title}</h3><p>{detail.description}</p><div className="submission-reward">完成审核后可获得 <strong>{detail.rewardPoints} 积分</strong></div></section><TaskFacts detail={detail} />{selectedClaim.submission?.reviewComment ? <div className="rework-note"><strong>运营退回说明</strong><span>{selectedClaim.submission.reviewComment}</span></div> : null}<section className="submission-section"><div className="submission-section-title"><strong>1. 发布链接</strong><span>必填</span></div><input className="submission-input" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="粘贴公开可访问的内容链接" /></section><section className="submission-section"><div className="submission-section-title"><strong>2. 发布截图</strong><span>至少 1 张，最多 3 张</span></div><ScreenshotPicker screenshots={screenshots} onChange={setScreenshots} /></section><section className="submission-section"><div className="submission-section-title"><strong>3. 补充说明</strong><span>选填</span></div><textarea className="submission-textarea" value={textContent} onChange={(event) => setTextContent(event.target.value)} placeholder="可填写发布账号、内容场景或需要运营关注的信息" /></section><div className="submission-rule"><strong>提交前确认</strong><span>我确认链接真实有效，截图与发布内容一致，且内容符合平台及基金宣传合规要求。</span></div><button className="primary-action submission-submit" type="button" disabled={actionPending || !submitReady} onClick={() => onAction(editing ? { kind: 'update', submissionId: selectedClaim.submission?.id, linkUrl, textContent, screenshots } : { kind: 'submit', claimId: selectedClaim.id, linkUrl, textContent, screenshots })}><Send size={18} />{editing ? '保存修改并重新提交' : '提交审核'}</button></section>;
}

function TaskFacts({ detail }: { detail: TaskDetail }) {
  const showFundInfo = Boolean(detail.organization.id);
  const facts = showFundInfo
    ? [['基金公司', detail.organization.name], ['基金产品', detail.fundProduct?.name ?? '未关联'], ['活动名称', detail.campaignName ?? '未设置'], ['执行名额', `${detail.claimedCount}/${detail.quota} 人`], ['发布平台', detail.platform], ['截止时间', new Date(detail.dueAt).toLocaleDateString()]]
    : [['执行名额', `${detail.claimedCount}/${detail.quota} 人`], ['发布平台', detail.platform], ['截止时间', new Date(detail.dueAt).toLocaleDateString()], ['完成奖励', `${detail.rewardPoints} 积分`]];
  return <><TaskTitleBlock title={detail.title} /><section className="task-facts">{facts.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>{detail.originalTextVisible ? <OriginalTextBlock detail={detail} /> : showFundInfo ? null : <section className="original-text-locked">领取任务后查看基金公司提供的发布正文</section>}</>;
}

function OriginalTextBlock({ detail }: { detail: TaskDetail }) {
  if (!detail.originalTextVisible) return null;
  const text = detail.originalText || '暂无原文内容';
  return <section className="original-text-block"><div><strong>发布正文</strong><CopyButton text={text} label="正文" /></div><p>{text}</p></section>;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return <button className="copy-button" type="button" onClick={() => void copy()}><Copy size={14} />{copied ? '已复制' : `复制${label}`}</button>;
}

function TaskTitleBlock({ title }: { title: string }) {
  return <section className="task-title-block"><div><strong>任务标题</strong><CopyButton text={title} label="标题" /></div><p>{title}</p></section>;
}

function LegacyCreateTaskPanel({ demo, posts = [], pending, onClose, onCreated, onCreate }: { demo: Awaited<ReturnType<typeof bootstrapDemo>>['data']; posts?: FundTaskPost[]; pending: boolean; onClose: () => void; onCreated: (task: TaskListItem) => void; onCreate: (input: CreateTaskInput) => Promise<{ data: TaskListItem }> }) {
  const [form, setForm] = useState({ title: '', description: '', originalText: '', platform: '小红书', taskType: 'CONTENT_PUBLISH', campaignName: '八月稳健理财季', quota: '10', dueAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16), fundTaskPostId: posts[0]?.id ?? '' });
  const [error, setError] = useState<string>();
  const selectedPost = posts.find((post) => post.id === form.fundTaskPostId);
  const selectPost = (id: string) => { const post = posts.find((item) => item.id === id); setForm({ ...form, fundTaskPostId: id, title: post?.taskName ?? form.title, platform: post?.platform ?? form.platform, description: post?.postContent ?? form.description, originalText: post?.postContent ?? form.originalText }); };
  const submit = async () => { if (!form.title.trim()) return setError('请填写任务名称'); try { const result = await onCreate({ ...form, quota: Number(form.quota), organizationId: demo.organization.id, fundProductId: demo.fundProduct.id, dueAt: new Date(form.dueAt).toISOString() }); onCreated(result.data); } catch (reason) { setError(reason instanceof Error ? reason.message : '创建失败'); } };
  return <section className="modal-layer"><div className="modal-panel"><div className="detail-header"><div><div className="eyebrow">新建任务</div><h2>创建营销任务</h2></div><button className="icon-button" type="button" onClick={onClose}>×</button></div><label>任务名称<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="例如：月度基金内容种草任务" /></label><label>任务说明<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="说明发布场景、内容要求和交付物" /></label><label>任务原文<textarea value={form.originalText} onChange={(event) => setForm({ ...form, originalText: event.target.value })} placeholder="录入基金公司提供的正式原文，兼职领取后可见" /></label><div className="form-grid"><label>发布平台<select value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value })}><option>小红书</option><option>微信公众号</option><option>抖音</option></select></label><label>执行名额<input type="number" min="1" value={form.quota} onChange={(event) => setForm({ ...form, quota: event.target.value })} /></label></div><label>截止时间<input type="datetime-local" value={form.dueAt} onChange={(event) => setForm({ ...form, dueAt: event.target.value })} /></label>{error ? <div className="form-error">{error}</div> : null}<button className="primary-action" type="button" disabled={pending} onClick={submit}><Plus size={17} />创建草稿</button></div></section>;
}

function CreateTaskPanel({ demo, posts, pending, onClose, onCreated, onCreate }: { demo: Awaited<ReturnType<typeof bootstrapDemo>>['data']; posts: FundTaskPost[]; pending: boolean; onClose: () => void; onCreated: (task: TaskListItem) => void; onCreate: (input: CreateTaskInput) => Promise<{ data: TaskListItem }> }) {
  const [postId, setPostId] = useState(posts[0]?.id ?? '');
  const post = posts.find((item) => item.id === postId);
  const [quota, setQuota] = useState('10');
  const [dueAt, setDueAt] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16));
  const [error, setError] = useState<string>();
  const submit = async () => {
    if (!post) return setError('请先让基金人员填报帖子配置');
    try {
      const result = await onCreate({ title: post.taskName, description: post.postContent ?? post.postTitle ?? '', originalText: post.postContent ?? '', taskType: 'CONTENT_PUBLISH', platform: post.platform, campaignName: post.taskName, organizationId: demo.organization.id, fundProductId: demo.fundProduct.id, fundTaskPostId: post.id, quota: Number(quota), dueAt: new Date(dueAt).toISOString() });
      onCreated(result.data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '创建失败'); }
  };
  return <section className="modal-layer"><div className="modal-panel"><div className="detail-header"><div><div className="eyebrow">新建任务</div><h2>关联基金帖子</h2></div><button className="icon-button" type="button" onClick={onClose}>×</button></div><label>基金帖子配置<select value={postId} onChange={(event) => setPostId(event.target.value)}><option value="">请选择配置</option>{posts.map((item) => <option value={item.id} key={item.id}>{item.taskName} · {item.platform}</option>)}</select></label>{post ? <section className="panel"><strong>{post.postTitle || post.taskName}</strong><p>{post.postContent || '暂无帖子正文'}</p>{post.postUrl ? <a href={post.postUrl} target="_blank" rel="noreferrer">打开原帖链接</a> : null}</section> : null}<label>执行名额<input type="number" min="1" value={quota} onChange={(event) => setQuota(event.target.value)} /></label><label>截止时间<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>{error ? <div className="form-error">{error}</div> : null}<button className="primary-action" type="button" disabled={pending || !post} onClick={() => void submit()}><Plus size={17} />创建并关联</button></div></section>;
}

type OperatorFundProductOption = { id: string; name: string; code: string; organizationId: string; organizationName: string };

function CreateTaskPanelV2({ demo, fundProducts, selectedFundProductId, onFundProductChange, posts, loadingPosts, pending, onClose, onCreated, onCreate }: { demo: Awaited<ReturnType<typeof bootstrapDemo>>['data']; fundProducts: OperatorFundProductOption[]; selectedFundProductId: string; onFundProductChange: (fundProductId: string) => void; posts: FundTask[]; loadingPosts: boolean; pending: boolean; onClose: () => void; onCreated: (task: TaskListItem) => void; onCreate: (input: CreateTaskInput) => Promise<{ data: TaskListItem }> }) {
  const [postId, setPostId] = useState(posts[0]?.id ?? '');
  const [dueAt, setDueAt] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16));
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const selectedFundProduct = fundProducts.find((item) => item.id === selectedFundProductId) ?? fundProducts[0] ?? { id: demo.fundProduct.id, name: demo.fundProduct.name, code: demo.fundProduct.code, organizationId: demo.organization.id, organizationName: demo.organization.name };
  const post = posts.find((item) => item.id === postId);
  const postIds = posts.map((item) => item.id).join('|');
  const selectedFundName = selectedFundProduct.name || selectedFundProduct.organizationName;
  const selectedPostTitle = post ? withFundNamePrefix(post.taskName, selectedFundName) : '';
  useEffect(() => { setPostId(posts[0]?.id ?? ''); setError(undefined); }, [selectedFundProductId, postIds]);
  const submit = async () => {
    if (!post) return setError('请先选择有效的基金任务');
    if (submitting) return;
    const taskFundProduct = fundProducts.find((item) => item.id === post.fundProductId) ?? selectedFundProduct;
    const taskTitle = withFundNamePrefix(post.taskName, taskFundProduct.name || taskFundProduct.organizationName);
    setSubmitting(true);
    setError(undefined);
    try {
      const result = await onCreate({ title: taskTitle, description: post.posts.map((item) => item.content).join('\n\n'), originalText: post.posts.map((item) => item.content).join('\n\n'), taskType: 'CONTENT_PUBLISH', platform: post.platform, campaignName: post.taskName, organizationId: taskFundProduct.organizationId, fundProductId: taskFundProduct.id, fundTaskId: post.id, quota: post.postCount, dueAt: new Date(dueAt).toISOString() });
      onCreated(result.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };
  return <section className="modal-layer"><div className="modal-panel"><div className="detail-header"><div><div className="eyebrow">新建任务</div><h2>选择基金任务</h2></div><button className="icon-button" type="button" onClick={onClose}>×</button></div><label>基金公司 / 产品<select value={selectedFundProductId} onChange={(event) => { setPostId(''); onFundProductChange(event.target.value); }}>{fundProducts.map((item) => <option value={item.id} key={item.id}>{item.organizationName}{item.name !== item.organizationName ? ` · ${item.name}` : ''}</option>)}</select></label><label>基金任务<select value={postId} onChange={(event) => setPostId(event.target.value)}><option value="">{loadingPosts ? '正在加载基金任务...' : '请选择基金任务'}</option>{posts.map((item) => <option value={item.id} key={item.id}>{withFundNamePrefix(item.taskName, selectedFundName)} · {item.platform} · {item.postCount} 个名额</option>)}</select></label>{post ? <section className="panel"><strong>{selectedPostTitle}</strong><p>客户：{selectedFundProduct.organizationName}；平台：{post.platform}；将创建 1 个运营任务，名额 {post.postCount}</p>{post.posts.map((item, index) => <p key={item.id}>帖子 {index + 1}：{item.title}</p>)}</section> : <section className="panel empty-state">{loadingPosts ? '正在加载基金任务...' : `${selectedFundProduct.organizationName} 暂无已填报基金任务，请先切换基金或让基金账号填报内容任务`}</section>}<label>截止时间<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>{error ? <div className="form-error">{error}</div> : null}<button className="primary-action" type="button" disabled={pending || submitting || loadingPosts || !post} onClick={() => void submit()}><Plus size={17} />{submitting ? '创建中...' : '创建任务'}</button></div></section>;
}

function daysLeft(isoDate: string) { return Math.max(0, Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86400000)); }
