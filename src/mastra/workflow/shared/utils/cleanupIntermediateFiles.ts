import { rm } from "fs/promises";

export const cleanupIntermediateFiles = async (
  paths: Array<string | undefined>,
): Promise<void> => {
  await Promise.all(
    paths.flatMap((path) => (path ? [rm(path, { force: true })] : [])),
  );
};
