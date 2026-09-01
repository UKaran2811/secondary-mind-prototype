import { type ChangeEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowLeft, ArrowUpRight, Archive, BarChart3, BrainCircuit, CalendarDays, CalendarPlus,
  Check, CheckCircle2, ChevronRight, Circle, Clipboard, Clock3, Command, Copy, Eye,
  FileText, Filter, ImagePlus, LayoutDashboard, ListFilter, LockKeyhole, Menu, MessageSquareText,
  Mic, PencilLine, Play, Plus, Radio, RotateCcw, Search, Send, Settings, ShieldCheck, SlidersHorizontal,
  Sparkles, Trash2, Upload, UserRound, VolumeX, X,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Link, Router as WouterRouter, useLocation } from 'wouter';

const queryClient = new QueryClient();

type SourceType = 'whatsapp' | 'voice' | 'image';
type Urgency = 'high' | 'medium' | 'low';
type Status = 'pending' | 'done';
type Entry = { id: string; sourceType: SourceType; rawText: string; transcribedText: string; timestamp: string; sender: string; threadId: string };
type Extraction = { id: string; entryId: string; task: string; owner: string; deadline: string; status: Status; topicTags: string[]; urgency: Urgency; confidence: number; threadId: string; completedAt?: string };
type DigestItem = { id: string; extractionId: string; held: boolean; dismissed?: boolean; meetingLabel: string };
type StoredState = { entries: Entry[]; extractions: Extraction[]; digest: DigestItem[]; threshold: number; model: string };

const seed: StoredState = {
  entries: [
    { id: 'entry-1', sourceType: 'whatsapp', sender: 'Mara Chen', timestamp: '2025-05-16T09:14:00', threadId: 'thread-launch', rawText: '[09:14] Mara: The new onboarding needs a calmer first screen. Can we review the copy Friday?', transcribedText: 'The new onboarding needs a calmer first screen. Can we review the copy Friday?', },
    { id: 'entry-2', sourceType: 'whatsapp', sender: 'Leo Martins', timestamp: '2025-05-16T09:18:00', threadId: 'thread-launch', rawText: '[09:18] Leo: I will bring the revised copy and the first-pass flow to the Friday review.', transcribedText: 'I will bring the revised copy and the first-pass flow to the Friday review.', },
    { id: 'entry-3', sourceType: 'whatsapp', sender: 'Mara Chen', timestamp: '2025-05-16T09:26:00', threadId: 'thread-launch', rawText: '[09:26] Mara: Also please add the accessibility notes to that same doc before we meet.', transcribedText: 'Also please add the accessibility notes to that same doc before we meet.', },
    { id: 'entry-4', sourceType: 'voice', sender: 'You', timestamp: '2025-05-15T16:42:00', threadId: 'thread-client', rawText: 'Voice memo — ask Northstar for the final headshots before the case study goes live.', transcribedText: 'Ask Northstar for the final headshots before the case study goes live.', },
    { id: 'entry-5', sourceType: 'image', sender: 'Sofia Patel', timestamp: '2025-05-15T11:03:00', threadId: 'thread-finance', rawText: 'Screenshot capture — invoice 4821 needs a second look before payment.', transcribedText: 'Invoice 4821 needs a second look before payment.', },
  ],
  extractions: [
    { id: 'task-1', entryId: 'entry-1', task: 'Review onboarding copy', owner: 'Leo', deadline: 'Fri, May 23', status: 'pending', topicTags: ['onboarding', 'copy'], urgency: 'high', confidence: .94, threadId: 'thread-launch' },
    { id: 'task-2', entryId: 'entry-2', task: 'Bring revised copy + first-pass flow', owner: 'Leo', deadline: 'Fri, May 23', status: 'pending', topicTags: ['onboarding', 'flow'], urgency: 'high', confidence: .91, threadId: 'thread-launch' },
    { id: 'task-3', entryId: 'entry-3', task: 'Add accessibility notes to review doc', owner: 'You', deadline: 'Thu, May 22', status: 'pending', topicTags: ['accessibility'], urgency: 'medium', confidence: .88, threadId: 'thread-launch' },
    { id: 'task-4', entryId: 'entry-4', task: 'Ask Northstar for final headshots', owner: 'You', deadline: 'Mon, May 26', status: 'pending', topicTags: ['client', 'case study'], urgency: 'medium', confidence: .82, threadId: 'thread-client' },
    { id: 'task-5', entryId: 'entry-5', task: 'Review invoice 4821', owner: 'Mara', deadline: 'Today', status: 'pending', topicTags: ['finance'], urgency: 'low', confidence: .56, threadId: 'thread-finance' },
    { id: 'task-6', entryId: 'entry-1', task: 'Confirm copy review attendees', owner: 'You', deadline: 'Thu, May 22', status: 'done', topicTags: ['onboarding'], urgency: 'low', confidence: .86, threadId: 'thread-launch', completedAt: '2025-05-16T13:05:00' },
  ],
  digest: [
    { id: 'digest-1', extractionId: 'task-1', held: false, meetingLabel: 'Before Friday review' },
    { id: 'digest-2', extractionId: 'task-3', held: true, meetingLabel: 'Held from yesterday' },
    { id: 'digest-3', extractionId: 'task-4', held: false, meetingLabel: 'Client handoff · Mon 26' },
  ],
  threshold: .7,
  model: 'Private local model',
};

function isOpen(item: Extraction) {
  return item.status === 'pending';
}

function needsReview(item: Extraction, threshold: number) {
  return isOpen(item) && item.confidence < threshold;
}

function getTaskStats(state: StoredState) {
  const open = state.extractions.filter(isOpen);
  return {
    open: open.length,
    completed: state.extractions.length - open.length,
    needsReview: open.filter(item => needsReview(item, state.threshold)).length,
  };
}

const navItems = [
  { href: '/', label: 'My tasks', icon: LayoutDashboard },
  { href: '/search', label: 'Search memory', icon: Search },
  { href: '/digest', label: 'Daily brief', icon: Clock3 },
  { href: '/insights', label: 'Insights', icon: BarChart3 },
];

function loadState(): StoredState {
  try {
    const stored = localStorage.getItem('secondary-mind-state-v1');
    if (!stored) return seed;
    const parsed = JSON.parse(stored) as Partial<StoredState>;
    const extractions = Array.isArray(parsed.extractions) ? parsed.extractions : seed.extractions;
    const savedDigest = Array.isArray(parsed.digest) ? parsed.digest : seed.digest;
    const digest = savedDigest.map((item, index) => {
      const legacy = item as DigestItem & { title?: string };
      return {
        id: legacy.id || `digest-${index + 1}`,
        extractionId: legacy.extractionId || extractions.find(extraction => extraction.task === legacy.title)?.id || seed.digest[index]?.extractionId || '',
        held: Boolean(legacy.held),
        dismissed: Boolean(legacy.dismissed),
        meetingLabel: legacy.meetingLabel || 'From captured context',
      };
    }).filter(item => item.extractionId);
    return {
      ...seed,
      ...parsed,
      entries: Array.isArray(parsed.entries) ? parsed.entries : seed.entries,
      extractions,
      digest,
      threshold: typeof parsed.threshold === 'number' ? parsed.threshold : seed.threshold,
      model: typeof parsed.model === 'string' ? parsed.model : seed.model,
    };
  } catch { return seed; }
}

