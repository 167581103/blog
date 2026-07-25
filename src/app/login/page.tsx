import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { PageFade } from "@/components/page-fade";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/");

  const params = await searchParams;
  const denied = params.error === "AccessDenied";

  return (
    <main className="login-shell">
      <PageFade>
        <div className="login-panel">
          <h1>Sign in</h1>
          <p>
            {denied
              ? "This account is not allowed to manage the blog."
              : "Author access via GitHub."}
          </p>
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: "/" });
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
