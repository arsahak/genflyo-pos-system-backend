# ✅ Vercel Deployment Checklist

## Before Deployment

- [ ] MongoDB Atlas cluster created and configured
- [ ] Database user created with read/write permissions
- [ ] Network access allows all IPs (0.0.0.0/0)
- [ ] MongoDB connection string obtained
- [ ] JWT secrets generated (use: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
- [ ] Cloudinary account created (for image uploads)

## Vercel Configuration

- [ ] `vercel.json` file present in root
- [ ] `.vercelignore` file configured
- [ ] `package.json` has "engines" field with Node version
- [ ] `package.json` has "build" and "vercel-build" scripts

## Environment Variables to Set in Vercel

```bash
# Essential
NODE_ENV=production
MONGO_URI=mongodb+srv://...
JWT_SECRET=generated_secret_here
JWT_REFRESH_SECRET=generated_refresh_secret_here

# CORS (update after frontend deployment)
CORS_ORIGIN=https://your-frontend.vercel.app
FRONTEND_URL=https://your-frontend.vercel.app

# File Upload (Cloudinary)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Optional
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=200
```

## After Deployment

- [ ] Deployment successful (check Vercel dashboard)
- [ ] Health endpoint working: `https://your-app.vercel.app/health`
- [ ] API docs accessible: `https://your-app.vercel.app/docs`
- [ ] Database seeded with initial data (run `npm run seed` locally)
- [ ] Test API endpoints with Postman/Thunder Client
- [ ] Update frontend API URL to Vercel backend URL
- [ ] Test CORS with frontend
- [ ] Monitor Vercel logs for any errors

## Common Issues & Solutions

### Issue: Build succeeds but deployment fails
**Solution**: Check Vercel function logs, verify environment variables are set

### Issue: MongoDB connection timeout
**Solution**: 
1. Verify MongoDB Atlas allows 0.0.0.0/0
2. Check connection string is correct
3. Ensure MongoDB user has correct permissions

### Issue: CORS errors from frontend
**Solution**: Update `CORS_ORIGIN` environment variable in Vercel with exact frontend URL

### Issue: File uploads not working
**Solution**: Vercel serverless is stateless - must use Cloudinary (already configured)

### Issue: 429 Too Many Requests
**Solution**: Rate limit is 200 req/min - adjust in `server.js` if needed

## Deployment Commands

```bash
# Using Vercel CLI
vercel login
vercel --prod

# Or push to GitHub and deploy via Vercel dashboard
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

## Testing Your Deployment

```bash
# Test health endpoint
curl https://your-app.vercel.app/health

# Test API welcome
curl https://your-app.vercel.app/

# Test authentication
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pos.com","password":"admin123"}'
```

## Monitor Your App

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Logs**: Vercel Dashboard → Your Project → Logs
- **Analytics**: Vercel Dashboard → Your Project → Analytics
- **MongoDB**: MongoDB Atlas → Metrics

## Security Notes

⚠️ **Never commit these to Git:**
- `.env` file
- MongoDB connection strings
- JWT secrets
- API keys

✅ **Always use:**
- Environment variables in Vercel dashboard
- Strong, random JWT secrets
- MongoDB Atlas user with minimal required permissions

---

**Ready to deploy?** Run: `vercel --prod`

