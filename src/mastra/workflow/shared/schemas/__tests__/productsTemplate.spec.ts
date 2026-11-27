import { describe, expect, it } from "bun:test";
import { readFile } from "fs/promises";
import { join } from "path";
import { templateSchema } from "../templateSchema";

const PRODUCTS_TEMPLATE_PATH = join(
  import.meta.dir,
  "../../../../../../samples/templates/products.json",
);

describe("samples/templates/products.json", () => {
  it("conforms to templateSchema", async () => {
    const raw: unknown = JSON.parse(
      await readFile(PRODUCTS_TEMPLATE_PATH, "utf-8"),
    );

    const result = templateSchema.safeParse(raw);

    expect(result.success).toBe(true);
  });

  it("defines the expected columns and aliases for each of them", async () => {
    const template = templateSchema.parse(
      JSON.parse(await readFile(PRODUCTS_TEMPLATE_PATH, "utf-8")),
    );
    const titles = template.columns.map((column) => column.title);

    expect(titles).toEqual(["name", "price", "sku", "quantity", "currency"]);
    expect(Object.keys(template.aliasDictionary ?? {})).toEqual(titles);
  });
});
