import { describe, it, expect } from "bun:test";
import {
  getConfidentMappingResults,
  isMappingResultsFullyConfident,
} from "../utils";
import type { MappingResults } from "../../../shared/schemas/mappingSchema";

const makeMapping = (
  confidence: number,
  title = "Name",
): MappingResults[number] => ({
  templateColumn: { title, required: true },
  csvHeader: title.toLowerCase(),
  confidence,
});

describe("getConfidentMappingResults", () => {
  it("returns only mappings with confidence === 1", () => {
    const results = [makeMapping(1), makeMapping(0.8), makeMapping(1, "Email")];
    expect(getConfidentMappingResults(results)).toEqual([
      results[0],
      results[2],
    ]);
  });

  it("returns empty array when no mapping has confidence 1", () => {
    expect(
      getConfidentMappingResults([makeMapping(0), makeMapping(0.5)]),
    ).toEqual([]);
  });

  it("returns all mappings when all have confidence 1", () => {
    const results = [makeMapping(1), makeMapping(1, "Email")];
    expect(getConfidentMappingResults(results)).toEqual(results);
  });

  it("returns empty array for empty input", () => {
    expect(getConfidentMappingResults([])).toEqual([]);
  });
});

describe("isMappingResultsFullyConfident", () => {
  it("returns true when all mappings have confidence 1", () => {
    expect(
      isMappingResultsFullyConfident([makeMapping(1), makeMapping(1, "Email")]),
    ).toBe(true);
  });

  it("returns false when any mapping has confidence less than 1", () => {
    expect(
      isMappingResultsFullyConfident([makeMapping(1), makeMapping(0.9)]),
    ).toBe(false);
  });

  it("returns false when all mappings have confidence less than 1", () => {
    expect(
      isMappingResultsFullyConfident([makeMapping(0), makeMapping(0.5)]),
    ).toBe(false);
  });

  it("returns true for empty array", () => {
    expect(isMappingResultsFullyConfident([])).toBe(true);
  });

  it("returns true when only optional columns are unmapped", () => {
    const unmappedOptional: MappingResults[number] = {
      templateColumn: { title: "Phone", required: false },
      csvHeader: undefined,
      confidence: 0,
    };

    expect(
      isMappingResultsFullyConfident([makeMapping(1), unmappedOptional]),
    ).toBe(true);
  });

  it("returns false when a required column is unmapped", () => {
    const unmappedRequired: MappingResults[number] = {
      templateColumn: { title: "Phone", required: true },
      csvHeader: undefined,
      confidence: 0,
    };

    expect(
      isMappingResultsFullyConfident([makeMapping(1), unmappedRequired]),
    ).toBe(false);
  });

  it("returns false when an optional column is mapped with confidence below 1", () => {
    expect(
      isMappingResultsFullyConfident([
        makeMapping(1),
        {
          templateColumn: { title: "Phone", required: false },
          csvHeader: "tel",
          confidence: 0.7,
        },
      ]),
    ).toBe(false);
  });
});
