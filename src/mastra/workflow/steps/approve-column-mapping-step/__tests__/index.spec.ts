import { describe, it, expect, mock } from "bun:test";
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
        inputData: { mappingResults: [makeMapping(0.8)] },
        resumeData: { action: "abort" },
        bail,
      });

      expect(bail).toHaveBeenCalledWith({
        outputFilePath: undefined,
        reason: expect.any(String),
      });
    });

    it("returns correctedMappings directly on revise action without re-suspending", async () => {
      const original = [makeMapping(0.8)];
      const corrected = [makeMapping(1), makeMapping(1, "Email")];
      const suspend = mock(() => {});

      const result = await runExecute({
        inputData: { mappingResults: original, _runMetrics: {} },
        resumeData: { action: "revise", correctedMappings: corrected },
        suspend,
      });

      expect(suspend).not.toHaveBeenCalled();
      expect(result).toEqual({
        approvedMappings: corrected,
        _runMetrics: {
          approveMappingHitl: { suspended: true, revisionCount: 1 },
        },
      });
      expect(result._runMetrics.approveMappingHitl).toEqual({
        suspended: true,
        revisionCount: 1,
      });
    });

    it("does not return the original proposal when revise provides corrections", async () => {
      const original = [makeMapping(0.5, "Name")];
      const corrected = [makeMapping(1, "FullName")];

      const result = await runExecute({
        inputData: { mappingResults: original, _runMetrics: {} },
        resumeData: { action: "revise", correctedMappings: corrected },
      });

      expect(result.approvedMappings).not.toEqual(original);
      expect(result.approvedMappings).toEqual(corrected);
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
