import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getHomeContent, saveHomeContent } from "@/lib/storage";

export async function GET() {
  const home = await getHomeContent();
  return NextResponse.json(home);
}

export async function PUT(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    content?: string;
  };

  try {
    const home = await saveHomeContent({
      title: body.title ?? "Blog",
      content: body.content ?? "",
    });
    return NextResponse.json(home);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save home";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
