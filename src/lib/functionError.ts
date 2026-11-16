export const CREDITS_MESSAGE = "Your workspace is out of AI credits. Add credits in Settings → Usage, then try again.";

/** Turns a backend function error into a clear, user-facing message. */
export async function readFunctionError(error: { message: string; context?: unknown }): Promise<string> {
  let msg = error.message;
  const ctx = error.context as Response | undefined;
  try {
    const body = await ctx?.clone?.().json();
    if (typeof body?.error === "string") msg = body.error;
    else if (typeof body?.message === "string") msg = body.message;
  } catch { /* keep default */ }
  if (ctx?.status === 402 || /credits exhausted|insufficient credits/i.test(msg)) return CREDITS_MESSAGE;
  return msg;
}
