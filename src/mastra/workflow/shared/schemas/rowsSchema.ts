import z from "zod";

export const rowSchema = z.array(z.string());

export const rowsSchema = z.array(rowSchema);

export type Row = z.infer<typeof rowSchema>;
export type Rows = z.infer<typeof rowsSchema>;
