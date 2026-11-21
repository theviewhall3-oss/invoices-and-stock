import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { BackLink } from "@/client/components/BackLink";
import { Choice } from "@/client/components/Choice";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Totals } from "@/client/components/DocumentEditor";
import { FormDialog } from "@/client/components/FormDialog";
import { FormRow } from "@/client/components/FormRow";
import { LinesTable } from "@/client/components/LinesTable";
import { NotFoundState, Page, Section } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { ShareLink } from "@/client/components/ShareLink";
import { StatusBadge } from "@/client/components/StatusBadge";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
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
import { useMoney, useSession } from "@/client/lib/session";
import {
  formatDate,
  formatQuantity,
  invoiceNumber,
  PAYMENT_METHODS,
  quoteNumber,
  type PaymentMethod,
} from "@/lib/format";
import { fromCents, toCents, today } from "@/lib/totals";
import {
  createCreditNote,
  deleteInvoice,
  deletePayment,
  getInvoice,
  issueInvoice,
  recordPayment,
  voidInvoice,
} from "@/serverFunctions/app";

export const Route = createFileRoute("/_app/invoices/$id/")({
  loader: ({ params }) => getInvoice({ data: { id: params.id } }),
  component: InvoicePage,
});

type Detail = NonNullable<Awaited<ReturnType<typeof getInvoice>>>;
type Dialog = "issue" | "void" | "delete" | "payment" | "credit" | { payment: Detail["payments"][number] } | null;

