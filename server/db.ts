import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import bcrypt from "bcryptjs";

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

/**
 * Create a new user with hashed password
 */
export async function createUser(
  username: string,
  password: string,
  options?: {
    name?: string;
    email?: string;
    role?: "user" | "admin";
  }
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  const values: InsertUser = {
    username,
    password: hashedPassword,
    name: options?.name,
    email: options?.email,
    role: options?.role || "user",
  };

  await db.insert(users).values(values);
}

/**
 * Authenticate user with username and password
 */
export async function authenticateUser(
  username: string,
  password: string
): Promise<{ id: number; username: string; name: string | null; email: string | null; role: "user" | "admin" } | null> {
  const db = await getDb();
  if (!db) {
    return null;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const user = result[0];

  // Verify password
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return null;
  }

  // Update last signed in
  await db
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, user.id));

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

/**
 * Get user by ID
 */
export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get user by username
 */
export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Check if any users exist (for initial setup)
 */
export async function hasAnyUsers(): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return false;
  }

  const result = await db.select().from(users).limit(1);
  return result.length > 0;
}

// Scraping-related database functions
import { scrapingJobs, scrapedPages, contentSections } from "../drizzle/schema";
import { desc } from "drizzle-orm";

/**
 * Create a new scraping job
 */
export async function createScrapingJob(userId: number, totalUrls: number): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.insert(scrapingJobs).values({
    userId,
    totalUrls,
    status: "pending",
  });

  return Number(result[0].insertId);
}

/**
 * Update scraping job status
 */
export async function updateScrapingJobStatus(
  jobId: number,
  status: "pending" | "processing" | "completed" | "failed",
  completedUrls?: number,
  failedUrls?: number
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const updateData: any = { status };
  if (completedUrls !== undefined) updateData.completedUrls = completedUrls;
  if (failedUrls !== undefined) updateData.failedUrls = failedUrls;

  await db.update(scrapingJobs).set(updateData).where(eq(scrapingJobs.id, jobId));
}

/**
 * Get scraping job by ID
 */
export async function getScrapingJob(jobId: number) {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const result = await db
    .select()
    .from(scrapingJobs)
    .where(eq(scrapingJobs.id, jobId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get all scraping jobs for a user
 */
export async function getUserScrapingJobs(userId: number) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db
    .select()
    .from(scrapingJobs)
    .where(eq(scrapingJobs.userId, userId))
    .orderBy(desc(scrapingJobs.createdAt));
}

/**
 * Create a scraped page entry
 */
export async function createScrapedPage(jobId: number, url: string): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.insert(scrapedPages).values({
    jobId,
    url,
    status: "pending",
  });

  return Number(result[0].insertId);
}

/**
 * Update scraped page
 */
export async function updateScrapedPage(
  pageId: number,
  data: {
    status?: "pending" | "scraping" | "completed" | "failed";
    pageTitle?: string;
    errorMessage?: string;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.update(scrapedPages).set(data).where(eq(scrapedPages.id, pageId));
}

/**
 * Get all pages for a job
 */
export async function getJobPages(jobId: number) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db.select().from(scrapedPages).where(eq(scrapedPages.jobId, jobId));
}

/**
 * Create a content section
 */
export async function createContentSection(
  pageId: number,
  data: {
    sectionType: string;
    sectionTitle: string | null;
    content: string;
    orderIndex: number;
    charCount: number;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.insert(contentSections).values({
    pageId,
    ...data,
  });
}

/**
 * Get job content (pages with their content sections)
 */
export async function getJobContent(jobId: number) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const pages = await db.select().from(scrapedPages).where(eq(scrapedPages.jobId, jobId));

  const pagesWithContent = await Promise.all(
    pages.map(async (page) => {
      const sections = await db
        .select()
        .from(contentSections)
        .where(eq(contentSections.pageId, page.id));

      return {
        ...page,
        content: sections,
      };
    })
  );

  return pagesWithContent;
}

/**
 * Update content section
 */
export async function updateContentSection(
  sectionId: number,
  content: string,
  charCount: number
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.update(contentSections).set({ content, charCount }).where(eq(contentSections.id, sectionId));
}
