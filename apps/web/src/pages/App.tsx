import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CLAIM_STATUS_LABEL, PLATFORM_OPTIONS, TASK_STATUS_LABEL, type CreateTaskInput, type DashboardSummary, type DemoAccount, type FundTask, type FundTaskPost, type FundTaskProgress, type TaskDetail, type TaskListItem } from '@xlyq/shared';
import { Bell, CheckCircle2, ClipboardCheck, ClipboardList, Copy, ExternalLink, Home, ImagePlus, ListChecks, Plus, Send, ShieldCheck, Trash2, UserRound, WifiOff, XCircle, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type ChangeEvent } from 'react';
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
  getPoints,
  getTaskDetail,
  getTaskMarket,
  getTasks,
  login,
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
  const [demo, setDemo] = useState<Awaited<ReturnType<typeof bootstrapDemo>>['data']>();
  const [notice, setNotice] = useState<string>();
  const [showCreate, setShowCreate] = useState(false);
  const [myTaskTab, setMyTaskTab] = useState<'all' | 'todo' | 'review' | 'done'>('todo');
  const [view, setView] = useState<View>('home');

  const boot = useMutation({ mutationFn: bootstrapDemo, onSuccess: (result) => setDemo(result.data) });
  const auth = useMutation({ mutationFn: login, onSuccess: (result) => { queryClient.clear(); setSessionAccount(result.data); setAccountId(result.data.id); window.localStorage.setItem('xlyq_account', JSON.stringify(result.data)); window.localStorage.setItem('xlyq_account_id', result.data.id); if (result.data.token) window.localStorage.setItem('xlyq_session_token', result.data.token); setNotice(undefined); } });
  useEffect(() => { boot.mutate(); }, []);

  const health = useQuery({ queryKey: ['health'], queryFn: getHealth, retry: 1 });
  const accounts = demo ? [demo.operator, demo.fund, ...demo.executors] : [];
  const account = sessionAccount ?? accounts.find((item) => item.id === accountId);
  const role: Role = account?.role === 'operator' ? 'operator' : account?.role === 'fund' ? 'fund' : 'user';
  const executorId = account?.role === 'executor' ? account.id : undefined;
  const scopedFundProductId = account?.fundProductId ?? demo?.fundProduct.id;
  const dashboard = useQuery({ queryKey: ['operator-dashboard'], queryFn: getOperatorDashboard, retry: 1, enabled: Boolean(demo && role === 'operator') });
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: getTasks, retry: 1, enabled: Boolean(demo && role === 'operator') });
  const market = useQuery({ queryKey: ['task-market', executorId], queryFn: () => getTaskMarket(executorId, 'executor'), retry: 1, enabled: Boolean(demo && role === 'user') });
  const points = useQuery({ queryKey: ['points', executorId], queryFn: () => getPoints(executorId!), enabled: Boolean(executorId) });
  const myTasks = useQuery({ queryKey: ['my-tasks', executorId], queryFn: () => getMyTasks(executorId!), enabled: Boolean(executorId) });
  const executorAccounts = useQuery({ queryKey: ['executor-accounts', executorId], queryFn: () => getExecutorAccounts(executorId!), enabled: Boolean(executorId) });
  const fundPosts = useQuery({ queryKey: ['fund-posts', scopedFundProductId], queryFn: () => getFundPosts(scopedFundProductId!), enabled: Boolean(scopedFundProductId && ['operator', 'fund'].includes(role)) });
  const fundProgress = useQuery({ queryKey: ['fund-task-progress', account?.id, scopedFundProductId], queryFn: () => getFundTaskProgress(account!.id, scopedFundProductId!), enabled: Boolean(scopedFundProductId && role === 'fund' && account) });
  const detailViewerId = role === 'operator' ? account?.id : executorId;
  const detailViewerRole = role === 'operator' ? 'operator' : 'executor';
  const detail = useQuery({ queryKey: ['task-detail', selectedTaskId, detailViewerId, detailViewerRole], queryFn: () => getTaskDetail(selectedTaskId!, detailViewerId, detailViewerRole), enabled: Boolean(selectedTaskId && detailViewerId) });

  const refresh = () => {
    for (const key of ['operator-dashboard', 'tasks', 'task-market', 'task-detail', 'points', 'my-tasks', 'executor-accounts', 'fund-posts', 'fund-task-progress']) void queryClient.invalidateQueries({ queryKey: [key] });
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
    onSuccess: (_, input) => {
      setNotice(input.kind === 'claim' ? '已领取任务，请完成发布后提交结果' : input.kind === 'submit' ? '结果已提交，等待运营审核' : input.kind === 'update' ? '提交材料已更新，等待运营审核' : input.kind === 'approve' ? '审核通过，积分已到账' : input.kind === 'reject' ? '已退回执行员补充材料' : input.kind === 'unpublish' ? '任务已下架，兼职将无法继续领取' : input.kind === 'remind' ? '已提醒当前任务的执行人员' : '任务已发布');
      refresh();
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : '操作失败，请稍后重试'),
  });

  const visibleTasks = role === 'operator' ? (tasks.data?.data ?? []) : (market.data?.data ?? []);
  const navItems: Array<[View, string, LucideIcon]> = role === 'fund'
    ? [['home', '首页', Home], ['mine', '我的', UserRound]]
    : [['home', '首页', Home], ['tasks', role === 'operator' ? '任务' : '可接任务', ClipboardList], ['review', role === 'operator' ? '审核' : '进度', ShieldCheck], ['mine', '我的', UserRound]];
  const selectedClaim = detail.data?.data.claims.find((claim) => claim.userId === executorId);
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
      setSelectedTaskId(undefined);
      setView('home');
    };
    window.addEventListener('xlyq-auth-expired', handleAuthExpired);
    return () => window.removeEventListener('xlyq-auth-expired', handleAuthExpired);
  }, [queryClient]);

  if (!account) return <LoginPage loading={boot.isPending} submitting={auth.isPending} error={auth.error || boot.error} onLogin={authenticate} />;

  return <main className="app-shell">
    <header className="topbar"><div><div className="eyebrow">公募基金营销任务跟踪系统</div><h1>{roleLabels[role]}</h1></div><button className="icon-button" aria-label="消息"><Bell size={19} /></button></header>
    <section className="account-strip"><span className="identity-icon">{role === 'operator' ? <ClipboardCheck size={18} /> : <UserRound size={18} />}</span><span><strong>{account.name}</strong><small>{role === 'operator' ? '运营账号 · 发布任务、审核内容、管理结算' : '兼职账号 · 领取、发布、提交结果'}</small></span><button type="button" onClick={logout}>退出登录</button></section>
    <ServiceStatus loading={health.isLoading || boot.isPending} error={health.error || boot.error} status={health.data?.data.status} database={health.data?.data.database} />
    {notice ? <section className="notice-panel"><CheckCircle2 size={16} /><span>{notice}</span><button type="button" onClick={() => setNotice(undefined)} aria-label="关闭提示">×</button></section> : null}
    {view === 'home' && demo && role === 'operator' ? <OperatorHome summary={dashboard.data?.data} tasks={visibleTasks} loading={dashboard.isLoading} onSelect={setSelectedTaskId} onCreate={() => setShowCreate(true)} /> : null}
    {view === 'home' && demo && role === 'user' ? <UserHome market={visibleTasks} myTasks={myTasks.data?.data ?? []} points={points.data?.data} tab={myTaskTab} onTabChange={setMyTaskTab} onSelect={setSelectedTaskId} /> : null}
    {view === 'home' && demo && role === 'fund' && scopedFundProductId ? <><FundProgressPanel progress={fundProgress.data?.data ?? []} /><FundPostWorkspaceV2 posts={fundPosts.data?.data ?? []} progress={fundProgress.data?.data ?? []} onCreate={async (input) => { await createFundPost(account.id, scopedFundProductId, input); refresh(); }} /></> : null}
    {view === 'tasks' && demo ? <TaskWorkspace role={role} tasks={tasks.data?.data ?? []} market={market.data?.data ?? []} myTasks={myTasks.data?.data ?? []} onSelect={setSelectedTaskId} /> : null}
    {view === 'review' && demo ? <ReviewWorkspace role={role} tasks={tasks.data?.data ?? []} actions={dashboard.data?.data.actionQueue ?? []} myTasks={myTasks.data?.data ?? []} onSelect={setSelectedTaskId} /> : null}
    {view === 'mine' && demo ? <MineWorkspaceV3 role={role} accountName={account.name} username={account.username} points={points.data?.data} onLogout={logout} accountSummary={executorAccounts.data?.data} onAddAccount={executorId ? async (input) => { await createExecutorAccount(executorId, input); refresh(); } : undefined} /> : null}
    {!demo && !boot.isPending ? <section className="panel error-panel"><strong>演示数据初始化失败</strong><span>{boot.error?.message ?? '请刷新页面重试'}</span></section> : null}
    {selectedTaskId && detail.data?.data && role === 'operator' ? <CleanOperatorTaskDetailPage detail={detail.data.data} actionPending={action.isPending} onAction={(input) => action.mutate(input)} onClose={() => setSelectedTaskId(undefined)} /> : null}
    {selectedTaskId && detail.data?.data && role === 'user' && selectedClaim && ['PENDING_SUBMIT', 'REWORKING', 'PENDING_REVIEW'].includes(selectedClaim.status) ? <CleanSubmissionPage detail={detail.data.data} selectedClaim={selectedClaim} actionPending={action.isPending} onAction={(input) => action.mutate(input)} onClose={() => setSelectedTaskId(undefined)} /> : null}
    {selectedTaskId && detail.isLoading ? <section className="detail-loading" role="status">正在加载任务详情...</section> : null}
    {selectedTaskId && detail.error ? <section className="detail-loading detail-error" role="alert"><strong>任务详情加载失败</strong><span>{detail.error.message}</span><button type="button" onClick={() => void detail.refetch()}>重新加载</button></section> : null}
    {selectedTaskId && detail.data?.data && role === 'user' && !['PENDING_SUBMIT', 'REWORKING', 'PENDING_REVIEW'].includes(selectedClaim?.status ?? '') ? <CleanTaskDetailPanel detail={detail.data.data} selectedClaim={selectedClaim} actionPending={action.isPending} onAction={(input) => action.mutate(input)} onClose={() => setSelectedTaskId(undefined)} /> : null}
    {showCreate && demo ? <CreateTaskPanelV2 demo={demo} posts={fundPosts.data?.data ?? []} pending={action.isPending} onClose={() => setShowCreate(false)} onCreated={(task) => { setShowCreate(false); setSelectedTaskId(task.id); setNotice('任务已创建，名额按帖子数量生成'); refresh(); }} onCreate={async (input) => createTask(input)} /> : null}
    <nav className="bottom-nav" aria-label="底部导航" style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}>{navItems.map(([key, label, Icon]) => <button className={view === key ? 'active' : ''} type="button" key={key} onClick={() => { setSelectedTaskId(undefined); setView(key); }}><Icon size={18} /><span>{label}</span></button>)}</nav>
  </main>;
}

