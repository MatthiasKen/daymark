import { NextResponse } from "next/server";
import { database } from "@/db/neon";
import { visitorId } from "@/db/visitor";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const unavailable = () => NextResponse.json({ error: "Could not save your note. Please try again." }, { status: 500 });
const noSession = () => NextResponse.json({ error: "Refresh the page to start your session." }, { status: 401 });
export async function GET(request: Request) {
  try {
    const owner = visitorId(request); if (!owner) return noSession();
    const sql = database();
    const rows = await sql`SELECT id, title, body, CAST(updated_at AS DOUBLE PRECISION) AS "updatedAt" FROM notes WHERE visitor_id = ${owner} ORDER BY updated_at DESC`;
    return NextResponse.json(rows);
  } catch (error) { console.error("notes GET", error); return unavailable(); }
}
export async function POST(request: Request) {
  try {
    const owner = visitorId(request); if (!owner) return noSession();
    const data = await request.json() as { title?: unknown; body?: unknown };
    const title = typeof data.title === "string" ? data.title.trim() : "";
    const body = typeof data.body === "string" ? data.body.trim() : "";
    if (!title || title.length > 160 || body.length > 10000) return NextResponse.json({ error: "Enter a note title (up to 160 characters)." }, { status: 400 });
    const id = crypto.randomUUID(); const updatedAt = Date.now(); const sql = database();
    await sql`INSERT INTO notes (id, visitor_id, title, body, updated_at) VALUES (${id}, ${owner}, ${title}, ${body}, ${updatedAt})`;
    return NextResponse.json({ id, title, body, updatedAt }, { status: 201 });
  } catch (error) { console.error("notes POST", error); return unavailable(); }
}
export async function PATCH(request: Request) {
  try {
    const owner = visitorId(request); if (!owner) return noSession();
    const data = await request.json() as { id?: unknown; title?: unknown; body?: unknown };
    const title = typeof data.title === "string" ? data.title.trim() : "";
    const body = typeof data.body === "string" ? data.body.trim() : "";
    if (typeof data.id !== "string" || !title || title.length > 160 || body.length > 10000) return NextResponse.json({ error: "Please check the note details." }, { status: 400 });
    const updatedAt = Date.now(); const sql = database();
    const rows = await sql`UPDATE notes SET title = ${title}, body = ${body}, updated_at = ${updatedAt} WHERE id = ${data.id} AND visitor_id = ${owner} RETURNING id`;
    if (!rows.length) return NextResponse.json({ error: "Note not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { console.error("notes PATCH", error); return unavailable(); }
}
export async function DELETE(request: Request) {
  try {
    const owner = visitorId(request); if (!owner) return noSession();
    const { id } = await request.json() as { id?: unknown };
    if (typeof id !== "string") return NextResponse.json({ error: "Invalid note." }, { status: 400 });
    const sql = database();
    await sql`DELETE FROM notes WHERE id = ${id} AND visitor_id = ${owner}`;
    return NextResponse.json({ ok: true });
  } catch (error) { console.error("notes DELETE", error); return unavailable(); }
}
