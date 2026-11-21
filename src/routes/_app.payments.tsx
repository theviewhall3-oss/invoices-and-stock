import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Choice } from "@/client/components/Choice";
import { EmptyState } from "@/client/components/EmptyState";
import { FormRow } from "@/client/components/FormRow";
import { Page, Stat } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
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
import { useMoney } from "@/client/lib/session";
import { formatDate, invoiceNumber, PAYMENT_METHODS, type PaymentMethod } from "@/lib/format";
import { getClients, getPayments } from "@/serverFunctions/app";

const ALL = "all";
const METHODS = ["cash", "bank_transfer", "card", "cheque", "other"] as const;

export const Route = createFileRoute("/_app/payments")({
  validateSearch: z.object({
    method: z.enum(METHODS).optional(),
    clientId: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [payments, clients] = await Promise.all([getPayments({ data: deps }), getClients({ data: { search: "" } })]);
    return { payments, clients };
  },
  component: Payments,
});

function Payments() {
  const { payments, clients } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const money = useMoney();
  const filtered = Object.values(search).some(Boolean);
  return (
    <Page>
      <PageHeader title="Payments" />
      <div className="flex flex-wrap items-end gap-3">
        <FormRow label="Method" htmlFor="filter-method">
          <Choice
            id="filter-method"
            label="Method"
            className="w-40 bg-card"
            value={search.method ?? ALL}
            onChange={(value) => void navigate({ search: { ...search, method: value === ALL ? undefined : (value as PaymentMethod) } })}
            options={[{ value: ALL, label: "Any method" }, ...Object.entries(PAYMENT_METHODS).map(([value, label]) => ({ value, label }))]}
          />
        </FormRow>
        <FormRow label="Client" htmlFor="filter-client">
          <Choice
            id="filter-client"
            label="Client"
            className="w-48 bg-card"
            value={search.clientId ?? ALL}
            onChange={(value) => void navigate({ search: { ...search, clientId: value === ALL ? undefined : value } })}
            options={[{ value: ALL, label: "Any client" }, ...clients.map((client) => ({ value: client.id, label: client.name }))]}
          />
        </FormRow>
        <FormRow label="From" htmlFor="filter-from">
          <Input id="filter-from" type="date" className="bg-card" value={search.from ?? ""} onChange={(event) => void navigate({ search: { ...search, from: event.target.value || undefined } })} />
        </FormRow>
        <FormRow label="To" htmlFor="filter-to">
          <Input id="filter-to" type="date" className="bg-card" value={search.to ?? ""} onChange={(event) => void navigate({ search: { ...search, to: event.target.value || undefined } })} />
        </FormRow>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Received" value={money(payments.reduce((sum, payment) => sum + payment.amount, 0))} testId="payments-total" />
        <Stat label="Payments" value={payments.length} testId="payments-count" />
      </div>
      {payments.length === 0 ? (
        filtered ? (
          <EmptyState kind="filtered" title="No payments match these filters" />
        ) : (
          <EmptyState media="rows" title="No payments yet" description="Record one from an issued invoice." />
        )
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id} data-testid="payment-row">
                  <TableCell className="whitespace-nowrap">{formatDate(payment.date)}</TableCell>
                  <TableCell>
                    <Link to="/invoices/$id" params={{ id: payment.invoiceId }} className="font-medium hover:underline">
                      {invoiceNumber(payment.invoiceNumber)}
                    </Link>
                  </TableCell>
                  <TableCell>{payment.clientName}</TableCell>
                  <TableCell>{PAYMENT_METHODS[payment.method]}</TableCell>
                  <TableCell>{payment.reference}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(payment.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </Page>
  );
}
