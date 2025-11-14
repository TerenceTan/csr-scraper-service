# Browserless.io Setup Guide

This guide shows you how to set up the CSR Scraper with Browserless.io for production scraping.

## Why Browserless.io?

- ✅ No VPS or server management needed
- ✅ No Docker deployment complexity
- ✅ Reliable browser automation infrastructure
- ✅ Free tier: 1,000 requests/month
- ✅ Perfect for scraping 78 URLs/month

## Step 1: Sign Up for Browserless.io

1. Go to https://browserless.io
2. Click **Sign Up** or **Get Started**
3. Create a free account
4. Verify your email

## Step 2: Get Your API Key

1. Log in to your Browserless dashboard
2. Navigate to **API Keys** or **Settings**
3. Copy your API key (it looks like: `a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6`)
4. Save it somewhere safe - you'll need it in the next step

## Step 3: Add API Key to Manus Platform

1. Open your CSR Scraper project on Manus Platform
2. Click the **Management UI icon** (top-right corner of chatbox)
3. Navigate to **Settings** → **Secrets** (in the left sidebar)
4. Click **Add Secret** or the **+** button
5. Add the environment variable:
   - **Key**: `BROWSERLESS_API_KEY`
   - **Value**: (paste your Browserless API key)
6. Click **Save**

## Step 4: Publish Your App

1. In the Management UI, click the **Publish** button (top-right header)
2. Wait for deployment to complete (usually 1-2 minutes)
3. Your app is now live with Browserless integration!

## Step 5: Test Scraping

1. Open your published app
2. Log in (if authentication is enabled)
3. Create a new scraping job
4. Add test URLs (e.g., https://example.com)
5. Click **Start Scraping**
6. Wait for results

If scraping works, you're all set! 🎉

## Usage Limits

### Free Tier
- **1,000 requests/month**
- Perfect for:
  - 78 URLs once/month ✅
  - 78 URLs weekly (312/month) ✅
  - Testing and development ✅

### Paid Plans (if you need more)
- **Starter**: $50/month - 10,000 requests
- **Professional**: $150/month - 50,000 requests
- **Enterprise**: Custom pricing

## Troubleshooting

### "Browserless not configured" Error

**Cause**: API key not set or incorrect

**Solution**:
1. Check that `BROWSERLESS_API_KEY` is added in Settings → Secrets
2. Verify the key is correct (no extra spaces)
3. Republish the app after adding the key

### Scraping Fails or Times Out

**Possible causes**:
1. **Invalid API key**: Check your Browserless dashboard
2. **Rate limit exceeded**: Check usage in Browserless dashboard
3. **Target website blocking**: Some sites block automated browsers

**Solutions**:
1. Verify API key is correct
2. Check Browserless dashboard for usage/errors
3. Try a different URL to test

### "Connection refused" or "WebSocket error"

**Cause**: Wrong Browserless endpoint

**Solution**:
The app uses `wss://production-sfo.browserless.io` by default. If your account uses a different region:
1. Check your Browserless dashboard for the correct endpoint
2. Contact support to update the endpoint in the code

## Monitoring Usage

1. Log in to Browserless dashboard
2. Go to **Usage** or **Analytics**
3. View:
   - Requests used this month
   - Remaining quota
   - Request history
   - Error rates

## Cost Estimate

For 78 URLs/month:
- **Browserless**: Free (well within 1,000 request limit)
- **Manus Platform**: (check with Manus team)
- **Total**: Just Manus platform fees

## Security

- ✅ API key is stored securely in Manus Secrets
- ✅ Never exposed in frontend code
- ✅ HTTPS/WSS encryption for all requests
- ✅ Browserless handles browser security

## Support

**Browserless Issues**:
- Browserless documentation: https://docs.browserless.io
- Browserless support: support@browserless.io

**App Issues**:
- Check this guide's troubleshooting section
- Review app logs in Manus dashboard

## Comparison: Browserless vs Self-Hosted

| Feature | Browserless.io | Self-Hosted VPS |
|---------|---------------|-----------------|
| Setup Time | 5 minutes | 30-60 minutes |
| Cost (78 URLs/month) | Free | $10-12/month |
| Maintenance | None | Regular updates |
| Reliability | 99.9% uptime | Depends on VPS |
| Scalability | Automatic | Manual |
| Browser Updates | Automatic | Manual |

For your use case (78 URLs/month), **Browserless.io is the clear winner**!

## Next Steps

Once scraping is working:

1. **Organize your URLs**: Create a spreadsheet with all 78 URLs
2. **Test with a few URLs first**: Verify output quality
3. **Run full scraping job**: Process all 78 URLs
4. **Export results**: Download Excel or CSV
5. **Send to translators**: Use the exported files

## FAQ

**Q: Can I scrape more than 78 URLs?**
A: Yes! The free tier allows 1,000 requests/month.

**Q: What if I exceed the free tier?**
A: Browserless will notify you and you can upgrade to a paid plan.

**Q: Can I use my own Browserless account?**
A: Yes! Just use your own API key in the Manus Secrets.

**Q: Is my data private?**
A: Yes. Browserless doesn't store scraped content. It only provides the browser infrastructure.

**Q: Can I scrape password-protected sites?**
A: Not directly. The scraper only handles public pages. For authenticated scraping, contact support for custom implementation.

---

**You're all set!** Enjoy hassle-free scraping with Browserless.io! 🚀
