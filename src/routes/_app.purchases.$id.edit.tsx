import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "@/client/components/BackLink";
import { BillEditor } from "@/client/components/BillEditor";
import { NotFoundState, Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { getBill, getPickable, getSuppliers } from "@/serverFunctions/app";

export const Route = createFileRoute("/_app/purchases/$id/edit")({
  loader: async ({ params }) => {
    const [detail, suppliers, products] = await Promise.all([
      getBill({ data: { id: params.id } }),
      getSuppliers(),
      getPickable(),
    ]);
    return { detail, suppliers, products };
  },
  component: EditBill,
});

function EditBill() {
  const { detail, suppliers, products } = Route.useLoaderData();
  if (!detail || detail.bill.status !== "draft")
    return (
      <Page>
        <PageHeader title="Edit bill" backLink={<BackLink to="/purchases">Purchases</BackLink>} />
        <NotFoundState what="draft bill" />
      </Page>
    );
  const { bill, lines } = detail;
  return (
    <Page>
      <PageHeader title="Edit bill" backLink={<BackLink to="/purchases">Purchases</BackLink>} />
      <BillEditor
        bill={{ id: bill.id, supplierId: bill.supplierId, reference: bill.reference, billDate: bill.billDate, notes: bill.notes, lines }}
        suppliers={suppliers}
        products={products}
      />
    </Page>
  );
}
