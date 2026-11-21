import { Package, Wrench } from "lucide-react";
import { useState } from "react";
import { FormDialog } from "@/client/components/FormDialog";
import { FormRow } from "@/client/components/FormRow";
import { SegmentedToggle } from "@/client/components/SegmentedToggle";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { useAction } from "@/client/lib/actions";
import { useSession } from "@/client/lib/session";
import { fromCents, toCents } from "@/lib/totals";
import { createProduct, updateProduct } from "@/serverFunctions/app";

interface Product {
  id: string;
  kind: "product" | "service";
  sku: string;
  name: string;
  unit: string;
  price: number;
  cost: number;
  taxRate: number;
  trackStock: boolean;
  lowStockLevel: number;
}

export function ProductDialog({
  product,
  onClose,
}: {
  product?: Product;
  onClose: () => void;
}) {
  const { business } = useSession();
  const [form, setForm] = useState({
    kind: product?.kind ?? ("product" as Product["kind"]),
    sku: product?.sku ?? "",
    name: product?.name ?? "",
    unit: product?.unit ?? "",
    price: product ? fromCents(product.price) : "",
    cost: product ? fromCents(product.cost) : "",
    taxRate: String(product?.taxRate ?? business.defaultTaxRate),
    trackStock: product?.trackStock ?? false,
    lowStockLevel: String(product?.lowStockLevel ?? 0),
  });
  const { run, pending, error, setError } = useAction();
  const text = (key: "sku" | "name" | "unit" | "price" | "cost" | "taxRate" | "lowStockLevel", label: string, type = "text") => (
    <FormRow label={label} htmlFor={`product-${key}`}>
      <Input
        id={`product-${key}`}
        type={type}
        step={type === "number" ? "any" : undefined}
        min={type === "number" ? 0 : undefined}
        value={form[key]}
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
      />
    </FormRow>
  );
  return (
    <FormDialog
      title={product ? "Edit item" : "New item"}
      onClose={onClose}
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="product-form" pending={pending}>
            Save item
          </Button>
        </>
      }
    >
      <form
        id="product-form"
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const price = toCents(form.price || "0");
          const cost = toCents(form.cost || "0");
          if (Number.isNaN(price) || Number.isNaN(cost)) {
            setError("Prices must be numbers.");
            return;
          }
          const data = {
            kind: form.kind,
            sku: form.sku,
            name: form.name,
            unit: form.unit,
            price,
            cost,
            taxRate: Number(form.taxRate || 0),
            trackStock: form.kind === "product" && form.trackStock,
            lowStockLevel: Number(form.lowStockLevel || 0),
          };
          void run(() =>
            product
              ? updateProduct({ data: { id: product.id, product: data } })
              : createProduct({ data }),
          ).then((saved) => {
            if (saved.ok) onClose();
          });
        }}
      >
        <SegmentedToggle
          showLabels
          value={form.kind}
          onChange={(kind) => setForm({ ...form, kind })}
          items={[
            { value: "product", label: "Product", icon: <Package aria-hidden /> },
            { value: "service", label: "Service", icon: <Wrench aria-hidden /> },
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {text("sku", "SKU")}
          <div className="sm:col-span-2">{text("name", "Name")}</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {text("price", "Sale price", "number")}
          {text("cost", "Cost", "number")}
          {text("taxRate", "Tax rate (%)", "number")}
          {text("unit", "Unit")}
        </div>
        {form.kind === "product" ? (
          <div className="grid items-end gap-3 sm:grid-cols-2">
            <div className="flex h-9 items-center gap-2">
              <Checkbox
                id="product-trackStock"
                checked={form.trackStock}
                onCheckedChange={(checked) => setForm({ ...form, trackStock: checked })}
              />
              <Label htmlFor="product-trackStock">Track stock</Label>
            </div>
            {form.trackStock ? text("lowStockLevel", "Low-stock level", "number") : null}
          </div>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </form>
    </FormDialog>
  );
}
