# Billing integrations

Modules that let WHMCS, Blesta and Paymenter create and manage BytePanel servers. BytePay has its own built-in module and doesn't need these.

Everything in this folder is MIT licensed (see [LICENSE](LICENSE)), unlike the rest of the repo, which is AGPL-3.0.

Every module calls the panel's billing API. Before installing one:

1. In BytePanel, open **Admin → Settings → Billing**, choose your billing system and enter your store URL.
2. Generate an API key. You'll need the key and your panel URL below.
3. Note the plan, game and location you want to sell. The modules list them for you.

Each billing service maps to one panel server. Customers get a panel account with the email from their billing account. They sign in through the "Open control panel" button, or by setting a password with "Forgot password?" on the panel's sign-in page.

## WHMCS

1. Copy `whmcs/modules/servers/bytepanel` to `modules/servers/bytepanel` in your WHMCS install.
2. **System Settings → Servers → Add New Server**: choose **BytePanel**, enter the panel hostname (for example `panel.example.com`), and paste the API key into **Password** or **Access Hash**. Click **Test Connection**.
3. Create a product with module **BytePanel** and pick a plan, and optionally a game and location.

To let customers choose, add configurable options named:

- `Game`, whose option values are game IDs, for example `clx123|Minecraft`.
- `Location`, whose option values are location IDs.
- Any game variable name in capitals, for example `MAX_PLAYERS`. The value is passed to the server's environment.

A custom field named `Server Name` sets the server name.

## Blesta

1. Copy `blesta/components/modules/bytepanel` to `components/modules/bytepanel` in your Blesta install.
2. **Settings → Modules → Available**: install **BytePanel**, then add a panel with its URL and API key. The key is checked when you save.
3. Create a package with module **BytePanel**, then choose a plan, and optionally a game and location.

For customer choices, add configurable options named `egg` and `location` (values are IDs) or a game variable name in capitals. Customers open the panel from the **Control panel** tab on their service.

## Paymenter

1. Copy `paymenter/extensions/Servers/BytePanel` to `extensions/Servers/BytePanel` in your Paymenter install.
2. **Extensions → Servers**: add **BytePanel** with the panel URL and API key.
3. Create a product with that server and pick a plan. Tick **Let customers choose the game** or **Let customers choose the location** to show pickers at checkout.

## API

All modules use the same endpoints under `<panel>/api/application`, with `Authorization: Bearer <key>`:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/catalog` | Plans, games and locations |
| POST | `/servers` | Create a server (`externalId`, `planId`, `eggId`, `locationId`, `environment`, `user`) |
| GET | `/servers/{externalId}` | Server status |
| PATCH | `/servers/{externalId}` | Change plan (`planId`) |
| DELETE | `/servers/{externalId}` | Terminate |
| POST / DELETE | `/servers/{externalId}/suspend` | Suspend / unsuspend |
| POST | `/servers/{externalId}/login` | One-time sign-in link, valid for 60 seconds |

Creating a server again with the same `externalId` returns the existing server, so retries are safe.
