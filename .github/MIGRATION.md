# Migrating from Pterodactyl

This guide moves an existing Pterodactyl install to BytePanel: the panel's data first, then each node from Wings to the BytePanel agent. Server files stay where they are on each node and are never copied, so game servers come back with their worlds, configs and backups intact.

The migration has two parts:

1. **Panel:** import the Pterodactyl database into BytePanel with `migrate:pterodactyl`.
2. **Nodes:** on each node, replace Wings with the agent using `bytepanel-daemon import-wings`.

Plan a maintenance window. Each node's servers are offline from the moment you stop them until the agent starts them again, which is usually a few minutes per node.

## Before you start

- A running BytePanel with its database migrated (`bun run db:deploy` in `apps/web`, or the Docker image, which does this on start). See the [README](README.md).
- `BETTER_AUTH_SECRET` and `DATABASE_URL` set in `apps/web/.env`. The import encrypts the new node tokens with `BETTER_AUTH_SECRET`, so use the same value as the running panel.
- Bun 1.3.13+ on the machine running the import, plus a checkout of this repository with `bun install` done.
- Access to the Pterodactyl database, either directly (`mysql://...`) or as a dump.
- Root SSH access to every node.
- A fresh backup of the Pterodactyl database and of `/etc/pterodactyl` on each node.

## Part 1: Import the panel data

### 1. Choose a source

The importer can read from the live Pterodactyl database:

```bash
--source mysql://pterodactyl:password@127.0.0.1:3306/panel
```

Or from a dump file (`.sql` or `.sql.gz`), which is handy when the BytePanel host can't reach MySQL:

```bash
mysqldump -u pterodactyl -p panel > panel.sql
# optional: keep the dump small by leaving out log tables
mysqldump -u pterodactyl -p panel --ignore-table=panel.activity_logs --ignore-table=panel.activity_log_subjects > panel.sql
```

Dumps need their table structure (the default). If you made one with `--no-create-info`, re-dump it with `--complete-insert`.

