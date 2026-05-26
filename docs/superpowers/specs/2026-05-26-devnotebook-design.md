# DevNotebook — Design Spec

A secure, local-first desktop application for developers to manage project secrets, configurations, architecture notes, and ideas in a unified notebook interface. Cross-platform (macOS + Windows), with Bluetooth proximity-based auto-locking.

## Tech Stack

- **Backend**: Rust via Tauri v2
- **Frontend**: React + TypeScript + Tailwind CSS
- **Rich Editor**: TipTap (WYSIWYG, Notion-like)
- **Database**: SQLite + SQLCipher (AES-256-CBC encryption)
- **Bluetooth**: `btleplug` crate (cross-platform BLE)
- **Key Derivation**: Argon2id
- **Build Targets**: `.dmg` (macOS), `.msi`/`.exe` (Windows)

## Authentication & Security

### Master Password

- On first launch, user creates a master password
- Password is processed through Argon2id to derive an encryption key
- This key encrypts/decrypts the SQLCipher database — the password is never stored
- Failed login attempts trigger exponential backoff (1s, 2s, 4s, 8s...)

### Bluetooth Proximity Lock

- **Pairing**: User selects their phone from a BLE scan in settings. App stores the device's BLE address.
- **Monitoring**: Rust backend polls for the paired device every 5 seconds via `btleplug`. Tracks RSSI (signal strength) to estimate proximity.
- **Soft lock trigger**: When phone signal drops below threshold (default ~-80 dBm) or device is not found for 30 seconds (configurable), the app locks.
- **Lock behavior**: All decrypted secrets wiped from memory, database connection closed, UI shows lock screen. App stays running in system tray.
- **Status bar indicators**: Green dot = connected, amber = weak signal / countdown active, red = disconnected/locked.
- **Unlock**: Phone must be back in range AND user re-enters master password. Proximity alone never unlocks.

### Future enhancement (not in v1)

- QR code pairing with a phone-side PWA that advertises a unique BLE token for stronger device verification.

### Data at Rest

- SQLCipher encrypts the entire database file (AES-256-CBC)
- Secrets are additionally encrypted per-field with the derived key (defense in depth)
- Clipboard auto-clears after 30 seconds when copying a secret

## Data Model

### Tables

**projects**
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Primary key |
| name | TEXT | Project display name |
| icon | TEXT | Optional emoji or icon identifier |
| directory_path | TEXT | Optional linked filesystem path |
| sort_order | INTEGER | Tab ordering |
| created_at | DATETIME | |
| updated_at | DATETIME | |

**secret_categories**
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Primary key |
| project_id | TEXT | FK to projects |
| name | TEXT | Category display name |
| icon | TEXT | Optional icon |
| is_builtin | BOOLEAN | Whether this is a pre-populated category |
| is_hidden | BOOLEAN | User can hide builtins (not delete) |
| sort_order | INTEGER | Sidebar ordering |

**Pre-populated builtin categories**: API Keys, Passwords, Database, OAuth Tokens, SSH Keys, Env Variables, Certificates, Webhooks, License Keys, Service Accounts, Personal Access Tokens, Encryption Keys

**secrets**
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Primary key |
| category_id | TEXT | FK to secret_categories |
| name | TEXT | Secret display name |
| encrypted_value | BLOB | Per-field encrypted value |
| masked_preview | TEXT | e.g., `sk_live_••••4242` |
| notes | TEXT | Optional plaintext notes |
| created_at | DATETIME | |
| updated_at | DATETIME | |

**notes**
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Primary key |
| project_id | TEXT | FK to projects |
| title | TEXT | Note title |
| content | TEXT | TipTap JSON document format |
| category | TEXT | Architecture / Improvements / Ideas / custom |
| sort_order | INTEGER | |
| created_at | DATETIME | |
| updated_at | DATETIME | |

**settings**
| Column | Type | Description |
|--------|------|-------------|
| key | TEXT | Setting identifier |
| value | TEXT | JSON-encoded value |

## UI Architecture

### Shell Layout

