import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyState } from "@/client/components/EmptyState";
import { Page, Section, Stat } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
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
import { useMoney, useSession } from "@/client/lib/session";
import { formatDate, formatQuantity, invoiceNumber } from "@/lib/format";
import { getDashboard } from "@/serverFunctions/app";

export const Route = createFileRoute("/_app/")({
  loader: () => getDashboard(),
  component: Dashboard,
});

function Dashboard() {
  const data = Route.useLoaderData();
  const { business, actor } = useSession();
  const money = useMoney();
  return (
    <Page>
      <PageHeader
        title={business.businessName || "Dashboard"}
        description={actor.admin ? "The whole business" : "Your clients and documents"}
        actions={
          <>
            <Button variant="outline" render={<Link to="/quotes/new" />}>
              New quote
            </Button>
            <Button render={<Link to="/invoices/new" />}>New invoice</Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Sales this month" value={money(data.salesThisMonth)} testId="sales-this-month" />
        <Stat label="Outstanding" value={money(data.outstanding)} testId="outstanding" />
        <Stat label="Overdue invoices" value={data.overdueCount} testId="overdue-count" />
        <Stat label="Low-stock items" value={data.lowStock.length} testId="low-stock-count" />
      </div>

      <Section title="Overdue">
        {data.overdue.length === 0 ? (
          <EmptyState icon={null} variant="dashed" size="sm" title="Nothing overdue" />
        ) : (
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.overdue.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Link to="/invoices/$id" params={{ id: invoice.id }} className="font-medium hover:underline">
                        {invoiceNumber(invoice.number)}
                      </Link>
                    </TableCell>
                    <TableCell>{invoice.clientName}</TableCell>
                    <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(invoice.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        )}
      </Section>

      <Section title="Low stock">
        {data.lowStock.length === 0 ? (
          <EmptyState icon={null} variant="dashed" size="sm" title="Nothing is low on stock" />
        ) : (
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="text-right">Low at</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.lowStock.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link to="/products/$id" params={{ id: item.id }} className="font-medium hover:underline">
                        {item.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatQuantity(item.onHand)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatQuantity(item.lowStockLevel)}</TableCell>
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
