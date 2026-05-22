import z from "zod";

export const validatorRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("required") }),
  z.object({ type: z.literal("minLength"), min: z.number() }),
  z.object({ type: z.literal("maxLength"), max: z.number() }),
  z.object({
    type: z.literal("regex"),
    pattern: z.string(),
    message: z.string().optional(),
  }),
  z.object({
    type: z.literal("numeric"),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  z.object({ type: z.literal("integer") }),
  z.object({ type: z.literal("date"), format: z.string().optional() }),
  z.object({ type: z.literal("boolean") }),
  z.object({
    type: z.literal("enum"),
    values: z.array(z.string()),
    caseSensitive: z.boolean().optional(),
  }),
  z.object({ type: z.literal("email") }),
  z.object({ type: z.literal("url") }),
]);

export const fixerStrategySchema = z.enum([
  "trim",
  "trimAndLower",
  "trimAndUpper",
  "normalizeWhitespace",
  "stripNonNumeric",
]);

export const templateColumnSchema = z.object({
  title: z.string(),
  required: z.boolean(),
  description: z.string().optional(),
  validators: z.array(validatorRuleSchema).optional(),
  fixerStrategy: fixerStrategySchema.optional(),
});

export const templateColumnsSchema = z.array(templateColumnSchema);

export const aliasDictionarySchema = z.record(
  z.string(),
  z.array(z.string().nonempty()),
);

export const templateSchema = z.object({
  maxFileSize: z.number().positive(),
  columns: z.array(templateColumnSchema),
  aliasDictionary: aliasDictionarySchema.optional(),
});

export type ValidatorRule = z.infer<typeof validatorRuleSchema>;
export type FixerStrategy = z.infer<typeof fixerStrategySchema>;
export type TemplateColumn = z.infer<typeof templateColumnSchema>;
export type TemplateColumns = z.infer<typeof templateColumnsSchema>;
export type AliasDictionary = z.infer<typeof aliasDictionarySchema>;
export type Template = z.infer<typeof templateSchema>;