```
┌──────────────────────────────────────────────────┐
│  [my-saas-app ×] [personal-site ×] [mobile ×] + │  ← Obsidian-style tabs
├────────┬─────────────────────────────────────────┤
│ SECRETS│                                         │
│ ▸ API  │  Content area:                          │
│   Pass │  - Secret list view (when category      │
│   DB   │    selected)                            │
│   OAuth│  - Rich text editor (when note          │
│   SSH  │    selected)                            │
│   Env  │  - Settings view                        │
│   Cert │                                         │
│   Web  │                                         │
│   Lic  │                                         │
│ + Cust │                                         │
│        │                                         │
│ NOTES  │                                         │
│   Arch │                                         │
│   Impr │                                         │
│   Ideas│                                         │
├────────┴─────────────────────────────────────────┤
│ 🟢 BT: iPhone connected  │  Vault encrypted     │  ← Status bar
└──────────────────────────────────────────────────┘
```

### Tab Bar (Obsidian-style)

- Rounded top corners, active tab background matches content area
- Inactive tabs are recessed into darker bar
- Each tab has a close button (×)
- `+` button to create new project
- Dropdown chevron when many tabs are open
- Drag to reorder, right-click context menu (rename, close, duplicate)

### Sidebar (~200px, resizable)

- **Secrets section**: Lists categories with amber accent on active selection, amber left-border indicator
- **Notes section**: Lists note categories
- `+ Custom` at bottom of each section to add user-defined categories
- Collapsible via toggle

### Content Views

1. **Secret list view** — Cards showing name + masked preview. Actions per card: Copy (copies to clipboard, auto-clears after 30s), Reveal (shows plaintext for 10s then re-masks), Edit, Delete. Header has `+ Add` button. Supports bulk export as `.env` format.

2. **Secret edit modal** — Fields: name, value (password input with show/hide toggle), notes, category selector. For structured secrets (database connections): host, port, user, password, database name as individual fields.

3. **Note editor** — TipTap WYSIWYG with: headings, bold/italic, code blocks (syntax highlighted), tables, checklists, embedded images (base64), dividers. Autosaves on every change.

4. **Settings view** — Bluetooth device pairing, lock timeout slider, import/export, category management (reorder, hide, add), theme tweaks.

5. **Lock screen** — Centered master password input, Bluetooth status indicator, minimal branding. No project information visible.

### Theme

- **Base**: `#1a1a1a` content background, `#151515` sidebar, `#0e0e0e` tab bar, `#222` cards
- **Text**: `#e0e0e0` primary, `#888` secondary, `#666` muted
- **Accent**: `#d4a029` (amber/gold) — active tab top-border, sidebar selection indicator, action buttons, section labels
- **Status**: Green (`#4a9`) connected, amber (`#d4a029`) warning, red (`#c44`) disconnected
- No purple. Monochrome base with amber as the sole accent color.

## Cross-Platform

### macOS

- Tauri v2 with `Info.plist` declaring Bluetooth usage description
- One-time OS permission prompt for Bluetooth access
- `.dmg` distribution
- System tray icon for background proximity monitoring

### Windows

- Bluetooth via WinRT APIs (wrapped by `btleplug`)
- No special permissions beyond app trust
- `.msi`/`.exe` distribution
- System tray icon for background proximity monitoring

### Shared

- Single Rust backend codebase with a `platform` module for OS-specific Bluetooth/tray code
- Single React frontend codebase — no platform branching in UI code

## Project Directory Linking

- Projects can optionally link to a filesystem directory
- When linked, a background scan detects `.env`, `config.yaml`, `.env.local`, etc.
- Detected files are surfaced as import suggestions — user confirms before any values are imported
- Import is always one-time copy, not live sync (secrets are stored in the encrypted DB, not the original files)

## Verification Plan

1. **Auth**: Create vault, lock, re-enter password, verify secrets decrypt correctly. Test wrong password rejection and exponential backoff.
2. **Bluetooth**: Pair a phone, verify status bar shows connected. Walk away, verify soft lock triggers after 30s. Return and verify unlock flow (proximity + password).
3. **Secrets CRUD**: Add secrets across all builtin categories. Copy, reveal, edit, delete. Add a custom category. Hide a builtin, verify it disappears from sidebar but can be restored.
4. **Notes**: Create notes in each category. Test TipTap features: headings, code blocks, images, tables. Verify autosave.
5. **Cross-platform**: Build and test on both macOS and Windows. Verify Bluetooth works on both.
6. **Security**: Inspect the SQLCipher DB file with a hex editor — verify it's encrypted. Kill the app process while unlocked — verify restart requires password. Verify clipboard clears after 30s.
