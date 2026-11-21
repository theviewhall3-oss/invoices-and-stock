import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FormRow } from "@/client/components/FormRow";
import { Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Textarea } from "@/client/components/ui/textarea";
import { useAction } from "@/client/lib/actions";
import { useSession } from "@/client/lib/session";
import { saveSettings } from "@/serverFunctions/app";

export const Route = createFileRoute("/_app/settings")({
  component: Settings,
});

function Settings() {
  const { business, actor } = useSession();
  const [form, setForm] = useState({
    businessName: business.businessName,
    address: business.address,
    currencyCode: business.currencyCode,
    defaultTaxRate: String(business.defaultTaxRate),
    paymentTermsDays: String(business.paymentTermsDays),
    nextQuoteNumber: String(business.nextQuoteNumber),
    nextInvoiceNumber: String(business.nextInvoiceNumber),
  });
  const { run, pending, error } = useAction();
  const disabled = !actor.admin;
  const set =
    (key: keyof typeof form) =>
    (event: { target: { value: string } }) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <Page>
      <PageHeader
        title="Settings"
        description={disabled ? "Only an admin can change these." : undefined}
      />
      <form
        className="space-y-5 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs"
        onSubmit={(event) => {
          event.preventDefault();
          void run(
            () =>
              saveSettings({
                data: {
                  businessName: form.businessName,
                  address: form.address,
                  currencyCode: form.currencyCode,
                  defaultTaxRate: Number(form.defaultTaxRate),
                  paymentTermsDays: Number(form.paymentTermsDays),
                  nextQuoteNumber: Number(form.nextQuoteNumber),
                  nextInvoiceNumber: Number(form.nextInvoiceNumber),
                },
              }),
            { success: "Settings saved" },
          );
        }}
      >
        <FormRow label="Business name" htmlFor="businessName">
          <Input id="businessName" value={form.businessName} onChange={set("businessName")} disabled={disabled} />
        </FormRow>
        <FormRow label="Address" htmlFor="address">
          <Textarea id="address" value={form.address} onChange={set("address")} disabled={disabled} rows={3} />
        </FormRow>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormRow label="Currency code" htmlFor="currencyCode">
            <Input id="currencyCode" value={form.currencyCode} onChange={set("currencyCode")} disabled={disabled} maxLength={3} />
          </FormRow>
          <FormRow label="Default tax rate (%)" htmlFor="defaultTaxRate">
            <Input id="defaultTaxRate" type="number" min={0} max={100} step="any" value={form.defaultTaxRate} onChange={set("defaultTaxRate")} disabled={disabled} />
          </FormRow>
          <FormRow label="Payment terms (days)" htmlFor="paymentTermsDays">
            <Input id="paymentTermsDays" type="number" min={0} step={1} value={form.paymentTermsDays} onChange={set("paymentTermsDays")} disabled={disabled} />
          </FormRow>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormRow label="Next quote number" htmlFor="nextQuoteNumber">
            <Input id="nextQuoteNumber" type="number" min={1} step={1} value={form.nextQuoteNumber} onChange={set("nextQuoteNumber")} disabled={disabled} />
          </FormRow>
          <FormRow label="Next invoice number" htmlFor="nextInvoiceNumber">
            <Input id="nextInvoiceNumber" type="number" min={1} step={1} value={form.nextInvoiceNumber} onChange={set("nextInvoiceNumber")} disabled={disabled} />
          </FormRow>
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {disabled ? null : (
          <div className="flex justify-end">
            <Button type="submit" pending={pending}>
              Save settings
            </Button>
          </div>
        )}
      </form>
    </Page>
  );
}
