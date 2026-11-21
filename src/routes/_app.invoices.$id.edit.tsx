import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "@/client/components/BackLink";
import { DocumentEditor } from "@/client/components/DocumentEditor";
import { NotFoundState, Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { getClients, getPickable, getInvoice } from "@/serverFunctions/app";

export const Route = createFileRoute("/_app/invoices/$id/edit")({
  loader: async ({ params }) => {
    const [detail, clients, products] = await Promise.all([
      getInvoice({ data: { id: params.id } }),
      getClients({ data: { search: "" } }),
      getPickable(),
    ]);
    return { detail, clients, products };
  },
  component: EditInvoice,
});

function EditInvoice() {
  const { detail, clients, products } = Route.useLoaderData();
  if (!detail || detail.invoice.status !== "draft")
    return (
      <Page>
        <PageHeader title="Edit invoice" backLink={<BackLink to="/invoices">Invoices</BackLink>} />
        <NotFoundState what="draft invoice" />
      </Page>
    );
  const { invoice, lines } = detail;
  return (
    <Page>
      <PageHeader title={`Edit draft invoice`} backLink={<BackLink to="/invoices">Invoices</BackLink>} />
      <DocumentEditor
        kind="invoice"
        draft={{ id: invoice.id, clientId: invoice.clientId, issueDate: invoice.issueDate, endDate: invoice.dueDate, discountRate: invoice.discountRate, notes: invoice.notes, lines }}
        clients={clients}
        products={products}
      />
    </Page>
  );
}
