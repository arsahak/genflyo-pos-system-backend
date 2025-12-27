# Environment Variables Setup

## ImageBB API Key Configuration

To enable image uploads, you need to add the `IMAGEBB_API_KEY` environment variable to your `.env` file.

### Steps:

1. **Create or edit `.env` file in the `backend` folder**
   ```
   backend/.env
   ```

2. **Get your ImageBB API Key:**
   - Go to https://api.imgbb.com/
   - Sign up or log in
   - Get your API key from the dashboard

3. **Add the API key to `.env` file:**
   ```env
   IMAGEBB_API_KEY=your_api_key_here
   ```
   
   **Important:**
   - Do NOT include quotes around the value
   - Do NOT include spaces around the `=` sign
   - Example: `IMAGEBB_API_KEY=abc123def456ghi789`

4. **Restart your server:**
   - Stop the server (Ctrl+C)
   - Start it again: `npm start` or `node server.js`

### Common Issues:

1. **".env file not found"**
   - Make sure the `.env` file is in the `backend` folder (same folder as `server.js`)
   - Make sure the file is named exactly `.env` (not `.env.txt` or `.env.example`)

2. **"IMAGEBB_API_KEY is not configured"**
   - Check that the variable name is exactly `IMAGEBB_API_KEY` (case-sensitive)
   - Make sure there are no spaces: `IMAGEBB_API_KEY=key` not `IMAGEBB_API_KEY = key`
   - Make sure the file is saved
   - Restart the server after adding the variable

3. **"Invalid API key"**
   - Verify your API key is correct on ImageBB dashboard
   - Make sure you copied the entire key (they can be long)
   - Check for any extra spaces or characters

### Example .env file structure:

```env
# Database
MONGO_URI=mongodb://localhost:27017/pos_software

# JWT Secrets
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d

# ImageBB API Key (for image uploads)
IMAGEBB_API_KEY=your_imagebb_api_key_here

# Server
PORT=8000
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:3000
```

### Verify Setup:

After adding the variable, restart your server and check the console. If you still get the error, check:

1. Server console output for any dotenv loading errors
2. That the `.env` file is in the correct location
3. That the variable name matches exactly

