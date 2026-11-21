import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "@/client/components/BackLink";
import { DocumentEditor } from "@/client/components/DocumentEditor";
import { NotFoundState, Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { quoteNumber } from "@/lib/format";
import { getClients, getPickable, getQuote } from "@/serverFunctions/app";

export const Route = createFileRoute("/_app/quotes/$id/edit")({
  loader: async ({ params }) => {
    const [detail, clients, products] = await Promise.all([
      getQuote({ data: { id: params.id } }),
      getClients({ data: { search: "" } }),
      getPickable(),
    ]);
    return { detail, clients, products };
  },
  component: EditQuote,
});

function EditQuote() {
  const { detail, clients, products } = Route.useLoaderData();
  if (!detail || detail.quote.status !== "draft")
    return (
      <Page>
        <PageHeader title="Edit quote" backLink={<BackLink to="/quotes">Quotes</BackLink>} />
        <NotFoundState what="draft quote" />
      </Page>
    );
  const { quote, lines } = detail;
  return (
    <Page>
      <PageHeader title={`Edit ${quoteNumber(quote.number)}`} backLink={<BackLink to="/quotes">Quotes</BackLink>} />
      <DocumentEditor
        kind="quote"
        draft={{ id: quote.id, clientId: quote.clientId, issueDate: quote.issueDate, endDate: quote.expiryDate, discountRate: quote.discountRate, notes: quote.notes, lines }}
        clients={clients}
        products={products}
      />
    </Page>
  );
}
