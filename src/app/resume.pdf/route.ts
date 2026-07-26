import { getResumeResponse } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Stable public URL: https://www.chenguo.dev/resume.pdf */
export async function GET() {
  try {
    const response = await getResumeResponse();
    if (!response) {
      return new Response("Resume not found", { status: 404 });
    }
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load resume";
    return new Response(message, { status: 500 });
  }
}
