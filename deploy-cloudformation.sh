#!/usr/bin/env bash
set -euo pipefail

# Configuration
STACK_NAME="testdriver-test"
TEMPLATE_FILE="cloudformation.yaml"

# Get the default VPC and subnet if not provided
if [ -z "${VPC_ID:-}" ]; then
    echo "Getting default VPC..."
    VPC_ID=$(aws ec2 describe-vpcs \
        --filters "Name=isDefault,Values=true" \
        --query 'Vpcs[0].VpcId' \
        --output text)
    echo "Using default VPC: $VPC_ID"
fi

if [ -z "${SUBNET_ID:-}" ]; then
    echo "Getting default subnet..."
    SUBNET_ID=$(aws ec2 describe-subnets \
        --filters "Name=vpc-id,Values=$VPC_ID" "Name=default-for-az,Values=true" \
        --query 'Subnets[0].SubnetId' \
        --output text)
    echo "Using default subnet: $SUBNET_ID"
fi

echo "Deploying CloudFormation stack: $STACK_NAME"
echo "VPC ID: $VPC_ID"
echo "Subnet ID: $SUBNET_ID"

# Deploy the stack
aws cloudformation deploy \
    --template-file "$TEMPLATE_FILE" \
    --stack-name "$STACK_NAME" \
    --parameter-overrides \
        VpcId="$VPC_ID" \
        DefaultSubnetId="$SUBNET_ID" \
        ProjectTag="testdriver" \
        InstanceType="c5.xlarge" \
        AllowedIngressCidr="0.0.0.0/0" \
        CreateKeyPair="yes" \
    --capabilities CAPABILITY_IAM \
    --region "${AWS_REGION:-us-east-1}"

echo "Stack deployment complete!"

# Get the outputs
echo "Stack outputs:"
aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs' \
    --output table