function App() {
  const [state, setState] = useState<StoredState>(loadState);
  const [location, setLocation] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureText, setCaptureText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('whatsapp');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);

  useEffect(() => { localStorage.setItem('secondary-mind-state-v1', JSON.stringify(state)); }, [state]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ text: string; type: SourceType }>;
      setCaptureText(custom.detail.text);
      setSourceType(custom.detail.type);
      setCaptureOpen(true);
    };
    window.addEventListener('secondary-capture', handler);
    return () => window.removeEventListener('secondary-capture', handler);
  }, []);

  const updateState = (fn: (current: StoredState) => StoredState) => setState(current => fn(current));
  const completeTask = (id: string) => {
    updateState(current => ({ ...current, extractions: current.extractions.map(item => item.id === id ? { ...item, status: item.status === 'done' ? 'pending' : 'done', completedAt: item.status === 'done' ? undefined : new Date().toISOString() } : item) }));
    setNotice('Task status updated');
  };
  const addCapture = (text: string, type: SourceType) => {
    const clean = text.trim();
    if (!clean) return;
    setProcessing(true);
    window.setTimeout(() => {
      const id = `entry-${Date.now()}`;
      const taskText = clean.replace(/^(voice memo|screenshot capture)\s*[—-]\s*/i, '').trim();
      const entry: Entry = { id, sourceType: type, rawText: clean, transcribedText: taskText, timestamp: new Date().toISOString(), sender: 'You', threadId: `thread-${type}-${Date.now()}` };
      const extraction: Extraction = { id: `task-${Date.now()}`, entryId: id, task: taskText.length > 72 ? `${taskText.slice(0, 69)}…` : taskText, owner: 'You', deadline: 'Needs a date', status: 'pending', topicTags: [type === 'whatsapp' ? 'imported' : type === 'voice' ? 'voice memo' : 'screenshot'], urgency: 'medium', confidence: .74, threadId: entry.threadId };
      const digestItem: DigestItem = { id: `digest-${Date.now()}`, extractionId: extraction.id, held: false, meetingLabel: 'Just captured · review when ready' };
      updateState(current => ({ ...current, entries: [entry, ...current.entries], extractions: [extraction, ...current.extractions], digest: [digestItem, ...current.digest] }));
      setProcessing(false); setCaptureText(''); setCaptureOpen(false); setNotice('New commitment extracted');
    }, 1100);
  };
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => addCapture(String(reader.result || ''), 'whatsapp');
    reader.readAsText(file);
  };
  const reply = (task: Extraction) => {
    const text = `Hi ${task.owner}, a quick check-in on “${task.task}” — are we still on track for ${task.deadline.toLowerCase()}?`;
    navigator.clipboard?.writeText(text);
    setNotice('Reply draft copied to clipboard');
  };
  const exportCalendar = (task: Extraction) => {
    if (!parseDeadlineDate(task.deadline)) return;
    window.open(getGoogleCalendarUrl(task), '_blank', 'noopener,noreferrer');
    setNotice('Google Calendar event ready');
  };
  const path = location.split('?')[0];
  const sourceId = path.startsWith('/source/') ? path.slice('/source/'.length) : '';

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="grain app-shell min-h-[100dvh] text-foreground">
          <aside className={`app-sidebar fixed inset-y-0 left-0 z-30 flex w-[252px] flex-col border-r border-sidebar-border px-4 py-5 text-sidebar-foreground transition-transform duration-300 md:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="flex items-center gap-3 px-3">
              <div className="grid size-9 place-items-center rounded-[11px] bg-sidebar-primary text-[hsl(var(--sidebar-primary-foreground))] shadow-lg shadow-black/10"><BrainCircuit size={20} strokeWidth={2.2} /></div>
              <div><div className="font-serif text-[21px] leading-none text-white">Secondary Mind</div><div className="mt-1 font-mono text-[9px] uppercase tracking-[.17em] text-sidebar-foreground/55">private workspace</div></div>
            </div>
            <div className="mt-9 px-3 font-mono text-[9px] uppercase tracking-[.18em] text-sidebar-foreground/40">Workspace</div>
            <nav className="mt-3 space-y-1" aria-label="Primary navigation">
              {navItems.map(item => {
                const Icon = item.icon; const active = path === item.href;
                return <Link key={item.href} href={item.href} onClick={() => setMobileNav(false)} data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`} className={`nav-item flex items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-semibold ${active ? 'bg-sidebar-accent text-white' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-white'}`}>
                  <span className="flex items-center gap-3"><Icon size={17} strokeWidth={active ? 2.1 : 1.7} /><span>{item.label}</span></span>
                  {item.href === '/digest' ? <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] font-medium text-accent-foreground">{state.digest.filter(digestItem => digestItem.held && !digestItem.dismissed && state.extractions.some(extraction => extraction.id === digestItem.extractionId && extraction.status === 'pending')).length}</span> : null}
                </Link>;
              })}
            </nav>
            <div className="mt-auto">
              <div className="mx-1 mb-3 rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-3.5">
                <div className="flex items-center gap-2 text-[11px] font-bold text-white"><LockKeyhole size={13} className="text-sidebar-primary" /> Offline by default</div>
                <p className="mt-2 text-[11px] leading-[1.55] text-sidebar-foreground/55">Your messages stay in this browser. No account, no upload, no quiet hours to configure.</p>
              </div>
              <Link href="/settings" onClick={() => setMobileNav(false)} data-testid="link-nav-settings" className={`nav-item flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold ${path === '/settings' ? 'bg-sidebar-accent text-white' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white'}`}><Settings size={17} /> Settings</Link>
              <div className="mt-5 flex items-center gap-2 border-t border-sidebar-border px-3 pt-4 text-[10px] text-sidebar-foreground/40"><div className="size-2 rounded-full bg-sidebar-primary" /> Local demo mode <span className="ml-auto font-mono">v0.8</span></div>
            </div>
          </aside>
          {mobileNav ? <button aria-label="Close menu" data-testid="button-close-menu" onClick={() => setMobileNav(false)} className="fixed inset-0 z-20 bg-foreground/20 backdrop-blur-sm md:hidden" /> : null}
          <main className="min-h-[100dvh] md:pl-[252px]">
            <header className="sticky top-0 z-10 flex h-[68px] items-center justify-between border-b border-border/70 bg-[hsl(214_38%_96%/.83)] px-5 backdrop-blur-md md:px-10">
              <button className="rounded-lg p-2 hover:bg-muted md:hidden" data-testid="button-open-menu" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
              <div className="hidden items-center gap-2 text-[11px] font-semibold text-muted-foreground md:flex"><span className="size-2 rounded-full bg-primary" /> All changes saved locally</div>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => { setCaptureOpen(true); setSourceType('whatsapp'); }} data-testid="button-quick-capture" className="flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-[12px] font-bold text-primary-foreground shadow-sm transition hover:-translate-y-px hover:shadow-md"><Plus size={15} /> Capture</button>
                <div className="ml-2 grid size-8 place-items-center rounded-full bg-accent font-mono text-[11px] font-bold text-accent-foreground">YC</div>
              </div>
            </header>
            <div className="mx-auto max-w-[1420px] px-5 pb-16 pt-8 md:px-10 lg:px-12">
              {path === '/' ? <Board state={state} onComplete={completeTask} onReply={reply} onReview={id => { setReviewId(id); setReviewOpen(true); }} onSource={id => setLocation(`/source/${id}`)} onCalendar={exportCalendar} /> : null}
              {path === '/search' ? <SearchPage state={state} onSource={id => setLocation(`/source/${id}`)} /> : null}
              {path === '/digest' ? <DigestPage state={state} updateState={updateState} onComplete={completeTask} /> : null}
              {path === '/insights' ? <Insights state={state} /> : null}
              {path === '/settings' ? <SettingsPage state={state} updateState={updateState} onReset={() => { localStorage.removeItem('secondary-mind-state-v1'); setState(seed); setNotice('Demo data restored'); }} /> : null}
              {sourceId ? <SourcePage state={state} sourceId={sourceId} onBack={() => setLocation('/')} /> : null}
              {!['/', '/search', '/digest', '/insights', '/settings'].includes(path) && !sourceId ? <NotFound /> : null}
            </div>
          </main>
          {notice ? <div data-testid="status-toast" className="animate-soft-in fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-[12px] font-semibold text-background shadow-xl"><Check size={14} className="text-primary" /> {notice}</div> : null}
          {captureOpen ? <CaptureModal open={captureOpen} text={captureText} setText={setCaptureText} type={sourceType} setType={setSourceType} processing={processing} onClose={() => !processing && setCaptureOpen(false)} onSubmit={() => addCapture(captureText, sourceType)} onFile={handleFile} /> : null}
          {reviewOpen && reviewId ? <ReviewModal item={state.extractions.find(item => item.id === reviewId)} onClose={() => setReviewOpen(false)} onAccept={() => { setReviewOpen(false); updateState(current => ({ ...current, extractions: current.extractions.map(item => item.id === reviewId ? { ...item, confidence: Math.max(item.confidence, current.threshold) } : item) })); setNotice('Confidence confirmed'); }} /> : null}
        </div>
      </TooltipProvider>
      <Toaster />
    </QueryClientProvider>
  );
}

