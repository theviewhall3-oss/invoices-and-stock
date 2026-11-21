import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { EmptyState } from "@/client/components/EmptyState";
import { FormRow } from "@/client/components/FormRow";
import { Page, Section, Stat } from "@/client/components/Page";
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
import { formatDate } from "@/lib/format";
import { getBills } from "@/serverFunctions/app";

export const Route = createFileRoute("/_app/purchases/")({
  validateSearch: z.object({ month: z.string().optional() }),
  loaderDeps: ({ search }) => ({ month: search.month }),
  loader: ({ deps }) => getBills({ data: { month: deps.month } }),
  component: Purchases,
});

function Purchases() {
  const data = Route.useLoaderData();
  const { month } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const money = useMoney();
  return (
    <Page>
      <PageHeader title="Purchases" actions={<Button render={<Link to="/purchases/new" />}>New bill</Button>} />
      <div className="flex flex-wrap items-end gap-3">
        <FormRow label="Month" htmlFor="purchases-month">
          <Input
            id="purchases-month"
            type="month"
            className="w-44 bg-card"
            value={month ?? ""}
            onChange={(event) => void navigate({ search: { month: event.target.value || undefined } })}
          />
        </FormRow>
        {month ? (
          <Button variant="ghost" onClick={() => void navigate({ search: {} })}>
            All time
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label={month ? "Total this month" : "Total"} value={money(data.total)} testId="purchases-total" />
        <Stat label="Bills" value={data.bills.length} testId="purchases-count" />
      </div>
      {data.bySupplier.length > 1 ? (
        <Section title="By supplier">
          <TableCard>
            <Table>
              <TableBody>
                {data.bySupplier.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(row.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        </Section>
      ) : null}
      <Section title="Bills">
        {data.bills.length === 0 ? (
          <EmptyState
            media="rows"
            title={month ? "No bills this month" : "No bills yet"}
          />
        ) : (
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.bills.map((bill) => (
                  <TableRow key={bill.id} data-testid="bill-row">
                    <TableCell className="whitespace-nowrap">
                      <Link to="/purchases/$id" params={{ id: bill.id }} className="font-medium hover:underline">
                        {formatDate(bill.billDate)}
                      </Link>
                    </TableCell>
                    <TableCell>{bill.supplierName}</TableCell>
                    <TableCell>{bill.reference}</TableCell>
                    <TableCell><StatusBadge status={bill.status} /></TableCell>
                    <TableCell className="text-right tabular-nums">{money(bill.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        )}
      </Section>
    </Page>
  );
}