function LoginPage({ loading, submitting, error, onLogin }: { loading: boolean; submitting: boolean; error?: Error | null; onLogin: (username: string, password: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const canSubmit = username.trim().length > 0 && password.length > 0;
  if (loading) return <main className="login-shell"><section className="login-panel"><div className="eyebrow">公募基金营销任务跟踪系统</div><h1>正在准备登录</h1><p>正在连接业务服务，请稍候...</p></section></main>;
  return <main className="login-shell"><section className="login-panel"><div className="eyebrow">公募基金营销任务跟踪系统</div><h1>账号登录</h1><p>请输入账号和密码进入对应工作台。</p><form className="login-form" onSubmit={(event) => { event.preventDefault(); if (canSubmit) onLogin(username.trim(), password); }}><label>账号<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="请输入账号" /></label><label>密码<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="请输入密码" /></label>{error ? <div className="form-error">{error.message}</div> : null}<button className="primary-action" type="submit" disabled={!canSubmit || submitting}>{submitting ? '登录中...' : '登录'}</button></form><div className="login-hint">运营账号：admin<br />兼职账号：staff1、staff2、staff3<br />基金公司：fund1</div></section></main>;
}

type MyTaskRow = TaskListItem & { claimId: string; claimStatus: keyof typeof CLAIM_STATUS_LABEL; reviewComment?: string | null };

function TaskWorkspace({ role, tasks, market, myTasks, onSelect }: { role: Role; tasks: TaskListItem[]; market: TaskListItem[]; myTasks: MyTaskRow[]; onSelect: (id: string) => void }) {
  return <section className="workspace-page"><div className="page-heading"><div><div className="eyebrow">{role === 'operator' ? '运营管理' : '兼职执行'}</div><h2>任务</h2></div><span>{role === 'operator' ? `${tasks.length} 个任务` : `${market.length} 个可领取`}</span></div>{role === 'operator' ? <TaskSection title="全部任务" tasks={tasks} onSelect={onSelect} /> : <><TaskSection title="可领取任务" tasks={market} onSelect={onSelect} /><TaskSection title="我的任务" tasks={myTasks} onSelect={onSelect} /></>}</section>;
}

function ReviewWorkspace({ role, tasks, actions, myTasks, onSelect }: { role: Role; tasks: TaskListItem[]; actions: DashboardSummary['actionQueue']; myTasks: MyTaskRow[]; onSelect: (id: string) => void }) {
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

  return <section className="workspace-page"><div className="page-heading"><div><div className="eyebrow">账号中心</div><h2>我的</h2></div></div><section className="profile-panel"><div className="profile-avatar">{accountName.slice(-1)}</div><div><strong>{accountName}</strong><small>{username} · 兼职执行人员</small></div></section><section className="points-banner mine-points"><div><span>可用积分</span><strong>{points?.availablePoints ?? 0}</strong></div><div><span>可兑换</span><strong>¥{points?.cashValue?.toFixed(2) ?? '0.00'}</strong></div></section><section className="panel account-manager account-manager-v3"><div className="account-manager-heading"><div><h2>发布账号</h2><p>每个平台配置一个账号 ID，用于领取对应平台任务</p></div><strong>{activeAccounts.length}<small> 个可用</small></strong></div><div className="publishing-account-list">{activeAccounts.length ? activeAccounts.map((item) => <article className="publishing-account-card" key={item.id}><div className="publishing-account-meta"><span>{item.platform}</span><strong>{item.accountName}</strong><em>可用</em></div><div className="publishing-account-id"><span>账号 ID</span><code>{item.accountUid || item.accountName}</code></div></article>) : <div className="empty-state">还没有发布账号，请先添加</div>}</div><div className="account-add-form"><div className="account-add-form-heading"><div><h3>新增发布账号</h3><p>只需要填写平台和账号 ID，不需要密码</p></div></div><div className="account-add-fields"><label>发布平台<select value={platform} onChange={(event) => setPlatform(event.target.value)}>{PLATFORM_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label><label className="account-id-field">账号 ID<input value={accountUid} onChange={(event) => setAccountUid(event.target.value)} placeholder="请输入平台账号 ID" autoComplete="off" /></label></div>{error ? <div className="form-error">{error}</div> : null}<button className="primary-action" type="button" disabled={!accountUid.trim() || adding} onClick={() => void submit()}><Plus size={16} />{adding ? '保存中...' : '保存发布账号'}</button></div></section><button className="secondary-action" type="button" onClick={onLogout}>退出登录</button></section>;
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
  return <section className="workspace-page"><div className="page-heading"><div><div className="eyebrow">基金内容协同</div><h2>任务帖子填报</h2></div><span>{posts.length} 个基金任务</span></div><section className="panel"><div className="section-heading"><div><h2>新增基金任务</h2><p className="section-caption">任务名和发布平台必填；一个任务可添加 N 个帖子，任务数按帖子数量生成</p></div></div><label>任务名称（必填）<input value={form.taskName} onChange={(event) => setForm({ ...form, taskName: event.target.value })} /></label><label>发布平台（必填）<select value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value })}>{PLATFORM_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label><div className="section-heading"><h3>帖子列表（至少 1 条）</h3><button className="secondary-action" type="button" onClick={() => setItems([...items, { title: '', content: '', url: '' }])}><Plus size={16} />添加帖子</button></div>{items.map((item, index) => <div className="panel" key={index}><strong>帖子 {index + 1}</strong><label>标题（必填）<input value={item.title} onChange={(event) => updateItem(index, 'title', event.target.value)} /></label><label>正文（必填）<textarea value={item.content} onChange={(event) => updateItem(index, 'content', event.target.value)} /></label><label>链接（选填）<input value={item.url} onChange={(event) => updateItem(index, 'url', event.target.value)} /></label>{items.length > 1 ? <button className="secondary-action" type="button" onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))}>删除此帖子</button> : null}</div>)}<button className="primary-action" type="button" disabled={!form.taskName.trim() || items.some((item) => !item.title.trim() || !item.content.trim())} onClick={() => void submit()}><Plus size={16} />保存基金任务</button></section><section className="panel task-panel"><div className="section-heading"><h2>已填报基金任务</h2><span>{posts.length} 个</span></div>{posts.map((task) => <article className="task-item" key={task.id}><div className="task-title-row"><h3>{task.taskName}</h3><span>{task.platform} · {task.postCount} 个任务</span></div>{task.posts.map((post, index) => <p key={post.id}>帖子 {index + 1}：{post.title}</p>)}</article>)}</section></section>;
}

