#!/usr/bin/env bash
set -euo pipefail

# Draehi S3 Assets Configuration Script
# Creates and configures S3 buckets for asset storage
# Usage: ./scripts/deploy-s3-assets.sh --stack-name draehi [--region us-east-1]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Cleanup tracking
TEMP_FILES=()
TEMP_DIRS=()
CLEANUP_NEEDED=false

cleanup() {
    local exit_code=$?

    if [[ "${CLEANUP_NEEDED}" == "true" ]]; then
        echo
        echo "🧹 Cleaning up..."

        for file in "${TEMP_FILES[@]}"; do
            [[ -f "$file" ]] && rm -f "$file"
        done

        for dir in "${TEMP_DIRS[@]}"; do
            [[ -d "$dir" ]] && rm -rf "$dir"
        done
    fi

    if [[ $exit_code -eq 0 ]]; then
        echo "✅ S3 configuration complete"
    else
        echo "❌ S3 configuration failed (exit code: $exit_code)"
    fi

    exit $exit_code
}

trap cleanup EXIT ERR INT TERM

# Parse arguments
STACK_NAME=""
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_PROFILE="${AWS_PROFILE:-default}"

while [[ $# -gt 0 ]]; do
    case $1 in
        --stack-name) STACK_NAME="$2"; shift 2 ;;
        --region) AWS_REGION="$2"; shift 2 ;;
        --profile) AWS_PROFILE="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

if [[ -z "${STACK_NAME}" ]]; then
    echo "Usage: $0 --stack-name <name> [--region <region>]"
    exit 1
fi

echo "═════════════════════════════════════════════════════"
echo "📦 S3 Assets Configuration"
echo "═════════════════════════════════════════════════════"
echo

BUCKET_NAME="${STACK_NAME}-assets"

echo "Configuration:"
echo "  Bucket Name: ${BUCKET_NAME}"
echo "  Region: ${AWS_REGION}"
echo

# Check prerequisites
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found"
    exit 1
fi
echo "✅ AWS CLI found"

echo

# Create bucket
echo "=== Creating S3 Bucket ==="
echo

echo "→ Creating bucket: ${BUCKET_NAME}"

if aws s3 mb "s3://${BUCKET_NAME}" \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" 2>&1 | grep -v "BucketAlreadyExists\|BucketAlreadyOwnedByYou"; then
    echo "✅ Bucket created"
elif aws s3 ls "s3://${BUCKET_NAME}" --region "${AWS_REGION}" --profile "${AWS_PROFILE}" > /dev/null 2>&1; then
    echo "✅ Bucket already exists"
else
    echo "❌ Failed to create bucket"
    exit 1
fi

echo

# Enable versioning
echo "=== Configuring Bucket ==="
echo

echo "→ Enabling versioning..."
aws s3api put-bucket-versioning \
    --bucket "${BUCKET_NAME}" \
    --versioning-configuration Status=Enabled \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" > /dev/null 2>&1
echo "✅ Versioning enabled"

echo

# Enable encryption
echo "→ Enabling encryption..."
aws s3api put-bucket-encryption \
    --bucket "${BUCKET_NAME}" \
    --server-side-encryption-configuration '{
        "Rules": [{
            "ApplyServerSideEncryptionByDefault": {
                "SSEAlgorithm": "AES256"
            }
        }]
    }' \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" > /dev/null 2>&1
echo "✅ Encryption enabled"

echo

# Configure CORS
echo "→ Configuring CORS..."
TEMP_CORS=$(mktemp)
TEMP_FILES+=("${TEMP_CORS}")
CLEANUP_NEEDED=true

cat > "${TEMP_CORS}" << 'EOF'
{
    "CORSRules": [
        {
            "AllowedOrigins": ["*"],
            "AllowedMethods": ["GET", "PUT", "POST"],
            "AllowedHeaders": ["*"],
            "MaxAgeSeconds": 3000,
            "ExposeHeaders": ["ETag"]
        }
    ]
}
EOF

if aws s3api put-bucket-cors \
    --bucket "${BUCKET_NAME}" \
    --cors-configuration file://"${TEMP_CORS}" \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" > /dev/null 2>&1; then
    echo "✅ CORS configured"
else
    echo "⚠️  Failed to configure CORS (continuing)"
fi

echo

# Block public access (security best practice)
echo "→ Configuring access control..."
aws s3api put-public-access-block \
    --bucket "${BUCKET_NAME}" \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" > /dev/null 2>&1
echo "✅ Public access blocked"

echo

# Create IAM policy file
echo "=== Creating IAM Policy ==="
echo

TEMP_POLICY=$(mktemp)
TEMP_FILES+=("${TEMP_POLICY}")
CLEANUP_NEEDED=true

cat > "${TEMP_POLICY}" << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::${BUCKET_NAME}",
                "arn:aws:s3:::${BUCKET_NAME}/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::${BUCKET_NAME}/*"
        }
    ]
}
EOF

echo "→ IAM Policy (for EC2/EKS roles):"
echo
cat "${TEMP_POLICY}" | jq . 2>/dev/null || cat "${TEMP_POLICY}"
echo

# Get bucket info
echo "=== Bucket Information ==="
echo

BUCKET_REGION=$(aws s3api get-bucket-location \
    --bucket "${BUCKET_NAME}" \
    --profile "${AWS_PROFILE}" \
    --query 'LocationConstraint' \
    --output text)

BUCKET_ARN="arn:aws:s3:::${BUCKET_NAME}"

echo "Bucket Details:"
echo "  Name: ${BUCKET_NAME}"
echo "  ARN: ${BUCKET_ARN}"
echo "  Region: ${BUCKET_REGION}"
echo "  Versioning: Enabled"
echo "  Encryption: AES256"
echo "  CORS: Configured"
echo
echo "S3 URL: https://${BUCKET_NAME}.s3.amazonaws.com"
echo "Regional URL: https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com"
echo

echo "═════════════════════════════════════════════════════"
echo "✅ S3 Configuration Complete"
echo "═════════════════════════════════════════════════════"
echo
echo "Next steps:"
echo "  1. Create IAM role for EC2/EKS with policy above"
echo "  2. Attach role to EC2 instances or EKS service account"
echo "  3. Set S3_BUCKET=${BUCKET_NAME} in environment"
echo "  4. Optionally configure CloudFront CDN"
echo
echo "CloudFront Setup (Optional):"
echo "  aws cloudfront create-distribution ..."
echo
