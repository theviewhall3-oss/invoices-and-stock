import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { FormDialog } from "@/client/components/FormDialog";
import { FormRow } from "@/client/components/FormRow";
import { Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Textarea } from "@/client/components/ui/textarea";
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
import { useSession } from "@/client/lib/session";
import {
  createSupplier,
  deleteSupplier,
  getSuppliers,
  updateSupplier,
} from "@/serverFunctions/app";

export const Route = createFileRoute("/_app/suppliers")({
  loader: () => getSuppliers(),
  component: Suppliers,
});

type Supplier = Awaited<ReturnType<typeof getSuppliers>>[number];

function Suppliers() {
  const suppliers = Route.useLoaderData();
  const { actor } = useSession();
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const { run, pending } = useAction();
  return (
    <Page>
      <PageHeader
        title="Suppliers"
        actions={actor.admin ? <Button onClick={() => setEditing("new")}>New supplier</Button> : undefined}
      />
      {suppliers.length === 0 ? (
        <EmptyState
          media="rows"
          title="No suppliers yet"
        />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                {actor.admin ? <TableHead className="w-20" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id} data-testid="supplier-row">
                  <TableCell className="font-medium">
                    {supplier.name}
                    {supplier.address ? (
                      <div className="text-xs font-normal whitespace-pre-line text-muted-foreground">{supplier.address}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>{supplier.contact}</TableCell>
                  <TableCell>{supplier.email}</TableCell>
                  <TableCell>{supplier.phone}</TableCell>
                  {actor.admin ? (
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${supplier.name}`} onClick={() => setEditing(supplier)}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${supplier.name}`} onClick={() => setDeleting(supplier)}>
                        <Trash2 />
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      {editing ? (
        <SupplierDialog supplier={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            void run(() => deleteSupplier({ data: { id: deleting.id } }), { toastError: true }).then(() =>
              setDeleting(null),
            )
          }
        />
      ) : null}
    </Page>
  );
}

function SupplierDialog({ supplier, onClose }: { supplier?: Supplier; onClose: () => void }) {
  const [form, setForm] = useState({
    name: supplier?.name ?? "",
    contact: supplier?.contact ?? "",
    email: supplier?.email ?? "",
    phone: supplier?.phone ?? "",
    address: supplier?.address ?? "",
  });
  const { run, pending, error } = useAction();
  const field = (key: "name" | "contact" | "email" | "phone", label: string) => (
    <FormRow label={label} htmlFor={`supplier-${key}`}>
      <Input id={`supplier-${key}`} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
    </FormRow>
  );
  return (
    <FormDialog
      title={supplier ? "Edit supplier" : "New supplier"}
      onClose={onClose}
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="supplier-form" pending={pending}>
            Save supplier
          </Button>
        </>
      }
    >
      <form
        id="supplier-form"
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void run(() =>
            supplier
              ? updateSupplier({ data: { id: supplier.id, supplier: form } })
              : createSupplier({ data: form }),
          ).then((done) => {
            if (done.ok) onClose();
          });
        }}
      >
        {field("name", "Name")}
        {field("contact", "Contact")}
        <div className="grid gap-3 sm:grid-cols-2">
          {field("email", "Email")}
          {field("phone", "Phone")}
        </div>
        <FormRow label="Address" htmlFor="supplier-address">
          <Textarea id="supplier-address" rows={2} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
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
