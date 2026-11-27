import { readFile } from "fs/promises";
import { resolve } from "path";
import { mastra } from "../src/mastra";
import { templateSchema } from "../src/mastra/workflow/shared/schemas/templateSchema";
import type { WorkflowInputData } from "../src/mastra/workflow/shared/schemas/workflowInputSchema";

const SAMPLE_CSV_PATH = resolve(import.meta.dir, "../samples/products.csv");
const TEMPLATE_PATH = resolve(
  import.meta.dir,
  "../samples/templates/products.json",
);
const MAX_RESUMES = 5;

const print = (label: string, value: unknown): void => {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(value, null, 2));
};

const main = async (): Promise<void> => {
  const template = templateSchema.parse(
    JSON.parse(await readFile(TEMPLATE_PATH, "utf-8")),
  );
  const inputData: Omit<WorkflowInputData, "startedAt"> = {
    filePath: SAMPLE_CSV_PATH,
    template,
  };

  const workflow = mastra.getWorkflow("csvFieldMapperWorkflow");
  const run = await workflow.createRun();

  let result = await run.start({ inputData: inputData as WorkflowInputData });

  for (let resumes = 0; result.status === "suspended"; resumes++) {
    if (resumes >= MAX_RESUMES) {
      throw new Error(`Still suspended after ${MAX_RESUMES} resumes`);
    }

    const [stepPath] = result.suspended;
    const stepId = stepPath[stepPath.length - 1];
    print(`Suspended at ${stepId}`, result.steps[stepId]?.suspendPayload);

    result = await run.resume({
      step: stepId,
      resumeData: { action: "approve" },
    });
  }

  print(
    `Final status: ${result.status}`,
    result.status === "success" ? result.result : result,
  );

  if (result.status !== "success") {
    process.exitCode = 1;
  }
};

await main();
