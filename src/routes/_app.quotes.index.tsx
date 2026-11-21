import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Choice } from "@/client/components/Choice";
import { EmptyState } from "@/client/components/EmptyState";
import { Page } from "@/client/components/Page";
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
import { useMoney } from "@/client/lib/session";
import { formatDate, quoteNumber } from "@/lib/format";
import { getClients, getQuotes } from "@/serverFunctions/app";

const STATUSES = ["draft", "sent", "accepted", "declined", "invoiced"] as const;
const ALL = "all";

export const Route = createFileRoute("/_app/quotes/")({
  validateSearch: z.object({ status: z.enum(STATUSES).optional(), clientId: z.string().optional() }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [quotes, clients] = await Promise.all([getQuotes({ data: deps }), getClients({ data: { search: "" } })]);
    return { quotes, clients };
  },
  component: Quotes,
});

function Quotes() {
  const { quotes, clients } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const money = useMoney();
  const filtered = Boolean(search.status || search.clientId);
  return (
    <Page>
      <PageHeader title="Quotes" actions={<Button render={<Link to="/quotes/new" />}>New quote</Button>} />
      <div className="flex flex-wrap gap-3">
        <Choice
          label="Status"
          className="w-44 bg-card"
          value={search.status ?? ALL}
          onChange={(value) => void navigate({ search: { ...search, status: value === ALL ? undefined : (value as (typeof STATUSES)[number]) } })}
          options={[
            { value: ALL, label: "Any status" },
            { value: "draft", label: "Draft" },
            { value: "sent", label: "Sent" },
            { value: "accepted", label: "Accepted" },
            { value: "declined", label: "Declined" },
            { value: "invoiced", label: "Invoiced" },
          ]}
        />
        <Choice
          label="Client"
          className="w-56 bg-card"
          value={search.clientId ?? ALL}
          onChange={(value) => void navigate({ search: { ...search, clientId: value === ALL ? undefined : value } })}
          options={[{ value: ALL, label: "Any client" }, ...clients.map((client) => ({ value: client.id, label: client.name }))]}
        />
      </div>
      {quotes.length === 0 ? (
        filtered ? (
          <EmptyState kind="filtered" title="No quotes match these filters" />
        ) : (
          <EmptyState media="rows" title="No quotes yet" />
        )
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((quote) => (
                <TableRow key={quote.id} data-testid="quote-row">
                  <TableCell>
                    <Link to="/quotes/$id" params={{ id: quote.id }} className="font-medium hover:underline">
                      {quoteNumber(quote.number)}
                    </Link>
                  </TableCell>
                  <TableCell>{quote.clientName}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(quote.issueDate)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(quote.expiryDate)}</TableCell>
                  <TableCell><StatusBadge status={quote.status} /></TableCell>
                  <TableCell className="text-right tabular-nums">{money(quote.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </Page>
  );
}
