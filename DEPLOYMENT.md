# CSR Website Content Scraper - Deployment Guide

This guide will help you deploy the CSR Scraper application on your own VPS server using Docker.

## Prerequisites

- A VPS server (Ubuntu 20.04+ recommended, minimum 2GB RAM)
- Docker and Docker Compose installed
- Domain name (optional, but recommended)
- SSH access to your server

## Quick Start

### 1. Install Docker and Docker Compose

If Docker is not installed on your server:

```bash
# Update package index
sudo apt update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin

# Add your user to docker group (optional, to run without sudo)
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Clone the Repository

```bash
git clone <your-repository-url>
cd csr-scraper
```

### 3. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file with your settings
nano .env
```

**Important**: Update these values in `.env`:
- `MYSQL_ROOT_PASSWORD` - Strong password for MySQL root user
- `MYSQL_PASSWORD` - Password for application database user
- `JWT_SECRET` - Random string (min 32 characters) for JWT tokens
- `SESSION_SECRET` - Random string (min 32 characters) for sessions

Generate secure secrets:
```bash
# Generate random secrets
openssl rand -base64 32
```

### 4. Deploy the Application

```bash
# Build and start all services
docker-compose up -d

# Check if services are running
docker-compose ps

# View logs
docker-compose logs -f app
```

The application will be available at `http://your-server-ip:3000`

### 5. Initialize the Database

```bash
# Run database migrations
docker-compose exec app pnpm db:push
```

### 6. (Optional) Set Up Nginx Reverse Proxy

For production deployment with a domain name:

```bash
# Install Nginx
sudo apt install nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/csr-scraper
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/csr-scraper /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. (Optional) Set Up SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
```

## Updating the Application

To update to a new version:

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose up -d --build

# Run any new migrations
docker-compose exec app pnpm db:push
```

## Useful Commands

```bash
# View application logs
docker-compose logs -f app

# View database logs
docker-compose logs -f db

# Restart the application
docker-compose restart app

# Stop all services
docker-compose down

# Stop and remove all data (WARNING: This deletes the database!)
docker-compose down -v

# Access the application container shell
docker-compose exec app sh

# Access MySQL database
docker-compose exec db mysql -u scraper_user -p csr_scraper

# Backup database
docker-compose exec db mysqldump -u root -p csr_scraper > backup.sql

# Restore database
docker-compose exec -T db mysql -u root -p csr_scraper < backup.sql
```

## Troubleshooting

### Application won't start

Check logs:
```bash
docker-compose logs app
```

Common issues:
- Database connection failed: Check DATABASE_URL in .env
- Port already in use: Change port in docker-compose.yml
- Out of memory: Increase server RAM or add swap space

### Scraping fails

The application uses Playwright with Chromium browser. The Docker image includes all necessary browser dependencies.

If scraping still fails:
- Check server has enough RAM (minimum 2GB recommended)
- Check logs for specific errors
- Verify the target website is accessible from your server

### Database connection issues

```bash
# Check if database is running
docker-compose ps db

# Test database connection
docker-compose exec db mysql -u scraper_user -p

# Recreate database
docker-compose down
docker-compose up -d db
docker-compose exec app pnpm db:push
```

## Security Recommendations

1. **Change default passwords**: Always use strong, unique passwords
2. **Use HTTPS**: Set up SSL certificate with Let's Encrypt
3. **Firewall**: Configure UFW to only allow necessary ports
   ```bash
   sudo ufw allow 22/tcp  # SSH
   sudo ufw allow 80/tcp  # HTTP
   sudo ufw allow 443/tcp # HTTPS
   sudo ufw enable
   ```
4. **Regular updates**: Keep your server and Docker images updated
5. **Backups**: Set up automated database backups

## Performance Optimization

### For high-volume scraping:

1. **Increase server resources**: 4GB+ RAM recommended
2. **Add swap space** if RAM is limited:
   ```bash
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```
3. **Adjust Docker resource limits** in docker-compose.yml
4. **Use SSD storage** for better database performance

## Support

For issues or questions:
1. Check the logs: `docker-compose logs -f`
2. Review this documentation
3. Check GitHub issues
4. Contact support

## License

MIT License - See LICENSE file for details
