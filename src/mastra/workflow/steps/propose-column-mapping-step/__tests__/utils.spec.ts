import { describe, expect, it } from "bun:test";
import {
  mapColumnsBasedOnDictionary,
  getUnmappedTemplateColumnTitles,
  getUnresolvedCsvHeadersWithSamples,
} from "../utils";

describe("mapColumnsBasedOnDictionary", () => {
  const templateColumns = [
    { title: "First Name", required: true },
    { title: "Last Name", required: true },
    { title: "Email", required: false },
  ];

  it("returns all unmapped when no alias dictionary provided", () => {
    const result = mapColumnsBasedOnDictionary(
      ["first_name", "last_name", "email"],
      templateColumns,
      undefined,
    );

    expect(result).toHaveLength(3);
    result.forEach((r) => {
      expect(r.csvHeader).toBeUndefined();
      expect(r.confidence).toBe(0);
    });
  });

  it("maps header when alias matches exactly", () => {
    const result = mapColumnsBasedOnDictionary(
      ["first_name", "surname", "email_address"],
      templateColumns,
      { "First Name": ["first_name"], "Last Name": ["surname"] },
    );

    expect(
      result.find((r) => r.templateColumn.title === "First Name"),
    ).toMatchObject({
      csvHeader: "first_name",
      confidence: 1,
    });
    expect(
      result.find((r) => r.templateColumn.title === "Last Name"),
    ).toMatchObject({
      csvHeader: "surname",
      confidence: 1,
    });
  });

  it("matches alias case-insensitively", () => {
    const result = mapColumnsBasedOnDictionary(
      ["FIRST_NAME"],
      [{ title: "First Name", required: true }],
      { "First Name": ["first_name"] },
    );

    expect(result[0].csvHeader).toBe("FIRST_NAME");
    expect(result[0].confidence).toBe(1);
  });

  it("returns confidence 0 when alias dictionary has no entry for a column", () => {
    const result = mapColumnsBasedOnDictionary(
      ["email"],
      [{ title: "Email", required: false }],
      { "First Name": ["first_name"] },
    );

    expect(result[0].csvHeader).toBeUndefined();
    expect(result[0].confidence).toBe(0);
  });
});

describe("getUnmappedColumnTitles", () => {
  it("returns titles of columns with confidence 0", () => {
    const mappingResults = [
      {
        templateColumn: { title: "Name", required: true },
        csvHeader: "name",
        confidence: 1,
      },
      {
        templateColumn: { title: "Email", required: false },
        csvHeader: undefined,
        confidence: 0,
      },
      {
        templateColumn: { title: "Phone", required: false },
        csvHeader: undefined,
        confidence: 0,
      },
    ];

    expect(getUnmappedTemplateColumnTitles(mappingResults)).toEqual([
      "Email",
      "Phone",
    ]);
  });

  it("returns empty array when all columns are mapped", () => {
    const mappingResults = [
      {
        templateColumn: { title: "Name", required: true },
        csvHeader: "name",
        confidence: 1,
      },
    ];

    expect(getUnmappedTemplateColumnTitles(mappingResults)).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(getUnmappedTemplateColumnTitles([])).toEqual([]);
  });
});

describe("getUnresolvedCsvHeadersWithSamples", () => {
  it("returns headers not already mapped", () => {
    const headerRow = ["name", "email", "extra_column"];
    const mappingResults = [
      {
        templateColumn: { title: "Name", required: true },
        csvHeader: "name",
        confidence: 1,
      },
      {
        templateColumn: { title: "Email", required: false },
        csvHeader: undefined,
        confidence: 0,
      },
    ];
    const sampleRows = [["Alice", "alice@example.com", "foo"]];

    const result = getUnresolvedCsvHeadersWithSamples(
      headerRow,
      mappingResults,
      sampleRows,
    );

    expect(result.map((r) => r.header)).toEqual(["email", "extra_column"]);
  });

  it("includes up to 3 sample values per header", () => {
    const headerRow = ["col"];
    const mappingResults = [
      {
        templateColumn: { title: "X", required: false },
        csvHeader: undefined,
        confidence: 0,
      },
    ];
    const sampleRows = [["a"], ["b"], ["c"], ["d"]];

    const result = getUnresolvedCsvHeadersWithSamples(
      headerRow,
      mappingResults,
      sampleRows,
    );

    expect(result[0].samples).toEqual(["a", "b", "c"]);
  });

  it("filters out empty sample values", () => {
    const headerRow = ["col"];
    const mappingResults = [
      {
        templateColumn: { title: "X", required: false },
        csvHeader: undefined,
        confidence: 0,
      },
    ];
    const sampleRows = [["a"], [""], ["c"]];

    const result = getUnresolvedCsvHeadersWithSamples(
      headerRow,
      mappingResults,
      sampleRows,
    );

    expect(result[0].samples).toEqual(["a", "c"]);
  });

  it("excludes already-mapped headers case-insensitively", () => {
    const headerRow = ["Name", "Email"];
    const mappingResults = [
      {
        templateColumn: { title: "Name", required: true },
        csvHeader: "name",
        confidence: 1,
      },
    ];
    const sampleRows = [["Alice", "alice@example.com"]];

    const result = getUnresolvedCsvHeadersWithSamples(
      headerRow,
      mappingResults,
      sampleRows,
    );

    const headers = result.map((r) => r.header);
    expect(headers).not.toContain("Name");
    expect(headers).toContain("Email");
  });

  it("returns empty array when all headers are resolved", () => {
    const headerRow = ["name"];
    const mappingResults = [
      {
        templateColumn: { title: "Name", required: true },
        csvHeader: "name",
        confidence: 1,
      },
    ];

    const result = getUnresolvedCsvHeadersWithSamples(
      headerRow,
      mappingResults,
      [],
    );

    expect(result).toEqual([]);
  });
});
