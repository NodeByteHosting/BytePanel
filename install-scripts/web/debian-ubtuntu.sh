#!/bin/bash

# Install script for Ubuntu and Debain (Panel only)

# Installs all pre reqs
echo "Installing Pre reqs"
curl -fsSL https://bun.sh/install | bash
apt -y install nginx tar unzip git redis-server

# Installs the latest panel version
echo "Installing Panel"

mkdir -p /var/www/BytePanel
cd /var/www/BytePanel
curl -Lo (panel zip or whatever) (panel download link here)
tar -xzvf (panel zip or whatever)

echo "Remove Agent source"

# Delete the agent files (So we use as less space as we can)
rm -rf apps/agent

echo "Copy .env"

# Copy env file
cp apps/web/.env.example apps/web/.env

echo "Installing Dependencies"

# Install all Dependencies
bun install --frozen-lockfile

echo "Building panel"
# Build the panel
bun run build

echo "Panel installation complete, please follow the manual steps https://bytepanel.nodebyte.co.uk/docs/auto-install-manual-steps"