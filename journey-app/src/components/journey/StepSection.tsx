import type { ReactNode } from "react";

export function StepSection({
  title,
  icon,
  borderClass,
  titleClass,
  children,
}: {
  title: string;
  icon: ReactNode;
  borderClass: string;
  titleClass: string;
  children: ReactNode;
}) {
  return (
    <div className={`relative pl-3 border-l-[3px] ${borderClass}`}>
      <div className={`m3-section-toggle mb-2 pointer-events-none ${titleClass}`}>
        <span className="flex items-center gap-2">
          {icon} {title}
        </span>
      </div>
      <div className="pb-1 space-y-2">{children}</div>
    </div>
  );
}