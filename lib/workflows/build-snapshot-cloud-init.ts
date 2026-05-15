import "server-only";

const SYSTEMD_UNIT = `[Unit]
Description=NodeByte Agent
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=simple
ExecStart=/usr/local/bin/nodebyte-agent
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production
ReadWritePaths=/var/lib/nodebyte /etc/nodebyte /usr/local/bin
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
`;

const indent = (text: string, spaces: number): string => {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => (line.length > 0 ? pad + line : line))
    .join("\n");
};

export const buildSnapshotCloudInit = (agentBinaryUrl: string): string => {
  const shouldSkipFullUpgrade =
    process.env.SNAPSHOT_SKIP_FULL_UPGRADE === "1" ||
    process.env.SNAPSHOT_SKIP_FULL_UPGRADE === "true";
  const upgradeStep = shouldSkipFullUpgrade
    ? 'echo "Skipping full apt upgrade (SNAPSHOT_SKIP_FULL_UPGRADE enabled)"'
    : "apt-get -y upgrade";

  const buildScript = `#!/usr/bin/env bash
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive

retry_cmd() {
  local attempts="$1"
  shift

  local count=1
  while true; do
    if "$@"; then
      return 0
    fi

    if [ "$count" -ge "$attempts" ]; then
      return 1
    fi

    echo "Command failed (attempt $count/$attempts): $*" >&2
    sleep $((count * 5))
    count=$((count + 1))
  done
}

retry_cmd 5 apt-get update
${upgradeStep}
retry_cmd 5 apt-get -y install --no-install-recommends ca-certificates curl gnupg ufw

if command -v docker >/dev/null 2>&1; then
  echo "Docker already present on builder image; skipping Docker apt bootstrap"
  systemctl enable --now docker || true
else
  for pkg in docker.io docker-doc docker-compose podman-docker containerd runc; do
    apt-get -y remove "$pkg" 2>/dev/null || true
  done

  install -m 0755 -d /etc/apt/keyrings
  retry_cmd 5 curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \${VERSION_CODENAME} stable" \\
    > /etc/apt/sources.list.d/docker.list

  retry_cmd 5 apt-get update
  retry_cmd 5 apt-get -y install --no-install-recommends docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  systemctl enable --now docker
fi

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw --force enable

mkdir -p /etc/nodebyte /var/lib/nodebyte/game
chmod 700 /etc/nodebyte /var/lib/nodebyte

retry_cmd 5 curl --retry 5 --retry-delay 5 --retry-connrefused -fsSL "${agentBinaryUrl}" -o /usr/local/bin/nodebyte-agent

# Verify the download is a Linux ELF — guards against silently baking an HTML
# auth-wall or sign-in redirect into the snapshot. Aborts the script (set -e)
# so the VM never reaches \`shutdown -h now\` and the workflow's wait-for-off
# loop times out with a clear failure instead of producing a broken image.
magic=$(head -c 4 /usr/local/bin/nodebyte-agent | od -An -tx1 | tr -d ' ')
if [ "$magic" != "7f454c46" ]; then
  echo "agent binary is not an ELF (magic=$magic, size=$(stat -c %s /usr/local/bin/nodebyte-agent) bytes)" >&2
  echo "first 200 bytes:" >&2
  head -c 200 /usr/local/bin/nodebyte-agent >&2 || true
  exit 1
fi

chmod +x /usr/local/bin/nodebyte-agent

systemctl daemon-reload
systemctl enable nodebyte-agent.service

apt-get clean
rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
truncate -s 0 /var/log/*log /var/log/**/*log || true
cloud-init clean --logs || true

shutdown -h now
`;

  return `#cloud-config
write_files:
  - path: /etc/systemd/system/nodebyte-agent.service
    owner: root:root
    permissions: '0644'
    content: |
${indent(SYSTEMD_UNIT, 6)}
  - path: /root/build-image.sh
    owner: root:root
    permissions: '0755'
    content: |
${indent(buildScript, 6)}
runcmd:
  - bash /root/build-image.sh
`;
};
