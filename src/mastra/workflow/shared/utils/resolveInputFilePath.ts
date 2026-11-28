import { realpath } from "fs/promises";
import { isAbsolute, relative, resolve } from "path";

export const DEFAULT_INPUT_DIR = "samples";

export const getInputDirPath = (): string =>
  resolve(process.env.INPUT_DIR || DEFAULT_INPUT_DIR);

export const resolveInputFilePath = async (
  filePath: string,
): Promise<string | undefined> => {
  try {
    const [realInputDir, realFilePath] = await Promise.all([
      realpath(getInputDirPath()),
      realpath(resolve(filePath)),
    ]);
    const relativePath = relative(realInputDir, realFilePath);

    return relativePath === "" ||
      relativePath.startsWith("..") ||
      isAbsolute(relativePath)
      ? undefined
      : realFilePath;
  } catch {
    return undefined;
  }
};
