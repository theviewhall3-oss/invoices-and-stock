import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Choice } from "@/client/components/Choice";
import { EmptyState } from "@/client/components/EmptyState";
import { FormRow } from "@/client/components/FormRow";
import { Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { StatusBadge } from "@/client/components/StatusBadge";
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
import { useMoney } from "@/client/lib/session";
import { formatDate, invoiceNumber } from "@/lib/format";
import { getClients, getInvoices } from "@/serverFunctions/app";

const STATES = ["draft", "unpaid", "partially_paid", "paid", "overdue", "void"] as const;
const ALL = "all";

export const Route = createFileRoute("/_app/invoices/")({
  validateSearch: z.object({
    state: z.enum(STATES).optional(),
    clientId: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [invoices, clients] = await Promise.all([getInvoices({ data: deps }), getClients({ data: { search: "" } })]);
    return { invoices, clients };
  },
  component: Invoices,
});

function Invoices() {
  const { invoices, clients } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const money = useMoney();
  const filtered = Object.values(search).some(Boolean);
  return (
    <Page>
      <PageHeader title="Invoices" actions={<Button render={<Link to="/invoices/new" />}>New invoice</Button>} />
      <div className="flex flex-wrap items-end gap-3">
        <FormRow label="Status" htmlFor="filter-state">
          <Choice
            id="filter-state"
            label="Status"
            className="w-40 bg-card"
            value={search.state ?? ALL}
            onChange={(value) => void navigate({ search: { ...search, state: value === ALL ? undefined : (value as (typeof STATES)[number]) } })}
            options={[
              { value: ALL, label: "Any status" },
              { value: "draft", label: "Draft" },
              { value: "unpaid", label: "Unpaid" },
              { value: "partially_paid", label: "Partially paid" },
              { value: "paid", label: "Paid" },
              { value: "overdue", label: "Overdue" },
              { value: "void", label: "Void" },
            ]}
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
      {invoices.length === 0 ? (
        filtered ? (
          <EmptyState kind="filtered" title="No invoices match these filters" />
        ) : (
          <EmptyState media="rows" title="No invoices yet" />
        )
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id} data-testid="invoice-row">
                  <TableCell>
                    <Link to="/invoices/$id" params={{ id: invoice.id }} className="font-medium hover:underline">
                      {invoiceNumber(invoice.number)}
                    </Link>
                  </TableCell>
                  <TableCell>{invoice.clientName}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(invoice.issueDate)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(invoice.dueDate)}</TableCell>
                  <TableCell><StatusBadge status={invoice.state} /></TableCell>
                  <TableCell className="text-right tabular-nums">{money(invoice.total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(invoice.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </Page>
  );
}