function PageHeading({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col gap-5 border-b border-border/80 pb-7 md:flex-row md:items-end md:justify-between"><div className="animate-rise"><div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[.2em] text-primary">{eyebrow}</div><h1 className="font-serif text-[38px] leading-[.98] tracking-[-.035em] text-foreground md:text-[49px]">{title}</h1><p className="mt-3 max-w-[560px] text-[13px] leading-relaxed text-muted-foreground">{detail}</p></div>{action}</div>;
}

function Board({ state, onComplete, onReply, onReview, onSource, onCalendar }: { state: StoredState; onComplete: (id: string) => void; onReply: (item: Extraction) => void; onReview: (id: string) => void; onSource: (id: string) => void; onCalendar: (item: Extraction) => void }) {
  const [filter, setFilter] = useState<'all' | 'review' | 'mine'>('all');
  const [view, setView] = useState<'board' | 'calendar'>('board');
  const stats = useMemo(() => getTaskStats(state), [state]);
  const matchingItems = useMemo(() => {
    return state.extractions.filter(item => filter === 'all' || (filter === 'review' ? needsReview(item, state.threshold) : item.owner === 'You'));
  }, [state.extractions, state.threshold, filter]);
  const groupThreads = (items: Extraction[]) => {
    const map = new Map<string, Extraction[]>();
    items.forEach(item => map.set(item.threadId, [...(map.get(item.threadId) || []), item]));
    return [...map.entries()];
  };
  const openThreads = useMemo(() => groupThreads(matchingItems.filter(item => item.status === 'pending')), [matchingItems]);
  const completedThreads = useMemo(() => groupThreads(matchingItems.filter(item => item.status === 'done')), [matchingItems]);
  const nudgeCount = state.extractions.filter(item => item.threadId === 'thread-launch' && isOpen(item)).length;
  return <div>
    <PageHeading eyebrow="Monday, 18 May · 09:32" title="What still needs you?" detail="Commitments pulled from your conversations, sorted into threads so the signal is easy to find." action={<div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground"><div className="size-2 rounded-full bg-primary" /><span className="font-semibold text-foreground">{stats.open} open commitments</span><span>·</span><span>across {openThreads.length} threads</span></div>} />
    <div className="mb-7 grid gap-3 md:grid-cols-[1.45fr_.8fr_.8fr]">
      <div className="dot-grid relative overflow-hidden rounded-2xl border border-[hsl(164_59%_38%/.22)] bg-[hsl(164_59%_38%/.1)] p-5"><div className="absolute -right-8 -top-10 size-40 rounded-full border-[22px] border-[hsl(164_59%_38%/.12)]" /><div className="relative"><div className="flex items-center gap-2 text-[11px] font-bold text-primary"><Sparkles size={14} /> A small nudge</div><p className="mt-3 max-w-[390px] font-serif text-[21px] leading-tight text-foreground">{nudgeCount > 0 ? `The Friday review has ${nudgeCount} related commitment${nudgeCount === 1 ? '' : 's'} waiting in one thread.` : 'The Friday review thread is clear for now.'}</p><button onClick={() => onSource('entry-1')} data-testid="button-view-thread" className="mt-4 flex items-center gap-1 text-[11px] font-bold text-primary hover:underline">Open the thread <ArrowUpRight size={13} /></button></div></div>
      <StatCard label="Needs review" value={String(stats.needsReview)} note="open tasks below threshold" accent="amber" />
      <StatCard label="Quietly completed" value={String(stats.completed)} note="this demo session" accent="blue" />
    </div>
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="mobile-scroll flex gap-1 rounded-xl bg-muted p-1"><FilterButton active={filter === 'all'} onClick={() => setFilter('all')} label="All tasks" /><FilterButton active={filter === 'review'} onClick={() => setFilter('review')} label="Needs review" /><FilterButton active={filter === 'mine'} onClick={() => setFilter('mine')} label="Assigned to me" /></div><div className="flex items-center gap-2"><button data-testid="button-board-filter" onClick={() => setFilter(filter === 'all' ? 'review' : 'all')} className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[11px] font-bold text-muted-foreground hover:text-foreground md:flex"><ListFilter size={14} /> Filter view</button><div className="flex gap-1 rounded-xl border border-border bg-card p-1"><button onClick={() => setView('board')} data-testid="button-view-board" className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${view === 'board' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}><LayoutDashboard size={13} /> Board</button><button onClick={() => setView('calendar')} data-testid="button-view-calendar" className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${view === 'calendar' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}><CalendarDays size={13} /> Calendar</button></div></div></div>
    {view === 'board' ? <><div className="space-y-4">{openThreads.map(([threadId, items], index) => <Thread key={threadId} threadId={threadId} items={items} entries={state.entries} index={index} onComplete={onComplete} onReply={onReply} onReview={onReview} onSource={onSource} onCalendar={onCalendar} threshold={state.threshold} />)}</div>{openThreads.length === 0 ? <EmptyState title="Nothing open right now" detail="Every matching commitment is complete or waiting for a different filter." /> : null}{completedThreads.length > 0 ? <section className="mt-7 rounded-2xl border border-border/80 bg-muted/35 p-4 md:p-5"><div className="mb-4 flex items-center justify-between border-b border-border/70 pb-3"><div className="flex items-center gap-2 text-[13px] font-extrabold"><CheckCircle2 size={17} className="text-primary" /> Completed</div><span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">{completedThreads.reduce((total, [, items]) => total + items.length, 0)}</span></div><div className="space-y-4">{completedThreads.map(([threadId, items], index) => <Thread key={threadId} threadId={threadId} items={items} entries={state.entries} index={index} onComplete={onComplete} onReply={onReply} onReview={onReview} onSource={onSource} onCalendar={onCalendar} threshold={state.threshold} />)}</div></section> : null}</> : <CalendarView items={matchingItems} onComplete={onComplete} onCalendar={onCalendar} />}
  </div>;
}

function Thread({ threadId, items, entries, index, onComplete, onReply, onReview, onSource, onCalendar, threshold }: { threadId: string; items: Extraction[]; entries: Entry[]; index: number; onComplete: (id: string) => void; onReply: (item: Extraction) => void; onReview: (id: string) => void; onSource: (id: string) => void; onCalendar: (item: Extraction) => void; threshold: number }) {
  const threadName = threadId === 'thread-launch' ? 'Onboarding launch' : threadId === 'thread-client' ? 'Northstar case study' : threadId === 'thread-finance' ? 'Finance follow-up' : 'New capture';
  const threadEntries = entries.filter(entry => entry.threadId === threadId);
  return <section className="animate-rise rounded-2xl border border-border bg-card p-4 shadow-[0_5px_22px_hsl(222_35%_18%/.035)] md:p-5" style={{ animationDelay: `${index * 70}ms` }} data-testid={`thread-${threadId}`}>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="grid size-8 place-items-center rounded-lg bg-secondary text-primary"><MessageSquareText size={16} /></div><div><h2 className="text-[13px] font-extrabold tracking-[-.01em]">{threadName}</h2><p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{threadEntries.length} source {threadEntries.length === 1 ? 'entry' : 'entries'} · {items.length} commitments</p></div></div><div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground"><span className="size-1.5 rounded-full bg-primary" /> evolving thread <ChevronRight size={14} /></div></div>
    <div className="space-y-2">{items.map(item => {
      const source = entries.find(entry => entry.id === item.entryId);
      const reviewNeeded = needsReview(item, threshold);
      return <div key={item.id} className={`task-card group rounded-xl border p-3.5 ${item.status === 'done' ? 'border-border/60 bg-muted/45' : reviewNeeded ? 'border-[hsl(43_92%_66%/.6)] bg-[hsl(43_92%_66%/.08)]' : 'border-border/80 bg-card'}`} data-testid={`card-task-${item.id}`}>
        <div className="flex gap-3"><button onClick={() => onComplete(item.id)} aria-label={`Mark ${item.task} ${item.status === 'done' ? 'pending' : 'done'}`} data-testid={`button-complete-${item.id}`} className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition ${item.status === 'done' ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary hover:bg-secondary'}`}>{item.status === 'done' ? <Check size={12} strokeWidth={3} /> : <Circle size={13} className="text-transparent group-hover:text-primary/40" />}</button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className={`text-[13px] font-bold ${item.status === 'done' ? 'text-muted-foreground line-through' : 'text-foreground'}`} data-testid={`text-task-${item.id}`}>{item.task}</p><div className="mt-2 flex flex-wrap items-center gap-1.5">{item.topicTags.map(tag => <span key={tag} className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">#{tag}</span>)}{reviewNeeded ? <button onClick={() => onReview(item.id)} data-testid={`button-review-${item.id}`} className="flex items-center gap-1 rounded-md bg-[hsl(43_92%_66%/.25)] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[hsl(34_70%_34%)] hover:bg-[hsl(43_92%_66%/.4)]"><AlertTriangle size={10} /> check confidence</button> : null}</div></div><Urgency urgency={item.urgency} /></div><div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-2.5 font-mono text-[10px] text-muted-foreground"><span className="flex items-center gap-1"><UserRound size={11} /> {item.owner}</span><span className="flex items-center gap-1"><CalendarDays size={11} /> {item.deadline}</span><span className="flex items-center gap-1"><span className={`inline-block h-1.5 w-1.5 rounded-full ${reviewNeeded ? 'bg-accent' : 'bg-primary'}`} /> {Math.round(item.confidence * 100)}% confident</span><button onClick={() => source && onSource(source.id)} data-testid={`button-source-${item.id}`} className="ml-auto flex items-center gap-1 font-sans font-bold text-primary opacity-80 hover:opacity-100 hover:underline"><Eye size={12} /> source</button>{parseDeadlineDate(item.deadline) ? <button onClick={() => onCalendar(item)} data-testid={`button-calendar-${item.id}`} className="flex items-center gap-1 font-sans font-bold text-primary hover:underline"><CalendarPlus size={12} /> calendar</button> : null}<button onClick={() => onReply(item)} data-testid={`button-reply-${item.id}`} className="flex items-center gap-1 font-sans font-bold text-muted-foreground hover:text-foreground"><Send size={12} /> draft reply</button></div></div></div>
      </div>;
    })}</div>
  </section>;
}

const DEMO_REFERENCE_DATE = new Date('2025-05-18T09:32:00');

function parseDeadlineDate(deadline: string): Date | null {
  const normalized = deadline.trim();
  if (!normalized || normalized.toLowerCase().includes('needs a date')) return null;
  if (normalized.toLowerCase() === 'today') return new Date(DEMO_REFERENCE_DATE);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? new Date(`${normalized}T12:00:00`) : new Date(`${normalized}, 2025`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function calendarDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function googleCalendarDate(date: Date) {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  const format = (value: Date) => `${value.getFullYear()}${String(value.getMonth() + 1).padStart(2, '0')}${String(value.getDate()).padStart(2, '0')}`;
  return `${format(date)}/${format(next)}`;
}

function getGoogleCalendarUrl(item: Extraction) {
  const date = parseDeadlineDate(item.deadline);
  if (!date) return '#';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: item.task,
    dates: googleCalendarDate(date),
    details: `Owner: ${item.owner}\nSource: Secondary Mind local task board\nTags: ${item.topicTags.join(', ')}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function CalendarView({ items, onComplete, onCalendar }: { items: Extraction[]; onComplete: (id: string) => void; onCalendar: (item: Extraction) => void }) {
  const monthStart = new Date(DEMO_REFERENCE_DATE.getFullYear(), DEMO_REFERENCE_DATE.getMonth(), 1);
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const leadingDays = monthStart.getDay();
  const datedItems = items.filter(item => parseDeadlineDate(item.deadline));
  const undatedItems = items.filter(item => !parseDeadlineDate(item.deadline));
  const tasksByDay = new Map<string, Extraction[]>();
  datedItems.forEach(item => {
    const date = parseDeadlineDate(item.deadline);
    if (!date) return;
    const key = calendarDateKey(date);
    tasksByDay.set(key, [...(tasksByDay.get(key) || []), item]);
  });
  tasksByDay.forEach(dayItems => dayItems.sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done')));
  const cells = Array.from({ length: leadingDays + daysInMonth }, (_, index) => index < leadingDays ? null : new Date(monthStart.getFullYear(), monthStart.getMonth(), index - leadingDays + 1));
  return <section className="animate-rise rounded-2xl border border-border bg-card p-4 shadow-[0_5px_22px_hsl(222_35%_18%/.035)] md:p-5" data-testid="calendar-view">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-border/70 pb-4"><div><div className="font-mono text-[10px] font-medium uppercase tracking-[.17em] text-primary">Dated commitments</div><h2 className="mt-1 font-serif text-[27px]">May 2025</h2></div><div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground"><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /> open</span><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-muted-foreground/40" /> complete</span></div></div>
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} className="bg-muted px-2 py-2 text-center font-mono text-[9px] font-bold uppercase tracking-[.08em] text-muted-foreground">{day}</div>)}
      {cells.map((date, index) => {
        const dayItems = date ? tasksByDay.get(calendarDateKey(date)) || [] : [];
        const isToday = date ? calendarDateKey(date) === calendarDateKey(DEMO_REFERENCE_DATE) : false;
        return <div key={date ? calendarDateKey(date) : `blank-${index}`} className={`min-h-[116px] bg-card p-1.5 md:min-h-[135px] md:p-2 ${date ? '' : 'bg-muted/35'}`} data-testid={date ? `calendar-day-${date.getDate()}` : undefined}>
          {date ? <><div className={`mb-1.5 flex size-6 items-center justify-center rounded-full font-mono text-[10px] font-bold ${isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{date.getDate()}</div><div className="space-y-1">{dayItems.slice(0, 3).map(item => <div key={item.id} className={`rounded-lg border p-1.5 ${item.status === 'done' ? 'border-border/50 bg-muted/60 opacity-65' : 'border-primary/25 bg-[hsl(164_59%_38%/.07)]'}`}><p className={`truncate text-[10px] font-bold leading-tight ${item.status === 'done' ? 'text-muted-foreground line-through' : ''}`} title={item.task}>{item.task}</p><div className="mt-1 flex items-center justify-between gap-1"><span className="truncate font-mono text-[8px] text-muted-foreground">{item.owner}</span><div className="flex shrink-0 gap-0.5"><button onClick={() => onComplete(item.id)} aria-label={`Mark ${item.task} ${item.status === 'done' ? 'pending' : 'done'}`} data-testid={`button-calendar-complete-${item.id}`} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-primary"><Check size={11} /></button><button onClick={() => onCalendar(item)} aria-label={`Add ${item.task} to Google Calendar`} data-testid={`button-calendar-export-${item.id}`} className="rounded p-1 text-primary hover:bg-secondary"><CalendarPlus size={11} /></button></div></div></div>)}{dayItems.length > 3 ? <span className="font-mono text-[8px] text-muted-foreground">+{dayItems.length - 3} more</span> : null}</div></> : null}
        </div>;
      })}
    </div>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4"><p className="text-[11px] text-muted-foreground"><strong className="text-foreground">{datedItems.length}</strong> dated tasks · click the calendar icon to create a Google Calendar event</p>{undatedItems.length > 0 ? <p className="font-mono text-[10px] text-muted-foreground">{undatedItems.length} without a date stay on the board</p> : <p className="font-mono text-[10px] text-primary">All matching tasks have dates</p>}</div>
    {undatedItems.length > 0 ? <div className="mt-3 flex flex-wrap gap-2">{undatedItems.map(item => <span key={item.id} className="rounded-lg border border-dashed border-border px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground">{item.task}</span>)}</div> : null}
  </section>;
}

function SearchPage({ state, onSource }: { state: StoredState; onSource: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return state.entries.filter(entry => `${entry.transcribedText} ${entry.sender}`.toLowerCase().includes(q));
  }, [query, state.entries]);
  return <div><PageHeading eyebrow="Second brain · searchable memory" title="Find the exact moment." detail="Search across messages, voice memos, and screenshots. Results keep their source intact, so context never gets flattened." /><div className="relative mb-9 max-w-[820px]"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={19} /><input autoFocus value={query} onChange={event => setQuery(event.target.value)} data-testid="input-search" placeholder="Try “headshots”, “Friday review”, or a person's name" className="h-14 w-full rounded-2xl border border-border bg-card pl-12 pr-16 text-[14px] shadow-[0_8px_25px_hsl(222_35%_18%/.05)] outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/10" /><kbd className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md border border-border bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">⌘ K</kbd></div>{query ? <div className="mb-4 flex items-center justify-between text-[11px] text-muted-foreground"><span><strong className="text-foreground">{results.length}</strong> source matches</span><span className="font-mono">exact snippets · local index</span></div> : <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground"><Command size={13} /> Search is private to this browser</div>}<div className="grid gap-3">{results.map((entry, index) => <button key={entry.id} onClick={() => onSource(entry.id)} data-testid={`result-source-${entry.id}`} className="animate-rise group rounded-2xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg" style={{ animationDelay: `${index * 60}ms` }}><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.12em] text-primary"><SourceIcon type={entry.sourceType} /> {entry.sourceType} capture</div><ArrowUpRight size={16} className="text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" /></div><p className="mt-3 max-w-[800px] text-[14px] leading-relaxed text-foreground">“{highlight(entry.transcribedText, query)}”</p><div className="mt-3 flex items-center gap-4 font-mono text-[10px] text-muted-foreground"><span>{entry.sender}</span><span>{formatDate(entry.timestamp)}</span><span>{state.extractions.filter(item => item.entryId === entry.id).length} extracted</span></div></button>)}{query && results.length === 0 ? <EmptyState title="No source matches yet" detail="Try a shorter phrase or search for a sender. Secondary Mind only searches what you have captured here." /> : null}{!query ? <SearchExamples onPick={setQuery} /> : null}</div></div>;
}

function SearchExamples({ onPick }: { onPick: (value: string) => void }) {
  return <div className="grid gap-4 pt-3 md:grid-cols-3"><button onClick={() => onPick('Friday review')} data-testid="button-search-example-review" className="rounded-2xl border border-dashed border-border bg-card/60 p-5 text-left hover:border-primary/50"><div className="font-mono text-[10px] uppercase tracking-[.14em] text-primary">Try a thread</div><p className="mt-2 font-serif text-[20px]">“Friday review”</p><p className="mt-1 text-[11px] text-muted-foreground">Find the conversation behind a commitment</p></button><button onClick={() => onPick('headshots')} data-testid="button-search-example-headshots" className="rounded-2xl border border-dashed border-border bg-card/60 p-5 text-left hover:border-primary/50"><div className="font-mono text-[10px] uppercase tracking-[.14em] text-primary">Try a phrase</div><p className="mt-2 font-serif text-[20px]">“headshots”</p><p className="mt-1 text-[11px] text-muted-foreground">Locate a request buried in a memo</p></button><button onClick={() => onPick('Mara')} data-testid="button-search-example-mara" className="rounded-2xl border border-dashed border-border bg-card/60 p-5 text-left hover:border-primary/50"><div className="font-mono text-[10px] uppercase tracking-[.14em] text-primary">Try a person</div><p className="mt-2 font-serif text-[20px]">“Mara”</p><p className="mt-1 text-[11px] text-muted-foreground">See every source from one collaborator</p></button></div>;
}

function DigestPage({ state, updateState, onComplete }: { state: StoredState; updateState: (fn: (current: StoredState) => StoredState) => void; onComplete: (id: string) => void }) {
  const [released, setReleased] = useState(false);
  const digestItems = useMemo(() => state.digest.map(digestItem => {
    const extraction = state.extractions.find(item => item.id === digestItem.extractionId);
    if (!extraction || extraction.status === 'done' || digestItem.dismissed) return null;
    return { ...digestItem, title: extraction.task, urgency: extraction.urgency, extractionId: extraction.id };
  }).filter((item): item is DigestItem & { title: string; urgency: Urgency } => Boolean(item)), [state.digest, state.extractions]);
  const held = digestItems.filter(item => item.held);
  const upcoming = digestItems.filter(item => !item.held);
  const toggleHold = (id: string) => { updateState(current => ({ ...current, digest: current.digest.map(item => item.id === id ? { ...item, held: !item.held } : item) })); };
  const dismiss = (id: string) => { updateState(current => ({ ...current, digest: current.digest.map(item => item.id === id ? { ...item, dismissed: true } : item) })); };
  const releaseHeld = () => {
    updateState(current => ({ ...current, digest: current.digest.map(item => item.held ? { ...item, held: false } : item) }));
    setReleased(true);
  };
  return <div><PageHeading eyebrow="Daily brief · Monday morning" title="Today, in the right order." detail="A humane briefing for what deserves attention now, what can wait, and what you can release after the meeting." action={<button onClick={releaseHeld} data-testid="button-release-digest" className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-[12px] font-bold hover:border-primary hover:text-primary"><Archive size={15} /> Release held items</button>} /><div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><section className="rounded-2xl border border-border bg-card p-5 md:p-6"><SectionLabel label="Next up" count={upcoming.length} /><div className="mt-4 space-y-2">{upcoming.map(item => <DigestRow key={item.id} item={item} onToggle={() => toggleHold(item.id)} onDismiss={() => dismiss(item.id)} onDone={() => onComplete(item.extractionId)} />)}</div>{upcoming.length === 0 ? <EmptyState title="Your next hour is clear" detail="Held items will stay parked until you are ready." /> : null}</section><section className="rounded-2xl border border-border bg-[hsl(222_35%_18%)] p-5 text-sidebar-foreground md:p-6"><SectionLabel label="Held gently" count={held.length} inverted /><p className="mt-3 text-[12px] leading-relaxed text-sidebar-foreground/60">These commitments were deliberately kept out of your immediate view. Nothing is lost.</p><div className="mt-5 space-y-2">{held.map(item => <DigestRow key={item.id} item={item} onToggle={() => toggleHold(item.id)} onDismiss={() => dismiss(item.id)} dark />)}{held.length === 0 ? <div className="rounded-xl border border-sidebar-border p-4 text-[12px] text-sidebar-foreground/55">Nothing held right now.</div> : null}</div></section></div>{released ? <div className="animate-rise mt-5 rounded-2xl border border-primary/30 bg-[hsl(164_59%_38%/.09)] p-5"><div className="flex items-center gap-2 text-[11px] font-bold text-primary"><CheckCircle2 size={15} /> Post-meeting release view</div><h2 className="mt-2 font-serif text-[25px]">The held work is back in your day.</h2><p className="mt-1 text-[12px] text-muted-foreground">Released items are now visible in “Next up” and remain synced with your board.</p><div className="mt-4 flex flex-wrap gap-2">{upcoming.slice(0, 3).map(item => <span key={item.id} className="rounded-lg border border-border bg-card px-3 py-2 text-[11px] font-semibold">{item.title}</span>)}</div></div> : null}</div>;
}

function Insights({ state }: { state: StoredState }) {
  const stats = getTaskStats(state);
  const owners = ['You', 'Leo', 'Mara'].map(owner => ({ owner, count: state.extractions.filter(item => item.owner === owner && isOpen(item)).length }));
  const sources = (['whatsapp', 'voice', 'image'] as SourceType[]).map(type => ({ type, count: state.entries.filter(entry => entry.sourceType === type).length }));
  return <div><PageHeading eyebrow="Office kit · a little perspective" title="See the shape of the work." detail="Small signals from your local board. Enough to notice a pattern, never enough to turn people into a spreadsheet." /><div className="grid gap-4 md:grid-cols-3"><MetricCard label="Time to done" value={stats.completed ? '1.8d' : '—'} note={stats.completed ? 'median this session' : 'Complete a task to measure'} icon={<Clock3 size={17} />} /><MetricCard label="Interruptions silenced" value="07" note="this week · estimated" icon={<VolumeX size={17} />} /><MetricCard label="Open load" value={String(stats.open)} note="commitments across the board" icon={<BarChart3 size={17} />} /></div><div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]"><InsightPanel title="Assignee load" detail="Open commitments by owner"><div className="space-y-5">{owners.map((owner, index) => <div key={owner.owner}><div className="mb-2 flex justify-between text-[12px] font-bold"><span className="flex items-center gap-2"><span className={`grid size-6 place-items-center rounded-full text-[9px] ${index === 0 ? 'bg-accent text-accent-foreground' : 'bg-secondary text-primary'}`}>{owner.owner.slice(0, 2).toUpperCase()}</span>{owner.owner}</span><span className="font-mono text-[10px] text-muted-foreground">{owner.count} open</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`progress-line h-full rounded-full ${index === 0 ? 'bg-accent' : index === 1 ? 'bg-primary' : 'bg-[hsl(205_62%_54%)]'}`} style={{ width: `${Math.max(12, owner.count / Math.max(...owners.map(item => item.count), 1) * 100)}%` }} /></div></div>)}</div></InsightPanel><InsightPanel title="Tasks by source" detail="Where commitments are coming from"><div className="space-y-3">{sources.map(source => <div key={source.type} className="flex items-center gap-3 rounded-xl border border-border/70 p-3"><div className="grid size-8 place-items-center rounded-lg bg-secondary text-primary"><SourceIcon type={source.type} /></div><div className="flex-1"><div className="text-[12px] font-bold capitalize">{source.type === 'whatsapp' ? 'WhatsApp' : source.type}</div><div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${source.count / Math.max(...sources.map(item => item.count), 1) * 100}%` }} /></div></div><span className="font-mono text-[11px] text-muted-foreground">{source.count} entries</span></div>)}</div></InsightPanel></div><div className="mt-5 rounded-2xl border border-border bg-card p-5"><div className="flex items-start justify-between"><div><h2 className="text-[14px] font-extrabold">Confidence calibration</h2><p className="mt-1 text-[11px] text-muted-foreground">How much of the board feels certain at a glance.</p></div><div className="font-mono text-[20px] font-medium text-primary">{Math.round(state.extractions.reduce((sum, item) => sum + item.confidence, 0) / state.extractions.length * 100)}%</div></div><div className="mt-5 flex h-3 gap-1 overflow-hidden rounded-full">{state.extractions.map(item => <div key={item.id} className={`${needsReview(item, state.threshold) ? 'bg-accent' : 'bg-primary'} rounded-sm`} style={{ flex: item.confidence }} title={`${item.task}: ${Math.round(item.confidence * 100)}%`} />)}</div><div className="mt-3 flex gap-5 font-mono text-[10px] text-muted-foreground"><span><i className="mr-1 inline-block size-2 rounded-full bg-primary" />above threshold</span><span><i className="mr-1 inline-block size-2 rounded-full bg-accent" />needs a look</span></div></div></div>;
}

function SettingsPage({ state, updateState, onReset }: { state: StoredState; updateState: (fn: (current: StoredState) => StoredState) => void; onReset: () => void }) {
  const [saved, setSaved] = useState(false);
  const setSetting = (fn: (current: StoredState) => StoredState) => { updateState(fn); setSaved(true); window.setTimeout(() => setSaved(false), 1600); };
  return <div><PageHeading eyebrow="Workspace settings" title="Keep it yours." detail="Secondary Mind is designed around a simple promise: your working memory should not become someone else's dataset." /><div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><div className="space-y-4"><SettingSection icon={<ShieldCheck size={17} />} title="Privacy & storage" detail="These controls are intentionally boring. That is the point."><div className="flex items-center justify-between gap-4 rounded-xl bg-muted/70 p-3.5"><div><p className="text-[12px] font-bold">Local-only workspace</p><p className="mt-1 text-[11px] text-muted-foreground">No messages leave this browser.</p></div><div className="flex items-center gap-2 font-mono text-[10px] font-bold text-primary"><span className="size-2 rounded-full bg-primary" /> ON</div></div><div className="mt-2 flex items-center justify-between gap-4 rounded-xl border border-border p-3.5"><div><p className="text-[12px] font-bold">Private by default</p><p className="mt-1 text-[11px] text-muted-foreground">No account, sync, or shared links.</p></div><LockKeyhole size={17} className="text-muted-foreground" /></div></SettingSection><SettingSection icon={<Sparkles size={17} />} title="Extraction model" detail="Choose how Secondary Mind reads a captured moment."><select value={state.model} onChange={event => setSetting(current => ({ ...current, model: event.target.value }))} data-testid="select-model" className="w-full rounded-xl border border-border bg-card px-3 py-3 text-[12px] font-semibold outline-none focus:border-primary"><option>Private local model</option><option>Careful demo model</option><option>Fast lightweight model</option></select></SettingSection><SettingSection icon={<SlidersHorizontal size={17} />} title="Confidence threshold" detail="Below this line, commitments ask for your eyes before they join the board."><div className="flex items-center gap-4"><input type="range" min=".5" max=".95" step=".05" value={state.threshold} onChange={event => setSetting(current => ({ ...current, threshold: Number(event.target.value) }))} data-testid="input-confidence-threshold" className="accent-[hsl(var(--primary))] flex-1" /><span className="w-12 rounded-lg bg-secondary px-2 py-2 text-center font-mono text-[11px] font-bold">{Math.round(state.threshold * 100)}%</span></div><div className="mt-2 flex justify-between font-mono text-[9px] text-muted-foreground"><span>more captured</span><span>more certain</span></div></SettingSection></div><div className="space-y-4"><div className="rounded-2xl bg-[hsl(222_35%_18%)] p-6 text-sidebar-foreground"><div className="flex items-center gap-2 text-[11px] font-bold text-sidebar-primary"><Radio size={15} /> Demo controls</div><h2 className="mt-3 font-serif text-[27px] text-white">Make the moment visible.</h2><p className="mt-2 text-[12px] leading-relaxed text-sidebar-foreground/60">Import a WhatsApp export, paste a note, simulate a voice memo, or run a screenshot through the demo OCR.</p><div className="mt-5 grid gap-2"><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-sidebar-border px-3 py-2.5 text-[11px] font-bold transition hover:bg-sidebar-accent"><Upload size={15} /> Import WhatsApp .txt<input type="file" accept=".txt,text/plain" onChange={event => { const file = event.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = () => { const text = String(reader.result || ''); if (text) { window.dispatchEvent(new CustomEvent('secondary-capture', { detail: { text, type: 'whatsapp' } })); } }; reader.readAsText(file); } }} className="hidden" /></label><button onClick={() => window.dispatchEvent(new CustomEvent('secondary-capture', { detail: { text: 'Voice memo — remember to send the project estimate before lunch.', type: 'voice' } }))} data-testid="button-simulate-voice" className="flex items-center gap-2 rounded-xl border border-sidebar-border px-3 py-2.5 text-left text-[11px] font-bold transition hover:bg-sidebar-accent"><Mic size={15} /> Simulate voice memo</button><button onClick={() => window.dispatchEvent(new CustomEvent('secondary-capture', { detail: { text: 'Screenshot capture — confirm the revised scope with the client.', type: 'image' } }))} data-testid="button-simulate-ocr" className="flex items-center gap-2 rounded-xl border border-sidebar-border px-3 py-2.5 text-left text-[11px] font-bold transition hover:bg-sidebar-accent"><ImagePlus size={15} /> Simulate screenshot OCR</button></div></div><div className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground"><Trash2 size={15} /> Reset this demo</div><p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Restore the original sample threads and commitments. Local captures will be removed.</p><button onClick={onReset} data-testid="button-reset-demo" className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/30 px-3 py-2 text-[11px] font-bold text-destructive hover:bg-destructive/5"><RotateCcw size={14} /> Restore demo data</button></div>{saved ? <div className="flex items-center gap-2 px-2 text-[11px] font-bold text-primary"><CheckCircle2 size={14} /> Saved locally</div> : null}</div></div></div>;
}

function SourcePage({ state, sourceId, onBack }: { state: StoredState; sourceId: string; onBack: () => void }) {
  const entry = state.entries.find(item => item.id === sourceId);
  if (!entry) return <div><PageHeading eyebrow="Source not found" title="That moment is missing." detail="It may have been removed from this local demo." action={<button onClick={onBack} data-testid="button-back-source" className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[12px] font-bold"><ArrowLeft size={15} /> Back to board</button>} /></div>;
  const related = state.extractions.filter(item => item.entryId === entry.id);
  return <div><button onClick={onBack} data-testid="button-back-source" className="mb-8 flex items-center gap-2 text-[12px] font-bold text-muted-foreground hover:text-primary"><ArrowLeft size={15} /> Back to board</button><div className="grid gap-6 lg:grid-cols-[1fr_340px]"><article className="rounded-2xl border border-border bg-card p-6 md:p-9"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-primary"><SourceIcon type={entry.sourceType} /> {entry.sourceType} source</div><span className="font-mono text-[10px] text-muted-foreground">{formatDate(entry.timestamp)}</span></div><h1 className="mt-8 font-serif text-[38px] leading-none">The original moment.</h1><div className="mt-8 border-l-2 border-primary/40 pl-5"><p className="text-[17px] leading-[1.75] text-foreground">“{entry.transcribedText}”</p></div><div className="mt-8 flex items-center gap-3 border-t border-border pt-5 text-[11px] text-muted-foreground"><div className="grid size-8 place-items-center rounded-full bg-accent font-mono text-[10px] font-bold text-accent-foreground">{entry.sender.slice(0, 2).toUpperCase()}</div><div><strong className="text-foreground">{entry.sender}</strong><div className="mt-0.5">{entry.sourceType === 'whatsapp' ? 'WhatsApp export' : entry.sourceType === 'voice' ? 'Voice memo transcription' : 'Screenshot OCR'} · {formatDate(entry.timestamp)}</div></div></div></article><aside className="space-y-4"><div className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-2 text-[11px] font-bold"><Clipboard size={15} className="text-primary" /> Extracted from this source</div><div className="mt-4 space-y-2">{related.map(item => <div key={item.id} className="rounded-xl bg-muted p-3"><p className="text-[12px] font-bold">{item.task}</p><div className="mt-2 flex justify-between font-mono text-[9px] text-muted-foreground"><span>{item.owner}</span><span>{Math.round(item.confidence * 100)}% confidence</span></div></div>)}</div></div><div className="rounded-2xl border border-border bg-[hsl(164_59%_38%/.08)] p-5"><div className="flex items-center gap-2 text-[11px] font-bold text-primary"><ShieldCheck size={15} /> Traceable by design</div><p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Every extracted commitment keeps a direct path back to the words that created it.</p></div></aside></div></div>;
}

function CaptureModal({ open, text, setText, type, setType, processing, onClose, onSubmit, onFile }: { open: boolean; text: string; setText: (text: string) => void; type: SourceType; setType: (type: SourceType) => void; processing: boolean; onClose: () => void; onSubmit: () => void; onFile: (event: ChangeEvent<HTMLInputElement>) => void }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-40 grid place-items-center bg-foreground/25 p-4 backdrop-blur-sm"><div className="animate-rise w-full max-w-[520px] rounded-3xl border border-border bg-card p-5 shadow-2xl md:p-7"><div className="flex items-start justify-between"><div><div className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">New capture</div><h2 className="mt-2 font-serif text-[30px] leading-none">Put the moment somewhere safe.</h2></div><button onClick={onClose} data-testid="button-close-capture" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><X size={18} /></button></div><div className="mt-6 grid grid-cols-3 gap-2">{(['whatsapp', 'voice', 'image'] as SourceType[]).map(item => <button key={item} onClick={() => setType(item)} data-testid={`button-capture-type-${item}`} className={`flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-[10px] font-bold capitalize ${type === item ? 'border-primary bg-[hsl(164_59%_38%/.08)] text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}><SourceIcon type={item} />{item === 'whatsapp' ? 'Paste / import' : item === 'voice' ? 'Voice memo' : 'Screenshot OCR'}</button>)}</div>{type === 'whatsapp' ? <div className="relative mt-4"><textarea value={text} onChange={event => setText(event.target.value)} data-testid="textarea-capture" autoFocus rows={6} placeholder="Paste a WhatsApp export or a single message here…" className="w-full resize-none rounded-2xl border border-border bg-muted/45 p-4 text-[13px] leading-relaxed outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /><label className="absolute bottom-3 right-3 flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground hover:text-primary"><Upload size={12} /> import .txt<input type="file" accept=".txt,text/plain" onChange={onFile} className="hidden" /></label></div> : <div className="mt-4 rounded-2xl border border-dashed border-primary/40 bg-[hsl(164_59%_38%/.06)] p-6 text-center"><div className="mx-auto grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">{type === 'voice' ? <Mic size={21} /> : <ImagePlus size={21} />}</div><p className="mt-3 text-[13px] font-bold">{type === 'voice' ? 'Voice memo ready to simulate' : 'Screenshot ready to simulate OCR'}</p><p className="mt-1 text-[11px] text-muted-foreground">The demo will transcribe this into a searchable commitment.</p><textarea value={text} onChange={event => setText(event.target.value)} data-testid="textarea-simulation" rows={2} placeholder={type === 'voice' ? 'Optional: describe the voice memo…' : 'Optional: describe the screenshot…'} className="mt-4 w-full rounded-xl border border-border bg-card p-3 text-[12px] outline-none focus:border-primary" /></div>}<div className="mt-5 flex items-center justify-between gap-3"><p className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><LockKeyhole size={12} className="text-primary" /> stays in this browser</p><button disabled={processing || !text.trim()} onClick={onSubmit} data-testid="button-process-capture" className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[12px] font-bold text-primary-foreground transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45">{processing ? <><span className="size-3 animate-pulse rounded-full bg-primary-foreground" /> Reading the moment…</> : <><Sparkles size={14} /> Extract commitments</>}</button></div></div></div>;
}

function ReviewModal({ item, onClose, onAccept }: { item?: Extraction; onClose: () => void; onAccept: () => void }) {
  if (!item) return null;
  return <div className="fixed inset-0 z-40 grid place-items-center bg-foreground/25 p-4 backdrop-blur-sm"><div className="animate-rise w-full max-w-[480px] rounded-3xl border border-border bg-card p-6 shadow-2xl"><div className="flex items-start justify-between"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(34_70%_34%)]"><AlertTriangle size={15} /> Needs a human look</div><button onClick={onClose} data-testid="button-close-review" className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={17} /></button></div><h2 className="mt-5 font-serif text-[27px] leading-tight">Does this feel like a commitment?</h2><div className="mt-5 rounded-2xl bg-[hsl(43_92%_66%/.16)] p-4"><p className="text-[14px] font-bold">{item.task}</p><div className="mt-3 flex gap-4 font-mono text-[10px] text-muted-foreground"><span>{item.owner}</span><span>{item.deadline}</span><span>{Math.round(item.confidence * 100)}% confidence</span></div></div><p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">Secondary Mind is not certain this is an actionable promise. Confirming it will keep it on your board and raise the confidence above your review line.</p><div className="mt-6 flex justify-end gap-2"><button onClick={onClose} data-testid="button-skip-review" className="rounded-xl px-3.5 py-2.5 text-[12px] font-bold text-muted-foreground hover:bg-muted">Keep reviewing later</button><button onClick={onAccept} data-testid="button-confirm-review" className="flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-[12px] font-bold text-primary-foreground"><Check size={14} /> Yes, keep it</button></div></div></div>;
}

function DigestRow({ item, onToggle, onDismiss, onDone, dark = false }: { item: DigestItem & { title: string; urgency: Urgency }; onToggle: () => void; onDismiss: () => void; onDone?: () => void; dark?: boolean }) {
  const urgencyClass = item.urgency === 'high' ? 'bg-[hsl(3_71%_56%/.14)] text-destructive' : 'bg-[hsl(43_92%_66%/.25)] text-[hsl(34_70%_34%)]';
  const rowClass = dark ? 'border-sidebar-border bg-sidebar-accent/45' : 'border-border/70 bg-muted/40';
  const titleClass = dark ? 'text-white' : '';
  const metaClass = dark ? 'text-sidebar-foreground/50' : 'text-muted-foreground';
  const doneClass = dark ? 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-white' : 'text-muted-foreground hover:bg-secondary hover:text-primary';
  const holdClass = dark ? 'bg-sidebar-accent text-sidebar-foreground hover:text-white' : 'bg-card text-muted-foreground hover:text-primary';
  return <div className={`flex items-center gap-3 rounded-xl border p-3 ${rowClass}`} data-testid={`digest-item-${item.id}`}>
    <div className={`grid size-7 shrink-0 place-items-center rounded-lg ${urgencyClass}`}><Clock3 size={14} /></div>
    <div className="min-w-0 flex-1"><p className={`text-[12px] font-bold ${titleClass}`}>{item.title}</p><p className={`mt-1 font-mono text-[9px] ${metaClass}`}>{item.meetingLabel}</p></div>
    {onDone ? <button onClick={onDone} data-testid={`button-digest-done-${item.id}`} aria-label="Mark digest item done" className={`rounded-lg p-2 ${doneClass}`}><Check size={15} /></button> : null}
    <button onClick={onToggle} data-testid={`button-digest-hold-${item.id}`} className={`rounded-lg px-2 py-1.5 font-mono text-[9px] font-bold ${holdClass}`}>{dark ? 'bring back' : 'hold'}</button>
    <button onClick={onDismiss} data-testid={`button-digest-dismiss-${item.id}`} aria-label={`Dismiss ${item.title}`} className={`rounded-lg p-1.5 ${dark ? 'text-sidebar-foreground/50 hover:text-white' : 'text-muted-foreground hover:text-destructive'}`}><X size={14} /></button>
  </div>;
}

function SettingSection({ icon, title, detail, children }: { icon: ReactNode; title: string; detail: string; children: ReactNode }) { return <section className="rounded-2xl border border-border bg-card p-5 md:p-6"><div className="flex items-center gap-2 text-primary">{icon}<h2 className="text-[14px] font-extrabold text-foreground">{title}</h2></div><p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{detail}</p><div className="mt-5">{children}</div></section>; }
function InsightPanel({ title, detail, children }: { title: string; detail: string; children: ReactNode }) { return <section className="rounded-2xl border border-border bg-card p-5 md:p-6"><h2 className="text-[14px] font-extrabold">{title}</h2><p className="mt-1 text-[11px] text-muted-foreground">{detail}</p><div className="mt-6">{children}</div></section>; }
function MetricCard({ label, value, note, icon }: { label: string; value: string; note: string; icon: ReactNode }) { return <div className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between text-muted-foreground"><span className="text-[11px] font-bold">{label}</span><span className="text-primary">{icon}</span></div><div className="mt-4 font-serif text-[35px] leading-none">{value}</div><p className="mt-2 font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">{note}</p></div>; }
function StatCard({ label, value, note, accent }: { label: string; value: string; note: string; accent: 'amber' | 'blue' }) { return <div className="rounded-2xl border border-border bg-card p-5"><div className={`mb-5 size-2 rounded-full ${accent === 'amber' ? 'bg-accent' : 'bg-[hsl(205_62%_54%)]'}`} /><div className="font-serif text-[33px] leading-none">{value}</div><div className="mt-2 text-[12px] font-bold">{label}</div><div className="mt-1 font-mono text-[9px] uppercase tracking-[.08em] text-muted-foreground">{note}</div></div>; }
function SectionLabel({ label, count, inverted = false }: { label: string; count: number; inverted?: boolean }) { return <div className={`flex items-center justify-between border-b pb-3 ${inverted ? 'border-sidebar-border' : 'border-border'}`}><h2 className={`font-mono text-[10px] font-medium uppercase tracking-[.16em] ${inverted ? 'text-sidebar-foreground/70' : 'text-muted-foreground'}`}>{label}</h2><span className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold ${inverted ? 'bg-sidebar-accent text-sidebar-foreground' : 'bg-secondary text-muted-foreground'}`}>{count}</span></div>; }
function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <button onClick={onClick} data-testid={`button-filter-${label.toLowerCase().replaceAll(' ', '-')}`} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-bold ${active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{label}</button>; }
function Urgency({ urgency }: { urgency: Urgency }) { return <span className={`rounded-md px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[.08em] ${urgency === 'high' ? 'bg-[hsl(3_71%_56%/.12)] text-destructive' : urgency === 'medium' ? 'bg-[hsl(43_92%_66%/.2)] text-[hsl(34_70%_34%)]' : 'bg-secondary text-muted-foreground'}`}>{urgency}</span>; }
function SourceIcon({ type }: { type: SourceType }) { return type === 'whatsapp' ? <MessageSquareText size={14} /> : type === 'voice' ? <Mic size={14} /> : <ImagePlus size={14} />; }
function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center"><div className="mx-auto grid size-10 place-items-center rounded-full bg-secondary text-primary"><BrainCircuit size={18} /></div><h3 className="mt-4 font-serif text-[22px]">{title}</h3><p className="mx-auto mt-2 max-w-[360px] text-[12px] leading-relaxed text-muted-foreground">{detail}</p></div>; }
function NotFound() { return <div className="py-20 text-center"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">404 · quiet corner</p><h1 className="mt-3 font-serif text-4xl">This page is not in the mind.</h1><Link href="/" data-testid="link-back-home" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[12px] font-bold text-primary-foreground">Back to board <ArrowUpRight size={14} /></Link></div>; }
function highlight(text: string, query: string) { if (!query) return text; const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'ig')); return parts.map((part, index) => part.toLowerCase() === query.toLowerCase() ? <mark key={index} className="rounded bg-accent/60 px-0.5 text-inherit">{part}</mark> : part); }
function escapeRegExp(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function formatDate(value: string) { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)); }

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Root() { return <RoutedErrorBoundary><App /></RoutedErrorBoundary>; }
export default Root;