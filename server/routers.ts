import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { scrapeUrl } from "./scraper";
import { generateExcel, generateCSV } from "./export";

/**
 * Background processor for scraping jobs
 */
async function processScraping(jobId: number) {
  try {
    // Update job status to processing
    await db.updateScrapingJobStatus(jobId, "processing");

    // Get all pages for this job
    const pages = await db.getJobPages(jobId);

    let completedCount = 0;
    let failedCount = 0;

    // Process each page
    for (const page of pages) {
      try {
        // Update page status to scraping
        await db.updateScrapedPage(page.id, { status: "scraping" });

        // Scrape the URL
        const { pageTitle, content } = await scrapeUrl(page.url);

        // Update page with title and status
        await db.updateScrapedPage(page.id, {
          pageTitle,
          status: "completed",
        });

        // Save content sections
        for (const section of content) {
          await db.createContentSection(page.id, {
            sectionType: section.sectionType,
            sectionTitle: section.sectionTitle,
            content: section.content,
            orderIndex: section.orderIndex,
            charCount: section.charCount,
          });
        }

        completedCount++;
      } catch (error) {
        console.error(`Error scraping ${page.url}:`, error);
        await db.updateScrapedPage(page.id, {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
        failedCount++;
      }
    }

    // Update job status to completed
    await db.updateScrapingJobStatus(jobId, "completed", completedCount, failedCount);
  } catch (error) {
    console.error(`Fatal error processing job ${jobId}:`, error);
    await db.updateScrapingJobStatus(jobId, "failed");
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  scraping: router({
    // Start a new scraping job
    startJob: publicProcedure
      .input(z.object({
        urls: z.array(z.string().url()),
        scrapingMode: z.enum(["main", "header", "footer"]).default("main")
      }))
      .mutation(async ({ input }) => {
        const { urls, scrapingMode } = input;
        const userId = 1; // Default user ID since auth is removed

        // Create scraping job
        const jobId = await db.createScrapingJob(userId, urls.length, scrapingMode);

        // Create page entries
        for (const url of urls) {
          await db.createScrapedPage(jobId, url);
        }

        // Start scraping in background
        processScraping(jobId).catch((error) => {
          console.error(`Error processing job ${jobId}:`, error);
        });

        return { jobId };
      }),

    // Get job status and content
    getJob: publicProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input }) => {
        const job = await db.getScrapingJob(input.jobId);
        if (!job) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });
        }

        const pagesWithContent = await db.getJobContent(input.jobId);
        return { job, pages: pagesWithContent };
      }),

    // Get all jobs for current user
    listJobs: publicProcedure.query(async () => {
      const userId = 1; // Default user ID since auth is removed
      const jobs = await db.getUserScrapingJobs(userId);

      // Ensure timestamps are numbers (SQLite returns them as is, which should work)
      // But let's make sure they're properly formatted
      return jobs.map(job => ({
        ...job,
        createdAt: typeof job.createdAt === 'number' ? job.createdAt : new Date(job.createdAt).getTime(),
        updatedAt: typeof job.updatedAt === 'number' ? job.updatedAt : new Date(job.updatedAt).getTime(),
      }));
    }),

    // Delete a job
    deleteJob: publicProcedure
      .input(z.object({ jobId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteScrapingJob(input.jobId);
        return { success: true };
      }),

    // Update content section
    updateSection: publicProcedure
      .input(
        z.object({
          sectionId: z.number(),
          content: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const { sectionId, content } = input;
        const charCount = content.length;
        await db.updateContentSection(sectionId, content, charCount);
        return { success: true };
      }),

    // Export to Excel
    exportExcel: publicProcedure
      .input(z.object({ jobId: z.number() }))
      .mutation(async ({ input }) => {
        const job = await db.getScrapingJob(input.jobId);
        if (!job) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });
        }

        const buffer = await generateExcel(input.jobId);
        const base64 = buffer.toString('base64');
        return { data: base64, filename: `scrape-job-${input.jobId}.xlsx` };
      }),

    // Export to CSV
    exportCSV: publicProcedure
      .input(z.object({ jobId: z.number() }))
      .mutation(async ({ input }) => {
        const job = await db.getScrapingJob(input.jobId);
        if (!job) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });
        }

        const csvContent = await generateCSV(input.jobId);
        return { data: csvContent, filename: `scrape-job-${input.jobId}.csv` };
      }),
  }),
});

export type AppRouter = typeof appRouter;
