import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: text("openId").unique(),
  /** Username for login (optional for OAuth users) */
  username: text("username").unique(),
  /** Hashed password (optional for OAuth users) */
  password: text("password"),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).defaultNow().notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).defaultNow().notNull(),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp" }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Scraping jobs table - tracks each scraping session
 */
export const scrapingJobs = sqliteTable("scraping_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  status: text("status", { enum: ["pending", "processing", "completed", "failed"] }).default("pending").notNull(),
  totalUrls: integer("total_urls").notNull(),
  completedUrls: integer("completed_urls").default(0).notNull(),
  scrapingMode: text("scraping_mode", { enum: ["main", "header", "footer"] }).default("main").notNull(),
  failedUrls: integer("failed_urls").default(0).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).defaultNow().notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).defaultNow().notNull(),
});

export type ScrapingJob = typeof scrapingJobs.$inferSelect;
export type InsertScrapingJob = typeof scrapingJobs.$inferInsert;

/**
 * Scraped pages table - stores content from each URL
 */
export const scrapedPages = sqliteTable("scraped_pages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").notNull(),
  url: text("url").notNull(),
  pageTitle: text("page_title"),
  status: text("status", { enum: ["pending", "scraping", "completed", "failed"] }).default("pending").notNull(),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp" }).defaultNow().notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).defaultNow().notNull(),
});

export type ScrapedPage = typeof scrapedPages.$inferSelect;
export type InsertScrapedPage = typeof scrapedPages.$inferInsert;

/**
 * Content sections table - stores extracted text organized by sections
 */
export const contentSections = sqliteTable("content_sections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pageId: integer("page_id").notNull(),
  sectionType: text("section_type").notNull(), // h1, h2, h3, p, etc.
  sectionTitle: text("section_title"),
  content: text("content").notNull(),
  orderIndex: integer("order_index").notNull(),
  charCount: integer("char_count").notNull(),
  context: text("context"), // additional context for translators
  createdAt: integer("created_at", { mode: "timestamp" }).defaultNow().notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).defaultNow().notNull(),
});

export type ContentSection = typeof contentSections.$inferSelect;
export type InsertContentSection = typeof contentSections.$inferInsert;