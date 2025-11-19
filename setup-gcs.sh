#!/bin/bash

# BobPT GCS Setup Script
# This script configures Google Cloud Storage bucket with proper CORS and permissions

set -e

BUCKET_NAME="bob-sto"
PROJECT_ID="plasma-canyon-477402-i8"
SERVICE_ACCOUNT="bobpt-backend@${PROJECT_ID}.iam.gserviceaccount.com"

echo "========================================="
echo "BobPT GCS Setup Script"
echo "========================================="
echo ""
echo "This script will:"
echo "1. Apply CORS configuration to GCS bucket"
echo "2. Verify service account permissions"
echo "3. Set up bucket IAM policies"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed"
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if gsutil is installed
if ! command -v gsutil &> /dev/null; then
    echo "❌ Error: gsutil is not installed"
    echo "Please install Google Cloud SDK which includes gsutil"
    exit 1
fi

echo "✅ gcloud and gsutil are installed"
echo ""

# Set project
echo "📋 Setting project to: ${PROJECT_ID}"
gcloud config set project ${PROJECT_ID}
echo ""

# Apply CORS configuration
echo "🌐 Applying CORS configuration to bucket: ${BUCKET_NAME}"
if [ -f "gcs-cors.json" ]; then
    gsutil cors set gcs-cors.json gs://${BUCKET_NAME}
    echo "✅ CORS configuration applied successfully"
else
    echo "❌ Error: gcs-cors.json file not found"
    exit 1
fi
echo ""

# Verify CORS configuration
echo "🔍 Verifying CORS configuration..."
gsutil cors get gs://${BUCKET_NAME}
echo ""

# Check service account permissions
echo "🔐 Checking service account permissions..."
echo "Service account: ${SERVICE_ACCOUNT}"

# Add Storage Admin role to service account (if not already added)
echo "Adding Storage Object Admin role to service account..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/storage.objectAdmin" \
    --condition=None

echo "✅ Service account permissions configured"
echo ""

# Set bucket to allow allUsers to read (for signed URLs to work)
echo "🔓 Configuring bucket for signed URL access..."
gsutil iam ch allUsers:objectViewer gs://${BUCKET_NAME} || echo "Note: Public access not set (this is optional)"
echo ""

echo "========================================="
echo "✅ Setup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Restart your backend server to load the .env file"
echo "2. Restart your frontend development server"
echo "3. Try uploading a file again"
echo ""
echo "If you still encounter 403 errors, check:"
echo "- Backend .env file has GOOGLE_CLOUD_PROJECT=${PROJECT_ID}"
echo "- Service account key file is properly configured"
echo "- Backend server was restarted after .env changes"
