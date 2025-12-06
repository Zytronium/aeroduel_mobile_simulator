# Aeroduel Mobile Simulator

A small React + Vite web app that simulates two Aeroduel mobile clients side‑by‑side.

Use it to quickly test and debug your Aeroduel game server's "mobile app" HTTP endpoints without needing real devices or native apps.

---

## Features

- **Two independent simulated mobiles**
  - Each has its own `userId`, `planeId`, and `playerName`
  - Join the same match as two different players
- **Join match flow**
  - Sends a `POST /api/join-match` request with the selected player details
  - Displays join status and stores the returned auth token (if any)
- **Server state inspection**
  - **View Match State** via `GET /api/match`
  - **View Planes & Scores** via `GET /api/planes`
  - Raw JSON displayed in a debug panel
- **Activity log**
  - Shows recent actions, successes, and errors (with timestamps)
  - Easy to see what each simulated mobile just did

---

## Tech Stack

- **Frontend:** React (via Vite)
- **Build tooling:** Vite
- **Icons:** [`lucide-react`](https://github.com/lucide-icons/lucide)
- **Styling:** TailwindCSS v4

---

## Prerequisites

- **Node.js**: v22+ (recommended)
- **npm**: v10+ (or compatible with your Node version)
- An **Aeroduel server** exposing the expected endpoints (see below)

---

## Getting Started

### 1. Install dependencies

From the project root:
```bash
npm install
```
### 2. Configure backend URL (optional)

By default, the simulator points to:
```text
http://aeroduel.local:45045
```
If your Aeroduel server is running elsewhere (e.g. `http://localhost:45321`), update the default URL in the app or configure DNS accordingly.

> Tip: If you're using something like `aeroduel.local`, make sure your hosts file or DNS points it to the correct machine.

### 3. Run the development server
```bash
npm run dev
```
Then open the URL printed in your terminal (usually `http://localhost:5173`).

The page should show **"Aeroduel Mobile Simulator"** with two "Mobile App" panels side‑by‑side.

---

## Expected Backend API

The simulator is a pure frontend client; it expects your Aeroduel server to expose the following endpoints:

### `POST /api/join-match`

Used when clicking **"Join Match"** on either mobile.

**Request body (JSON):**
```json
{
"planeId": "sim-plane-001",
"userId": "sim-user-001",
"playerName": "Foxtrot-4"
}
```
- The second mobile uses its own IDs (e.g. `sim-user-002`, `sim-plane-002`, etc.).
- `playerName` is editable before joining.

**Expected success response (JSON):**
```json
{
"authToken": "some-auth-token-string"
}
```
- The simulator:
  - Treats non‑error HTTP responses as success.
  - Stores the `authToken` value.
  - Shows a success log entry (with the token truncated for display).

**Expected error response (JSON):**
```json
{
"error": "Description of why the join failed"
}
```
- On HTTP error status codes, the simulator:
  - Resets the mobile's status to "Not Joined".
  - Shows an error entry in the activity log with the message from `error`.

---

### `GET /api/match`

Called when clicking **"View Match State"**.

- The response body is shown raw as pretty‑printed JSON in the **debug panel**.
- The simulator does not require a particular schema; it just displays whatever the server returns.

---

### `GET /api/planes`

Called when clicking **"View Planes & Scores"**.

- The response body is also shown raw as JSON in the debug panel.
- Intended for inspecting connected planes and their scores, but the actual structure is defined by your backend.

---

## Using the Simulator

1. **Start your Aeroduel server** and confirm it's listening on the hostname/port configured in the simulator.
2. **Run the simulator** with `npm run dev` and open it in your browser.
3. For each "Mobile App" panel:
   - Optionally **edit the Player Name** (before joining).
   - Click **"Join Match"**.
   - Check the **status badge** and **activity log** for result details.
4. Use the **"View Match State"** and **"View Planes & Scores"** buttons to:
   - Verify that your backend correctly updates and exposes match/plane information.
   - Inspect what the server sees in real time.

You can keep the page open and repeatedly:
- Re‑start your server,
- Change server logic,
- Refresh the browser
to quickly iterate on and validate your Aeroduel HTTP API.

---

## Available npm Scripts

Common scripts defined in `package.json` (typical for a Vite + React app):
```bash
# Start dev server (with HMR)
npm run dev

# Create a production build
npm run build

# Preview the production build locally
npm run preview

# Run linting
npm run lint
```
(If your `package.json` differs, adjust accordingly.)

---

## Project Structure (High Level)
```text
aeroduel_mobile_simulator/
public/          # Static assets served as-is
src/
assets/        # Frontend assets (images, etc.)
main.jsx       # Application entry point (Vite + React)
App.jsx        # Main UI: two mobile simulators + debug/log panels
index.css      # Global styles / utility integrations
index.html       # Root HTML for Vite
vite.config.js   # Vite configuration
eslint.config.js # ESLint configuration
package.json     # Project metadata, scripts, dependencies
```
---

## Notes & Tips

- **CORS:** If you're hosting the simulator on a different origin than the Aeroduel backend, ensure your backend's CORS configuration allows requests from the simulator's origin.
- **Auth tokens:** The simulator displays only a truncated version of the `authToken` for readability, but keeps the full value in its internal state.
- **Error handling:** Any network or JSON parsing errors will appear in the **Activity Log** as error entries.
