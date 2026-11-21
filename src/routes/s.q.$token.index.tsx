import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { SharedDocument } from "@/client/components/SharedDocument";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { formatDate, quoteNumber } from "@/lib/format";
import { getSharedQuote } from "@/serverFunctions/share";

// Public (everyapp.config.ts): the client opens the quote from its link.
export const Route = createFileRoute("/s/q/$token/")({
  validateSearch: z.object({ r: z.string().optional() }),
  loader: async ({ params }) => {
    const shared = await getSharedQuote({ data: { token: params.token } });
    if (!shared) throw notFound();
    return shared;
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `Quote ${quoteNumber(loaderData.quote.number)}` }] : [],
  }),
  notFoundComponent: () => <p className="p-10 text-center text-sm text-muted-foreground">This link doesn't lead to a quote.</p>,
  component: SharedQuote,
});

const RESULTS: Record<string, string> = {
  accepted: "Thank you. The quote is accepted.",
  declined: "The quote is declined.",
  closed: "This quote has already been answered.",
  expired: "This quote has expired.",
};

function SharedQuote() {
  const { quote, lines, client, business } = Route.useLoaderData();
  const { token } = Route.useParams();
  const { r } = Route.useSearch();
  const open = quote.status === "sent" && !quote.expired;
  const status = quote.status === "sent" && quote.expired ? "expired" : quote.status === "invoiced" ? "accepted" : quote.status;
  return (
    <SharedDocument
      title={`Quote ${quoteNumber(quote.number)}`}
      status={status}
      business={business}
      client={client}
      dates={<span>{formatDate(quote.issueDate)} · valid until {formatDate(quote.expiryDate)}</span>}
      lines={lines}
      totals={quote}
      notes={quote.notes}
    >
      {r && RESULTS[r] ? (
        <Alert>
          <AlertDescription>{RESULTS[r]}</AlertDescription>
        </Alert>
      ) : null}
      {open ? (
        <form method="post" action={`/s/q/${token}/respond`} className="flex flex-wrap justify-end gap-2">
          <Button type="submit" name="answer" value="decline" variant="outline">
            Decline
          </Button>
          <Button type="submit" name="answer" value="accept">
            Accept quote
          </Button>
        </form>
      ) : null}
    </SharedDocument>
  );
}
