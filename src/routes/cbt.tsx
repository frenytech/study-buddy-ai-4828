import { createFileRoute, redirect } from "@tanstack/react-router";

// Public /cbt link from the landing page: send visitors to sign-in or the CBT setup.
export const Route = createFileRoute("/cbt")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (location.pathname !== "/cbt" && location.pathname !== "/cbt/") return;
  },
});
