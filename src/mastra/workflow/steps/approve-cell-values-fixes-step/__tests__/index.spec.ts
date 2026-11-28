import { describe, it, expect, mock, beforeEach } from "bun:test";

const mockRecordMetrics = mock(() => Promise.resolve("/mock/metrics.json"));

mock.module("../../../../metrics/record", () => ({
  recordMetrics: mockRecordMetrics,
}));

import { approveCellValuesFixesStep } from "../index";
import { CellValueValidationStatus } from "../../validate-cell-values-step/constants";
import type { CellValidationResult } from "../../../shared/schemas/validationSchema";

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
    autoFixed: CellValidationResult[];
    approvedMappings: unknown[];
    templateColumns?: unknown[];
    validatedFilePath: string;
    startedAt?: string;
    totalTemplateColumns?: number;
    _runMetrics?: Record<string, unknown>;
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
  beforeEach(() => mockRecordMetrics.mockClear());

  describe("without resumeData", () => {
    it("returns empty approvedFixes without suspending when proposedFixes is empty", async () => {
      const suspend = mock(() => {});

      const result = await runExecute({
        inputData: {
          proposedFixes: [],
          autoFixed: [],
          approvedMappings: [],
          validatedFilePath: "/tmp/test.csv",
          _runMetrics: {},
        },
        suspend,
      });

      expect(suspend).not.toHaveBeenCalled();
      expect(result).toEqual({
        approvedFixes: [],
        autoFixed: [],
        approvedMappings: [],
        validatedFilePath: "/tmp/test.csv",
        _runMetrics: { approveCellFixesHitl: { suspended: false } },
      });
      expect(result._runMetrics.approveCellFixesHitl).toEqual({
        suspended: false,
      });
    });

    it("suspends with proposedFixes and autoFixed when there are fixes to review", async () => {
      const fixes = [makeFix()];
      const autoFixed = [makeFix({ fixedValue: "auto" })];
      const suspend = mock(() => {});

      await runExecute({
        inputData: {
          proposedFixes: fixes,
          autoFixed,
          approvedMappings: [],
          validatedFilePath: "/tmp/test.csv",
          _runMetrics: {},
        },
        suspend,
      });

      expect(suspend).toHaveBeenCalledWith({ proposedFixes: fixes, autoFixed });
    });
  });

  describe("with resumeData", () => {
    it("bails with undefined outputFilePath and reason on abort action", async () => {
      const bail = mock(() => {});

      await runExecute({
        inputData: {
          proposedFixes: [makeFix()],
          autoFixed: [],
          approvedMappings: [],
          validatedFilePath: "/tmp/test.csv",
          startedAt: new Date().toISOString(),
          totalTemplateColumns: 1,
          _runMetrics: {},
        },
        resumeData: { action: "abort" },
        bail,
      });

      expect(mockRecordMetrics).toHaveBeenCalledTimes(1);

      expect(bail).toHaveBeenCalledWith({
        outputFilePath: undefined,
        reason: expect.any(String),
      });
    });

    it("returns proposedFixes as approvedFixes on approve action", async () => {
      const fixes = [makeFix()];

      const result = await runExecute({
        inputData: {
          proposedFixes: fixes,
          autoFixed: [],
          approvedMappings: [],
          validatedFilePath: "/tmp/test.csv",
          _runMetrics: {},
        },
        resumeData: { action: "approve" },
      });

      expect(result).toEqual({
        approvedFixes: fixes,
        autoFixed: [],
        approvedMappings: [],
        validatedFilePath: "/tmp/test.csv",
        _runMetrics: { approveCellFixesHitl: { suspended: true } },
      });
      expect(result._runMetrics.approveCellFixesHitl).toEqual({
        suspended: true,
      });
    });

    const templateColumns = [
      {
        title: "Name",
        required: true,
        validators: [{ type: "minLength", min: 3 }],
      },
      { title: "Note", required: false },
    ];
    const reviseInput = (proposedFixes: CellValidationResult[]) => ({
      proposedFixes,
      autoFixed: [],
      approvedMappings: [],
      templateColumns,
      validatedFilePath: "/tmp/test.csv",
      _runMetrics: {},
    });

    it("applies human values to matching proposals and keeps untouched ones", async () => {
      const proposed = [
        makeFix({ rowIndex: 0, fixedValue: "llm0" }),
        makeFix({ rowIndex: 1, fixedValue: "llm1" }),
      ];

      const result = await runExecute({
        inputData: reviseInput(proposed),
        resumeData: {
          action: "revise",
          correctedFixes: [
            { rowIndex: 1, columnTitle: "Name", fixedValue: "human" },
          ],
        },
      });

      expect(result).toEqual({
        approvedFixes: [proposed[0], { ...proposed[1], fixedValue: "human" }],
        autoFixed: [],
        approvedMappings: [],
        validatedFilePath: "/tmp/test.csv",
        _runMetrics: { approveCellFixesHitl: { suspended: true } },
      });
    });

    it("ignores injected fields beyond the corrected value", async () => {
      const proposed = [makeFix()];

      const result = await runExecute({
        inputData: reviseInput(proposed),
        resumeData: {
          action: "revise",
          correctedFixes: [
            {
              rowIndex: 0,
              columnTitle: "Name",
              fixedValue: "human",
              originalValue: "forged",
              failedRules: ["x"],
            },
          ],
        },
      });

      expect(result.approvedFixes).toEqual([
        { ...proposed[0], fixedValue: "human" },
      ]);
    });

    it("accepts an empty value for an optional column without validators", async () => {
      const proposed = [makeFix({ columnTitle: "Note" })];

      const result = await runExecute({
        inputData: reviseInput(proposed),
        resumeData: {
          action: "revise",
          correctedFixes: [
            { rowIndex: 0, columnTitle: "Note", fixedValue: "" },
          ],
        },
      });

      expect(result.approvedFixes[0].fixedValue).toBe("");
    });

    it.each([
      [
        "cell not in proposedFixes (row)",
        { rowIndex: 5, columnTitle: "Name", fixedValue: "valid" },
        "not in proposed fixes",
      ],
      [
        "cell not in proposedFixes (column)",
        { rowIndex: 0, columnTitle: "Note", fixedValue: "valid" },
        "not in proposed fixes",
      ],
      [
        "value failing validators",
        { rowIndex: 0, columnTitle: "Name", fixedValue: "ab" },
        "Invalid value",
      ],
      [
        "empty value for a required column",
        { rowIndex: 0, columnTitle: "Name", fixedValue: "  " },
        "required",
      ],
    ])("bails and records metrics on %s", async (_label, correction, text) => {
      const bail = mock(() => {});

      await runExecute({
        inputData: {
          ...reviseInput([makeFix()]),
          startedAt: new Date().toISOString(),
          totalTemplateColumns: 2,
        },
        resumeData: { action: "revise", correctedFixes: [correction] },
        bail,
      });

      expect(mockRecordMetrics).toHaveBeenCalledTimes(1);
      expect(bail).toHaveBeenCalledWith({
        reason: expect.stringContaining(text),
      });
    });

    it("bails on duplicate corrections for the same cell", async () => {
      const bail = mock(() => {});
      const correction = {
        rowIndex: 0,
        columnTitle: "Name",
        fixedValue: "good",
      };

      await runExecute({
        inputData: reviseInput([makeFix()]),
        resumeData: {
          action: "revise",
          correctedFixes: [correction, correction],
        },
        bail,
      });

      expect(bail).toHaveBeenCalledWith({
        reason: expect.stringContaining("Duplicate"),
      });
    });
  });
});
