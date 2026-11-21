import { useNavigate } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Choice } from "@/client/components/Choice";
import { FormRow } from "@/client/components/FormRow";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Textarea } from "@/client/components/ui/textarea";
import { useAction } from "@/client/lib/actions";
import { useMoney, useSession } from "@/client/lib/session";
import { documentTotals, fromCents, toCents, today } from "@/lib/totals";
import { createBill, updateBill } from "@/serverFunctions/app";

interface Line {
  productId: string;
  quantity: string;
  unitCost: string;
  taxRate: string;
}

interface BillDraft {
  id?: string;
  supplierId: string;
  reference: string;
  billDate: string;
  notes: string;
  lines: { productId: string; quantity: number; unitCost: number; taxRate: number }[];
}

export function BillEditor({
  bill,
  suppliers,
  products,
}: {
  bill?: BillDraft;
  suppliers: { id: string; name: string }[];
  products: { id: string; name: string; cost: number; taxRate: number; kind: string }[];
}) {
  const { business } = useSession();
  const money = useMoney();
  const navigate = useNavigate();
  const blank = (): Line => ({ productId: "", quantity: "1", unitCost: "", taxRate: String(business.defaultTaxRate) });
  const [supplierId, setSupplierId] = useState(bill?.supplierId ?? "");
  const [reference, setReference] = useState(bill?.reference ?? "");
  const [billDate, setBillDate] = useState(bill?.billDate ?? today());
  const [notes, setNotes] = useState(bill?.notes ?? "");
  const [lines, setLines] = useState<Line[]>(
    bill?.lines.map((line) => ({
      productId: line.productId,
      quantity: String(line.quantity),
      unitCost: fromCents(line.unitCost),
      taxRate: String(line.taxRate),
    })) ?? [blank()],
  );
  const { run, pending, error, setError } = useAction();
  const parsed = lines.map((line) => ({
    productId: line.productId,
    quantity: Number(line.quantity),
    unitCost: toCents(line.unitCost || "0"),
    taxRate: Number(line.taxRate || 0),
  }));
  const totals = documentTotals(
    parsed.map((line) => ({
      quantity: line.quantity || 0,
      unitPrice: Number.isNaN(line.unitCost) ? 0 : line.unitCost,
      discountRate: 0,
      taxRate: line.taxRate,
    })),
    0,
  );
  const change = (index: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const productOptions = products
    .filter((product) => product.kind === "product")
    .map((product) => ({ value: product.id, label: product.name }));

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (parsed.some((line) => Number.isNaN(line.unitCost))) {
          setError("Costs must be numbers.");
          return;
        }
        const data = { supplierId, reference, billDate, notes, lines: parsed };
        void run(() => (bill?.id ? updateBill({ data: { id: bill.id, bill: data } }) : createBill({ data }))).then(
          (done) => {
            if (done.ok) void navigate({ to: "/purchases/$id", params: { id: done.value.id } });
          },
        );
      }}
    >
      <div className="grid gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs sm:grid-cols-3">
        <FormRow label="Supplier" htmlFor="bill-supplier">
          <Choice
            id="bill-supplier"
            label="Supplier"
            value={supplierId}
            onChange={setSupplierId}
            options={suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))}
          />
        </FormRow>
        <FormRow label="Reference" htmlFor="bill-reference">
          <Input id="bill-reference" value={reference} onChange={(event) => setReference(event.target.value)} />
        </FormRow>
        <FormRow label="Bill date" htmlFor="bill-date">
          <Input id="bill-date" type="date" value={billDate} onChange={(event) => setBillDate(event.target.value)} />
        </FormRow>
      </div>

      <div className="space-y-3">
        {lines.map((line, index) => {
          const n = index + 1;
          return (
            <div key={index} className="grid grid-cols-2 items-end gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xs sm:grid-cols-[1fr_6rem_7rem_5rem_auto]">
              <FormRow label="Item" htmlFor={`bill-item-${n}`} className="col-span-2 sm:col-span-1">
                <Choice
                  id={`bill-item-${n}`}
                  label={`Item ${n}`}
                  value={line.productId}
                  onChange={(productId) => {
                    const product = products.find((p) => p.id === productId);
                    change(index, {
                      productId,
                      unitCost: product ? fromCents(product.cost) : line.unitCost,
                      taxRate: product ? String(product.taxRate) : line.taxRate,
                    });
                  }}
                  options={productOptions}
                />
              </FormRow>
              <FormRow label="Quantity" htmlFor={`bill-qty-${n}`}>
                <Input id={`bill-qty-${n}`} aria-label={`Quantity ${n}`} type="number" step="any" min={0} value={line.quantity} onChange={(event) => change(index, { quantity: event.target.value })} />
              </FormRow>
              <FormRow label="Unit cost" htmlFor={`bill-cost-${n}`}>
                <Input id={`bill-cost-${n}`} aria-label={`Unit cost ${n}`} type="number" step="0.01" min={0} value={line.unitCost} onChange={(event) => change(index, { unitCost: event.target.value })} />
              </FormRow>
              <FormRow label="Tax %" htmlFor={`bill-tax-${n}`}>
                <Input id={`bill-tax-${n}`} aria-label={`Tax ${n}`} type="number" step="any" min={0} value={line.taxRate} onChange={(event) => change(index, { taxRate: event.target.value })} />
              </FormRow>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove line ${n}`}
                disabled={lines.length === 1}
                onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
              >
                <Trash2 />
              </Button>
            </div>
          );
        })}
        <Button type="button" variant="outline" onClick={() => setLines((current) => [...current, blank()])}>
          <Plus aria-hidden />
          Add line
        </Button>
      </div>

      <FormRow label="Notes" htmlFor="bill-notes">
        <Textarea id="bill-notes" rows={2} className="bg-card" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </FormRow>

      <dl className="ml-auto max-w-xs space-y-1 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{money(totals.subtotal)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd className="tabular-nums">{money(totals.taxTotal)}</dd></div>
        <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{money(totals.total)}</dd></div>
      </dl>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="submit" pending={pending}>
          Save bill
        </Button>
      </div>
    </form>
  );
}
