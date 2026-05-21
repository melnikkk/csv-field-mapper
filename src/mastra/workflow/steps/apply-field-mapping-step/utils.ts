import { dirname, basename, extname, join } from "path";

export const generateOutputFilePath = (filePath: string) => {
  const dir = dirname(filePath).replace("samples", "outputs");
  const ext = extname(filePath);
  const name = basename(filePath, ext);

  return join(dir, `${name}-mapped${ext}`);
};
