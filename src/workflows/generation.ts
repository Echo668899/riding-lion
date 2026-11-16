import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { getJob } from "../lib/db";
import { isMockGeneration } from "../lib/fal";
import {
  completeMockGeneration,
  markJob,
  pollFalUntilDone,
  submitOrResumeFal,
} from "../lib/generation";

export type GenerationParams = {
  jobId: string;
  baseUrl: string;
};

export class GenerationWorkflow extends WorkflowEntrypoint<Env, GenerationParams> {
  async run(event: WorkflowEvent<GenerationParams>, step: WorkflowStep) {
    const { jobId, baseUrl } = event.payload;

    await step.do("submit-or-resume", async () => {
      const job = await getJob(this.env.DB, jobId);
      if (!job) throw new Error("job missing");
      if (["succeeded", "failed", "storage_failed"].includes(job.status)) {
        return { skipped: true, status: job.status };
      }
      await markJob(this.env.DB, jobId, {
        workflow_instance_id: event.instanceId,
      });
      await submitOrResumeFal(this.env, baseUrl, jobId);
      return { ok: true };
    });

    if (isMockGeneration(this.env)) {
      await step.sleep("mock-delay", "15 seconds");
      await step.do("mock-complete", async () => {
        await completeMockGeneration(this.env, jobId);
        return { ok: true };
      });
      return { jobId, mode: "mock" };
    }

    // Poll with sleeps so work survives page close
    for (let i = 0; i < 120; i++) {
      const done = await step.do(`poll-${i}`, async () => {
        const job = await getJob(this.env.DB, jobId);
        if (!job) return { done: true, status: "missing" };
        if (["succeeded", "failed", "storage_failed"].includes(job.status)) {
          return { done: true, status: job.status };
        }
        const updated = await pollFalUntilDone(this.env, jobId, 1);
        const finished = ["succeeded", "failed", "storage_failed"].includes(updated.status);
        return { done: finished, status: updated.status };
      });
      if (done.done) return { jobId, status: done.status };
      await step.sleep(`wait-${i}`, "5 seconds");
    }

    await step.do("timeout", async () => {
      const job = await getJob(this.env.DB, jobId);
      if (job && !["succeeded", "failed", "storage_failed"].includes(job.status)) {
        await markJob(this.env.DB, jobId, {
          status: "failed",
          error_code: "generation_timeout",
          error_message: "Generation took too long. You can request a refund.",
        });
      }
      return { ok: true };
    });

    return { jobId, status: "timeout" };
  }
}
