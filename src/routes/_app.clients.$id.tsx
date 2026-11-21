import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BackLink } from "@/client/components/BackLink";
import { ClientDialog } from "@/client/components/ClientDialog";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { NotFoundState, Page, Section, Stat } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { StatusBadge } from "@/client/components/StatusBadge";
import { Button } from "@/client/components/ui/button";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { useAction } from "@/client/lib/actions";
import { useMoney } from "@/client/lib/session";
import { formatDate, invoiceNumber, PAYMENT_METHODS, quoteNumber } from "@/lib/format";
import { deleteClient, getClient } from "@/serverFunctions/app";

export const Route = createFileRoute("/_app/clients/$id")({
  loader: ({ params }) => getClient({ data: { id: params.id } }),
  component: ClientPage,
});

function ClientPage() {
  const detail = Route.useLoaderData();
  const navigate = useNavigate();
  const money = useMoney();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { run, pending } = useAction();
  if (!detail)
    return (
      <Page>
        <PageHeader title="Client" backLink={<BackLink to="/clients">Clients</BackLink>} />
        <NotFoundState what="client" />
      </Page>
    );
  const { client } = detail;
  const contact = [client.company, client.email, client.phone].filter(Boolean).join(" · ");
  return (
    <Page>
      <PageHeader
        title={client.name}
        description={contact || undefined}
        backLink={<BackLink to="/clients">Clients</BackLink>}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit client
            </Button>
            <Button variant="outline" onClick={() => setDeleting(true)}>
              Delete client
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Balance" value={money(detail.balance)} testId="client-balance" />
        <Stat label="Invoices" value={detail.invoices.length} testId="client-invoice-count" />
        <Stat label="Quotes" value={detail.quotes.length} testId="client-quote-count" />
      </div>
      {client.address || client.taxId || client.notes ? (
        <dl className="grid gap-3 rounded-xl border border-border bg-card p-4 text-sm text-card-foreground shadow-xs sm:grid-cols-3">
          {client.address ? (
            <div>
              <dt className="text-muted-foreground">Address</dt>
              <dd className="whitespace-pre-line">{client.address}</dd>
            </div>
          ) : null}
          {client.taxId ? (
            <div>
              <dt className="text-muted-foreground">Tax ID</dt>
              <dd>{client.taxId}</dd>
            </div>
          ) : null}
          {client.notes ? (
            <div>
              <dt className="text-muted-foreground">Notes</dt>
              <dd className="whitespace-pre-line">{client.notes}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <Section
        title="Invoices"
        testId="client-invoices"
        actions={
          <Button size="sm" variant="outline" render={<Link to="/invoices/new" search={{ clientId: client.id }} />}>
            New invoice
          </Button>
        }
      >
        {detail.invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices.</p>
        ) : (
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Link to="/invoices/$id" params={{ id: invoice.id }} className="font-medium hover:underline">
                        {invoiceNumber(invoice.number)}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                    <TableCell><StatusBadge status={invoice.state} /></TableCell>
                    <TableCell className="text-right tabular-nums">{money(invoice.total)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(invoice.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        )}
      </Section>

      <Section
        title="Quotes"
        testId="client-quotes"
        actions={
          <Button size="sm" variant="outline" render={<Link to="/quotes/new" search={{ clientId: client.id }} />}>
            New quote
          </Button>
        }
      >
        {detail.quotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No quotes.</p>
        ) : (
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.quotes.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell>
                      <Link to="/quotes/$id" params={{ id: quote.id }} className="font-medium hover:underline">
                        {quoteNumber(quote.number)}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(quote.issueDate)}</TableCell>
                    <TableCell><StatusBadge status={quote.status} /></TableCell>
                    <TableCell className="text-right tabular-nums">{money(quote.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        )}
      </Section>

      <Section title="Payments" testId="client-payments">
        {detail.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments.</p>
        ) : (
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(payment.date)}</TableCell>
                    <TableCell>{invoiceNumber(payment.invoiceNumber)}</TableCell>
                    <TableCell>{PAYMENT_METHODS[payment.method]}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(payment.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        )}
      </Section>

      {editing ? <ClientDialog client={client} onClose={() => setEditing(false)} /> : null}
      {deleting ? (
        <ConfirmDialog
          title={`Delete ${client.name}?`}
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDeleting(false)}
          onConfirm={() =>
            void run(() => deleteClient({ data: { id: client.id } }), { toastError: true }).then(
              (done) => {
                setDeleting(false);
                if (done.ok) void navigate({ to: "/clients" });
              },
            )
          }
        >
          Its quotes are deleted with it.
        </ConfirmDialog>
      ) : null}
    </Page>
  );
}
