import { join } from "path";

export const getOutputsDirPath = (): string =>
  join(import.meta.dirname, "../..", "outputs");
