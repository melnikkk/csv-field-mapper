import { describe, expect, it, spyOn } from "bun:test";
import { checkRule, createCellValidator, runValidators } from "../utils";

describe("empty values", () => {
  it("passes an empty optional email", () => {
    const validate = createCellValidator({
      required: false,
      validators: [{ type: "email" }],
    });

    expect(validate("")).toEqual([]);
    expect(validate("   ")).toEqual([]);
  });

  it("fails an empty required numeric with only the required error", () => {
    const validate = createCellValidator({
      required: true,
      validators: [{ type: "numeric" }],
    });

    expect(validate("")).toEqual(["Value is required"]);
  });

  it("does not duplicate the required error when a required rule is listed", () => {
    const validate = createCellValidator({
      required: true,
      validators: [{ type: "required" }, { type: "numeric" }],
    });

    expect(validate("")).toEqual(["Value is required"]);
  });

  it("runValidators lets only the required rule fail on empty values", () => {
    expect(
      runValidators("", [{ type: "numeric" }, { type: "minLength", min: 3 }]),
    ).toEqual([]);
    expect(
      runValidators("", [{ type: "required" }, { type: "numeric" }]),
    ).toEqual(["Value is required"]);
  });
});

describe("createCellValidator regex compilation", () => {
  it("compiles each regex once regardless of the number of values", () => {
    const OriginalRegExp = RegExp;
    let constructed = 0;
    const spy = spyOn(globalThis, "RegExp").mockImplementation(((
      pattern: string,
      flags?: string,
    ) => {
      constructed++;

      return new OriginalRegExp(pattern, flags);
    }) as unknown as RegExpConstructor);

    try {
      const validate = createCellValidator({
        required: false,
        validators: [{ type: "regex", pattern: "^[A-Z]+$" }],
      });

      for (let i = 0; i < 100; i++) {
        validate("ABC");
      }

      expect(constructed).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("checkRule > strict dates", () => {
  const withFormat = (value: string, format: string) =>
    checkRule(value, { type: "date", format });
  const iso = (value: string) => checkRule(value, { type: "date" });

  it("rejects Feb 31 in every format", () => {
    expect(withFormat("2025-02-31", "YYYY-MM-DD")).not.toBeNull();
    expect(withFormat("02/31/2025", "MM/DD/YYYY")).not.toBeNull();
    expect(withFormat("31/02/2025", "DD/MM/YYYY")).not.toBeNull();
    expect(
      withFormat("2025-02-31T10:00:00", "YYYY-MM-DDTHH:mm:ss"),
    ).not.toBeNull();
  });

  it("handles leap years", () => {
    expect(withFormat("2024-02-29", "YYYY-MM-DD")).toBeNull();
    expect(withFormat("2023-02-29", "YYYY-MM-DD")).not.toBeNull();
    expect(withFormat("1900-02-29", "YYYY-MM-DD")).not.toBeNull();
    expect(withFormat("2000-02-29", "YYYY-MM-DD")).toBeNull();
  });

  it("rejects day 31 in 30-day months", () => {
    expect(withFormat("2025-04-31", "YYYY-MM-DD")).not.toBeNull();
  });

  it("falls back to strict ISO-8601 when no format is given", () => {
    expect(iso("2025-03-05")).toBeNull();
    expect(iso("2025-03-05T10:20:30")).toBeNull();
    expect(iso("2025-03-05T10:20")).toBeNull();
    expect(iso("2025-03-05T10:20:30Z")).toBeNull();
    expect(iso("2025-03-05T10:20:30.123+02:00")).toBeNull();
    expect(iso("2024-02-29")).toBeNull();
  });

  it("rejects non-ISO and out-of-range values when no format is given", () => {
    expect(iso("March 5")).not.toBeNull();
    expect(iso("2025-13-01")).not.toBeNull();
    expect(iso("2025-02-31")).not.toBeNull();
    expect(iso("2025-03-05T25:00:00")).not.toBeNull();
    expect(iso("03/05/2025")).not.toBeNull();
    expect(iso("2025-3-5")).not.toBeNull();
  });

  it("treats an unknown format as strict ISO-8601", () => {
    expect(withFormat("2025-03-05", "YYYY.MM.DD")).toBeNull();
    expect(withFormat("05.03.2025", "DD.MM.YYYY")).not.toBeNull();
  });
});
