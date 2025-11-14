import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, scrapingJobs, scrapedPages, contentSections, InsertContentSection } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Scraping job queries
export async function createScrapingJob(userId: number, totalUrls: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(scrapingJobs).values({
    userId,
    totalUrls,
  });
  return result[0].insertId;
}

export async function getScrapingJob(jobId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(scrapingJobs).where(eq(scrapingJobs.id, jobId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateScrapingJobStatus(jobId: number, status: "pending" | "processing" | "completed" | "failed", completedUrls?: number, failedUrls?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: any = { status };
  if (completedUrls !== undefined) updateData.completedUrls = completedUrls;
  if (failedUrls !== undefined) updateData.failedUrls = failedUrls;
  
  await db.update(scrapingJobs).set(updateData).where(eq(scrapingJobs.id, jobId));
}

export async function getUserScrapingJobs(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(scrapingJobs).where(eq(scrapingJobs.userId, userId)).orderBy(scrapingJobs.createdAt);
}

// Scraped page queries
export async function createScrapedPage(jobId: number, url: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(scrapedPages).values({
    jobId,
    url,
  });
  return result[0].insertId;
}

export async function getScrapedPage(pageId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(scrapedPages).where(eq(scrapedPages.id, pageId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateScrapedPage(pageId: number, data: { pageTitle?: string; status?: "pending" | "scraping" | "completed" | "failed"; errorMessage?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(scrapedPages).set(data).where(eq(scrapedPages.id, pageId));
}

export async function getJobPages(jobId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(scrapedPages).where(eq(scrapedPages.jobId, jobId));
}

// Content section queries
export async function createContentSection(pageId: number, section: Omit<InsertContentSection, "pageId" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(contentSections).values({
    pageId,
    ...section,
  });
  return result[0].insertId;
}

export async function getPageSections(pageId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(contentSections).where(eq(contentSections.pageId, pageId)).orderBy(contentSections.orderIndex);
}

export async function updateContentSection(sectionId: number, content: string, charCount: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(contentSections).set({ content, charCount }).where(eq(contentSections.id, sectionId));
}

export async function getJobContent(jobId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get all pages for this job with their sections
  const pages = await db.select().from(scrapedPages).where(eq(scrapedPages.jobId, jobId));
  
  const pagesWithContent = await Promise.all(
    pages.map(async (page) => {
      const sections = await getPageSections(page.id);
      return { ...page, sections };
    })
  );
  
  return pagesWithContent;
}
