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
import { addDays, documentTotals, fromCents, toCents, today } from "@/lib/totals";
import { createInvoice, createQuote, updateInvoice, updateQuote } from "@/serverFunctions/app";

const FREE = "free";

interface Line {
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountRate: string;
  taxRate: string;
}

interface DocumentDraft {
  id?: string;
  clientId: string;
  issueDate: string;
  endDate: string;
  discountRate: number;
  notes: string;
  lines: {
    productId: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    discountRate: number;
    taxRate: number;
  }[];
}

interface Product {
  id: string;
  name: string;
  sku: string;
  unit: string;
  price: number;
  taxRate: number;
}

/** The quote and invoice form: client, dates, lines and live totals. */
export function DocumentEditor({
  kind,
  draft,
  clients,
  products,
}: {
  kind: "quote" | "invoice";
  draft?: Partial<DocumentDraft>;
  clients: { id: string; name: string }[];
  products: Product[];
}) {
  const { business } = useSession();
  const money = useMoney();
  const navigate = useNavigate();
  const blank = (): Line => ({
    productId: FREE,
    description: "",
    quantity: "1",
    unitPrice: "",
    discountRate: "0",
    taxRate: String(business.defaultTaxRate),
  });
  const start = draft?.issueDate ?? today();
  const [clientId, setClientId] = useState(draft?.clientId ?? "");
  const [issueDate, setIssueDate] = useState(start);
  const [endDate, setEndDate] = useState(
    draft?.endDate ?? addDays(start, kind === "invoice" ? business.paymentTermsDays : 30),
  );
  const [discountRate, setDiscountRate] = useState(String(draft?.discountRate ?? 0));
  const [notes, setNotes] = useState(draft?.notes ?? "");
  const [lines, setLines] = useState<Line[]>(
    draft?.lines?.map((line) => ({
      productId: line.productId ?? FREE,
      description: line.description,
      quantity: String(line.quantity),
      unitPrice: fromCents(line.unitPrice),
      discountRate: String(line.discountRate),
      taxRate: String(line.taxRate),
    })) ?? [blank()],
  );
  const { run, pending, error, setError } = useAction();
  const parsed = lines.map((line) => ({
    productId: line.productId === FREE ? null : line.productId,
    description: line.description,
    quantity: Number(line.quantity),
    unitPrice: toCents(line.unitPrice || "0"),
    discountRate: Number(line.discountRate || 0),
    taxRate: Number(line.taxRate || 0),
  }));
  const totals = documentTotals(
    parsed.map((line) => ({
      ...line,
      quantity: line.quantity || 0,
      unitPrice: Number.isNaN(line.unitPrice) ? 0 : line.unitPrice,
    })),
    Number(discountRate || 0),
  );
  const change = (index: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const endLabel = kind === "invoice" ? "Due date" : "Expiry date";

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (parsed.some((line) => Number.isNaN(line.unitPrice))) {
          setError("Prices must be numbers.");
          return;
        }
        const data = {
          clientId,
          issueDate,
          endDate,
          discountRate: Number(discountRate || 0),
          notes,
          lines: parsed,
        };
        const id = draft?.id;
        void run(() =>
          kind === "quote"
            ? id
              ? updateQuote({ data: { id, document: data } })
              : createQuote({ data })
            : id
              ? updateInvoice({ data: { id, document: data } })
              : createInvoice({ data }),
        ).then((done) => {
          if (!done.ok) return;
          void navigate(
            kind === "quote"
              ? { to: "/quotes/$id", params: { id: done.value.id } }
              : { to: "/invoices/$id", params: { id: done.value.id } },
          );
        });
      }}
    >
      <div className="grid gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs sm:grid-cols-3">
        <FormRow label="Client" htmlFor="doc-client">
          <Choice
            id="doc-client"
            label="Client"
            value={clientId}
            onChange={setClientId}
            options={clients.map((client) => ({ value: client.id, label: client.name }))}
          />
        </FormRow>
        <FormRow label="Issue date" htmlFor="doc-issue">
          <Input
            id="doc-issue"
            type="date"
            value={issueDate}
            onChange={(event) => {
              const next = event.target.value;
              setIssueDate(next);
              if (kind === "invoice" && next) setEndDate(addDays(next, business.paymentTermsDays));
            }}
          />
        </FormRow>
        <FormRow label={endLabel} htmlFor="doc-end">
          <Input id="doc-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </FormRow>
      </div>

      <div className="space-y-3">
        {lines.map((line, index) => {
          const n = index + 1;
          return (
            <div key={index} className="space-y-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xs">
              <div className="grid gap-3 sm:grid-cols-[14rem_1fr_auto] sm:items-end">
                <FormRow label="Item" htmlFor={`line-item-${n}`}>
                  <Choice
                    id={`line-item-${n}`}
                    label={`Item ${n}`}
                    value={line.productId}
                    onChange={(productId) => {
                      const product = products.find((p) => p.id === productId);
                      change(index, product
                        ? { productId, description: product.name, unitPrice: fromCents(product.price), taxRate: String(product.taxRate) }
                        : { productId });
                    }}
                    options={[
                      { value: FREE, label: "Free text" },
                      ...products.map((product) => ({ value: product.id, label: product.name })),
                    ]}
                  />
                </FormRow>
                <FormRow label="Description" htmlFor={`line-desc-${n}`}>
                  <Input id={`line-desc-${n}`} aria-label={`Description ${n}`} value={line.description} onChange={(event) => change(index, { description: event.target.value })} />
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <FormRow label="Quantity" htmlFor={`line-qty-${n}`}>
                  <Input id={`line-qty-${n}`} aria-label={`Quantity ${n}`} type="number" step="any" min={0} value={line.quantity} onChange={(event) => change(index, { quantity: event.target.value })} />
                </FormRow>
                <FormRow label="Unit price" htmlFor={`line-price-${n}`}>
                  <Input id={`line-price-${n}`} aria-label={`Unit price ${n}`} type="number" step="0.01" min={0} value={line.unitPrice} onChange={(event) => change(index, { unitPrice: event.target.value })} />
                </FormRow>
                <FormRow label="Discount %" htmlFor={`line-disc-${n}`}>
                  <Input id={`line-disc-${n}`} aria-label={`Discount ${n}`} type="number" step="any" min={0} max={100} value={line.discountRate} onChange={(event) => change(index, { discountRate: event.target.value })} />
                </FormRow>
                <FormRow label="Tax %" htmlFor={`line-tax-${n}`}>
                  <Input id={`line-tax-${n}`} aria-label={`Tax ${n}`} type="number" step="any" min={0} max={100} value={line.taxRate} onChange={(event) => change(index, { taxRate: event.target.value })} />
                </FormRow>
                <div className="col-span-2 space-y-1.5 text-right sm:col-span-1">
                  <div className="text-sm font-medium">Amount</div>
                  <div className="flex h-9 items-center justify-end tabular-nums">
                    {money(
                      Math.round(
                        (Number(line.quantity) || 0) *
                          (Number.isNaN(parsed[index]!.unitPrice) ? 0 : parsed[index]!.unitPrice) *
                          (1 - (Number(line.discountRate) || 0) / 100),
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <Button type="button" variant="outline" onClick={() => setLines((current) => [...current, blank()])}>
          <Plus aria-hidden />
          Add line
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-4">
          <FormRow label="Document discount (%)" htmlFor="doc-discount">
            <Input id="doc-discount" type="number" step="any" min={0} max={100} className="w-32 bg-card" value={discountRate} onChange={(event) => setDiscountRate(event.target.value)} />
          </FormRow>
          <FormRow label="Notes" htmlFor="doc-notes">
            <Textarea id="doc-notes" rows={3} className="bg-card" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </FormRow>
        </div>
        <Totals totals={totals} money={money} />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" pending={pending}>
          {kind === "quote" ? "Save quote" : "Save invoice"}
        </Button>
      </div>
    </form>
  );
}

export function Totals({
  totals,
  money,
  children,
  totalTestId = "doc-total",
}: {
  totalTestId?: string;
  totals: { subtotal: number; discountTotal: number; taxTotal: number; total: number };
  money: (cents: number) => string;
  children?: React.ReactNode;
}) {
  return (
    <dl className="w-full space-y-1 self-start text-sm sm:ml-auto sm:max-w-xs">
      <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{money(totals.subtotal)}</dd></div>
      {totals.discountTotal ? (
        <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd className="tabular-nums">−{money(totals.discountTotal)}</dd></div>
      ) : null}
      <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd className="tabular-nums">{money(totals.taxTotal)}</dd></div>
      <div className="flex justify-between border-t border-border pt-1 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums" data-testid={totalTestId}>{money(totals.total)}</dd></div>
      {children}
    </dl>
  );
}
