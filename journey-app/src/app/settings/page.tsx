import { AppShell } from "@/components/layout/AppShell";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { prisma } from "@/lib/db";
import { saveFigmaPat } from "@/lib/actions/settings";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const pref = await prisma.userPreference.findUnique({
    where: { userId: user.id },
  });

  return (
    <AppShell>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <form action={saveFigmaPat} className="max-w-md space-y-3 rounded-xl border border-border p-4">
        <h2 className="font-semibold text-sm">Figma personal access token</h2>
        <p className="text-xs text-muted">Used for FigJam import (`file:read` scope). Stored in the database.</p>
        <input
          name="figmaPat"
          type="password"
          defaultValue={pref?.figmaPat ?? ""}
          placeholder="figd_..."
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <button type="submit" className="bg-brand text-white rounded-lg px-4 py-2 text-sm">
          Save
        </button>
      </form>
    </AppShell>
  );
}