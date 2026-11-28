import { beforeEach, describe, expect, mock, it } from "bun:test";

const mockGenerateText = mock(
  (_args?: unknown): Promise<unknown> => Promise.resolve({ output: "ok" }),
);

mock.module("ai", () => ({ generateText: mockGenerateText }));

const { generateTextWithRetry } = await import("../generateTextWithRetry");

const params = { model: "m", prompt: "p" } as never;

describe("generateTextWithRetry", () => {
  beforeEach(() => mockGenerateText.mockReset());

  it("returns the result on first success", async () => {
    mockGenerateText.mockResolvedValue({ output: "ok" });
    expect(await generateTextWithRetry(params, { backoffMs: 0 })).toEqual({
      output: "ok",
    } as never);
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it("retries a transient failure and then succeeds", async () => {
    mockGenerateText
      .mockRejectedValueOnce(new Error("503"))
      .mockResolvedValueOnce({ output: "ok" });
    expect(await generateTextWithRetry(params, { backoffMs: 0 })).toEqual({
      output: "ok",
    } as never);
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
  });

  it("passes a per-attempt abort signal and disables SDK retries", async () => {
    mockGenerateText.mockResolvedValue({ output: "ok" });
    await generateTextWithRetry(params, { backoffMs: 0 });
    const args = mockGenerateText.mock.calls[0]![0] as {
      maxRetries: number;
      abortSignal: AbortSignal;
    };
    expect(args.maxRetries).toBe(0);
    expect(args.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it("throws the last error after exhausting retries", async () => {
    mockGenerateText.mockRejectedValue(new Error("down"));
    await expect(
      generateTextWithRetry(params, { maxRetries: 2, backoffMs: 0 }),
    ).rejects.toThrow("down");
    expect(mockGenerateText).toHaveBeenCalledTimes(3);
  });
});
