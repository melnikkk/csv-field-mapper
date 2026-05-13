import { describe, expect, it } from "bun:test";
import { buildFieldMappingPrompt } from "../prompts";

describe("buildFieldMappingPrompt", () => {
  it("includes each CSV header in the prompt", () => {
    const prompt = buildFieldMappingPrompt(
      [{ header: "first_name", samples: [] }],
      [{ title: "Name", required: true }],
    );

    expect(prompt).toContain('"first_name"');
  });

  it("includes sample values in parentheses when present", () => {
    const prompt = buildFieldMappingPrompt(
      [{ header: "first_name", samples: ["Alice", "Bob"] }],
      [{ title: "Name", required: true }],
    );

    expect(prompt).toContain('(samples: "Alice", "Bob")');
  });

  it("omits samples section when samples are empty", () => {
    const prompt = buildFieldMappingPrompt(
      [{ header: "first_name", samples: [] }],
      [{ title: "Name", required: true }],
    );

    expect(prompt).not.toContain("samples:");
  });

  it("includes template column titles", () => {
    const prompt = buildFieldMappingPrompt(
      [{ header: "col", samples: [] }],
      [
        { title: "Name", required: true },
        { title: "Email", required: false },
      ],
    );

    expect(prompt).toContain("Name");
    expect(prompt).toContain("Email");
  });

  it("marks required columns with (required)", () => {
    const prompt = buildFieldMappingPrompt(
      [{ header: "col", samples: [] }],
      [{ title: "Name", required: true }],
    );

    expect(prompt).toContain("Name (required)");
  });

  it("does not mark optional columns with (required)", () => {
    const prompt = buildFieldMappingPrompt(
      [{ header: "col", samples: [] }],
      [{ title: "Email", required: false }],
    );

    expect(prompt).toContain("Email");
    expect(prompt).not.toContain("Email (required)");
  });

  it("includes instruction to set templateColumn null for low-confidence matches", () => {
    const prompt = buildFieldMappingPrompt([], []);

    expect(prompt).toContain("null");
  });
});
