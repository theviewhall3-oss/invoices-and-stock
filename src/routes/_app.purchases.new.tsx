import { createFileRoute, Link } from "@tanstack/react-router";
import { BackLink } from "@/client/components/BackLink";
import { BillEditor } from "@/client/components/BillEditor";
import { EmptyState } from "@/client/components/EmptyState";
import { Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { getPickable, getSuppliers } from "@/serverFunctions/app";

export const Route = createFileRoute("/_app/purchases/new")({
  loader: async () => {
    const [suppliers, products] = await Promise.all([getSuppliers(), getPickable()]);
    return { suppliers, products };
  },
  component: NewBill,
});

function NewBill() {
  const { suppliers, products } = Route.useLoaderData();
  return (
    <Page>
      <PageHeader title="New bill" backLink={<BackLink to="/purchases">Purchases</BackLink>} />
      {suppliers.length === 0 ? (
        <EmptyState
          title="No suppliers yet"
          description="A bill needs a supplier. An admin adds them."
          action={<Button variant="outline" render={<Link to="/suppliers" />}>Suppliers</Button>}
        />
      ) : (
        <BillEditor suppliers={suppliers} products={products} />
      )}
    </Page>
  );
}
