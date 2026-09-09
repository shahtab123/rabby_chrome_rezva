# Rabby + Rezva (Chrome extension)

Rabby Chrome MV3 wallet with **Rezva** identifier resolution. Resolve emails, provider names, Bangla QR, and more into on-chain USDC payment destinations — then send with Rabby’s normal Send flow.

Official site: [https://rezva.xyz](https://rezva.xyz)

## Install (developer / unpacked)

1. Clone this repo and install dependencies:

```bash
git clone https://github.com/shahtab123/rabby_chrome_rezva.git
cd rabby_chrome_rezva
npm install
```

2. Configure Rezva credentials (never commit secrets):

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
REZVA_PROVIDER_API_KEY=rzva_prov_…
# or REZVA_FREE_API_KEY=rzva_free_…

# Production (recommended):
REZVA_API_BASE_URL=https://universal-payment-api.sabrishahtab.workers.dev

# Local API instead (API must be running on your PC):
# REZVA_API_BASE_URL=http://127.0.0.1:8787
```

3. Build the Chrome MV3 extension:

```bash
npm run build:debug
```

Output folder: `dist/`

4. In Chrome open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the `dist` folder.

## How to use

1. Unlock Rabby → **Send**.
2. In the “To” field, paste an identifier or scan a QR (not only a `0x` address).
3. Wait for Rezva resolve UI (destination, network, asset).
4. Confirm and send USDC. Gas is paid in the chain’s native token.

### Identifiers to try

| Input | Type |
| --- | --- |
| `shahtab.rabby` | Provider name |
| `test@test.com` | Email |
| Bangla / EMV QR | Full QR text starting with `000201…`, or scan the poster |

Sample Bangla QR poster (scan with Rabby’s QR button or paste the decoded EMV string):

![Bangla QR](./bangla%20qr.png)

### Check USDC deposits

Resolved payments for these test identifiers land on:

`0x7774001cB9a85AF9683246D357884fFe17c0C364`

Base Sepolia explorer:

[https://sepolia.basescan.org/address/0x7774001cB9a85AF9683246D357884fFe17c0C364](https://sepolia.basescan.org/address/0x7774001cB9a85AF9683246D357884fFe17c0C364)

## API base URL (local vs production)

| Build | Default API |
| --- | --- |
| Debug / local (`npm run build:debug`, `npm run build:dev`) | `http://127.0.0.1:8787` unless `REZVA_API_BASE_URL` is set |
| Release / pro | `https://universal-payment-api.sabrishahtab.workers.dev` unless overridden |

You can always override in `.env.local` or in the Send → Rezva config UI. Local testing still works when the Rezva API is running on your machine.

Health check:

```bash
curl https://universal-payment-api.sabrishahtab.workers.dev/health
```

## Notes

- Do not hardcode merchants or destinations — always use `POST /v1/resolve`.
- Use `token_contract` / `network_identifier` from the resolve response only.
- Docs: [https://rezva.xyz](https://rezva.xyz)

Based on [RabbyHub/Rabby](https://github.com/RabbyHub/Rabby).
