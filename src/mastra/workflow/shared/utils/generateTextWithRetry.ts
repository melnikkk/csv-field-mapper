import { generateText, type Output, type ToolSet } from "ai";

export const LLM_TIMEOUT_MS = 30_000;
export const LLM_MAX_RETRIES = 2;
export const LLM_RETRY_BACKOFF_MS = 500;

const getDefaultBackoffMs = (): number => {
  const parsed = Number(process.env.LLM_RETRY_BACKOFF_MS);
  return process.env.LLM_RETRY_BACKOFF_MS !== undefined && parsed >= 0
    ? parsed
    : LLM_RETRY_BACKOFF_MS;
};

export type RetryOptions = {
  timeoutMs?: number;
  maxRetries?: number;
  backoffMs?: number;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const generateTextWithRetry = async <OUTPUT extends Output.Output>(
  params: Parameters<typeof generateText<ToolSet, OUTPUT>>[0],
  {
    timeoutMs = LLM_TIMEOUT_MS,
    maxRetries = LLM_MAX_RETRIES,
    backoffMs = getDefaultBackoffMs(),
  }: RetryOptions = {},
): Promise<Awaited<ReturnType<typeof generateText<ToolSet, OUTPUT>>>> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await sleep(backoffMs * 2 ** (attempt - 1));
    try {
      return await generateText({
        ...params,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};
