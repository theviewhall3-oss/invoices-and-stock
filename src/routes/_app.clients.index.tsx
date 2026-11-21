import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { ClientDialog } from "@/client/components/ClientDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
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
import { getClients } from "@/serverFunctions/app";

export const Route = createFileRoute("/_app/clients/")({
  validateSearch: z.object({ q: z.string().optional() }),
  loaderDeps: ({ search }) => ({ q: search.q ?? "" }),
  loader: ({ deps }) => getClients({ data: { search: deps.q } }),
  component: Clients,
});

function Clients() {
  const clients = Route.useLoaderData();
  const { q = "" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [adding, setAdding] = useState(false);
  const money = useMoney();
  return (
    <Page>
      <PageHeader
        title="Clients"
        actions={<Button onClick={() => setAdding(true)}>New client</Button>}
      />
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          aria-label="Search clients"
          placeholder="Search by name, company, email or phone"
          className="bg-card pl-8"
          defaultValue={q}
          onChange={(event) =>
            void navigate({ search: { q: event.target.value || undefined }, replace: true })
          }
        />
      </div>
      {clients.length === 0 ? (
        q ? (
          <EmptyState kind="filtered" title="No client matches that search" />
        ) : (
          <EmptyState
            media="rows"
            title="No clients yet"
            description="Add one to start quoting and invoicing."
          />
        )
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id} data-testid="client-row">
                  <TableCell>
                    <Link to="/clients/$id" params={{ id: client.id }} className="font-medium hover:underline">
                      {client.name}
                    </Link>
                    {client.company ? (
                      <div className="text-xs text-muted-foreground">{client.company}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>{client.email}</TableCell>
                  <TableCell>{client.phone}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(client.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      {adding ? <ClientDialog onClose={() => setAdding(false)} /> : null}
    </Page>
  );
}
