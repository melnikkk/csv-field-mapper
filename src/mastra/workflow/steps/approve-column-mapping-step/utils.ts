import { MappingResults } from "../../shared/schemas/mappingSchema";

export const getConfidentMappingResults = (mappingResults: MappingResults) =>
  mappingResults.filter(({ confidence }) => confidence === 1);

export const isMappingResultsFullyConfident = (
  mappingResults: MappingResults,
) =>
  mappingResults.every(({ csvHeader, confidence, templateColumn }) =>
    csvHeader === undefined ? !templateColumn.required : confidence === 1,
  );
