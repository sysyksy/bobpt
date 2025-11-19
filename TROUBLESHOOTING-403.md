# Troubleshooting GCS 403 Errors

## Problem Summary

You're encountering 403 (Permission Denied) errors when:
1. Uploading files to Google Cloud Storage
2. Accessing uploaded files from the project list
3. Loading videos in the editor

## Root Causes

The 403 errors are caused by:

1. **CORS not configured** - Browser blocks requests to GCS from localhost
2. **Service account permissions** - Backend service account may not have proper permissions
3. **Backend not restarted** - The `.env` file with `GOOGLE_CLOUD_PROJECT` wasn't loaded

## Solution Steps

### Step 1: Apply CORS Configuration

Run the setup script to apply CORS and configure permissions:

```bash
./setup-gcs.sh
```

**OR** manually apply CORS:

```bash
# Apply CORS configuration
gsutil cors set gcs-cors.json gs://bob-sto

# Verify it was applied
gsutil cors get gs://bob-sto
```

### Step 2: Verify Backend Configuration

1. **Check `.env` file exists** in `backend/.env`:
   ```bash
   cat backend/.env | grep GOOGLE_CLOUD_PROJECT
   ```

   Should show:
   ```
   GOOGLE_CLOUD_PROJECT=plasma-canyon-477402-i8
   ```

2. **If `.env` is missing**, create it:
   ```bash
   cp backend/.env.example backend/.env
   ```

   Then edit `backend/.env` and update:
   ```
   GOOGLE_CLOUD_PROJECT=plasma-canyon-477402-i8
   ```

### Step 3: Restart Backend Server

**CRITICAL**: The backend must be restarted to load the `.env` file.

```bash
# Stop the current backend (Ctrl+C if running)
# Then start it with:
cd backend
uvicorn main:app --reload --port 8000
```

### Step 4: Restart Frontend

```bash
# Stop the frontend (Ctrl+C if running)
# Then start it:
npm run dev
```

### Step 5: Test Upload

1. Open http://localhost:5173
2. Try uploading a video file
3. Check browser console for errors

## Verification

### Check CORS is Applied

```bash
gsutil cors get gs://bob-sto
```

Should return:
```json
[
  {
    "origin": ["http://localhost:5173", "http://localhost:3000"],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "responseHeader": ["Content-Type", "x-goog-resumable"],
    "maxAgeSeconds": 3600
  }
]
```

### Check Service Account Permissions

```bash
gcloud projects get-iam-policy plasma-canyon-477402-i8 \
  --flatten="bindings[].members" \
  --filter="bindings.members:bobpt-backend@plasma-canyon-477402-i8.iam.gserviceaccount.com"
```

Should show roles including:
- `roles/storage.objectAdmin` or `roles/storage.admin`

### Check Backend is Using Correct Project

Look at backend logs when it starts. Should see:
```
Firestore initialized successfully
Storage client initialized successfully
```

No errors about project ID.

## Common Issues

### Issue 1: "gsutil: command not found"

**Solution**: Install Google Cloud SDK:
```bash
# macOS
brew install --cask google-cloud-sdk

# Ubuntu/Debian
sudo apt-get install google-cloud-sdk

# Or download from: https://cloud.google.com/sdk/docs/install
```

### Issue 2: Backend Still Shows 403 After CORS Applied

**Cause**: Backend wasn't restarted.

**Solution**: Kill the backend process completely and restart:
```bash
# Find the process
ps aux | grep uvicorn

# Kill it
kill -9 <PID>

# Restart
cd backend
uvicorn main:app --reload --port 8000
```

### Issue 3: Upload Works But Shows as Failed

**Cause**: GCS is returning 403 on the PUT request due to CORS.

**Solution**: Follow Step 1 to apply CORS, then restart backend.

### Issue 4: Video Player Shows 403

**Cause**: Signed read URLs are failing.

**Solution**:
1. Ensure service account has `roles/storage.objectAdmin`
2. Check bucket permissions allow signed URL access
3. Restart backend

## Alternative: Quick Test Without CORS

For local testing only, you can temporarily disable CORS checks in your browser:

**Chrome (macOS)**:
```bash
open -na Google\ Chrome --args --disable-web-security --user-data-dir=/tmp/chrome_dev
```

**Chrome (Linux)**:
```bash
google-chrome --disable-web-security --user-data-dir=/tmp/chrome_dev
```

**⚠️ WARNING**: Only use this for testing! Never browse the internet with CORS disabled.

## Manual CORS Configuration via Console

If you prefer using Google Cloud Console:

1. Go to: https://console.cloud.google.com/storage/browser/bob-sto
2. Click "Permissions" tab
3. Click "CORS" section
4. Add CORS configuration:
   ```json
   [
     {
       "origin": ["http://localhost:5173"],
       "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
       "responseHeader": ["Content-Type"],
       "maxAgeSeconds": 3600
     }
   ]
   ```

## Still Having Issues?

1. **Check browser console** for exact error messages
2. **Check backend logs** for authentication errors
3. **Verify service account key** is properly configured
4. **Test with curl**:
   ```bash
   # Get an upload URL from backend
   curl -X POST http://localhost:8000/api/projects/init \
     -H "Content-Type: application/json" \
     -d '{"fileName": "test.mp4", "language": "ko-KR"}'

   # Try uploading to the returned URL
   curl -X PUT "<uploadUrl>" \
     -H "Content-Type: video/mp4" \
     --data-binary @test.mp4
   ```

## Contact

If none of these solutions work, check:
- Backend error logs for detailed messages
- GCP IAM & Admin console for service account permissions
- GCS bucket configuration in Cloud Console
