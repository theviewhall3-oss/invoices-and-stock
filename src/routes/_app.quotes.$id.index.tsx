import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BackLink } from "@/client/components/BackLink";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Totals } from "@/client/components/DocumentEditor";
import { LinesTable } from "@/client/components/LinesTable";
import { NotFoundState, Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { ShareLink } from "@/client/components/ShareLink";
import { StatusBadge } from "@/client/components/StatusBadge";
import { Button } from "@/client/components/ui/button";
import { useAction } from "@/client/lib/actions";
import { useMoney, useSession } from "@/client/lib/session";
import { formatDate, quoteNumber } from "@/lib/format";
import { today } from "@/lib/totals";
import { convertQuote, deleteQuote, getQuote, sendQuote } from "@/serverFunctions/app";

export const Route = createFileRoute("/_app/quotes/$id/")({
  loader: ({ params }) => getQuote({ data: { id: params.id } }),
  component: QuotePage,
});

function QuotePage() {
  const detail = Route.useLoaderData();
  const { origin } = useSession();
  const money = useMoney();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const { run, pending } = useAction();
  if (!detail)
    return (
      <Page>
        <PageHeader title="Quote" backLink={<BackLink to="/quotes">Quotes</BackLink>} />
        <NotFoundState what="quote" />
      </Page>
    );
  const { quote, lines, client } = detail;
  const expired = quote.status === "sent" && quote.expiryDate < today();
  return (
    <Page>
      <PageHeader
        title={quoteNumber(quote.number)}
        backLink={<BackLink to="/quotes">Quotes</BackLink>}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={quote.status} testId="doc-status" />
            {expired ? <StatusBadge status="expired" /> : null}
            <Link to="/clients/$id" params={{ id: client.id }} className="hover:underline">
              {client.name}
            </Link>
            · {formatDate(quote.issueDate)} · expires {formatDate(quote.expiryDate)}
          </span>
        }
        actions={
          <>
            {quote.status === "draft" ? (
              <>
                <Button pending={pending} onClick={() => void run(() => sendQuote({ data: { id: quote.id } }), { toastError: true })}>
                  Mark as sent
                </Button>
                <Button variant="outline" render={<Link to="/quotes/$id/edit" params={{ id: quote.id }} />}>
                  Edit
                </Button>
                <Button variant="outline" onClick={() => setDeleting(true)}>
                  Delete
                </Button>
              </>
            ) : null}
            {quote.status === "sent" || quote.status === "accepted" ? (
              <Button
                pending={pending}
                onClick={() =>
                  void run(() => convertQuote({ data: { id: quote.id } }), { toastError: true }).then((done) => {
                    if (done.ok) void navigate({ to: "/invoices/$id", params: { id: done.value.invoiceId } });
                  })
                }
              >
                Convert to invoice
              </Button>
            ) : null}
            {quote.status === "invoiced" && quote.invoiceId ? (
              <Button variant="outline" render={<Link to="/invoices/$id" params={{ id: quote.invoiceId }} />}>
                Open invoice
              </Button>
            ) : null}
          </>
        }
      />
      {quote.shareToken && quote.status !== "draft" ? (
        <ShareLink url={`${origin}/s/q/${quote.shareToken}`} label="Client link" />
      ) : null}
      <LinesTable lines={lines} money={money} />
      <div className="grid gap-6 sm:grid-cols-2">
        {quote.notes ? <p className="text-sm whitespace-pre-line text-muted-foreground">{quote.notes}</p> : <div />}
        <Totals totals={quote} money={money} />
      </div>
      {deleting ? (
        <ConfirmDialog
          title={`Delete ${quoteNumber(quote.number)}?`}
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDeleting(false)}
          onConfirm={() =>
            void run(() => deleteQuote({ data: { id: quote.id } }), { toastError: true }).then((done) => {
              setDeleting(false);
              if (done.ok) void navigate({ to: "/quotes" });
            })
          }
        />
      ) : null}
    </Page>
  );
}
