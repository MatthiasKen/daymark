"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ChevronRight, ClipboardList, FileText, LayoutList, MoreHorizontal, Plus, Search, Trash2, Pencil, Sparkles, ArrowUpRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";

type Priority = "low" | "medium" | "high";
type Task = { priority: Priority; progress: number; id: string; title: string; detail: string; dueDate: string | null; dueTime: string | null; completed: number; createdAt: number };
type Note = { id: string; title: string; body: string; updatedAt: number };
type View = "all" | "upcoming" | "completed" | "notes";
const priorityStyle: Record<Priority, string> = { low: "bg-[#e0f6ed] text-[#137e58]", medium: "bg-[#fff1d5] text-[#98640b]", high: "bg-[#ffe4e7] text-[#b43d4d]" };
const deadlineMs = (task: Task) => task.dueDate ? new Date(`${task.dueDate}T${task.dueTime ?? "23:59"}:00`).getTime() : null;
const deadlineState = (task: Task, now: number): "overdue" | "soon" | null => {
  if (task.completed) return null;
  const deadline = deadlineMs(task);
  if (deadline === null || !Number.isFinite(deadline)) return null;
  const remaining = deadline - now;
  return remaining < 0 ? "overdue" : remaining <= 24 * 60 * 60 * 1000 ? "soon" : null;
};
const warningText = (task: Task, now: number) => {
  const deadline = deadlineMs(task);
  if (deadline === null) return "";
  const remaining = deadline - now;
  if (remaining < 0) return "Overdue";
  if (remaining < 60 * 60 * 1000) return `Due in ${Math.max(1, Math.ceil(remaining / 60000))} min`;
  return `Due in ${Math.ceil(remaining / 3600000)} hr`;
};
const readableTime = (value: string) => new Date(`2000-01-01T${value}:00`).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const readableDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [view, setView] = useState<View>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDetail, setTaskDetail] = useState("");
  const [taskDate, setTaskDate] = useState("");
  const [taskTime, setTaskTime] = useState("");
  const [taskPriority, setTaskPriority] = useState<Priority>("medium");
  const [taskProgress, setTaskProgress] = useState(0);
  const [noteOpen, setNoteOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");

  const refresh = useCallback(async () => {
    try {
      const session = await fetch("/api/session", { cache: "no-store" });
      if (!session.ok) throw new Error("Could not start your workspace. Please try again.");
      const [tasksResponse, notesResponse] = await Promise.all([fetch("/api/tasks", { cache: "no-store" }), fetch("/api/notes", { cache: "no-store" })]);
      if (!tasksResponse.ok || !notesResponse.ok) throw new Error("Could not load your data. Please try again.");
      setTasks(await tasksResponse.json()); setNotes(await notesResponse.json()); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load your data."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); const updateTime = () => setNow(Date.now()); const timer = window.setInterval(updateTime, 60000); window.addEventListener("focus", updateTime); document.addEventListener("visibilitychange", updateTime); return () => { window.clearInterval(timer); window.removeEventListener("focus", updateTime); document.removeEventListener("visibilitychange", updateTime); }; }, [refresh]);
  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: object, options: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    const register = (name: string, title: string, description: string, properties: object, required: string[], path: string) => {
      void Promise.resolve(context.registerTool({ name, title, description, inputSchema: { type: "object", properties, required, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, async execute(input: unknown) {
        const value = input as Record<string, unknown>;
        const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
        const result = await response.json() as { id?: string; error?: string };
        if (!response.ok) throw new Error(result.error || "Could not save.");
        await refresh(); return { id: result.id, saved: true };
      } }, { signal: controller.signal })).catch(() => {});
    };
    register("create_task", "Create task", "Save a task in the current workspace.", { title: { type: "string", minLength: 1, maxLength: 160 }, detail: { type: "string" }, dueDate: { type: "string", description: "Optional date in YYYY-MM-DD format" }, dueTime: { type: "string", description: "Optional time in HH:mm format; requires dueDate" }, priority: { type: "string", enum: ["low", "medium", "high"] }, progress: { type: "integer", minimum: 0, maximum: 100 } }, ["title"], "/api/tasks");
    register("create_note", "Create note", "Save a note in the current workspace.", { title: { type: "string", minLength: 1, maxLength: 160 }, body: { type: "string" } }, ["title"], "/api/notes");
    return () => controller.abort();
  }, [refresh]);

  async function mutate(path: string, method: string, data: object) {
    setBusy(true); setError("");
    try {
      const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!response.ok) { const result = await response.json() as { error?: string }; throw new Error(result.error || "Could not save your changes."); }
      await refresh(); return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save your changes."); return false; }
    finally { setBusy(false); }
  }
  function openTask(task?: Task) { setEditingTask(task ?? null); setTaskTitle(task?.title ?? ""); setTaskDetail(task?.detail ?? ""); setTaskDate(task?.dueDate ?? ""); setTaskTime(task?.dueTime ?? ""); setTaskPriority(task?.priority ?? "medium"); setTaskProgress(task?.progress ?? 0); setTaskOpen(true); }
  function openNote(note?: Note) { setEditingNote(note ?? null); setNoteTitle(note?.title ?? ""); setNoteBody(note?.body ?? ""); setNoteOpen(true); }
  async function saveTask(event: React.FormEvent) { event.preventDefault(); if (await mutate("/api/tasks", editingTask ? "PATCH" : "POST", { ...(editingTask ? { id: editingTask.id } : {}), title: taskTitle, detail: taskDetail, dueDate: taskDate || null, dueTime: taskDate ? taskTime || null : null, priority: taskPriority, progress: taskProgress })) setTaskOpen(false); }
  async function saveNote(event: React.FormEvent) { event.preventDefault(); if (await mutate("/api/notes", editingNote ? "PATCH" : "POST", { ...(editingNote ? { id: editingNote.id } : {}), title: noteTitle, body: noteBody })) setNoteOpen(false); }
  async function deleteTask(task: Task) { if (window.confirm(`Delete “${task.title}”?`)) await mutate("/api/tasks", "DELETE", { id: task.id }); }
  async function deleteNote(note: Note) { if (window.confirm(`Delete “${note.title}”?`)) await mutate("/api/notes", "DELETE", { id: note.id }); }
  const active = tasks.filter(t => !t.completed).length;
  const overdue = tasks.filter(t => deadlineState(t, now) === "overdue").length;
  const dueSoon = tasks.filter(t => deadlineState(t, now) === "soon").length;
  const overallProgress = tasks.length ? Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length) : 0;
  const visibleTasks = useMemo(() => tasks.filter(t => {
    if (view === "upcoming" && (t.completed || !t.dueDate)) return false;
    if (view === "completed" && !t.completed) return false;
    return `${t.title} ${t.detail}`.toLowerCase().includes(search.toLowerCase());
  }).sort((a,b) => view === "upcoming" ? `${a.dueDate ?? ""}T${a.dueTime ?? "23:59"}`.localeCompare(`${b.dueDate ?? ""}T${b.dueTime ?? "23:59"}`) : Number(a.completed) - Number(b.completed) || b.createdAt - a.createdAt), [tasks, view, search]);
  const visibleNotes = notes.filter(n => `${n.title} ${n.body}`.toLowerCase().includes(search.toLowerCase()));
  const nav: { key: View; label: string; icon: typeof LayoutList; count: number }[] = [
    { key: "all", label: "All tasks", icon: LayoutList, count: tasks.length },
    { key: "upcoming", label: "Upcoming", icon: CalendarDays, count: tasks.filter(t => !t.completed && t.dueDate).length },
    { key: "completed", label: "Completed", icon: Check, count: tasks.length - active },
    { key: "notes", label: "Notes", icon: FileText, count: notes.length },
  ];
  const heading = { all: "My tasks", upcoming: "Upcoming", completed: "Completed", notes: "My notes" }[view];

  return <div className="app-shell min-h-screen md:flex">
    <aside className="sidebar md:sticky md:top-0 md:flex md:h-screen md:w-[260px] md:shrink-0 md:flex-col">
      <div className="flex items-center gap-3 px-5 py-5 md:px-7 md:pb-12 md:pt-8">
        <div className="brand-mark"><Check size={21} strokeWidth={3}/></div>
        <span className="text-[22px] font-extrabold tracking-[-.055em] text-white">daymark<span className="text-[#85a9ff]">.</span></span>
      </div>
      <p className="hidden px-7 pb-3 text-xs font-bold uppercase tracking-[.17em] text-[#7685ae] md:block">Workspace</p>
      <nav aria-label="Main navigation" className="flex gap-1 overflow-x-auto px-3 pb-4 md:flex-col md:gap-1.5 md:px-4">
        {nav.map(item => <button key={item.key} onClick={() => { setView(item.key); setSearch(""); }} className={`nav-item flex min-w-max flex-1 items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-semibold md:flex-none ${view === item.key ? "nav-active" : "text-[#a9b5d0] hover:bg-white/7 hover:text-white"}`} aria-current={view === item.key ? "page" : undefined}>
          <item.icon size={18}/><span className="flex-1">{item.label}</span><span className="nav-count">{item.count}</span>
        </button>)}
      </nav>
      <div className="mt-auto hidden p-5 md:block"><div className="sidebar-tip"><Sparkles size={20} className="mb-4 text-[#8fb6ff]"/><p className="font-semibold text-white">One step at a time.</p><p className="mt-1 text-sm leading-6 text-[#aab8d3]">Your demo tasks and notes stay separate in this browser.</p></div></div>
    </aside>

    <main className="mx-auto w-full max-w-[1480px] min-w-0 px-4 pb-20 pt-7 sm:px-8 md:px-10 md:pt-10 xl:px-14">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div><p className="eyebrow mb-2">PUBLIC DEMO / {view === "notes" ? "NOTES" : "TASKS"}</p><h1 className="text-3xl font-extrabold tracking-[-.045em] text-[#17233b] sm:text-[40px]">{heading}</h1><p className="mt-2 text-[15px] text-[#75829b]">{view === "notes" ? "A place for the details worth keeping." : `${active} task${active === 1 ? "" : "s"} left to do${overdue ? `  ·  ${overdue} overdue` : ""}`}</p></div>
        <Button className="primary-action h-11 rounded-xl px-5 text-sm font-bold shadow-[0_8px_18px_rgba(63,91,210,.22)]" onClick={() => view === "notes" ? openNote() : openTask()}><Plus size={19}/> {view === "notes" ? "New note" : "New task"}</Button>
      </header>

      {view !== "notes" && <>
        <div className="overview-banner mb-5 flex flex-wrap items-center justify-between gap-5 rounded-[22px] p-6 sm:p-7">
          <div className="relative z-10"><div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#c7d8ff]"><Sparkles size={16}/> Keep your momentum</div><h2 className="max-w-lg text-2xl font-bold tracking-tight text-white sm:text-[29px]">Make room for what matters today.</h2><p className="mt-2 text-sm text-[#c6d4f6]">A clear view of your plans, from first step to done.</p></div>
          <div className="relative z-10 flex size-[94px] shrink-0 flex-col items-center justify-center rounded-full border-[6px] border-[#92b1ff]/50 bg-white/10 text-white backdrop-blur-sm"><strong className="text-2xl leading-none">{overallProgress}%</strong><span className="mt-1 text-xs text-[#d9e3ff]">overall</span></div>
        </div>
        <div className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Total tasks" value={tasks.length} icon={<LayoutList size={20}/>} tone="blue" />
          <Stat label="To do" value={active} icon={<MoreHorizontal size={20}/>} tone="amber" />
          <Stat label="Completed" value={tasks.length - active} icon={<Check size={20}/>} tone="green" />
          <Card className="stat-card animation-rise gap-0 border-0 py-0"><div className="flex items-start justify-between"><div><span className="stat-label">Overall progress</span><strong className="mt-3 block text-[30px] font-bold tracking-tight text-[#1b2945]">{overallProgress}%</strong></div><span className="stat-icon stat-blue"><ArrowUpRight size={20}/></span></div><Progress value={overallProgress} aria-label="Overall task progress" className="mt-4 h-2 bg-[#e9eeff] [&_[data-slot=progress-indicator]]:bg-[#4e6ce3]"/></Card>
        </div>
      </>}

      {(dueSoon > 0 || overdue > 0) && <div role="status" aria-live="polite" className={`deadline-alert mb-6 flex flex-wrap items-center gap-4 rounded-2xl px-5 py-4 sm:px-6 ${overdue ? "deadline-overdue" : "deadline-soon"}`}><span className="deadline-alert-icon"><AlertTriangle size={20}/></span><div className="min-w-0 flex-1"><p className="font-bold">{overdue ? `${overdue} overdue task${overdue === 1 ? "" : "s"}` : `${dueSoon} task${dueSoon === 1 ? "" : "s"} due soon`}</p><p className="mt-0.5 text-sm opacity-80">{overdue && dueSoon ? `${dueSoon} more due within the next 24 hours. ` : ""}{overdue ? "Review your deadlines and update your plan." : "Check what needs attention in the next 24 hours."}</p></div><Button variant="outline" onClick={() => { setView("upcoming"); setSearch(""); }} className="deadline-alert-button rounded-xl font-semibold">View tasks</Button></div>}

      <Card className="list-panel gap-0 overflow-hidden border-0 py-0">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ecf0f7] px-5 py-5 sm:px-7 sm:py-6">
          <div><h2 className="text-lg font-bold tracking-tight text-[#1d2942]">{view === "all" ? "Your list" : heading}</h2><p className="mt-1 text-sm text-[#8a96aa]">{view === "notes" ? `${visibleNotes.length} note${visibleNotes.length === 1 ? "" : "s"}` : `${visibleTasks.length} task${visibleTasks.length === 1 ? "" : "s"}`}</p></div>
          <label className="relative block w-full sm:w-64"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#99a7be]" size={17}/><span className="sr-only">Search {view === "notes" ? "notes" : "tasks"}</span><Input value={search} onChange={e => setSearch(e.target.value)} placeholder={view === "notes" ? "Search notes..." : "Search tasks..."} className="h-11 rounded-xl border-[#e8ecf4] bg-[#f7f9fd] pl-10 text-sm shadow-none focus-visible:bg-white"/></label>
        </div>
        {error && <div role="alert" className="mx-5 mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error} <button className="ml-2 font-bold underline" onClick={() => void refresh()}>Retry</button></div>}
        {loading ? <div className="space-y-3 p-6" aria-label="Loading workspace"><div className="skeleton-line w-4/5"/><div className="skeleton-line w-3/5"/><div className="skeleton-line w-4/5"/></div> : view === "notes" ? visibleNotes.length ? <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3 sm:p-7">{visibleNotes.map((note, index) => <article key={note.id} style={{ animationDelay: `${Math.min(index, 7) * 45}ms` }} className="note-card animation-rise flex min-h-52 flex-col rounded-2xl p-5"><div className="flex items-start justify-between gap-2"><div className="note-icon"><FileText size={19}/></div><button aria-label={`Delete ${note.title}`} onClick={() => void deleteNote(note)} className="icon-button hover:bg-red-50 hover:text-red-600"><Trash2 size={17}/></button></div><button onClick={() => openNote(note)} className="mt-5 text-left text-lg font-bold tracking-tight text-[#1e2a43] hover:text-[#4e6ce3]">{note.title}</button><p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-[#77849c]">{note.body || "No details yet."}</p><button onClick={() => openNote(note)} className="mt-auto flex items-center justify-between pt-6 text-xs font-semibold text-[#9aa5b7]"><span>Edited {new Date(note.updatedAt).toLocaleDateString()}</span><ChevronRight size={18}/></button></article>)}</div> : <Empty title={search ? "No matching notes" : "No notes yet"} description={search ? "Try a different search." : "Capture an idea, a reminder, or any detail you want to keep."} action={search ? undefined : () => openNote()} actionLabel="Create a note"/> : visibleTasks.length ? <div>{visibleTasks.map((task, index) => <article key={task.id} style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }} className="task-row animation-rise flex flex-wrap items-start gap-3 border-b border-[#eef1f7] px-5 py-5 last:border-0 sm:flex-nowrap sm:gap-4 sm:px-7">
          <Checkbox aria-label={`Mark ${task.title} ${task.completed ? "incomplete" : "complete"}`} checked={Boolean(task.completed)} disabled={busy} onCheckedChange={() => void mutate("/api/tasks", "PATCH", { id: task.id, completed: !task.completed })} className="mt-1 size-5 rounded-md border-[#b4c0d2] data-checked:border-[#4e6ce3] data-checked:bg-[#4e6ce3]"/>
          <button onClick={() => openTask(task)} className="min-w-0 basis-[calc(100%-40px)] flex-1 text-left sm:basis-auto"><span className={`block text-[16px] font-semibold ${task.completed ? "text-[#a1acc0] line-through" : "text-[#24314c]"}`}>{task.title}</span>{task.detail && <span className="mt-1.5 block truncate text-sm text-[#8a96aa]">{task.detail}</span>}{task.dueDate && <span className={`mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold ${deadlineState(task, now) === "overdue" ? "text-[#c24e5b]" : deadlineState(task, now) === "soon" ? "text-[#ad750e]" : "text-[#8291ac]"}`}><CalendarDays size={14}/>{deadlineState(task, now) ? `${warningText(task, now)} · ` : ""}{readableDate(task.dueDate)}{task.dueTime ? ` · ${readableTime(task.dueTime)}` : ""}</span>}<span className="mt-3 flex max-w-[290px] items-center gap-3"><Progress value={task.progress} aria-label={`${task.title} progress`} className="h-[7px] bg-[#e9eeff] [&_[data-slot=progress-indicator]]:bg-[#5573e8]"/><span className="min-w-10 text-right text-xs font-bold text-[#677b9d]">{task.progress}%</span></span></button>
          <Select value={task.priority} disabled={busy} onValueChange={value => void mutate("/api/tasks", "PATCH", { id: task.id, priority: value })}><SelectTrigger size="sm" aria-label={`Priority for ${task.title}`} className={`priority-pill w-[106px] shrink-0 rounded-full border-transparent text-xs font-bold capitalize shadow-none ${priorityStyle[task.priority]}`}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent></Select>
          <button aria-label={`Edit ${task.title}`} title="Edit task" onClick={() => openTask(task)} className="icon-button hover:bg-[#eef2ff] hover:text-[#4e6ce3]"><Pencil size={17}/></button><button aria-label={`Delete ${task.title}`} onClick={() => void deleteTask(task)} className="icon-button hover:bg-red-50 hover:text-red-600"><Trash2 size={17}/></button>
        </article>)}</div> : <Empty title={search ? "No matching tasks" : view === "completed" ? "Nothing completed yet" : view === "upcoming" ? "No upcoming tasks" : "A clear slate"} description={search ? "Try a different search." : view === "all" ? "Add your first task to get started." : "Tasks will appear here when they match this view."} action={view === "all" && !search ? () => openTask() : undefined} actionLabel="Add a task"/>}
      </Card>
    </main>

    <Dialog open={taskOpen} onOpenChange={setTaskOpen}><DialogContent className="dialog-panel max-h-[90vh] max-w-lg overflow-y-auto rounded-[22px] border-0 bg-white p-6 sm:p-7"><DialogHeader><DialogTitle className="text-2xl font-bold tracking-tight">{editingTask ? "Edit task" : "New task"}</DialogTitle></DialogHeader><form onSubmit={saveTask} className="space-y-5"><label className="block text-sm font-semibold">Task title<Input autoFocus required maxLength={160} value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="What needs to get done?" className="mt-2 h-11 rounded-xl"/></label><label className="block text-sm font-semibold">Notes <span className="font-normal text-[#8792a6]">(optional)</span><Textarea maxLength={4000} value={taskDetail} onChange={e => setTaskDetail(e.target.value)} placeholder="Add more details..." className="mt-2 min-h-28 rounded-xl"/></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Due date <span className="font-normal text-[#8792a6]">(optional)</span><Input type="date" value={taskDate} onChange={e => { setTaskDate(e.target.value); if (!e.target.value) setTaskTime(""); }} className="mt-2 h-11 rounded-xl"/></label><label className="block text-sm font-semibold">Due time <span className="font-normal text-[#8792a6]">(optional)</span><Input type="time" disabled={!taskDate} value={taskTime} onChange={e => setTaskTime(e.target.value)} className="mt-2 h-11 rounded-xl"/></label></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><label htmlFor="task-priority" className="block text-sm font-semibold">Priority</label><Select value={taskPriority} onValueChange={value => setTaskPriority(value as Priority)}><SelectTrigger id="task-priority" className="h-11 w-full rounded-xl"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent></Select></div><label className="block text-sm font-semibold">Progress (%)<Input type="number" min={0} max={100} step={1} required value={taskProgress} onChange={e => setTaskProgress(Number(e.target.value))} className="mt-2 h-11 rounded-xl"/></label></div><DialogFooter><Button type="button" variant="outline" onClick={() => setTaskOpen(false)}>Cancel</Button><Button disabled={busy} type="submit" className="primary-action">{busy ? "Saving…" : "Save task"}</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={noteOpen} onOpenChange={setNoteOpen}><DialogContent className="dialog-panel max-h-[90vh] max-w-xl overflow-y-auto rounded-[22px] border-0 bg-white p-6 sm:p-7"><DialogHeader><DialogTitle className="text-2xl font-bold tracking-tight">{editingNote ? "Edit note" : "New note"}</DialogTitle></DialogHeader><form onSubmit={saveNote} className="space-y-5"><label className="block text-sm font-semibold">Title<Input autoFocus required maxLength={160} value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="Give your note a title" className="mt-2 h-11 rounded-xl"/></label><label className="block text-sm font-semibold">Note<Textarea maxLength={10000} value={noteBody} onChange={e => setNoteBody(e.target.value)} placeholder="Write anything worth keeping..." className="mt-2 min-h-56 rounded-xl"/></label><DialogFooter><Button type="button" variant="outline" onClick={() => setNoteOpen(false)}>Cancel</Button><Button disabled={busy} type="submit" className="primary-action">{busy ? "Saving…" : "Save note"}</Button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}
function Stat({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: "blue" | "amber" | "green" }) { return <Card className="stat-card animation-rise gap-0 border-0 py-0"><div className="flex items-start justify-between"><div><span className="stat-label">{label}</span><strong className="mt-3 block text-[30px] font-bold tracking-tight text-[#1b2945]">{value}</strong></div><span className={`stat-icon stat-${tone}`}>{icon}</span></div><span className="mt-4 text-[13px] font-medium text-[#a4afc1]">{label === "Total tasks" ? "Across your workspace" : label === "To do" ? "Still in motion" : "Nicely done"}</span></Card>; }
function Empty({ title, description, action, actionLabel }: { title: string; description: string; action?: () => void; actionLabel: string }) { return <div className="flex flex-col items-center px-5 py-20 text-center"><div className="empty-icon mb-5 flex size-16 items-center justify-center rounded-2xl"><ClipboardList size={30}/></div><h3 className="text-lg font-bold text-[#1d2942]">{title}</h3><p className="mt-2 max-w-xs text-sm leading-6 text-[#8290a8]">{description}</p>{action && <Button onClick={action} variant="outline" className="mt-5 rounded-xl border-[#dce4f4] text-[#4e6ce3]"><Plus size={16}/>{actionLabel}</Button>}</div>; }
