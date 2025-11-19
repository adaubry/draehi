# Asset Ingestion Troubleshooting Guide

Quick guide to verify MinIO and asset uploads are working correctly.

## 1. Verify MinIO is Running

```bash
# Check MinIO status
npm run minio status

# If not running, start it
npm run minio

# Verify it's accessible
curl http://localhost:9000/minio/health/live
# Should return 200 OK
```

## 2. Verify Environment Variables

Check your `.env.local` has:

```bash
STORAGE_MODE=local
MINIO_ENDPOINT=http://localhost:9000
MINIO_PUBLIC_URL=http://localhost:9000
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=draehi-assets
```

## 3. Test Asset Upload

Run the test script:

```bash
npx tsx scripts/test-asset-upload.ts
```

**Expected output:**
```
✓ Test files created
✓ Testing asset processing...

[Test] Relative path from pages/ (../assets/...)
  Local path removed: ✓
  S3 URL present: ✓

[Test] Direct path (assets/...)
  Local path removed: ✓
  S3 URL present: ✓

✓ All asset processing tests passed!
```

## 4. Check MinIO Console

Open http://localhost:9001 in browser:
- Login: `minioadmin` / `minioadmin`
- Navigate to **Buckets** → `draehi-assets`
- Look for `workspaces/` folder
- Verify uploaded assets appear there

## 5. During Workspace Sync

Watch the logs during ingestion to see asset uploads:

```bash
# Trigger sync and watch logs
npm run dev
```

Look for console output like:
```
[Asset Upload] ✓ ../assets/image.png → http://localhost:9000/draehi-assets/workspaces/1/assets/image.png
[Asset Upload] ✓ assets/screenshot.png → http://localhost:9000/draehi-assets/workspaces/1/assets/screenshot.png
```

## 6. Common Issues

### Assets still showing local paths (`../assets/...`)

**Symptoms:** HTML contains `<img src="../assets/image.png" />` instead of S3 URL

**Causes:**
1. MinIO not running
2. Wrong environment variables
3. Asset file doesn't exist in repo
4. Upload failed (check logs for errors)

**Fix:**
```bash
# Restart MinIO
npm run minio restart

# Verify .env.local settings
cat .env.local | grep -E "STORAGE|MINIO|S3"

# Check logs for upload errors
npm run dev
# Look for "[Asset Upload] ✗ Failed to upload..."
```

### MinIO returns 403 Forbidden

**Cause:** Bucket not public or doesn't exist

**Fix:**
```bash
# Recreate bucket with public access
docker exec draehi-minio sh -c "
  mc alias set local http://localhost:9000 minioadmin minioadmin
  mc mb local/draehi-assets --ignore-existing
  mc anonymous set public local/draehi-assets
"
```

### Assets upload but don't display

**Cause:** CORS or wrong public URL

**Fix:**
```bash
# Set CORS policy
docker exec draehi-minio sh -c "
  mc alias set local http://localhost:9000 minioadmin minioadmin
  mc anonymous set download local/draehi-assets
"
```

## 7. Manual Asset Check

Upload a test file manually:

```bash
# Create test file
echo "test" > /tmp/test.txt

# Upload via MinIO CLI
docker exec draehi-minio sh -c "
  mc alias set local http://localhost:9000 minioadmin minioadmin
  mc cp /tmp/test.txt local/draehi-assets/test.txt
"

# Verify it's accessible
curl http://localhost:9000/draehi-assets/test.txt
# Should return: test
```

## 8. Production (AWS S3)

Switch to AWS S3 for production:

```bash
# Update .env.local
STORAGE_MODE=production
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
S3_BUCKET=draehi-prod-assets
```

**Important:** Create bucket and set public read policy via AWS Console.

## Quick Reference

```bash
# MinIO management
npm run minio           # Start
npm run minio stop      # Stop
npm run minio logs      # View logs
npm run minio status    # Check status

# Test asset upload
npx tsx scripts/test-asset-upload.ts

# MinIO console
http://localhost:9001   # Web UI

# MinIO API
http://localhost:9000   # S3-compatible API
```
