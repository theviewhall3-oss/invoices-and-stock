import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { formatQuantity } from "@/lib/format";

/** A document's lines, read-only. */
export function LinesTable({
  lines,
  money,
}: {
  lines: { description: string; quantity: number; unitPrice: number; discountRate: number; taxRate: number; returned?: number }[];
  money: (cents: number) => string;
}) {
  const discounts = lines.some((line) => line.discountRate);
  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Price</TableHead>
            {discounts ? <TableHead className="text-right">Discount</TableHead> : null}
            <TableHead className="text-right">Tax</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line, index) => (
            <TableRow key={index}>
              <TableCell>
                {line.description}
                {line.returned ? (
                  <div className="text-xs text-muted-foreground">{formatQuantity(line.returned)} returned</div>
                ) : null}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatQuantity(line.quantity)}</TableCell>
              <TableCell className="text-right tabular-nums">{money(line.unitPrice)}</TableCell>
              {discounts ? <TableCell className="text-right tabular-nums">{line.discountRate ? `${line.discountRate}%` : ""}</TableCell> : null}
              <TableCell className="text-right tabular-nums">{line.taxRate}%</TableCell>
              <TableCell className="text-right tabular-nums">
                {money(Math.round(line.quantity * line.unitPrice * (1 - line.discountRate / 100)))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}
