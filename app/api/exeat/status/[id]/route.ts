import { NextRequest, NextResponse } from "next/server";
import { getExeatRequestById } from "@/supabase/queries";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

    if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
      return NextResponse.json(
        { error: "Invalid request ID." },
        { status: 400 },
      );
    }

    const request = await getExeatRequestById(id);

    if (!request) {
      return NextResponse.json(
        { error: "Request not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: request.id,
      status: request.status,
      student_name: request.student.full_name,
      department: request.student.department.name,
      departure_date: request.departure_date,
      return_date: request.return_date,
      created_at: request.created_at,
      updated_at: request.updated_at,
    });
  } catch (err) {
    console.error("[API /exeat/status GET]", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
