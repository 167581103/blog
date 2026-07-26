import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { PageFade } from "@/components/chrome/page-fade";

export const dynamic = "force-dynamic";

function safeNextPath(raw?: string) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const next = safeNextPath(params.next);

  if (session) redirect(next);

  const denied = params.error === "AccessDenied";

  return (
    <main className="login-shell">
      <PageFade>
        <div className="login-panel">
          <h1>Sign in</h1>
          <p>
            {denied
              ? "GitHub sign-in was denied."
              : "Sign in with GitHub to comment. The site owner can also write."}
          </p>
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: next });
            }}
          >
            <button type="submit" className="ghost-btn">
              Continue with GitHub
            </button>
          </form>
        </div>
      </PageFade>
    </main>
  );
}