If your Pterodactyl tables use a prefix (`DB_PREFIX` in Pterodactyl's `.env`), pass it with `--prefix`.

### 2. Do a dry run

From `apps/web`:

```bash
bun run migrate:pterodactyl --source panel.sql --dry-run
```

A dry run performs the whole import inside a transaction and rolls it back. It prints how many rows of each type it would import, any egg features BytePanel can't represent, and the tables it skips. Fix anything it complains about before continuing.

### 3. Run the import

```bash
bun run migrate:pterodactyl --source panel.sql
```

The import runs in a single transaction, so it either fully succeeds or changes nothing. It is safe to run again, for example after a newer dump: rows are matched by email, UUID, location short code, nest name or egg name and updated in place.

### What gets imported

| Pterodactyl | BytePanel | Notes |
| --- | --- | --- |
| Users | Users | Passwords carry over (see [Signing in](#signing-in-after-the-migration)). Root admins become admins. |
| Locations, nodes, allocations | Locations, nodes, allocations | Nodes get new daemon tokens; Wings tokens can't be reused. |
| Nests, eggs, egg variables | Nests, eggs, egg variables | Eggs that copy config or scripts from another egg are resolved. |
| Servers, server variables | Servers, server variables | UUIDs are kept, so files on the node line up. Primary and extra allocations are kept. |
| Backups | Backups | The archives themselves are moved in Part 2. |
| Subusers | Server members | Mapped to a role: read-only permissions become *viewer*, user management becomes *admin*, everything else *member*. |

### What doesn't carry over

| Pterodactyl data | Why |
| --- | --- |
| Two-factor (TOTP) secrets | BytePanel doesn't use TOTP. Users can add a passkey instead. |
| API keys, SSH keys, recovery tokens | Different credential formats; users recreate them. |
| Database hosts and databases | BytePanel doesn't manage databases. The databases themselves are untouched. |
| Schedules and tasks | BytePanel has no schedules. |
| Mounts | Re-create them as `extraMounts` on the eggs that need them. |
| Activity, audit and API logs | History only. |
| Sessions, password resets, jobs, notifications, settings | Pterodactyl runtime state. Configure panel settings again in BytePanel's admin area. |

Egg config-file rules that BytePanel can't express, such as conditional values or the XML parser, are dropped. Each one is printed as a warning, so check those eggs afterwards.

## Part 2: Switch each node from Wings to the agent

Do this one node at a time. Nothing on the node is deleted, so a node can be rolled back at any point (see [Rolling back](#rolling-back-a-node)).

### 1. Stop the node's servers

Stop every server on the node from Pterodactyl, while Wings is still running, so each one shuts down with its egg's stop command and saves cleanly.

### 2. Install and configure the agent

Install the agent, then open the node's page in the BytePanel admin area and run the `configure` command shown there:

```bash
bytepanel-daemon configure --panel https://panel.example.com --token <tokenId.token>
```

Don't start the agent yet. Wings still holds ports 8080 and 2022.

### 3. Import the Wings setup

Preview what will happen, then run it:

```bash
bytepanel-daemon import-wings --dry-run
bytepanel-daemon import-wings
```

`import-wings` reads `/etc/pterodactyl/config.yml` and:

- stops and disables `wings.service`
- removes the Wings containers (the agent recreates them with its own settings on first start) and the `pterodactyl_nw` Docker network
- moves backup archives from `/var/lib/pterodactyl/backups` into the agent's backup directory
- reuses Wings' SFTP host key, so SFTP clients don't warn about a changed key
- keeps Wings' data directory, file owner UID/GID, timezone, DNS servers, allowed origins and TLS certificate paths

| Flag | Default | Use |
| --- | --- | --- |
| `--dry-run` | off | Print the plan without changing anything. |
| `--stop-running` | off | Stop servers that are still running (SIGTERM, 60s) instead of refusing. |
| `--force` | off | Continue even if the Wings config belongs to a different node. |
| `--wings-config` | `/etc/pterodactyl/config.yml` | Path to the Wings config. |
| `--wings-service` | `wings` | Name of the Wings systemd unit. |
| `--config` | `/etc/bytepanel/daemon.json` | Path to the agent config. |

> [!IMPORTANT]
> Running `configure` again later resets the imported settings to the panel's values, including the file owner UID/GID, which breaks permissions on migrated servers. If you re-run `configure`, run `import-wings` straight after it. It's safe to repeat while `/etc/pterodactyl/config.yml` is still on the node.

### 4. Start the agent and check it

```bash
systemctl enable --now bytepanel-daemon
journalctl -u bytepanel-daemon -f
```

Start one server from BytePanel and check that the console, file manager, SFTP and a backup restore all work. Then start the rest.

### 5. Clean up

When the node has run well for a while, you can remove Wings:

```bash
rm /usr/local/bin/wings /etc/systemd/system/wings.service
rm -rf /etc/pterodactyl /var/lib/pterodactyl/archives /var/lib/pterodactyl/.sftp
```

Leave `/var/lib/pterodactyl/volumes` alone: that's where the server files still live. To move them somewhere else later, stop the node's servers, move the folder, and change both the node's daemon base in the panel and `system.data` in `/etc/bytepanel/daemon.json`.

## Signing in after the migration

How imported users sign in depends on the panel's billing provider:

- **BytePay:** customers sign in with BytePay, and staff (admins) sign in with their password or a passkey. When a customer signs in with BytePay for the first time, it links to their imported account by email address, so their servers are waiting for them. Make sure customers' BytePay emails match the ones they used in Pterodactyl.
- **Any other provider:** everyone signs in with their existing Pterodactyl email and password. Pterodactyl's bcrypt password hashes are accepted as they are.

Imported admins become admins, not super admins. Promote the accounts that need it in the admin area.

SFTP uses a separate password in BytePanel. Each user sets one from their account settings before connecting. The host and port are unchanged.

## Rolling back a node

Until you clean up, Wings can be brought back:

```bash
systemctl disable --now bytepanel-daemon
docker ps -a --filter label=bytepanel.server -q | xargs -r docker rm -f
systemctl enable --now wings
```

Backup archives moved in Part 2 are in `/var/lib/bytepanel/backups`. Move them back to `/var/lib/pterodactyl/backups` if Wings needs them. The Pterodactyl panel and its database are not changed by the import, so they keep working.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `Table ... is not in the dump (wrong --prefix?)` | The dump is missing a table, or the tables use a prefix. Pass `--prefix`, or dump the whole database. |
| `INSERT into ... has no column list` | The dump has no table structure. Re-dump without `--no-create-info`, or with `--complete-insert`. |
| `Wings is node ... but the agent is configured for node ...` | You ran `configure` with another node's token. Use the command from this node's admin page. |
| `server(s) are still running under Wings` | Stop them from Pterodactyl, or pass `--stop-running`. |
| Servers fail with permission errors | The agent isn't using Wings' file owner. Check `system.user` in `/etc/bytepanel/daemon.json` against `id pterodactyl`, or re-run `import-wings`. |
| Servers have no files | The node's `system.data` doesn't point at the Wings volumes. Check it against `system.data` in the Wings config. |
| `subnet 172.18.0.0/16 is in use` in the agent log | The `pterodactyl_nw` network is still there. Remove it after the Wings containers are gone, or let the agent pick another subnet. |
| Timestamps are off by a few hours | Dates are read as UTC. If Pterodactyl's `APP_TIMEZONE` wasn't UTC, created and backup dates shift by that offset. Nothing else is affected. |

Need help? Ask on [Discord](https://discord.gg/53byT2VrhQ).