type DraftFundPost = { title: string; content: string; url: string };

function FundPostEditorV2({ posts, progress, onCreate }: { posts: FundTask[]; progress: FundTaskProgress[]; onCreate: (input: { taskName: string; platform: string; posts: Array<{ title: string; content: string; url?: string }> }) => Promise<void> }) {
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [taskName, setTaskName] = useState('');
  const [platform, setPlatform] = useState<string>(PLATFORM_OPTIONS[0]);
  const [items, setItems] = useState<DraftFundPost[]>([{ title: '', content: '', url: '' }]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const reset = () => {
    setMode('list');
    setTaskName('');
    setPlatform(PLATFORM_OPTIONS[0]);
    setItems([{ title: '', content: '', url: '' }]);
    setActiveIndex(0);
    setError(undefined);
  };

  const updateItem = (key: keyof DraftFundPost, value: string) => {
    setItems((current) => current.map((item, index) => index === activeIndex ? { ...item, [key]: value } : item));
  };

  const addItem = () => {
    setItems((current) => [...current, { title: '', content: '', url: '' }]);
    setActiveIndex(items.length);
    setError(undefined);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    const nextItems = items.filter((_, itemIndex) => itemIndex !== index);
    setItems(nextItems);
    setActiveIndex(Math.min(activeIndex, nextItems.length - 1));
  };

  const save = async () => {
    if (!taskName.trim()) return setError('请先填写任务名称');
    if (items.some((item) => !item.title.trim() || !item.content.trim())) return setError('请补全每条帖子的标题和正文');
    if (saving) return;
    setSaving(true);
    setError(undefined);
    try {
      await onCreate({ taskName: taskName.trim(), platform, posts: items.map((item) => ({ title: item.title.trim(), content: item.content.trim(), url: item.url.trim() || undefined })) });
      reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  if (mode === 'list') {
    return <section className="fund-post-workspace"><div className="fund-post-heading"><div><div className="eyebrow">内容资料管理</div><h2>任务帖子填报</h2><p>先查看已填报任务，需要新增时再开始编辑</p></div><button className="primary-action fund-new-task-button" type="button" onClick={() => { setMode('create'); setError(undefined); }}><Plus size={17} />新建任务</button></div><section className="fund-task-list"><div className="fund-section-heading"><div><h3>已填报任务</h3><span>提交后会生成对应执行任务</span></div><strong>{posts.length} 个</strong></div>{posts.length === 0 ? <div className="fund-empty-state">还没有填报任务，点击上方开始创建</div> : posts.map((task) => { const taskProgress = progress.find((item) => item.id === task.id); return <article className="fund-task-card" key={task.id}><div className="fund-task-card-head"><div><span className="fund-platform-tag">{task.platform}</span><h3>{task.taskName}</h3></div><strong>{task.postCount} 条帖子</strong></div><div className="fund-task-card-progress"><span>执行进度</span><div><i style={{ width: `${Math.min(100, taskProgress?.completionRate ?? 0)}%` }} /></div><b>{taskProgress?.completionRate ?? 0}%</b></div><div className="fund-post-preview">{task.posts.slice(0, 2).map((post, index) => <div key={post.id}><span>{index + 1}</span><p>{post.title}</p></div>)}{task.posts.length > 2 ? <small>还有 {task.posts.length - 2} 条帖子</small> : null}</div></article>; })}</section></section>;
  }

  const activeItem = items[activeIndex];
  return <section className="fund-post-workspace"><div className="fund-post-heading fund-create-heading"><div><button className="text-back-button" type="button" onClick={reset}>‹ 返回任务列表</button><div className="eyebrow">新建内容任务</div><h2>填写任务帖子</h2><p>先填写任务基本信息，再逐条添加要发布的帖子</p></div></div><section className="fund-create-form"><div className="fund-form-section"><div className="fund-section-heading"><div><h3>1. 任务基本信息</h3><span>这些信息会同步给运营人员</span></div></div><label>任务名称<input value={taskName} onChange={(event) => setTaskName(event.target.value)} placeholder="例如：八月稳健理财内容推广" /></label><label>发布平台<select value={platform} onChange={(event) => setPlatform(event.target.value)}>{PLATFORM_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label></div><div className="fund-form-section"><div className="fund-section-heading"><div><h3>2. 帖子内容</h3><span>共 {items.length} 条，点击下方卡片切换编辑</span></div><button className="secondary-action" type="button" onClick={addItem}><Plus size={15} />新增一条</button></div><div className="fund-draft-list">{items.map((item, index) => <button className={`fund-draft-item ${index === activeIndex ? 'active' : ''}`} type="button" key={index} onClick={() => { setActiveIndex(index); setError(undefined); }}><span>{index + 1}</span><div><strong>{item.title.trim() || `帖子 ${index + 1}`}</strong><small>{item.content.trim() ? `${item.content.trim().slice(0, 42)}${item.content.trim().length > 42 ? '...' : ''}` : '待填写正文'}</small></div><em>{item.title.trim() && item.content.trim() ? '已填写' : '待填写'}</em></button>)}</div><article className="fund-post-editor-card"><div className="fund-editor-card-head"><div><span>正在编辑第 {activeIndex + 1} 条</span><h3>{activeItem.title.trim() || '未命名帖子'}</h3></div>{items.length > 1 ? <button className="icon-button" type="button" aria-label="删除当前帖子" onClick={() => removeItem(activeIndex)}><Trash2 size={16} /></button> : null}</div><label>帖子标题<input value={activeItem.title} onChange={(event) => updateItem('title', event.target.value)} placeholder="输入本条帖子的标题" /></label><label>帖子正文<textarea value={activeItem.content} onChange={(event) => updateItem('content', event.target.value)} placeholder="粘贴或填写基金公司确认后的正式发布正文" /></label><label>原帖链接 <span className="optional-label">选填</span><input value={activeItem.url} onChange={(event) => updateItem('url', event.target.value)} placeholder="如有原帖或参考链接，可粘贴在这里" /></label></article></div></section>{error ? <div className="form-error fund-form-error">{error}</div> : null}<div className="fund-create-actions"><button className="secondary-action" type="button" onClick={reset}>取消</button><button className="primary-action" type="button" disabled={saving} onClick={() => void save()}><CheckCircle2 size={16} />{saving ? '保存中...' : `保存任务 · ${items.length} 条帖子`}</button></div></section>;
}

function FundPostWorkspaceV2({ posts, progress, onCreate }: { posts: FundTask[]; progress: FundTaskProgress[]; onCreate: (input: { taskName: string; platform: string; posts: Array<{ title: string; content: string; url?: string }> }) => Promise<void> }) {
  return <><FundProgressPanel progress={progress} /><FundPostEditorV2 posts={posts} progress={progress} onCreate={onCreate} /></>;
}

function FundProgressPanel({ progress }: { progress: FundTaskProgress[] }) {
  const totals = progress.reduce((sum, item) => ({ postCount: sum.postCount + item.postCount, claimedCount: sum.claimedCount + item.claimedCount, submittedCount: sum.submittedCount + item.submittedCount, approvedCount: sum.approvedCount + item.approvedCount }), { postCount: 0, claimedCount: 0, submittedCount: 0, approvedCount: 0 });
  const rate = totals.postCount ? Math.round((totals.approvedCount / totals.postCount) * 100) : 0;
  return <section className="panel"><div className="section-heading"><div><h2>我的任务完成情况</h2><p className="section-caption">基金任务与运营执行结果</p></div><span>{rate}% 总完成率</span></div><div className="stat-grid"><article className="stat-card"><span>计划帖子</span><strong>{totals.postCount}</strong></article><article className="stat-card"><span>已领取</span><strong>{totals.claimedCount}</strong></article><article className="stat-card"><span>已提交</span><strong>{totals.submittedCount}</strong></article><article className="stat-card"><span>已通过</span><strong>{totals.approvedCount}</strong></article></div>{progress.map((item) => <div className="task-meta" key={item.id}><strong>{item.taskName}</strong><span>{item.platform}</span><span>计划 {item.postCount} / 通过 {item.approvedCount}</span><span>{item.completionRate}%</span></div>)}</section>;
}

function ServiceStatus({ loading, error, status, database }: { loading: boolean; error: Error | null; status?: 'ok' | 'degraded'; database?: 'ok' | 'error' }) {
  if (loading) return <section className="service-status">正在准备演示环境...</section>;
  if (error || status !== 'ok' || database !== 'ok') return <section className="service-status warning"><WifiOff size={16} /><span>接口或数据库暂不可用</span></section>;
  return <section className="service-status ok"><CheckCircle2 size={16} />服务连接正常</section>;
}

function OperatorHome({ summary, tasks, loading, onSelect, onCreate }: { summary?: DashboardSummary; tasks: TaskListItem[]; loading: boolean; onSelect: (id: string) => void; onCreate: () => void }) {
  return <>
    <button className="primary-action" type="button" onClick={onCreate}><Plus size={18} />创建营销任务</button>
    <StatGrid stats={[['待发布', summary?.pendingPublish ?? 0], ['待审核', summary?.pendingReview ?? 0], ['进行中', summary?.inProgress ?? 0], ['三日内截止', summary?.todayDue ?? 0]]} loading={loading} />
    <OperatorQueue actions={summary?.actionQueue ?? []} onSelect={onSelect} />
    <CustomerSnapshotCard snapshot={summary?.customerSnapshot ?? null} />
    <TaskHealthCard stats={summary?.taskStats ?? []} />
    <TaskSection title="任务列表" tasks={tasks} onSelect={onSelect} />
  </>;
}

function OperatorQueue({ actions, onSelect }: { actions: DashboardSummary['actionQueue']; onSelect: (id: string) => void }) {
  return <section className="panel queue-panel">
    <div className="section-heading"><div><h2>今日待办</h2><p className="section-caption">按优先级处理，完成后队列会自动刷新</p></div><span>{actions.length} 项</span></div>
    {actions.length === 0 ? <div className="empty-state compact-empty">当前没有待处理事项</div> : <div className="action-queue">{actions.map((action) => <button className={`queue-item priority-${action.priority.toLowerCase()}`} key={action.id} type="button" onClick={() => onSelect(action.taskId)}><span className="queue-mark">{action.type === 'REVIEW_SUBMISSION' ? <ClipboardCheck size={17} /> : action.type === 'PUBLISH_TASK' ? <Send size={17} /> : <Bell size={17} />}</span><span className="queue-copy"><strong>{action.title}</strong><small>{action.description}</small></span><span className="queue-arrow">›</span></button>)}</div>}
  </section>;
}

function CustomerSnapshotCard({ snapshot }: { snapshot: DashboardSummary['customerSnapshot'] }) {
  if (!snapshot) return null;
  return <section className="panel customer-panel"><div className="section-heading"><div><h2>基金公司项目</h2><p className="section-caption">运营侧客户协同视图</p></div><span className="customer-status">进行中</span></div><div className="customer-title"><strong>{snapshot.organizationName}</strong><span>{snapshot.fundProductName}</span></div><div className="customer-metrics"><div><strong>{snapshot.completionRate}%</strong><span>完成率</span></div><div><strong>{snapshot.activeTasks}</strong><span>进行中任务</span></div><div><strong>{snapshot.pendingReview}</strong><span>待审核</span></div><div><strong>{snapshot.availablePoints}</strong><span>积分成本</span></div></div><div className="customer-progress"><span style={{ width: `${Math.min(100, snapshot.completionRate)}%` }} /></div><div className="customer-foot"><span>已领取 {snapshot.claimedCount} / 已通过 {snapshot.approvedCount}</span><button type="button">查看客户项目</button></div></section>;
}

function TaskHealthCard({ stats }: { stats: DashboardSummary['taskStats'] }) {
  return <section className="panel health-panel"><div className="section-heading"><div><h2>任务健康度</h2><p className="section-caption">快速识别积压和异常</p></div></div><div className="health-list">{stats.map((item) => <div className="health-row" key={item.key}><span>{item.label}</span><div className="health-bar"><i style={{ width: `${Math.min(100, item.count * 10)}%` }} /></div><strong>{item.count}</strong></div>)}</div></section>;
}

function UserHome({ market, myTasks, points, tab, onTabChange, onSelect }: { market: TaskListItem[]; myTasks: Array<TaskListItem & { claimId: string; claimStatus: keyof typeof CLAIM_STATUS_LABEL; reviewComment?: string | null }>; points?: { availablePoints: number; cashValue: number }; tab: 'all' | 'todo' | 'review' | 'done'; onTabChange: (tab: 'all' | 'todo' | 'review' | 'done') => void; onSelect: (id: string) => void }) {
  const filtered = myTasks.filter((task) => tab === 'all' || (tab === 'todo' && ['PENDING_SUBMIT', 'REWORKING'].includes(task.claimStatus)) || (tab === 'review' && task.claimStatus === 'PENDING_REVIEW') || (tab === 'done' && task.claimStatus === 'APPROVED'));
  return <><section className="points-banner"><div><span>可用积分</span><strong>{points?.availablePoints ?? 0}</strong></div><div><span>可兑换</span><strong>¥{points?.cashValue?.toFixed(2) ?? '0.00'}</strong></div></section><StatGrid stats={[['待处理', myTasks.filter((task) => ['PENDING_SUBMIT', 'REWORKING'].includes(task.claimStatus)).length], ['审核中', myTasks.filter((task) => task.claimStatus === 'PENDING_REVIEW').length], ['已通过', myTasks.filter((task) => task.claimStatus === 'APPROVED').length], ['可领取', market.length]]} /><section className="personal-tabs">{([['todo', '待处理'], ['review', '审核中'], ['done', '已完成'], ['all', '全部任务']] as const).map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} type="button" onClick={() => onTabChange(key)}>{label}</button>)}</section>{tab === 'all' || tab === 'todo' ? <TaskSection title="任务大厅" tasks={market} onSelect={onSelect} /> : null}<section className="panel task-panel"><div className="section-heading"><div><h2>我的任务</h2><p className="section-caption">每个任务都有明确的下一步动作</p></div><span>{filtered.length} 条</span></div>{filtered.length === 0 ? <div className="empty-state">当前没有对应任务</div> : <div className="my-task-list">{filtered.map((task) => <button className="my-task-item" type="button" key={task.claimId} onClick={() => onSelect(task.id)}><div><strong>{task.title}</strong><small>{task.platform} · {daysLeft(task.dueAt)} 天截止</small></div><span className={`claim-badge claim-${task.claimStatus.toLowerCase()}`}>{CLAIM_STATUS_LABEL[task.claimStatus]}</span>{task.reviewComment ? <p>{task.reviewComment}</p> : null}</button>)}</div>}</section></>;
}

function StatGrid({ stats, loading = false }: { stats: Array<[string, number]>; loading?: boolean }) { return <section className="stat-grid">{stats.map(([label, value]) => <article className="stat-card" key={label}><span>{label}</span><strong>{loading ? '-' : value}</strong></article>)}</section>; }

function TaskSection({ title, tasks, onSelect }: { title: string; tasks: TaskListItem[]; onSelect: (id: string) => void }) {
  return <section className="panel task-panel"><div className="section-heading"><h2>{title}</h2><span>{tasks.length} 条</span></div>{tasks.length === 0 ? <div className="empty-state">暂无任务</div> : <div className="task-list">{tasks.map((task) => <button className="task-item" key={task.id} type="button" onClick={() => onSelect(task.id)}><div className="task-title-row"><h3>{task.title}</h3><span>{TASK_STATUS_LABEL[task.status]}</span></div><p>{task.fundProduct?.name ?? '任务信息'} / {task.organization.name} / {task.platform}</p><div className="task-meta"><span>名额 {task.claimedCount}/{task.quota}</span><span>奖励 {task.rewardPoints} 分</span><span>{daysLeft(task.dueAt)} 天截止</span></div></button>)}</div>}</section>;
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
  return <article className="clean-claim-card"><div className="clean-claim-head"><div><strong>{claim.userName}</strong><small>领取于 {new Date(claim.claimedAt).toLocaleString()}</small></div><span className="claim-badge">{CLAIM_STATUS_LABEL[claim.status as keyof typeof CLAIM_STATUS_LABEL] ?? claim.status}</span></div>{!submission ? <p className="clean-muted">尚未提交结果</p> : <><div className="clean-submission-status"><span>提交于 {new Date(submission.submittedAt).toLocaleString()}</span><strong>{submission.status === 'PENDING_REVIEW' ? '待审核' : submission.status === 'APPROVED' ? '已通过' : '待补充'}</strong></div>{submission.linkUrl ? <a className="clean-link" href={submission.linkUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} />打开发布链接</a> : <p className="clean-muted">未提交发布链接</p>}{submission.screenshots?.length ? <div className="clean-image-grid">{submission.screenshots.map((src, index) => <a href={src} target="_blank" rel="noreferrer" key={`${submission.id}-${index}`}><img src={src} alt={`提交截图 ${index + 1}`} /></a>)}</div> : null}{submission.textContent ? <div className="clean-note"><strong>提交说明</strong><p>{submission.textContent}</p></div> : null}{submission.reviewComment ? <div className="clean-review-note"><strong>审核意见</strong><p>{submission.reviewComment}</p></div> : null}{submission.status === 'PENDING_REVIEW' ? <div className="clean-review-buttons"><button className="approve-action" type="button" disabled={actionPending} onClick={() => onAction({ kind: 'approve', submissionId: submission.id })}><CheckCircle2 size={16} />通过</button><button className="reject-action" type="button" disabled={actionPending} onClick={() => onAction({ kind: 'reject', submissionId: submission.id })}><XCircle size={16} />退回</button></div> : null}</>}</article>;
}

function CleanSubmissionPage({ detail, selectedClaim, actionPending, onAction, onClose }: { detail: TaskDetail; selectedClaim: NonNullable<TaskDetail['claims'][number]>; actionPending: boolean; onAction: (input: CleanActionInput) => void; onClose: () => void }) {
  const [linkUrl, setLinkUrl] = useState(selectedClaim.submission?.linkUrl ?? '');
  const [textContent, setTextContent] = useState(selectedClaim.submission?.textContent ?? '');
  const [screenshots, setScreenshots] = useState<string[]>(selectedClaim.submission?.screenshots ?? []);
  const editing = Boolean(selectedClaim.submission);
  const ready = /^https?:\/\/.+/.test(linkUrl) && screenshots.length > 0;
  return <section className="clean-task-page"><header className="clean-task-header"><button className="back-button" type="button" onClick={onClose} aria-label="返回">‹</button><div><div className="eyebrow">兼职任务</div><h2>{editing ? '修改提交材料' : '提交任务结果'}</h2></div><span className="operator-detail-status">{CLAIM_STATUS_LABEL[selectedClaim.status as keyof typeof CLAIM_STATUS_LABEL]}</span></header><section className="clean-task-overview"><h3>{detail.title}</h3><p>{detail.description || '暂无任务说明'}</p><TaskFacts detail={detail} /></section>{selectedClaim.submission?.reviewComment ? <div className="clean-review-note"><strong>运营退回说明</strong><p>{selectedClaim.submission.reviewComment}</p></div> : null}<section className="clean-form-section"><label>发布链接<input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="粘贴公开可访问的内容链接" /></label><label>发布截图<CleanScreenshotPicker screenshots={screenshots} onChange={setScreenshots} /></label><label>提交说明<textarea value={textContent} onChange={(event) => setTextContent(event.target.value)} placeholder="填写发布账号、内容场景或补充说明" /></label></section><div className="clean-confirm">提交前确认：链接真实有效，截图与发布内容一致，且内容符合平台及基金宣传合规要求。</div><button className="primary-action" type="button" disabled={!ready || actionPending} onClick={() => onAction(editing ? { kind: 'update', submissionId: selectedClaim.submission?.id, linkUrl, textContent, screenshots } : { kind: 'submit', claimId: selectedClaim.id, linkUrl, textContent, screenshots })}><Send size={17} />{editing ? '保存修改并重新提交' : '提交审核'}</button></section>;
}

function CleanTaskDetailPanel({ detail, selectedClaim, actionPending, onAction, onClose }: { detail: TaskDetail; selectedClaim?: TaskDetail['claims'][number]; actionPending: boolean; onAction: (input: CleanActionInput) => void; onClose: () => void }) {
  const canClaim = !selectedClaim && ['PUBLISHED', 'IN_PROGRESS'].includes(detail.status);
  return <section className="clean-task-page"><header className="clean-task-header"><button className="back-button" type="button" onClick={onClose} aria-label="返回">‹</button><div><div className="eyebrow">任务详情</div><h2>{detail.title}</h2></div><span className="operator-detail-status">{TASK_STATUS_LABEL[detail.status]}</span></header><section className="clean-task-overview"><p>{detail.description || '暂无任务说明'}</p><TaskFacts detail={detail} /></section>{detail.complianceRequirements ? <section className="clean-requirements"><strong>合规要求</strong><span>{detail.complianceRequirements}</span></section> : null}{canClaim ? <button className="primary-action" type="button" disabled={actionPending} onClick={() => onAction({ kind: 'claim', taskId: detail.id })}><ListChecks size={17} />领取任务</button> : null}{selectedClaim ? <CleanClaimCard claim={selectedClaim} actionPending={actionPending} onAction={onAction} /> : null}</section>;
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
    <div className="operator-claim-heading"><div><strong>{claim.userName}</strong><small>领取于 {new Date(claim.claimedAt).toLocaleString()}</small></div><span className={`claim-badge claim-${claim.status.toLowerCase()}`}>{claimLabel}</span></div>
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

function CreateTaskPanelV2({ demo, posts, pending, onClose, onCreated, onCreate }: { demo: Awaited<ReturnType<typeof bootstrapDemo>>['data']; posts: FundTask[]; pending: boolean; onClose: () => void; onCreated: (task: TaskListItem) => void; onCreate: (input: CreateTaskInput) => Promise<{ data: TaskListItem }> }) {
  const [postId, setPostId] = useState(posts[0]?.id ?? '');
  const [dueAt, setDueAt] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16));
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const post = posts.find((item) => item.id === postId);
  const submit = async () => { if (!post) return setError('请先选择有效的基金任务'); if (submitting) return; setSubmitting(true); setError(undefined); try { const result = await onCreate({ title: post.taskName, description: post.posts.map((item) => item.content).join('\n\n'), originalText: post.posts.map((item) => item.content).join('\n\n'), taskType: 'CONTENT_PUBLISH', platform: post.platform, campaignName: post.taskName, organizationId: demo.organization.id, fundProductId: demo.fundProduct.id, fundTaskId: post.id, quota: post.postCount, dueAt: new Date(dueAt).toISOString() }); onCreated(result.data); } catch (reason) { setError(reason instanceof Error ? reason.message : '创建失败'); } finally { setSubmitting(false); } };
  return <section className="modal-layer"><div className="modal-panel"><div className="detail-header"><div><div className="eyebrow">新建任务</div><h2>选择基金任务</h2></div><button className="icon-button" type="button" onClick={onClose}>×</button></div><label>基金任务<select value={postId} onChange={(event) => setPostId(event.target.value)}><option value="">请选择基金任务</option>{posts.map((item) => <option value={item.id} key={item.id}>{item.taskName} · {item.platform} · {item.postCount} 个任务</option>)}</select></label>{post ? <section className="panel"><strong>{post.taskName}</strong><p>平台：{post.platform}；将生成 {post.postCount} 个任务名额</p>{post.posts.map((item, index) => <p key={item.id}>帖子 {index + 1}：{item.title}</p>)}</section> : null}<label>截止时间<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>{error ? <div className="form-error">{error}</div> : null}<button className="primary-action" type="button" disabled={pending || submitting || !post} onClick={() => void submit()}><Plus size={17} />{submitting ? '创建中...' : '创建任务'}</button></div></section>;
}

function daysLeft(isoDate: string) { return Math.max(0, Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86400000)); }
