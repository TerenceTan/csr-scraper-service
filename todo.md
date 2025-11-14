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
