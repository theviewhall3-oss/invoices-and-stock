import { createFileRoute, notFound } from "@tanstack/react-router";
import { SharedDocument } from "@/client/components/SharedDocument";
import { formatDate, formatMoney, invoiceNumber } from "@/lib/format";
import { getSharedInvoice } from "@/serverFunctions/share";

// Public (everyapp.config.ts): the client views an issued invoice from its link.
export const Route = createFileRoute("/s/i/$token")({
  loader: async ({ params }) => {
    const shared = await getSharedInvoice({ data: { token: params.token } });
    if (!shared) throw notFound();
    return shared;
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `Invoice ${invoiceNumber(loaderData.invoice.number)}` }] : [],
  }),
  notFoundComponent: () => <p className="p-10 text-center text-sm text-muted-foreground">This link doesn't lead to an invoice.</p>,
  component: SharedInvoice,
});

function SharedInvoice() {
  const data = Route.useLoaderData();
  const { invoice, business } = data;
  const money = (cents: number) => formatMoney(cents, business.currencyCode);
  return (
    <SharedDocument
      title={`Invoice ${invoiceNumber(invoice.number)}`}
      status={data.state}
      business={business}
      client={data.client}
      dates={<span>{formatDate(invoice.issueDate)} · due {formatDate(invoice.dueDate)}</span>}
      lines={data.lines}
      totals={invoice}
      notes={invoice.notes}
      extra={
        invoice.status === "issued" ? (
          <>
            {data.paid ? <div className="flex justify-between"><dt className="text-muted-foreground">Paid</dt><dd className="tabular-nums">{money(data.paid)}</dd></div> : null}
            {data.credited ? <div className="flex justify-between"><dt className="text-muted-foreground">Credited</dt><dd className="tabular-nums">{money(data.credited)}</dd></div> : null}
            <div className="flex justify-between font-semibold"><dt>Balance due</dt><dd className="tabular-nums" data-testid="share-balance">{money(data.balance)}</dd></div>
          </>
        ) : null
      }
    />
  );
}
