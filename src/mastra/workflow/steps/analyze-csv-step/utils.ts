export const findDuplicateHeaders = (
  headerRow: ReadonlyArray<string>,
): Array<string> => {
  const seen = new Set<string>();
  const duplicates = new Map<string, string>();

  for (const header of headerRow) {
    const name = header.trim();
    const key = name.toLowerCase();

    if (seen.has(key)) {
      duplicates.set(key, duplicates.get(key) ?? name);
    }

    seen.add(key);
  }

  return [...duplicates.values()];
};
