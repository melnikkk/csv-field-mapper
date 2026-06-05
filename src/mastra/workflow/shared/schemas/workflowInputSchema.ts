import { z } from "zod";
import { templateSchema } from "./templateSchema";

export const workflowInputDataSchema = z.object({
  filePath: z.string().nonempty(),
  template: templateSchema,
  startedAt: z.string(),
});

export type WorkflowInputData = z.infer<typeof workflowInputDataSchema>;