function InvoicePage() {
  const detail = Route.useLoaderData();
  const { origin, actor } = useSession();
  const money = useMoney();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<Dialog>(null);
  const { run, pending } = useAction();
  if (!detail)
    return (
      <Page>
        <PageHeader title="Invoice" backLink={<BackLink to="/invoices">Invoices</BackLink>} />
        <NotFoundState what="invoice" />
      </Page>
    );
  const { invoice, client, lines } = detail;
  const issued = invoice.status === "issued";
  const close = () => setDialog(null);
  return (
    <Page>
      <PageHeader
        title={invoice.number == null ? "Draft invoice" : invoiceNumber(invoice.number)}
        backLink={<BackLink to="/invoices">Invoices</BackLink>}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={detail.state} testId="doc-status" />
            <Link to="/clients/$id" params={{ id: client.id }} className="hover:underline">
              {client.name}
            </Link>
            · {formatDate(invoice.issueDate)} · due <span data-testid="due-date">{formatDate(invoice.dueDate)}</span>
            {detail.quote ? (
              <>
                · from{" "}
                <Link to="/quotes/$id" params={{ id: detail.quote.id }} className="hover:underline">
                  {quoteNumber(detail.quote.number)}
                </Link>
              </>
            ) : null}
          </span>
        }
        actions={
          invoice.status === "draft" ? (
            <>
              <Button onClick={() => setDialog("issue")}>Issue invoice</Button>
              <Button variant="outline" render={<Link to="/invoices/$id/edit" params={{ id: invoice.id }} />}>
                Edit
              </Button>
              <Button variant="outline" onClick={() => setDialog("delete")}>
                Delete
              </Button>
            </>
          ) : issued ? (
            <>
              {detail.balance > 0 ? <Button onClick={() => setDialog("payment")}>Record payment</Button> : null}
              <Button variant="outline" onClick={() => setDialog("credit")}>
                Credit note
              </Button>
              {actor.admin && detail.paid === 0 ? (
                <Button variant="outline" onClick={() => setDialog("void")}>
                  Void invoice
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      />
      {invoice.shareToken && invoice.status !== "draft" ? (
        <ShareLink url={`${origin}/s/i/${invoice.shareToken}`} label="Client link" />
      ) : null}
      <LinesTable lines={lines} money={money} />
      <div className="grid gap-6 sm:grid-cols-2">
        {invoice.notes ? <p className="text-sm whitespace-pre-line text-muted-foreground">{invoice.notes}</p> : <div />}
        <Totals totals={invoice} money={money} totalTestId="invoice-total">
          {issued || detail.paid || detail.credited ? (
            <>
              <div className="flex justify-between"><dt className="text-muted-foreground">Paid</dt><dd className="tabular-nums" data-testid="invoice-paid">{money(detail.paid)}</dd></div>
              {detail.credited ? (
                <div className="flex justify-between"><dt className="text-muted-foreground">Credited</dt><dd className="tabular-nums" data-testid="invoice-credited">{money(detail.credited)}</dd></div>
              ) : null}
              <div className="flex justify-between font-semibold"><dt>Balance</dt><dd className="tabular-nums" data-testid="invoice-balance">{money(detail.balance)}</dd></div>
            </>
          ) : null}
        </Totals>
      </div>

      {detail.payments.length ? (
        <Section title="Payments">
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(payment.date)}</TableCell>
                    <TableCell>{PAYMENT_METHODS[payment.method]}</TableCell>
                    <TableCell>{payment.reference}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(payment.amount)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" aria-label={`Delete payment of ${money(payment.amount)}`} onClick={() => setDialog({ payment })}>
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        </Section>
      ) : null}

      {detail.creditNotes.length ? (
        <Section title="Credit notes">
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.creditNotes.map((note) => (
                  <TableRow key={note.id}>
                    <TableCell>{formatDate(note.date)}</TableCell>
                    <TableCell>{note.reason}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(note.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        </Section>
      ) : null}

      {dialog === "issue" ? (
        <ConfirmDialog
          title="Issue this invoice?"
          confirmLabel="Issue"
          pending={pending}
          onClose={close}
          onConfirm={() => void run(() => issueInvoice({ data: { id: invoice.id } }), { toastError: true }).then(close)}
        >
          It gets the next number and its lines can no longer be changed.
        </ConfirmDialog>
      ) : null}
      {dialog === "void" ? (
        <ConfirmDialog
          title="Void this invoice?"
          confirmLabel="Void"
          destructive
          pending={pending}
          onClose={close}
          onConfirm={() => void run(() => voidInvoice({ data: { id: invoice.id } }), { toastError: true }).then(close)}
        >
          Its products go back into stock and it no longer counts as owed.
        </ConfirmDialog>
      ) : null}
      {dialog === "delete" ? (
        <ConfirmDialog
          title="Delete this draft?"
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={close}
          onConfirm={() =>
            void run(() => deleteInvoice({ data: { id: invoice.id } }), { toastError: true }).then((done) => {
              close();
              if (done.ok) void navigate({ to: "/invoices" });
            })
          }
        />
      ) : null}
      {dialog && typeof dialog === "object" ? (
        <ConfirmDialog
          title={`Delete payment of ${money(dialog.payment.amount)}?`}
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={close}
          onConfirm={() => void run(() => deletePayment({ data: { id: dialog.payment.id } }), { toastError: true }).then(close)}
        />
      ) : null}
      {dialog === "payment" ? <PaymentDialog invoiceId={invoice.id} balance={detail.balance} onClose={close} /> : null}
      {dialog === "credit" ? <CreditDialog detail={detail} onClose={close} /> : null}
    </Page>
  );
}

function PaymentDialog({ invoiceId, balance, onClose }: { invoiceId: string; balance: number; onClose: () => void }) {
  const [form, setForm] = useState({ amount: fromCents(balance), date: today(), method: "cash" as PaymentMethod, reference: "" });
  const { run, pending, error, setError } = useAction();
  return (
    <FormDialog
      title="Record payment"
      onClose={onClose}
      actions={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="payment-form" pending={pending}>Save payment</Button>
        </>
      }
    >
      <form
        id="payment-form"
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const amount = toCents(form.amount);
          if (Number.isNaN(amount)) {
            setError("Enter an amount.");
            return;
          }
          void run(() => recordPayment({ data: { invoiceId, amount, date: form.date, method: form.method, reference: form.reference } })).then(
            (done) => {
              if (done.ok) onClose();
            },
          );
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormRow label="Amount" htmlFor="payment-amount">
            <Input id="payment-amount" type="number" step="0.01" min={0} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
          </FormRow>
          <FormRow label="Date" htmlFor="payment-date">
            <Input id="payment-date" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
          </FormRow>
        </div>
        <FormRow label="Method" htmlFor="payment-method">
          <Choice
            id="payment-method"
            label="Method"
            value={form.method}
            onChange={(method) => setForm({ ...form, method: method as PaymentMethod })}
            options={Object.entries(PAYMENT_METHODS).map(([value, label]) => ({ value, label }))}
          />
        </FormRow>
        <FormRow label="Reference" htmlFor="payment-reference">
          <Input id="payment-reference" value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} />
        </FormRow>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </form>
    </FormDialog>
  );
}

function CreditDialog({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  const [quantities, setQuantities] = useState<string[]>(detail.lines.map(() => ""));
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(today());
  const { run, pending, error } = useAction();
  return (
    <FormDialog
      title="Credit note"
      onClose={onClose}
      actions={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="credit-form" pending={pending}>Save credit note</Button>
        </>
      }
    >
      <form
        id="credit-form"
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void run(() =>
            createCreditNote({
              data: {
                invoiceId: detail.invoice.id,
                date,
                reason,
                lines: detail.lines.map((line, index) => ({ invoiceLineId: line.id, quantity: Number(quantities[index] || 0) })),
              },
            }),
          ).then((done) => {
            if (done.ok) onClose();
          });
        }}
      >
        {detail.lines.map((line, index) => {
          const left = line.quantity - line.returned;
          return (
            <div key={line.id} className="flex items-end justify-between gap-3">
              <div className="min-w-0 text-sm">
                <div className="truncate">{line.description}</div>
                <div className="text-xs text-muted-foreground">{formatQuantity(left)} of {formatQuantity(line.quantity)} left</div>
              </div>
              <Input
                aria-label={`Return quantity ${index + 1}`}
                type="number"
                step="any"
                min={0}
                max={left}
                placeholder="0"
                disabled={left <= 0}
                className="w-24"
                value={quantities[index]}
                onChange={(event) => setQuantities((current) => current.map((q, i) => (i === index ? event.target.value : q)))}
              />
            </div>
          );
        })}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormRow label="Date" htmlFor="credit-date">
            <Input id="credit-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </FormRow>
          <FormRow label="Reason" htmlFor="credit-reason">
            <Input id="credit-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          </FormRow>
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </form>
    </FormDialog>
  );
}
