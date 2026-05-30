import { describe, it, expect } from "bun:test";
import { resumeApproveCellValuesFixesStepSchema } from "../schema";
import { CellValueValidationStatus } from "../../validate-cell-values-step/constants";

describe("resumeApproveCellValuesFixesStepSchema", () => {
  it("parses approve action", () => {
    expect(
      resumeApproveCellValuesFixesStepSchema.parse({ action: "approve" }),
    ).toEqual({
      action: "approve",
    });
  });

  it("parses abort action", () => {
    expect(
      resumeApproveCellValuesFixesStepSchema.parse({ action: "abort" }),
    ).toEqual({
      action: "abort",
    });
  });

  it("parses revise action with correctedFixes", () => {
    const correctedFixes = [
      {
        rowIndex: 0,
        columnTitle: "Name",
        originalValue: "bad",
        fixedValue: "good",
        status: CellValueValidationStatus.AUTO_FIXED,
        failedRules: [],
      },
    ];
    expect(
      resumeApproveCellValuesFixesStepSchema.parse({
        action: "revise",
        correctedFixes,
      }),
    ).toEqual({ action: "revise", correctedFixes });
  });

  it("rejects an unknown action", () => {
    expect(() =>
      resumeApproveCellValuesFixesStepSchema.parse({ action: "unknown" }),
    ).toThrow();
  });

  it("rejects revise action when correctedFixes is missing", () => {
    expect(() =>
      resumeApproveCellValuesFixesStepSchema.parse({ action: "revise" }),
    ).toThrow();
  });
});
