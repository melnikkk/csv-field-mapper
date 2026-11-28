export const CELL_FIX_BATCH_SIZE = 100;
export const DEFAULT_CELL_FIX_MAX_CELLS = 500;

export const getCellFixMaxCells = (): number => {
  const parsed = Number(process.env.CELL_FIX_MAX_CELLS);
  return process.env.CELL_FIX_MAX_CELLS !== undefined &&
    Number.isInteger(parsed) &&
    parsed >= 0
    ? parsed
    : DEFAULT_CELL_FIX_MAX_CELLS;
};
