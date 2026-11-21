import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { BackLink } from "@/client/components/BackLink";
import { DocumentEditor } from "@/client/components/DocumentEditor";
import { EmptyState } from "@/client/components/EmptyState";
import { Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { getClients, getPickable } from "@/serverFunctions/app";

export const Route = createFileRoute("/_app/quotes/new")({
  validateSearch: z.object({ clientId: z.string().optional() }),
  loader: async () => {
    const [clients, products] = await Promise.all([getClients({ data: { search: "" } }), getPickable()]);
    return { clients, products };
  },
  component: NewQuote,
});

function NewQuote() {
  const { clients, products } = Route.useLoaderData();
  const { clientId } = Route.useSearch();
  return (
    <Page>
      <PageHeader title="New quote" backLink={<BackLink to="/quotes">Quotes</BackLink>} />
      {clients.length === 0 ? (
        <EmptyState title="Add a client first" action={<Button render={<Link to="/clients" />}>Clients</Button>} />
      ) : (
        <DocumentEditor kind="quote" draft={{ clientId }} clients={clients} products={products} />
      )}
    </Page>
  );
}
