import { useState } from "react";
import { FormDialog } from "@/client/components/FormDialog";
import { FormRow } from "@/client/components/FormRow";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Textarea } from "@/client/components/ui/textarea";
import { useAction } from "@/client/lib/actions";
import { createClient, updateClient } from "@/serverFunctions/app";

interface ClientFields {
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  notes: string;
}

const EMPTY: ClientFields = {
  name: "",
  company: "",
  email: "",
  phone: "",
  address: "",
  taxId: "",
  notes: "",
};

export function ClientDialog({
  client,
  onClose,
}: {
  client?: ClientFields & { id: string };
  onClose: () => void;
}) {
  const [form, setForm] = useState<ClientFields>(client ?? EMPTY);
  const { run, pending, error } = useAction();
  const field = (key: keyof ClientFields, label: string, type = "text") => (
    <FormRow label={label} htmlFor={`client-${key}`}>
      <Input
        id={`client-${key}`}
        type={type}
        value={form[key]}
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
      />
    </FormRow>
  );
  return (
    <FormDialog
      title={client ? "Edit client" : "New client"}
      onClose={onClose}
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="client-form" pending={pending}>
            Save client
          </Button>
        </>
      }
    >
      <form
        id="client-form"
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = {
            name: form.name,
            company: form.company,
            email: form.email,
            phone: form.phone,
            address: form.address,
            taxId: form.taxId,
            notes: form.notes,
          };
          void run(() =>
            client
              ? updateClient({ data: { id: client.id, client: data } })
              : createClient({ data }),
          ).then((saved) => {
            if (saved.ok) onClose();
          });
        }}
      >
        {field("name", "Name")}
        {field("company", "Company")}
        <div className="grid gap-3 sm:grid-cols-2">
          {field("email", "Email", "email")}
          {field("phone", "Phone")}
        </div>
        <FormRow label="Address" htmlFor="client-address">
          <Textarea id="client-address" rows={2} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
        </FormRow>
        {field("taxId", "Tax ID")}
        <FormRow label="Notes" htmlFor="client-notes">
          <Textarea id="client-notes" rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
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
