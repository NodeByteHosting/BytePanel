#!/bin/bash

# Install script for Ubuntu and Debain (Panel only)

set -e

REPO="NodeByteHosting/BytePanel"

PANEL_BETA="${PANEL_BETA:-false}"
while [ $# -gt 0 ]; do
  case "$1" in
    --beta=*)
      PANEL_BETA="${1#*=}"
      ;;
    --beta)
      if [ "$2" = "true" ] || [ "$2" = "false" ]; then
        PANEL_BETA="$2"
        shift
      else
        PANEL_BETA="true"
      fi
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
  shift
done

if [ "$PANEL_BETA" != "true" ] && [ "$PANEL_BETA" != "false" ]; then
  echo "--beta must be true or false"
  exit 1
fi

# Installs all pre reqs
echo "Installing Pre reqs"
apt -y update
apt -y install curl jq nginx tar unzip git redis-server
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"
source /root/.bashrc

# Installs the latest panel version (or the one set with PANEL_VERSION=1.2.0)
# With --beta true, pre-releases are included when picking the latest version
echo "Installing Panel"

if [ -z "$PANEL_VERSION" ]; then
  PANEL_TAG=$(curl -fsSL "https://api.github.com/repos/$REPO/releases?per_page=100" \
    | jq -r --argjson beta "$PANEL_BETA" '[.[] | select(.draft | not) | select($beta or (.prerelease | not)) | select(.tag_name | startswith("panel-v"))][0].tag_name')
  if [ -z "$PANEL_TAG" ] || [ "$PANEL_TAG" = "null" ]; then
    echo "Could not find a panel release on $REPO"
    exit 1
  fi
  PANEL_VERSION="${PANEL_TAG#panel-v}"
fi

echo "Downloading panel v$PANEL_VERSION"

mkdir -p /var/www/BytePanel
cd /var/www/BytePanel
PANEL_ZIP="bytepanel-panel-v$PANEL_VERSION.zip"
RELEASE_URL="https://github.com/$REPO/releases/download/panel-v$PANEL_VERSION"
curl -fLo "$PANEL_ZIP" "$RELEASE_URL/$PANEL_ZIP"
curl -fLo SHA256SUMS "$RELEASE_URL/SHA256SUMS"

echo "Verifying download"
sha256sum -c --ignore-missing SHA256SUMS

unzip -o "$PANEL_ZIP"
rm "$PANEL_ZIP" SHA256SUMS

echo "Remove Agent source"

# Delete the agent files (So we use as less space as we can)
rm -rf apps/agent

echo "Copy .env"

# Copy env file
cp apps/web/.env.example apps/web/.env

echo "Installing Dependencies"

# Install all Dependencies
bun install --frozen-lockfile

echo "Panel installation complete, please follow the manual steps https://bytepanel.nodebyte.co.uk/docs/auto-install-manual-steps"