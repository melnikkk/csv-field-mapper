import z from "zod";

export const templateColumnSchema = z.object({
  title: z.string(),
  required: z.boolean(),
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

export type TemplateColumns = z.infer<typeof templateColumnsSchema>;
export type AliasDictionary = z.infer<typeof aliasDictionarySchema>;
export type Template = z.infer<typeof templateSchema>;
