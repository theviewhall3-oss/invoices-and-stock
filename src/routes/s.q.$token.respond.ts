import { createFileRoute } from "@tanstack/react-router";

// Public (everyapp.config.ts): the accept and decline buttons of the quote's
// share page post here. The token is the only key; the quote changes once,
// while it is sent and unexpired. Answers go back to the page by redirect.
export const Route = createFileRoute("/s/q/$token/respond")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const form = await request.formData().catch(() => null);
        const answer = form?.get("answer");
        if (answer !== "accept" && answer !== "decline")
          return new Response("Answer accept or decline.", { status: 400 });
        const { respondToQuote } = await import("@/server/quotes");
        const result = await respondToQuote(params.token, answer);
        if (result === "not_found") return new Response("Not found", { status: 404 });
        return new Response(null, {
          status: 303,
          headers: { location: `/s/q/${encodeURIComponent(params.token)}?r=${result}` },
        });
      },
    },
  },
});
