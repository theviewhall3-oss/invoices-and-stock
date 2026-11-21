import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { FormRow } from "@/client/components/FormRow";
import { Page, Section } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { Input } from "@/client/components/ui/input";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { useMoney, useSession } from "@/client/lib/session";
import { today } from "@/lib/totals";
import { getReports } from "@/serverFunctions/app";

export const Route = createFileRoute("/_app/reports")({
  validateSearch: z.object({ from: z.string().optional(), to: z.string().optional() }),
  loaderDeps: ({ search }) => ({
    from: search.from ?? `${today().slice(0, 7)}-01`,
    to: search.to ?? today(),
  }),
  loader: ({ deps }) => getReports({ data: deps }),
  component: Reports,
});

const monthName = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

function Reports() {
  const { sales, aging, profit } = Route.useLoaderData();
  const search = Route.useSearch();
  const { actor } = useSession();
  const navigate = useNavigate({ from: Route.fullPath });
  const money = useMoney();
  const peak = Math.max(1, ...sales.map((row) => row.invoiced));
  const from = search.from ?? `${today().slice(0, 7)}-01`;
  const to = search.to ?? today();
  return (
    <Page>
      <PageHeader title="Reports" description={actor.admin ? "The whole business" : "Your documents"} />

      <Section title="Profit">
        <div className="flex flex-wrap items-end gap-3">
          <FormRow label="From" htmlFor="profit-from">
            <Input id="profit-from" type="date" className="bg-card" value={from} onChange={(event) => event.target.value && void navigate({ search: { ...search, from: event.target.value } })} />
          </FormRow>
          <FormRow label="To" htmlFor="profit-to">
            <Input id="profit-to" type="date" className="bg-card" value={to} onChange={(event) => event.target.value && void navigate({ search: { ...search, to: event.target.value } })} />
          </FormRow>
        </div>
        <TableCard>
          <Table>
            <TableBody>
              <TableRow><TableCell>Invoiced sales</TableCell><TableCell className="text-right tabular-nums" data-testid="profit-sales">{money(profit.sales)}</TableCell></TableRow>
              <TableRow><TableCell>Credit notes</TableCell><TableCell className="text-right tabular-nums" data-testid="profit-credits">{money(profit.credits)}</TableCell></TableRow>
              <TableRow><TableCell>Purchases received</TableCell><TableCell className="text-right tabular-nums" data-testid="profit-purchases">{money(profit.purchases)}</TableCell></TableRow>
              <TableRow><TableCell>Expenses</TableCell><TableCell className="text-right tabular-nums" data-testid="profit-expenses">{money(profit.expenses)}</TableCell></TableRow>
            </TableBody>
            <TableFooter>
              <TableRow><TableCell className="font-semibold">Profit</TableCell><TableCell className="text-right font-semibold tabular-nums" data-testid="profit-total">{money(profit.profit)}</TableCell></TableRow>
            </TableFooter>
          </Table>
        </TableCard>
        <p className="text-sm text-muted-foreground">Amounts exclude tax.</p>
      </Section>

      <Section title="Sales by month">
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="w-1/3" />
                <TableHead className="text-right">Invoices</TableHead>
                <TableHead className="text-right">Invoiced</TableHead>
                <TableHead className="text-right">Credited</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((row) => (
                <TableRow key={row.month} data-testid="sales-month">
                  <TableCell className="whitespace-nowrap">{monthName(row.month)}</TableCell>
                  <TableCell>
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${(row.invoiced / peak) * 100}%` }} />
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(row.invoiced)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.credited ? money(row.credited) : ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      </Section>

      <Section title="Receivables aging">
        {aging.clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing is owed.</p>
        ) : (
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  {aging.buckets.map((bucket) => (
                    <TableHead key={bucket} className="text-right">{bucket} days</TableHead>
                  ))}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aging.clients.map((row) => (
                  <TableRow key={row.clientId} data-testid="aging-row">
                    <TableCell>
                      <Link to="/clients/$id" params={{ id: row.clientId }} className="font-medium hover:underline">
                        {row.clientName}
                      </Link>
                    </TableCell>
                    {row.buckets.map((amount, index) => (
                      <TableCell key={index} className="text-right tabular-nums">{amount ? money(amount) : ""}</TableCell>
                    ))}
                    <TableCell className="text-right tabular-nums">{money(row.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">Total</TableCell>
                  {aging.totals.map((amount, index) => (
                    <TableCell key={index} className="text-right font-semibold tabular-nums">{money(amount)}</TableCell>
                  ))}
                  <TableCell className="text-right font-semibold tabular-nums">{money(aging.totals.reduce((a, b) => a + b, 0))}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </TableCard>
        )}
        <p className="text-sm text-muted-foreground">Days past the due date; invoices not yet due count as 0–30.</p>
      </Section>
    </Page>
  );
}
