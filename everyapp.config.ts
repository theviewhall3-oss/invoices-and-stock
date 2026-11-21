import { defineEveryApp } from "@every-app/sdk";

// defineEveryApp types the manifest. The Gateway keeps it; the Worker gets
// the bindings it lists (env.DB), never the file.
export default defineEveryApp({
  id: "invoices-and-stock",
  name: "Invoices and Stock",
  description:
    "Quotes, invoices, payments and stock for a small business, with links clients open to accept a quote or view an invoice.",
  icon: "/icon.svg",
  resources: {
    d1: ["DB"],
  },
  // Every member sells and records payments; admins manage settings, the
  // catalog and suppliers, and see everyone's records.
  access: "everyone",
  // Nothing is open to the internet but the links clients receive. Each
  // page finds its document by the unguessable token in the path and shows
  // only that document.
  public: [
    // A sent quote, and the accept and decline buttons on it.
    { path: "/s/q/:token", methods: ["GET"] },
    { path: "/s/q/:token/respond", methods: ["POST"] },
    // An issued invoice.
    { path: "/s/i/:token", methods: ["GET"] },
  ],
  // The scripts, styles and icon the share pages load.
  publicAssets: ["/assets/**", "/icon.svg"],
});
