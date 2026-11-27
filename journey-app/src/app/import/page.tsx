import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { CursorImportPanel } from "@/components/import/CursorImportPanel";
import { getSessionUser } from "@/lib/auth/sessionUser";

export default async function ImportPage() {
  const user = await getSessionUser();
  if (user?.isGuest) redirect("/");
  return (
    <AppShell>
      <div
        className="relative flex min-h-[calc(100dvh-var(--app-header-px,56px))] w-full flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-14 bg-gradient-to-b from-brand/[0.07] via-canvas to-canvas"
        aria-label="Import instructions"
      >
        <CursorImportPanel />
      </div>
    </AppShell>
  );
}