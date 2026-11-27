"use client";

import { useBodyScrollLock } from "@/components/journey/useBodyScrollLock";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  useBodyScrollLock(true);
  return <div className="w-full min-h-0 overflow-hidden">{children}</div>;
}