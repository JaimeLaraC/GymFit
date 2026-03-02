"use client";

import { useEffect, useState } from "react";

interface AchievementToastProps {
  type: "pr" | "streak" | "badge";
  title: string;
  description: string;
  icon?: string;
  onDismiss?: () => void;
}

const TOAST_STYLES: Record<AchievementToastProps["type"], string> = {
  pr: "border-amber-300/70 bg-amber-50 text-amber-950",
  streak: "border-emerald-300/70 bg-emerald-50 text-emerald-950",
  badge: "border-violet-300/70 bg-violet-50 text-violet-950",
};

export function AchievementToast({
  type,
  title,
  description,
  icon,
  onDismiss,
}: AchievementToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const hideTimeout = window.setTimeout(() => setIsVisible(false), 4000);
    const dismissTimeout = window.setTimeout(() => onDismiss?.(), 4400);

    return () => {
      window.clearTimeout(hideTimeout);
      window.clearTimeout(dismissTimeout);
    };
  }, [onDismiss]);

  return (
    <article
      className={`pointer-events-auto relative overflow-hidden rounded-xl border px-4 py-3 shadow-lg transition-all duration-300 ${TOAST_STYLES[type]} ${
        isVisible ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
      }`}
      role="status"
      aria-live="polite"
    >
      <span className="absolute right-3 top-2 text-base" aria-hidden>
        ✨
      </span>
      <p className="pr-6 text-sm font-semibold">
        {icon ? `${icon} ` : ""}
        {title}
      </p>
      <p className="mt-1 text-xs opacity-90">{description}</p>
    </article>
  );
}
