import { describe, expect, it } from "bun:test";
import { applyFixer, checkRule } from "../utils";

describe("checkRule > date", () => {
  it("accepts a valid YYYY-MM-DD date", () => {
    expect(
      checkRule("2024-01-15", { type: "date", format: "YYYY-MM-DD" }),
    ).toBeNull();
  });

  it("rejects a YYYY-MM-DD value with an invalid month", () => {
    expect(
      checkRule("2024-13-01", { type: "date", format: "YYYY-MM-DD" }),
    ).not.toBeNull();
  });

  it("rejects a YYYY-MM-DD value with an invalid day", () => {
    expect(
      checkRule("2024-01-32", { type: "date", format: "YYYY-MM-DD" }),
    ).not.toBeNull();
  });

  it("rejects a value that does not match YYYY-MM-DD pattern", () => {
    expect(
      checkRule("01/15/2024", { type: "date", format: "YYYY-MM-DD" }),
    ).not.toBeNull();
  });

  it("accepts a valid MM/DD/YYYY date", () => {
    expect(
      checkRule("01/15/2024", { type: "date", format: "MM/DD/YYYY" }),
    ).toBeNull();
  });

  it("rejects a MM/DD/YYYY value with invalid month", () => {
    expect(
      checkRule("13/01/2024", { type: "date", format: "MM/DD/YYYY" }),
    ).not.toBeNull();
  });

  it("accepts a valid DD/MM/YYYY date", () => {
    expect(
      checkRule("15/01/2024", { type: "date", format: "DD/MM/YYYY" }),
    ).toBeNull();
  });

  it("rejects a DD/MM/YYYY value with invalid day", () => {
    expect(
      checkRule("32/01/2024", { type: "date", format: "DD/MM/YYYY" }),
    ).not.toBeNull();
  });

  it("accepts a valid YYYY-MM-DDTHH:mm:ss datetime", () => {
    expect(
      checkRule("2024-01-15T10:30:59", {
        type: "date",
        format: "YYYY-MM-DDTHH:mm:ss",
      }),
    ).toBeNull();
  });

  it("rejects a malformed datetime string", () => {
    expect(
      checkRule("2024-01-15 10:30:59", {
        type: "date",
        format: "YYYY-MM-DDTHH:mm:ss",
      }),
    ).not.toBeNull();
  });

  it("falls back to Date.parse when no format is specified", () => {
    expect(checkRule("not-a-date", { type: "date" })).not.toBeNull();
    expect(checkRule("2024-01-15", { type: "date" })).toBeNull();
  });

  it("falls back to Date.parse for an unrecognized format string", () => {
    expect(
      checkRule("2024-01-15", { type: "date", format: "UNKNOWN" }),
    ).toBeNull();
    expect(
      checkRule("not-a-date", { type: "date", format: "UNKNOWN" }),
    ).not.toBeNull();
  });
});

describe("applyFixer > stripNonNumeric", () => {
  it("strips currency symbol from positive number", () => {
    expect(applyFixer("$42.00", "stripNonNumeric")).toBe("42.00");
  });

  it("preserves leading minus sign on negative number", () => {
    expect(applyFixer("-42.5", "stripNonNumeric")).toBe("-42.5");
  });

  it("preserves mid-string minus sign", () => {
    expect(applyFixer("1-2", "stripNonNumeric")).toBe("1-2");
  });

  it("strips non-numeric characters while preserving minus", () => {
    expect(applyFixer("$-99.99", "stripNonNumeric")).toBe("-99.99");
  });
});
