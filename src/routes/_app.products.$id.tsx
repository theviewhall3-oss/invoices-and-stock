import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BackLink } from "@/client/components/BackLink";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { FormDialog } from "@/client/components/FormDialog";
import { FormRow } from "@/client/components/FormRow";
import { NotFoundState, Page, Section, Stat } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { ProductDialog } from "@/client/components/ProductDialog";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
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
import { formatDate, formatQuantity } from "@/lib/format";
import {
  adjustStock,
  archiveProduct,
  deleteProduct,
  getProduct,
} from "@/serverFunctions/app";

export const Route = createFileRoute("/_app/products/$id")({
  loader: ({ params }) => getProduct({ data: { id: params.id } }),
  component: ProductPage,
});

const MOVEMENT_LABELS = {
  sale: "Sale",
  purchase: "Purchase",
  credit: "Credit note",
  adjustment: "Adjustment",
  void: "Voided invoice",
} as const;

function ProductPage() {
  const detail = Route.useLoaderData();
  const { actor } = useSession();
  const money = useMoney();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<"edit" | "adjust" | "delete" | null>(null);
  const { run, pending } = useAction();
  if (!detail)
    return (
      <Page>
        <PageHeader title="Item" backLink={<BackLink to="/products">Products and services</BackLink>} />
        <NotFoundState what="item" />
      </Page>
    );
  const { product, movements } = detail;
  return (
    <Page>
      <PageHeader
        title={product.name}
        description={[product.kind === "service" ? "Service" : "Product", product.sku, product.archived ? "Archived" : ""].filter(Boolean).join(" · ")}
        backLink={<BackLink to="/products">Products and services</BackLink>}
        actions={
          actor.admin ? (
            <>
              {product.trackStock ? (
                <Button onClick={() => setDialog("adjust")}>Adjust stock</Button>
              ) : null}
              <Button variant="outline" onClick={() => setDialog("edit")}>
                Edit
              </Button>
              <Button
                variant="outline"
                pending={pending}
                onClick={() =>
                  void run(() => archiveProduct({ data: { id: product.id, archived: !product.archived } }), {
                    toastError: true,
                    success: product.archived ? "Restored" : "Archived",
                  })
                }
              >
                {product.archived ? "Restore" : "Archive"}
              </Button>
              <Button variant="outline" onClick={() => setDialog("delete")}>
                Delete
              </Button>
            </>
          ) : undefined
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Sale price" value={money(product.price)} testId="price" />
        <Stat label="Cost" value={money(product.cost)} testId="cost" />
        <Stat label="Tax rate" value={`${product.taxRate}%`} testId="tax-rate" />
        {product.trackStock ? (
          <div className="rounded-xl border border-border bg-card px-4 py-3 text-card-foreground shadow-xs">
            <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              On hand
              {product.low ? (
                <Badge variant="warning" data-testid="low-stock">
                  Low stock
                </Badge>
              ) : null}
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums" data-testid="on-hand">
              {formatQuantity(product.onHand)}
            </div>
            <div className="text-xs text-muted-foreground">Low at {formatQuantity(product.lowStockLevel)}</div>
          </div>
        ) : null}
      </div>

      {product.trackStock ? (
        <Section title="Stock movements">
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No movements yet.</p>
          ) : (
            <TableCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => (
                    <TableRow key={movement.id} data-testid="movement-row">
                      <TableCell>{formatDate(movement.createdAt)}</TableCell>
                      <TableCell>{MOVEMENT_LABELS[movement.kind]}</TableCell>
                      <TableCell>{movement.reason}</TableCell>
                      <TableCell className="text-muted-foreground">{movement.by}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {movement.quantity > 0 ? "+" : ""}
                        {formatQuantity(movement.quantity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableCard>
          )}
        </Section>
      ) : null}

      {dialog === "edit" ? <ProductDialog product={product} onClose={() => setDialog(null)} /> : null}
      {dialog === "adjust" ? <AdjustDialog productId={product.id} onClose={() => setDialog(null)} /> : null}
      {dialog === "delete" ? (
        <ConfirmDialog
          title={`Delete ${product.name}?`}
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDialog(null)}
          onConfirm={() =>
            void run(() => deleteProduct({ data: { id: product.id } }), { toastError: true }).then((done) => {
              setDialog(null);
              if (done.ok) void navigate({ to: "/products" });
            })
          }
        />
      ) : null}
    </Page>
  );
}

function AdjustDialog({ productId, onClose }: { productId: string; onClose: () => void }) {
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const { run, pending, error } = useAction();
  return (
    <FormDialog
      title="Adjust stock"
      onClose={onClose}
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="adjust-form" pending={pending}>
            Save adjustment
          </Button>
        </>
      }
    >
      <form
        id="adjust-form"
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void run(() =>
            adjustStock({ data: { productId, quantity: Number(quantity), reason } }),
          ).then((done) => {
            if (done.ok) onClose();
          });
        }}
      >
        <FormRow label="Quantity change" htmlFor="adjust-quantity">
          <Input id="adjust-quantity" type="number" step="any" placeholder="-2 or 5" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        </FormRow>
        <FormRow label="Reason" htmlFor="adjust-reason">
          <Input id="adjust-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
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
