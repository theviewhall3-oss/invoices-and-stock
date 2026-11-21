import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BackLink } from "@/client/components/BackLink";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { NotFoundState, Page } from "@/client/components/Page";
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
import { formatDate, formatQuantity } from "@/lib/format";
import { deleteBill, getBill, receiveBill } from "@/serverFunctions/app";

export const Route = createFileRoute("/_app/purchases/$id/")({
  loader: ({ params }) => getBill({ data: { id: params.id } }),
  component: BillPage,
});

function BillPage() {
  const detail = Route.useLoaderData();
  const money = useMoney();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const { run, pending } = useAction();
  if (!detail)
    return (
      <Page>
        <PageHeader title="Bill" backLink={<BackLink to="/purchases">Purchases</BackLink>} />
        <NotFoundState what="bill" />
      </Page>
    );
  const { bill, lines, supplier } = detail;
  const draft = bill.status === "draft";
  return (
    <Page>
      <PageHeader
        title={`Bill from ${supplier.name}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={bill.status} testId="doc-status" />
            {formatDate(bill.billDate)}
            {bill.reference ? ` · ${bill.reference}` : ""}
          </span>
        }
        backLink={<BackLink to="/purchases">Purchases</BackLink>}
        actions={
          draft ? (
            <>
              <Button
                pending={pending}
                onClick={() => void run(() => receiveBill({ data: { id: bill.id } }), { toastError: true, success: "Stock updated" })}
              >
                Mark received
              </Button>
              <Button variant="outline" render={<Link to="/purchases/$id/edit" params={{ id: bill.id }} />}>
                Edit
              </Button>
              <Button variant="outline" onClick={() => setDeleting(true)}>
                Delete
              </Button>
            </>
          ) : undefined
        }
      />
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Unit cost</TableHead>
              <TableHead className="text-right">Tax</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>{line.productName}</TableCell>
                <TableCell className="text-right tabular-nums">{formatQuantity(line.quantity)}</TableCell>
                <TableCell className="text-right tabular-nums">{money(line.unitCost)}</TableCell>
                <TableCell className="text-right tabular-nums">{line.taxRate}%</TableCell>
                <TableCell className="text-right tabular-nums">{money(Math.round(line.quantity * line.unitCost))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
      <dl className="ml-auto max-w-xs space-y-1 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{money(bill.subtotal)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd className="tabular-nums">{money(bill.taxTotal)}</dd></div>
        <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd className="tabular-nums" data-testid="bill-total">{money(bill.total)}</dd></div>
      </dl>
      {bill.notes ? <p className="text-sm whitespace-pre-line text-muted-foreground">{bill.notes}</p> : null}
      {deleting ? (
        <ConfirmDialog
          title="Delete this bill?"
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDeleting(false)}
          onConfirm={() =>
            void run(() => deleteBill({ data: { id: bill.id } }), { toastError: true }).then((done) => {
              setDeleting(false);
              if (done.ok) void navigate({ to: "/purchases" });
            })
          }
        />
      ) : null}
    </Page>
  );
}
