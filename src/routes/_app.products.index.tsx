import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { EmptyState } from "@/client/components/EmptyState";
import { Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { ProductDialog } from "@/client/components/ProductDialog";
import { SegmentedToggle } from "@/client/components/SegmentedToggle";
import { Badge } from "@/client/components/ui/badge";
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
import { formatQuantity } from "@/lib/format";
import { getProducts } from "@/serverFunctions/app";

export const Route = createFileRoute("/_app/products/")({
  loader: () => getProducts(),
  component: Products,
});

function Products() {
  const all = Route.useLoaderData();
  const { actor } = useSession();
  const money = useMoney();
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<"active" | "archived">("active");
  const products = all.filter((item) => item.archived === (view === "archived"));
  return (
    <Page>
      <PageHeader
        title="Products and services"
        actions={
          actor.admin ? <Button onClick={() => setAdding(true)}>New item</Button> : undefined
        }
      />
      {all.some((item) => item.archived) ? (
        <SegmentedToggle
          showLabels
          value={view}
          onChange={setView}
          items={[
            { value: "active", label: "Active", icon: null },
            { value: "archived", label: "Archived", icon: null },
          ]}
        />
      ) : null}
      {products.length === 0 ? (
        <EmptyState
          media="rows"
          title={view === "archived" ? "Nothing archived" : "No items yet"}
          description={actor.admin || view === "archived" ? undefined : "An admin adds the items you can put on documents."}
        />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">On hand</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((item) => (
                <TableRow key={item.id} data-testid="product-row">
                  <TableCell>
                    <Link to="/products/$id" params={{ id: item.id }} className="font-medium hover:underline">
                      {item.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {item.kind === "service" ? "Service" : "Product"}
                      {item.unit ? ` · per ${item.unit}` : ""}
                    </div>
                  </TableCell>
                  <TableCell>{item.sku}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(item.price)}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.taxRate}%</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.trackStock ? (
                      <span className="inline-flex items-center gap-2">
                        {item.low ? <Badge variant="warning">Low</Badge> : null}
                        {formatQuantity(item.onHand)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      {adding ? <ProductDialog onClose={() => setAdding(false)} /> : null}
    </Page>
  );
}
