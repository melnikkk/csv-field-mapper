import { statSync } from "fs";
import { realpath } from "fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "path";

export const DEFAULT_INPUT_DIR = "samples";

const hasSamplesDir = (dir: string): boolean => {
  try {
    return statSync(join(dir, DEFAULT_INPUT_DIR)).isDirectory();
  } catch {
    return false;
  }
};

export const getProjectRoot = (): string => {
  const cwd = process.cwd();

  for (let dir = cwd; ; dir = dirname(dir)) {
    if (hasSamplesDir(dir)) {
      return dir;
    }

    if (dirname(dir) === dir) {
      return cwd;
    }
  }
};

export const getInputDirPath = (): string =>
  resolve(getProjectRoot(), process.env.INPUT_DIR || DEFAULT_INPUT_DIR);

export const resolveInputFilePath = async (
  filePath: string,
): Promise<string | undefined> => {
  try {
    const [realInputDir, realFilePath] = await Promise.all([
      realpath(getInputDirPath()),
      realpath(resolve(getProjectRoot(), filePath)),
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
