"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { JourneyNav } from "@/components/journey/JourneyNav";
import { journeySectionFromPathname } from "@/lib/navigation/journeySegment";

export function JourneyNavClient({
  journeyId,
  layout = "bar",
}: {
  journeyId: string;
  layout?: "bar" | "rail" | "rail-icons" | "header";
}) {
  const pathname = usePathname();
  // Defer active tab styling until after mount so SSR markup matches the first client paint.
  const [segment, setSegment] = useState<string | null>(null);

  useEffect(() => {
    setSegment(journeySectionFromPathname(pathname));
  }, [pathname]);

  return (
    <JourneyNav
      journeyId={journeyId}
      segment={segment ?? ""}
      layout={layout}
      suppressActive={segment === null}
    />
  );
}