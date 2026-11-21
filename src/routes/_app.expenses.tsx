import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Choice } from "@/client/components/Choice";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { FormDialog } from "@/client/components/FormDialog";
import { FormRow } from "@/client/components/FormRow";
import { Page, Section, Stat } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
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
import { useAction } from "@/client/lib/actions";
import { useMoney } from "@/client/lib/session";
import { formatDate } from "@/lib/format";
import { fromCents, toCents, today } from "@/lib/totals";
import {
  createExpense,
  deleteExpense,
  getExpenses,
  getSuppliers,
  updateExpense,
} from "@/serverFunctions/app";

export const Route = createFileRoute("/_app/expenses")({
  validateSearch: z.object({ month: z.string().optional() }),
  loaderDeps: ({ search }) => ({ month: search.month }),
  loader: async ({ deps }) => {
    const [list, suppliers] = await Promise.all([
      getExpenses({ data: { month: deps.month } }),
      getSuppliers(),
    ]);
    return { ...list, suppliers };
  },
  component: Expenses,
});

type Expense = Awaited<ReturnType<typeof getExpenses>>["expenses"][number];
const NONE = "none";

function Expenses() {
  const data = Route.useLoaderData();
  const { month } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const money = useMoney();
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const { run, pending } = useAction();
  const categories = [...new Set(data.byCategory.map((row) => row.category))];
  return (
    <Page>
      <PageHeader title="Expenses" actions={<Button onClick={() => setEditing("new")}>New expense</Button>} />
      <div className="flex flex-wrap items-end gap-3">
        <FormRow label="Month" htmlFor="expenses-month">
          <Input
            id="expenses-month"
            type="month"
            className="w-44 bg-card"
            value={month ?? ""}
            onChange={(event) => void navigate({ search: { month: event.target.value || undefined } })}
          />
        </FormRow>
        {month ? (
          <Button variant="ghost" onClick={() => void navigate({ search: {} })}>
            All time
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label={month ? "Total this month" : "Total"} value={money(data.total)} testId="expenses-total" />
        <Stat label="Expenses" value={data.expenses.length} testId="expenses-count" />
      </div>
      {data.byCategory.length ? (
        <Section title="By category">
          <TableCard>
            <Table>
              <TableBody>
                {data.byCategory.map((row) => (
                  <TableRow key={row.category} data-testid="category-total">
                    <TableCell>{row.category}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(row.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        </Section>
      ) : null}
      <Section title="Expenses">
        {data.expenses.length === 0 ? (
          <EmptyState media="rows" title={month ? "No expenses this month" : "No expenses yet"} />
        ) : (
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.expenses.map((expense) => (
                  <TableRow key={expense.id} data-testid="expense-row">
                    <TableCell className="whitespace-nowrap">{formatDate(expense.date)}</TableCell>
                    <TableCell>{expense.category}</TableCell>
                    <TableCell>{expense.supplierName}</TableCell>
                    <TableCell>{expense.note}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(expense.amount)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon-sm" aria-label="Edit expense" onClick={() => setEditing(expense)}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Delete expense" onClick={() => setDeleting(expense)}>
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        )}
      </Section>
      {editing ? (
        <ExpenseDialog
          expense={editing === "new" ? undefined : editing}
          suppliers={data.suppliers}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title="Delete this expense?"
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            void run(() => deleteExpense({ data: { id: deleting.id } }), { toastError: true }).then(() =>
              setDeleting(null),
            )
          }
        />
      ) : null}
    </Page>
  );
}

function ExpenseDialog({
  expense,
  suppliers,
  categories,
  onClose,
}: {
  expense?: Expense;
  suppliers: { id: string; name: string }[];
  categories: string[];
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    date: expense?.date ?? today(),
    category: expense?.category ?? "",
    amount: expense ? fromCents(expense.amount) : "",
    supplierId: expense?.supplierId ?? NONE,
    note: expense?.note ?? "",
  });
  const { run, pending, error, setError } = useAction();
  return (
    <FormDialog
      title={expense ? "Edit expense" : "New expense"}
      onClose={onClose}
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="expense-form" pending={pending}>
            Save expense
          </Button>
        </>
      }
    >
      <form
        id="expense-form"
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const amount = toCents(form.amount);
          if (Number.isNaN(amount)) {
            setError("Enter an amount.");
            return;
          }
          const data = {
            date: form.date,
            category: form.category,
            amount,
            supplierId: form.supplierId === NONE ? null : form.supplierId,
            note: form.note,
          };
          void run(() =>
            expense ? updateExpense({ data: { id: expense.id, expense: data } }) : createExpense({ data }),
          ).then((done) => {
            if (done.ok) onClose();
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormRow label="Date" htmlFor="expense-date">
            <Input id="expense-date" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
          </FormRow>
          <FormRow label="Amount" htmlFor="expense-amount">
            <Input id="expense-amount" type="number" step="0.01" min={0} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
          </FormRow>
        </div>
        <FormRow label="Category" htmlFor="expense-category">
          <Input id="expense-category" list="expense-categories" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
          <datalist id="expense-categories">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </FormRow>
        <FormRow label="Supplier" htmlFor="expense-supplier">
          <Choice
            id="expense-supplier"
            label="Supplier"
            value={form.supplierId}
            onChange={(supplierId) => setForm({ ...form, supplierId })}
            options={[{ value: NONE, label: "None" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
          />
        </FormRow>
        <FormRow label="Note" htmlFor="expense-note">
          <Input id="expense-note" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
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
