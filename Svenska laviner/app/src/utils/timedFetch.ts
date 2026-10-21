/**
 * fetch that gives up after `ms` (the whole request, body included). On a
 * weak mountain signal a request can hang for minutes; giving up lets the
 * app fall back to what it has saved instead of spinning.
 */
export function timedFetch(input: string, init: RequestInit = {}, ms = 20_000): Promise<Response> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), ms);
  const outer = init.signal;
  if (outer) {
    if (outer.aborted) abort.abort();
    else outer.addEventListener("abort", () => abort.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: abort.signal }).catch((err: unknown) => {
    clearTimeout(timer);
    throw err;
  });
}
