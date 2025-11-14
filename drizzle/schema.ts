import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Username for login (unique) */
  username: varchar("username", { length: 64 }).notNull().unique(),
  /** Hashed password */
  password: varchar("password", { length: 255 }).notNull(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Scraping jobs table - tracks each scraping session
 */
export const scrapingJobs = mysqlTable("scraping_jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  totalUrls: int("total_urls").notNull(),
  completedUrls: int("completed_urls").default(0).notNull(),
  failedUrls: int("failed_urls").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ScrapingJob = typeof scrapingJobs.$inferSelect;
export type InsertScrapingJob = typeof scrapingJobs.$inferInsert;

/**
 * Scraped pages table - stores content from each URL
 */
export const scrapedPages = mysqlTable("scraped_pages", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("job_id").notNull(),
  url: text("url").notNull(),
  pageTitle: text("page_title"),
  status: mysqlEnum("status", ["pending", "scraping", "completed", "failed"]).default("pending").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ScrapedPage = typeof scrapedPages.$inferSelect;
export type InsertScrapedPage = typeof scrapedPages.$inferInsert;

/**
 * Content sections table - stores extracted text organized by sections
 */
export const contentSections = mysqlTable("content_sections", {
  id: int("id").autoincrement().primaryKey(),
  pageId: int("page_id").notNull(),
  sectionType: varchar("section_type", { length: 50 }).notNull(), // h1, h2, h3, p, etc.
  sectionTitle: text("section_title"),
  content: text("content").notNull(),
  orderIndex: int("order_index").notNull(),
  charCount: int("char_count").notNull(),
  context: text("context"), // additional context for translators
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ContentSection = typeof contentSections.$inferSelect;
export type InsertContentSection = typeof contentSections.$inferInsert;