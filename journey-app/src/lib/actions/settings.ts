"use server";

import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/auth/sessionUser";
import { prisma } from "@/lib/db";

export async function saveFigmaPat(formData: FormData) {
  const user = await requireSessionUser();
  const figmaPat = String(formData.get("figmaPat") || "");
  await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: { figmaPat },
    create: { userId: user.id, figmaPat },
  });
  revalidatePath("/settings");
}