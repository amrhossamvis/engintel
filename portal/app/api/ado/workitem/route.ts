import { NextResponse } from "next/server";
import { adoReadable } from "@/lib/ado";
import { createWorkItem, WORK_ITEM_TYPES, type CreateWorkItemInput } from "@/lib/ado-workitems";

export async function POST(req: Request) {
  const userPat = req.headers.get("x-ado-pat")?.trim() || undefined;
  if (!(await adoReadable(userPat))) {
    return NextResponse.json({ error: "ado_not_configured" }, { status: 501 });
  }

  const body = (await req.json().catch(() => null)) as Partial<CreateWorkItemInput> | null;
  const type = body?.type?.trim();
  const title = body?.title?.trim();
  if (!type || !WORK_ITEM_TYPES.includes(type as (typeof WORK_ITEM_TYPES)[number])) {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }
  if (!title) return NextResponse.json({ error: "missing_title" }, { status: 400 });

  const parentId =
    body?.parentId != null && Number.isFinite(Number(body.parentId))
      ? Number(body.parentId)
      : undefined;

  try {
    const created = await createWorkItem(
      {
        type,
        title,
        description: body?.description,
        acceptanceCriteria: body?.acceptanceCriteria,
        areaPath: body?.areaPath,
        iterationPath: body?.iterationPath,
        parentId,
      },
      userPat,
    );
    return NextResponse.json(created);
  } catch (err) {
    // Surface ADO's own message (e.g. PAT lacks Work Items write, bad area path).
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "create_failed" },
      { status: 502 },
    );
  }
}
