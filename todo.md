# CSR Scraper Project TODO

## Backend Features
- [x] Set up database schema for scraping jobs and extracted content
- [x] Install Playwright for headless browser scraping
- [x] Implement scraping engine to extract visible text from CSR pages
- [x] Create API endpoint to start scraping jobs
- [x] Create API endpoint to get scraping job status and content
- [x] Create API endpoint to update extracted content after user edits
- [x] Implement Excel (.xlsx) export with multi-sheet structure (one sheet per URL)
- [x] Implement CSV export with all content in single file
- [x] Create API endpoint for exporting content

## Frontend Features
- [x] Design and implement URL input interface
- [x] Implement scraping progress tracking display
- [x] Build content review and editing interface
- [x] Implement section-based content organization display
- [x] Add export buttons for CSV and Excel formats
- [x] Implement file download functionality

## Testing & Refinement
- [x] Test scraping with ContentStack-based website
- [x] Test scraping with various CSR websites
- [x] Test Excel export with multiple URLs
- [x] Test CSV export functionality
- [x] Test content editing and re-export
- [x] Verify export file structure matches translation workflow requirements

## Bug Fixes
- [x] Debug and fix scraping failures reported by user
- [x] Add better error logging for troubleshooting
- [x] Test with real URLs to ensure scraping works correctly

## Production Deployment - Hybrid Approach
- [x] Create standalone scraping microservice for VPS
- [x] Create Dockerfile for scraping service
- [x] Create API endpoint for scraping
- [x] Update main app to call scraping microservice
- [x] Add SCRAPING_SERVICE_URL environment variable
- [x] Write deployment guide for microservice
- [x] Test hybrid setup
- [x] Push microservice to GitHub

## Browserless.io Integration
- [x] Update scraper.ts to use Browserless.io API
- [x] Add BROWSERLESS_API_KEY environment variable
- [ ] Test scraping with Browserless
- [x] Update documentation with Browserless setup instructions

## Remove Authentication
- [x] Update routers to remove protectedProcedure requirement
- [x] Update frontend to remove login/auth checks
- [x] Test app without authentication

## Bug Fixes - Job Issues
- [x] Fix JobDetail page crash when viewing job details
- [x] Debug why jobs are failing (missing BROWSERLESS_API_KEY)
- [x] Add better error handling and loading states

## Environment Variable Fix
- [x] Add BROWSERLESS_API_KEY to env.ts configuration
- [x] Update scraper to use ENV.browserlessApiKey
- [ ] Test scraping with proper API key

## New Features & Bug Fixes
- [x] Test scraping with real URL (example.com) - Confirmed working via Browserless dashboard
- [x] Fix JobDetail page undefined pages error
- [x] Add URL validation with green checkmark/red X feedback
- [x] Add delete button for each job
- [x] Debug why jobs stuck in processing state (fixed connectOverCDP)
- [x] Verify scraping works end-to-end

## Export Format Changes
- [x] Remove section grouping from exports
- [x] Show content in exact page sequence (by orderIndex)
- [x] Add "Tag" column showing HTML tag names (h1, h2, p, li, etc.)
- [x] Update Excel export with new column structure
- [x] Update CSV export with new column structure
- [x] Update JobDetail page to show new format

## Visual Order Fix
- [x] Update scraper to traverse DOM in document order
- [x] Extract content in HTML sequence (top to bottom)
- [x] Test with Pepperstone page to verify correct visual sequence

## Content Filtering
- [x] Add smart filtering to exclude navigation menus and footers
- [x] Detect and skip common nav/footer HTML patterns (nav, header, footer tags)
- [x] Prioritize main content areas (main, article tags)
- [x] Test with Pepperstone page to verify filtering works correctly (reduced from 86 to 24 sections)

## Rollback and Feature Re-implementation
- [x] Rollback to checkpoint 6ba28067 (last known working version)
- [x] Fix waitUntil from networkidle to domcontentloaded (fixed Browserless connection issue)
- [x] Verify scraping works with test job (SUCCESS!)
- [x] Re-implement banner exclusions (pui-disclaimer-banner, pui-live-pricing) with testing (SUCCESS!)
- [x] Add pui-cookies exclusion (SUCCESS!)
- [x] Add table extraction with testing (SUCCESS!)
- [x] Add expandable content handling (pui-expendable-banner) with testing (SUCCESS!)
- [x] Save final checkpoint with all features working

## Bug Fixes - TypeScript Errors
- [x] Fix getUserByOpenId and upsertUser missing from server/db.ts (added OAuth support to schema)
- [x] Add openId and loginMethod fields to users table schema
- [x] Run database migration (pnpm db:push)
- [x] Fix nullable username/password TypeScript errors
- [x] Verify tRPC API is working correctly (SUCCESS!)
- [x] Test that homepage loads without errors (SUCCESS!)
