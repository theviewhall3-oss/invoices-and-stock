import type { ReactNode } from "react";
import { AppShell } from "@/client/components/AppShell";
import { AppNav } from "@/client/components/AppNav";

/** A member page: the shell with the app's menu. */
export function Page({ children }: { children: ReactNode }) {
  return <AppShell nav={<AppNav />}>{children}</AppShell>;
}

/** A titled part of a page. */
export function Section({
  title,
  actions,
  children,
  testId,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section className="space-y-3" data-testid={testId}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** A figure with its label, for summaries. */
export function Stat({
  label,
  value,
  testId,
}: {
  label: string;
  value: ReactNode;
  testId: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 text-card-foreground shadow-xs">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums" data-testid={testId}>
        {value}
      </div>
    </div>
  );
}

export function NotFoundState({ what }: { what: string }) {
  return (
    <div
      data-testid="not-found"
      className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground"
    >
      No such {what}.
    </div>
  );
}
