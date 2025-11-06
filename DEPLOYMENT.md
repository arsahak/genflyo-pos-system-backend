# 🚀 Vercel Deployment Guide for POS Backend

## Prerequisites

1. **MongoDB Atlas Account** (Free tier available)
   - Create cluster at: https://www.mongodb.com/cloud/atlas
   - Get your connection string

2. **Vercel Account**
   - Sign up at: https://vercel.com

## 📋 Step-by-Step Deployment

### 1. Prepare MongoDB Atlas

1. Go to MongoDB Atlas: https://cloud.mongodb.com
2. Create a new cluster (or use existing)
3. Go to **Database Access** → Add Database User
4. Go to **Network Access** → Add IP Address → Allow access from anywhere (0.0.0.0/0)
5. Go to **Database** → Connect → Get connection string:
   ```
   mongodb+srv://<username>:<password>@cluster.mongodb.net/pos_software?retryWrites=true&w=majority
   ```

### 2. Configure Vercel Environment Variables

In your Vercel project dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add these variables:

```bash
# Required Variables
NODE_ENV=production
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/pos_software

# JWT Secrets (Generate using: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_SECRET=your_generated_secret_here
JWT_REFRESH_SECRET=your_generated_refresh_secret_here

# CORS (Update after frontend deployment)
CORS_ORIGIN=https://your-frontend-url.vercel.app
FRONTEND_URL=https://your-frontend-url.vercel.app

# Optional - Cloudinary (Recommended for image uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 3. Deploy to Vercel

#### Option A: Using Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
cd pos-backend
vercel --prod
```

#### Option B: Using GitHub Integration

1. Push your code to GitHub
2. Go to Vercel Dashboard
3. Click **"Add New Project"**
4. Import your GitHub repository
5. Set Root Directory to `pos-backend`
6. Click **"Deploy"**

### 4. Seed Database (First Time Only)

After deployment, run the seed script to create initial roles and super admin:

```bash
# Install dependencies locally
npm install

# Set MONGO_URI in your local .env to your Atlas connection
# Then run:
npm run seed
```

Or create a separate Vercel Function for seeding.

### 5. Test Deployment

Your API will be available at: `https://your-project.vercel.app`

Test endpoints:
- Health: `https://your-project.vercel.app/health`
- API Docs: `https://your-project.vercel.app/docs`
- Welcome: `https://your-project.vercel.app/`

## 🔧 Important Configuration

### File Uploads on Vercel

⚠️ **Important**: Vercel's serverless functions are **stateless** and **ephemeral**. Local file uploads to `/uploads` directory won't persist.

**Solution**: Use **Cloudinary** for file storage (already configured in the codebase)

1. Sign up at: https://cloudinary.com (Free tier: 25GB storage)
2. Get your credentials from Dashboard
3. Add to Vercel environment variables:
   ```
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

### Database Connection

Ensure your MongoDB Atlas connection string includes:
- `retryWrites=true`
- `w=majority`
- Correct username and password (URL encoded if they contain special characters)

## 🐛 Troubleshooting

### Build Fails

1. Check Node.js version in `package.json` engines field
2. Verify all dependencies are in `dependencies` (not `devDependencies`)
3. Check Vercel build logs for specific errors

### 429 Rate Limit Errors

The rate limiting is configured in `server.js`. Current settings:
- 200 requests per minute
- Skips localhost in development

### CORS Errors

Update `CORS_ORIGIN` in Vercel environment variables to match your frontend URL.

### MongoDB Connection Fails

1. Verify connection string is correct
2. Check MongoDB Atlas network access allows 0.0.0.0/0
3. Ensure database user has read/write permissions

## 📊 Monitor Your Deployment

- **Vercel Dashboard**: View logs, analytics, and metrics
- **MongoDB Atlas**: Monitor database performance
- **Vercel Analytics**: Track API usage and performance

## 🔒 Security Checklist

- ✅ Strong JWT secrets in production
- ✅ MongoDB Atlas network access configured
- ✅ Environment variables set in Vercel (not in code)
- ✅ Rate limiting enabled
- ✅ CORS properly configured
- ✅ Helmet middleware enabled

## 📝 Post-Deployment

1. Update frontend API URL to point to Vercel backend
2. Test all API endpoints
3. Run database seed if needed
4. Monitor logs for any errors
5. Set up custom domain (optional)

## 🆘 Need Help?

- Vercel Docs: https://vercel.com/docs
- MongoDB Atlas Docs: https://docs.atlas.mongodb.com
- Project Issues: https://github.com/your-repo/issues

---

**Note**: Socket.IO real-time features have limitations on Vercel serverless functions. Consider using Vercel's WebSocket support or alternative hosting for Socket.IO features.

