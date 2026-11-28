import { describe, it, expect, mock, beforeEach } from "bun:test";

const mockRecordMetrics = mock(() => Promise.resolve("/mock/metrics.json"));

mock.module("../../../../metrics/record", () => ({
  recordMetrics: mockRecordMetrics,
}));

import { approveColumnMappingStep } from "../index";
import type { MappingResults } from "../../../shared/schemas/mappingSchema";

const makeMapping = (
  confidence: number,
  title = "Name",
): MappingResults[number] => ({
  templateColumn: { title, required: true },
  csvHeader: title.toLowerCase(),
  confidence,
});

const runExecute = (params: {
  inputData: {
    mappingResults: MappingResults;
    templateColumns?: Array<MappingResults[number]["templateColumn"]>;
    headerRow?: string[];
    startedAt?: string;
    totalTemplateColumns?: number;
    _runMetrics?: Record<string, unknown>;
  };
  resumeData?: unknown;
  suspend?: (payload: unknown) => unknown;
  bail?: (payload: unknown) => unknown;
}) =>
  (approveColumnMappingStep as any).execute({
    suspend: () => {},
    bail: () => {},
    ...params,
  });

describe("approveColumnMappingStep", () => {
  beforeEach(() => mockRecordMetrics.mockClear());

  describe("without resumeData", () => {
    it("returns approvedMappings without suspending when all mappings are fully confident", async () => {
      const mappings = [makeMapping(1), makeMapping(1, "Email")];
      const suspend = mock(() => {});

      const result = await runExecute({
        inputData: { mappingResults: mappings, _runMetrics: {} },
        suspend,
      });

      expect(suspend).not.toHaveBeenCalled();
      expect(result).toEqual({
        approvedMappings: mappings,
        _runMetrics: {
          approveMappingHitl: { suspended: false, revisionCount: 0 },
        },
      });
      expect(result._runMetrics.approveMappingHitl).toEqual({
        suspended: false,
        revisionCount: 0,
      });
    });

    it("suspends with mappingResults when not all mappings are fully confident", async () => {
      const mappings = [makeMapping(1), makeMapping(0.8, "Email")];
      const suspend = mock(() => {});

      await runExecute({
        inputData: { mappingResults: mappings },
        suspend,
      });

      expect(suspend).toHaveBeenCalledWith({ mappingResults: mappings });
    });

    it("suspends when all mappings have confidence 0", async () => {
      const mappings = [makeMapping(0), makeMapping(0, "Email")];
      const suspend = mock(() => {});

      await runExecute({
        inputData: { mappingResults: mappings },
        suspend,
      });

      expect(suspend).toHaveBeenCalledWith({ mappingResults: mappings });
    });
  });

  describe("with resumeData", () => {
    it("bails with undefined outputFilePath and reason on abort action", async () => {
      const bail = mock(() => {});

      await runExecute({
        inputData: {
          mappingResults: [makeMapping(0.8)],
          startedAt: new Date().toISOString(),
          totalTemplateColumns: 1,
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

    const columns = [
      { title: "Name", required: true },
      { title: "Email", required: true },
    ];
    const headerRow = ["name", "email", "other"];
    const reviseInput = (mappingResults: MappingResults) => ({
      mappingResults,
      templateColumns: columns,
      headerRow,
      _runMetrics: {},
    });

    it("applies corrections over the proposal with confidence 1 and keeps untouched mappings", async () => {
      const proposed = [
        { templateColumn: columns[0]!, csvHeader: "name", confidence: 0.6 },
        { templateColumn: columns[1]!, csvHeader: undefined, confidence: 0 },
      ];
      const suspend = mock(() => {});

      const result = await runExecute({
        inputData: reviseInput(proposed),
        resumeData: {
          action: "revise",
          correctedMappings: [
            { templateColumnTitle: "Email", csvHeader: "email" },
          ],
        },
        suspend,
      });

      expect(suspend).not.toHaveBeenCalled();
      expect(result).toEqual({
        approvedMappings: [
          { templateColumn: columns[0], csvHeader: "name", confidence: 0.6 },
          { templateColumn: columns[1], csvHeader: "email", confidence: 1 },
        ],
        _runMetrics: {
          approveMappingHitl: { suspended: true, revisionCount: 1 },
        },
      });
    });

    it("allows unmapping a column with a null csvHeader", async () => {
      const result = await runExecute({
        inputData: reviseInput([makeMapping(0.5, "Name")]),
        resumeData: {
          action: "revise",
          correctedMappings: [{ templateColumnTitle: "Name", csvHeader: null }],
        },
      });

      expect(result.approvedMappings[0]).toEqual({
        templateColumn: columns[0],
        csvHeader: undefined,
        confidence: 1,
      });
    });

    it("rebuilds templateColumn from the template, ignoring injected columns", async () => {
      const result = await runExecute({
        inputData: reviseInput([makeMapping(0.5, "Name")]),
        resumeData: {
          action: "revise",
          correctedMappings: [
            {
              templateColumnTitle: "Name",
              csvHeader: "other",
              templateColumn: {
                title: "Name",
                required: false,
                validators: [{ type: "regex", pattern: ".*" }],
              },
            },
          ],
        },
      });

      expect(result.approvedMappings[0].templateColumn).toEqual(columns[0]);
    });

    it.each([
      [
        "unknown templateColumnTitle",
        [{ templateColumnTitle: "Evil", csvHeader: "name" }],
        "Unknown template column",
      ],
      [
        "csvHeader not in headerRow",
        [{ templateColumnTitle: "Name", csvHeader: "ghost" }],
        "not found in file",
      ],
      [
        "duplicate templateColumnTitle",
        [
          { templateColumnTitle: "Name", csvHeader: "name" },
          { templateColumnTitle: "Name", csvHeader: "other" },
        ],
        "Duplicate entry",
      ],
      [
        "same csvHeader assigned twice",
        [
          { templateColumnTitle: "Name", csvHeader: "other" },
          { templateColumnTitle: "Email", csvHeader: "other" },
        ],
        "assigned to both",
      ],
      [
        "csvHeader colliding with an untouched proposed mapping",
        [{ templateColumnTitle: "Email", csvHeader: "name" }],
        "assigned to both",
      ],
    ])("bails and records metrics on %s", async (_label, corrections, text) => {
      const bail = mock(() => {});

      await runExecute({
        inputData: {
          ...reviseInput([makeMapping(0.5, "Name")]),
          startedAt: new Date().toISOString(),
          totalTemplateColumns: 2,
        },
        resumeData: { action: "revise", correctedMappings: corrections },
        bail,
      });

      expect(mockRecordMetrics).toHaveBeenCalledTimes(1);
      expect(bail).toHaveBeenCalledWith({
        reason: expect.stringContaining(text),
      });
    });

    it("returns approvedMappings from inputData on approve action", async () => {
      const mappings = [makeMapping(0.8), makeMapping(1, "Email")];

      const result = await runExecute({
        inputData: { mappingResults: mappings, _runMetrics: {} },
        resumeData: { action: "approve" },
      });

      expect(result).toEqual({
        approvedMappings: mappings,
        _runMetrics: {
          approveMappingHitl: { suspended: true, revisionCount: 0 },
        },
      });
      expect(result._runMetrics.approveMappingHitl).toEqual({
        suspended: true,
        revisionCount: 0,
      });
    });
  });
});
