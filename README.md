# Scraping Microservice

Lightweight Node.js microservice for scraping client-side rendered (CSR) websites using Playwright.

## Features

- ✅ Scrapes CSR/JavaScript-rendered websites
- ✅ Extracts visible text content organized by sections
- ✅ API key authentication
- ✅ Docker-ready deployment
- ✅ Handles dynamic content loading
- ✅ Automatic fallback strategies for difficult sites

## Quick Start

### Option 1: Docker (Recommended)

```bash
# 1. Set your API key
echo "API_KEY=your-secure-random-key-here" > .env

# 2. Start the service
docker-compose up -d

# 3. Check if it's running
curl http://localhost:3001/health
```

### Option 2: Direct Node.js

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright browsers
npx playwright install chromium --with-deps

# 3. Set your API key
echo "API_KEY=your-secure-random-key-here" > .env

# 4. Start the service
npm start
```

## API Usage

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "service": "scraping-service"
}
```

### Scrape URL

```bash
POST /scrape
Headers:
  x-api-key: your-api-key-here
  Content-Type: application/json
Body:
{
  "url": "https://example.com"
}
```

Success Response:
```json
{
  "success": true,
  "pageTitle": "Example Domain",
  "content": [
    {
      "sectionType": "h1",
      "sectionTitle": "Example Domain",
      "content": "Example Domain",
      "orderIndex": 0,
      "charCount": 14
    },
    {
      "sectionType": "p",
      "sectionTitle": null,
      "content": "This domain is for use in illustrative examples...",
      "orderIndex": 1,
      "charCount": 115
    }
  ]
}
```

Error Response:
```json
{
  "success": false,
  "error": "Error message here"
}
```

## Deployment on VPS

### Prerequisites

- Ubuntu 20.04+ server
- Docker and Docker Compose installed
- At least 2GB RAM
- Open port 3001 (or your chosen port)

### Step-by-Step Deployment

1. **SSH into your VPS**
   ```bash
   ssh user@your-vps-ip
   ```

2. **Install Docker** (if not installed)
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo apt install docker-compose-plugin
   ```

3. **Clone or upload this directory**
   ```bash
   # Upload files via SCP, SFTP, or git clone
   scp -r scraping-service/ user@your-vps-ip:~/
   ```

4. **Configure environment**
   ```bash
   cd scraping-service
   
   # Generate a secure API key
   openssl rand -base64 32
   
   # Set it in .env
   echo "API_KEY=<generated-key>" > .env
   ```

5. **Start the service**
   ```bash
   docker-compose up -d
   ```

6. **Verify it's running**
   ```bash
   curl http://localhost:3001/health
   ```

7. **(Optional) Set up Nginx reverse proxy**
   
   If you want to use a domain name:
   
   ```bash
   sudo apt install nginx
   sudo nano /etc/nginx/sites-available/scraper
   ```
   
   Add this configuration:
   ```nginx
   server {
       listen 80;
       server_name scraper.yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
   }
   ```
   
   Enable and restart:
   ```bash
   sudo ln -s /etc/nginx/sites-available/scraper /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

8. **(Optional) SSL with Let's Encrypt**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d scraper.yourdomain.com
   ```

## Configuration

### Environment Variables

- `API_KEY` - Required. API key for authentication
- `PORT` - Optional. Port to run on (default: 3001)
- `NODE_ENV` - Optional. Environment (default: production)

### Resource Limits

The docker-compose.yml includes:
- Memory limit: 2GB
- CPU limit: 1 core

Adjust these based on your VPS resources and scraping volume.

## Security

1. **Always use a strong API key**
   ```bash
   openssl rand -base64 32
   ```

2. **Use HTTPS in production** (via Nginx + Let's Encrypt)

3. **Firewall rules**
   ```bash
   sudo ufw allow 22/tcp   # SSH
   sudo ufw allow 80/tcp   # HTTP
   sudo ufw allow 443/tcp  # HTTPS
   sudo ufw enable
   ```

4. **Keep Docker images updated**
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

## Monitoring

### View logs
```bash
docker-compose logs -f
```

### Check resource usage
```bash
docker stats
```

### Restart service
```bash
docker-compose restart
```

## Troubleshooting

### Service won't start
```bash
# Check logs
docker-compose logs

# Common issues:
# - Port already in use: Change PORT in .env
# - Out of memory: Increase server RAM or reduce mem_limit
```

### Scraping fails
```bash
# Check if browser is working
docker-compose exec scraper npx playwright --version

# Verify enough RAM (minimum 2GB)
free -h
```

### High memory usage
```bash
# Restart the service periodically
docker-compose restart

# Or add a cron job to restart daily
0 3 * * * cd /path/to/scraping-service && docker-compose restart
```

## Integration with Main App

In your main application (on Manus platform), add these environment variables:

```
SCRAPING_SERVICE_URL=http://your-vps-ip:3001
SCRAPING_SERVICE_API_KEY=your-api-key-here
```

Or if using domain + SSL:
```
SCRAPING_SERVICE_URL=https://scraper.yourdomain.com
SCRAPING_SERVICE_API_KEY=your-api-key-here
```

## Performance

- Handles ~10-20 concurrent scraping requests
- Average scrape time: 5-15 seconds per page
- Memory usage: ~500MB-1.5GB depending on page complexity

## License

MIT
