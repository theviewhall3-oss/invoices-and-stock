import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    // Validation failures arrive as a list of issues.
    try {
      const issues = JSON.parse(error.message) as { message?: string }[];
      if (Array.isArray(issues) && issues[0]?.message) return issues[0].message;
    } catch {
      // A plain message.
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

/**
 * Runs a change, then reloads the page's data. `error` holds the failure
 * for a form to show; without a form, it is a toast.
 */
export function useAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run<T>(
    work: () => Promise<T>,
    options: { success?: string; toastError?: boolean } = {},
  ): Promise<{ ok: true; value: T } | { ok: false }> {
    setPending(true);
    setError(null);
    try {
      const result = await work();
      await router.invalidate();
      if (options.success) toast.success(options.success);
      return { ok: true, value: result };
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      if (options.toastError) toast.error(message);
      return { ok: false };
    } finally {
      setPending(false);
    }
  }
  return { run, pending, error, setError };
}
