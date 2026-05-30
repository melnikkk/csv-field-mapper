import { describe, it, expect, mock } from "bun:test";
import { approveCellValuesFixesStep } from "../index";
import { CellValueValidationStatus } from "../../validate-cell-values-step/constants";
import type { CellValidationResult } from "../../shared/schemas/validationSchema";

const makeFix = (
  overrides?: Partial<CellValidationResult>,
): CellValidationResult => ({
  rowIndex: 0,
  columnTitle: "Name",
  originalValue: "bad",
  fixedValue: "good",
  status: CellValueValidationStatus.AUTO_FIXED,
  failedRules: [],
  ...overrides,
});

const runExecute = (params: {
  inputData: {
    proposedFixes: CellValidationResult[];
    validatedFilePath: string;
  };
  resumeData?: unknown;
  suspend?: (payload: unknown) => unknown;
  bail?: (payload: unknown) => unknown;
}) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (approveCellValuesFixesStep as any).execute({
    suspend: () => {},
    bail: () => {},
    ...params,
  });

describe("approveCellValuesFixesStep", () => {
  describe("without resumeData", () => {
    it("returns empty approvedFixes without suspending when proposedFixes is empty", async () => {
      const suspend = mock(() => {});

      const result = await runExecute({
        inputData: { proposedFixes: [], validatedFilePath: "/tmp/test.csv" },
        suspend,
      });

      expect(suspend).not.toHaveBeenCalled();
      expect(result).toEqual({
        approvedFixes: [],
        validatedFilePath: "/tmp/test.csv",
      });
    });

    it("suspends with proposedFixes when there are fixes to review", async () => {
      const fixes = [makeFix()];
      const suspend = mock(() => {});

      await runExecute({
        inputData: { proposedFixes: fixes, validatedFilePath: "/tmp/test.csv" },
        suspend,
      });

      expect(suspend).toHaveBeenCalledWith({ proposedFixes: fixes });
    });
  });

  describe("with resumeData", () => {
    it("bails with undefined outputFilePath on abort action", async () => {
      const bail = mock(() => {});

      await runExecute({
        inputData: {
          proposedFixes: [makeFix()],
          validatedFilePath: "/tmp/test.csv",
        },
        resumeData: { action: "abort" },
        bail,
      });

      expect(bail).toHaveBeenCalledWith({ outputFilePath: undefined });
    });

    it("returns proposedFixes as approvedFixes on approve action", async () => {
      const fixes = [makeFix()];

      const result = await runExecute({
        inputData: { proposedFixes: fixes, validatedFilePath: "/tmp/test.csv" },
        resumeData: { action: "approve" },
      });

      expect(result).toEqual({
        approvedFixes: fixes,
        validatedFilePath: "/tmp/test.csv",
      });
    });

    it("returns correctedFixes as approvedFixes on revise action", async () => {
      const original = [makeFix()];
      const corrected = [makeFix({ fixedValue: "corrected" })];

      const result = await runExecute({
        inputData: {
          proposedFixes: original,
          validatedFilePath: "/tmp/test.csv",
        },
        resumeData: { action: "revise", correctedFixes: corrected },
      });

      expect(result).toEqual({
        approvedFixes: corrected,
        validatedFilePath: "/tmp/test.csv",
      });
    });
  });
});
