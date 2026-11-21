import { createFileRoute, Outlet } from "@tanstack/react-router";
import { getSession } from "@/serverFunctions/app";

// Every member page sits under this layout: who is signed in, and the
// business details documents show.
export const Route = createFileRoute("/_app")({
  loader: () => getSession(),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.business.businessName || "Invoices and Stock" }],
  }),
  component: Outlet,
});
