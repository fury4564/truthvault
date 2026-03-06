# TruthVault

> Anonymous. Secure. Temporary.

TruthVault is a web-based application designed to provide the ultimate level of ephemeral and anonymous communication. Users engage in completely anonymous, text-based conversations that vanish without a trace for them once they leave. Conversely, a hidden administrative system retains a complete, immutable record of all activity. 

## Features

* **Ephemeral & Anonymous:** User messages disappear upon leaving a room. Communication is strictly anonymous, with users assigned random IDs (e.g., `User-492`) and colors.
* **Room Management:** Generate unique Room Codes (e.g., `7A2B-9F1C`) and One-Time Invite Links. Rooms can be optionally password-protected.
* **Real-Time Communication:** Live chat powered by WebSockets, featuring typing indicators, read receipts, and instant message delivery.
* **Network Ready:** Invite links and QR codes dynamically adapt to your local network IP, making local hosting and sharing seamless out-of-the-box.
* **Security & Privacy Focus:** 
  * "No Trace" architecture for users (localStorage, sessionStorage, and IndexedDB are purged actively).
  * System-wide copy/paste disabled.
  * Screenshot detection warnings.
* **Admin Recall System:** A hidden, secure admin dashboard.
  * Search by Room Code or User ID.
  * View complete, immutable chat logs for active or archived rooms.
  * Download logs as TXT or JSON.
  * "Ghost Mode" joining to silently observe active rooms.

## Tech Stack

* **Frontend:** React.js + Vite (Single Page Application)
* **Backend:** Node.js + Express
* **Database:** Native JSON file-store (`truthvault_data.json`)
* **Real-time Engine:** Socket.IO
* **Styling:** Custom plain CSS with modern glassmorphism, dynamic animations, and dark mode native design.

## How to Run Locally

### Prerequisites
* Node.js (v18 or higher recommended)
* NPM

### 1. Clone the repository
```bash
git clone https://github.com/fury4564/truthvault.git
cd truthvault
```

### 2. Start the Backend Server
Open a terminal window and navigate to the `server` directory:

```bash
cd server
npm install
node server.js
```
The backend server will start on port `3001` and bind to `0.0.0.0` to allow local-network connections.

### 3. Start the Frontend Application
Open a **new** terminal window and navigate to the `client` directory:

```bash
cd client
npm install
npx vite --host
```
Vite will start the frontend development server. Using the `--host` flag ensures it broadcasts on your local network (e.g., `http://10.90.x.x:5173`) allowing easy testing across devices on your Wi-Fi!

## Admin Panel Access
The admin panel is hidden on the `/nothing` route.
1. Click the **TruthVault logo** on the home page. 
2. Click the **Nothing** link on the top right NavBar.
3. Enter the 3-step master override sequence: **`6211825`** (enter three times).

---
*Developed for unparalleled ephemeral privacy.*
