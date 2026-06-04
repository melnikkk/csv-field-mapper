import { MappingResults } from "../../shared/schemas/mappingSchema";

export const getConfidentMappingResults = (mappingResults: MappingResults) =>
  mappingResults.filter(({ confidence }) => confidence === 1);

export const isMappingResultsFullyConfident = (
  mappingResults: MappingResults,
) => {
  const confidentMappingResults = getConfidentMappingResults(mappingResults);

  return confidentMappingResults.length === mappingResults.length;
};
