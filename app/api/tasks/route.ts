import { NextResponse } from "next/server";
import { database } from "@/db/neon";
import { visitorId } from "@/db/visitor";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const unavailable = () => NextResponse.json({ error: "Could not save your changes. Please try again." }, { status: 500 });
const noSession = () => NextResponse.json({ error: "Refresh the page to start your session." }, { status: 401 });
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
export async function GET(request: Request) {
  try {
    const owner = visitorId(request); if (!owner) return noSession();
    const sql = database();
    const rows = await sql`SELECT id, title, detail, due_date AS "dueDate", due_time AS "dueTime", priority,
      CASE WHEN completed THEN 100 ELSE progress END AS progress, completed,
      CAST(created_at AS DOUBLE PRECISION) AS "createdAt"
      FROM tasks WHERE visitor_id = ${owner} ORDER BY created_at DESC`;
    return NextResponse.json(rows);
  } catch (error) { console.error("tasks GET", error); return unavailable(); }
}
export async function POST(request: Request) {
  try {
    const owner = visitorId(request); if (!owner) return noSession();
    const data = await request.json() as { title?: unknown; detail?: unknown; dueDate?: unknown; dueTime?: unknown; priority?: unknown; progress?: unknown };
    const title = typeof data.title === "string" ? data.title.trim() : "";
    const detail = typeof data.detail === "string" ? data.detail.trim() : "";
    const dueDate = typeof data.dueDate === "string" && datePattern.test(data.dueDate) ? data.dueDate : null;
    const dueTime = data.dueTime === null || data.dueTime === undefined || data.dueTime === "" ? null : typeof data.dueTime === "string" && timePattern.test(data.dueTime) ? data.dueTime : false;
    const priority = data.priority === undefined ? "medium" : data.priority;
    const progress = data.progress === undefined ? 0 : data.progress;
    if (!title || title.length > 160 || detail.length > 4000 || dueTime === false || (dueTime && !dueDate) || (priority !== "low" && priority !== "medium" && priority !== "high") || typeof progress !== "number" || !Number.isInteger(progress) || progress < 0 || progress > 100) return NextResponse.json({ error: "Please check the task details." }, { status: 400 });
    const id = crypto.randomUUID(); const createdAt = Date.now(); const completed = progress === 100;
    const sql = database();
    await sql`INSERT INTO tasks (id, visitor_id, title, detail, due_date, due_time, priority, progress, completed, created_at)
      VALUES (${id}, ${owner}, ${title}, ${detail}, ${dueDate}, ${dueTime}, ${priority}, ${progress}, ${completed}, ${createdAt})`;
    return NextResponse.json({ id, title, detail, dueDate, dueTime, priority, progress, completed, createdAt }, { status: 201 });
  } catch (error) { console.error("tasks POST", error); return unavailable(); }
}
export async function PATCH(request: Request) {
  try {
    const owner = visitorId(request); if (!owner) return noSession();
    const data = await request.json() as { id?: unknown; title?: unknown; detail?: unknown; dueDate?: unknown; dueTime?: unknown; priority?: unknown; progress?: unknown; completed?: unknown };
    if (typeof data.id !== "string") return NextResponse.json({ error: "Invalid task." }, { status: 400 });
    const sql = database();
    const rows = await sql`SELECT title, detail, due_date, due_time, priority, progress, completed FROM tasks WHERE id = ${data.id} AND visitor_id = ${owner}`;
    if (!rows.length) return NextResponse.json({ error: "Task not found." }, { status: 404 });
    const current = rows[0];
    const title = data.title === undefined ? current.title : typeof data.title === "string" ? data.title.trim() : "";
    const detail = data.detail === undefined ? current.detail : typeof data.detail === "string" ? data.detail.trim() : "";
    const dueDate = data.dueDate === undefined ? current.due_date : data.dueDate === null || data.dueDate === "" ? null : typeof data.dueDate === "string" && datePattern.test(data.dueDate) ? data.dueDate : false;
    const dueTime = data.dueTime === undefined ? current.due_time : data.dueTime === null || data.dueTime === "" ? null : typeof data.dueTime === "string" && timePattern.test(data.dueTime) ? data.dueTime : false;
    const priority = data.priority === undefined ? current.priority : data.priority;
    const progress = data.completed !== undefined ? data.completed === true ? 100 : data.completed === false ? 0 : -1 : data.progress === undefined ? current.completed ? 100 : current.progress : data.progress;
    if (typeof title !== "string" || !title || title.length > 160 || typeof detail !== "string" || detail.length > 4000 || dueDate === false || dueTime === false || (dueTime && !dueDate) || (priority !== "low" && priority !== "medium" && priority !== "high") || typeof progress !== "number" || !Number.isInteger(progress) || progress < 0 || progress > 100) return NextResponse.json({ error: "Please check the task details." }, { status: 400 });
    const completed = progress === 100;
    await sql`UPDATE tasks SET title = ${title}, detail = ${detail}, due_date = ${dueDate}, due_time = ${dueTime}, priority = ${priority}, progress = ${progress}, completed = ${completed} WHERE id = ${data.id} AND visitor_id = ${owner}`;
    return NextResponse.json({ ok: true });
  } catch (error) { console.error("tasks PATCH", error); return unavailable(); }
}
export async function DELETE(request: Request) {
  try {
    const owner = visitorId(request); if (!owner) return noSession();
    const { id } = await request.json() as { id?: unknown };
    if (typeof id !== "string") return NextResponse.json({ error: "Invalid task." }, { status: 400 });
    const sql = database();
    await sql`DELETE FROM tasks WHERE id = ${id} AND visitor_id = ${owner}`;
    return NextResponse.json({ ok: true });
  } catch (error) { console.error("tasks DELETE", error); return unavailable(); }
}
