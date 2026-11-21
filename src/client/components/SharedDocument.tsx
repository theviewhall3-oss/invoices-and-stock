import type { ReactNode } from "react";
import { LinesTable } from "@/client/components/LinesTable";
import { StatusBadge } from "@/client/components/StatusBadge";
import { formatMoney } from "@/lib/format";

/** A document as its client sees it from the link: no app chrome. */
export function SharedDocument({
  title,
  status,
  business,
  client,
  dates,
  lines,
  totals,
  notes,
  extra,
  children,
}: {
  title: string;
  status: string;
  business: { name: string; address: string; currencyCode: string };
  client: { name: string; company: string };
  dates: ReactNode;
  lines: { description: string; quantity: number; unitPrice: number; discountRate: number; taxRate: number }[];
  totals: { subtotal: number; discountTotal: number; taxTotal: number; total: number };
  notes: string;
  extra?: ReactNode;
  children?: ReactNode;
}) {
  const money = (cents: number) => formatMoney(cents, business.currencyCode);
  return (
    <div className="h-dvh overflow-y-auto">
      <main className="mx-auto w-full max-w-3xl space-y-8 px-4 pt-10 pb-24 md:px-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            {business.name ? <div className="font-semibold">{business.name}</div> : null}
            {business.address ? (
              <div className="text-sm whitespace-pre-line text-muted-foreground">{business.address}</div>
            ) : null}
          </div>
          <div className="space-y-1 text-right text-sm">
            <div className="text-muted-foreground">For</div>
            <div className="font-medium">{client.name}</div>
            {client.company ? <div className="text-muted-foreground">{client.company}</div> : null}
          </div>
        </header>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <StatusBadge status={status} testId="share-status" />
            {dates}
          </div>
        </div>
        <LinesTable lines={lines} money={money} />
        <div className="grid gap-6 sm:grid-cols-2">
          {notes ? <p className="text-sm whitespace-pre-line text-muted-foreground">{notes}</p> : <div />}
          <dl className="w-full space-y-1 text-sm sm:ml-auto sm:max-w-xs">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{money(totals.subtotal)}</dd></div>
            {totals.discountTotal ? (
              <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd className="tabular-nums">−{money(totals.discountTotal)}</dd></div>
            ) : null}
            <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd className="tabular-nums">{money(totals.taxTotal)}</dd></div>
            <div className="flex justify-between border-t border-border pt-1 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums" data-testid="share-total">{money(totals.total)}</dd></div>
            {extra}
          </dl>
        </div>
        {children}
      </main>
    </div>
  );
}
