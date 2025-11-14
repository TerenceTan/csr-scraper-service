CREATE TABLE `content_sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`page_id` int NOT NULL,
	`section_type` varchar(50) NOT NULL,
	`section_title` text,
	`content` text NOT NULL,
	`order_index` int NOT NULL,
	`char_count` int NOT NULL,
	`context` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_sections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scraped_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`job_id` int NOT NULL,
	`url` text NOT NULL,
	`page_title` text,
	`status` enum('pending','scraping','completed','failed') NOT NULL DEFAULT 'pending',
	`error_message` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scraped_pages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scraping_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`total_urls` int NOT NULL,
	`completed_urls` int NOT NULL DEFAULT 0,
	`failed_urls` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scraping_jobs_id` PRIMARY KEY(`id`)
);
