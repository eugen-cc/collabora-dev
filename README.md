# Collabora Online Workspace (WOPI Integration)

A modern, high-performance web workspace allowing real-time, collaborative editing of Microsoft Word (`.docx`) documents. This application integrates a **Vite React frontend** (styled with the KoliBri design system), a **Java Spring Boot WOPI backend**, and the official **Collabora Online Development Edition (CODE)** running in Docker.

---

## 🏗️ Architecture Overview

The integration follows the standard **WOPI (Web Application Open Platform Interface)** protocol defined by Microsoft, enabling secure communication between the client, host, and editor frame:

1. **Vite React Frontend:** Renders the dashboard of documents. When you edit a document, it opens a dedicated popup browser window loaded with a Collabora Online IFrame.
2. **Java Spring Boot Backend:** Serves as the WOPI Host. It stores documents physically, tracks lock tokens in-memory, and provides WOPI REST endpoints (`CheckFileInfo`, `GetFile`, `PutFile`, and lock overrides).
3. **Collabora Online Server (CODE):** Runs inside a Docker container. It downloads the document from the Spring Boot backend, displays the editing environment to the user, and uploads changes back to the backend.

```
[ Browser / React App ] <=====> [ Collabora Online (Docker CODE) ]
          |                                     ||
          | (Files REST API)                    || (WOPI Protocol: GetFile/PutFile)
          v                                     v
[ Spring Boot WOPI Backend ] <==================//
```

---

## 📋 Prerequisites

To run this application locally, ensure your machine has the following software installed:

1. **Docker Desktop:** Required to host the Collabora Online (CODE) editor container.
2. **Java JDK 21 or higher:** The backend is built on Spring Boot 3.4.3 and compiled to Java 21 bytecode.
3. **Apache Maven 3.6+:** Used to build, compile, and run the backend Java project.
4. **Node.js (v18+) & npm:** Required to run the Vite Dev Server for the React frontend.

---

## 🚀 Getting Started

Follow these step-by-step instructions to get the complete stack up and running:

### Step 1: Install Frontend Dependencies
From the root directory of the repository, download and install Node.js modules:
```bash
npm install
```

### Step 2: Start Collabora CODE (Docker)
Launch the Collabora Online server container. This command disables SSL for local development and maps port `9980`:
```bash
docker run -t -d -p 9980:9980 -e "extra_params=--o:ssl.enable=false --o:ssl.termination=false" --cap-add MKNOD --name collabora-online collabora/code
```
*(Verify the container is running by typing `docker ps` or checking logs using `docker logs -f collabora-online`)*

### Step 3: Run Frontend & Backend Concurrently
Start both the Java Spring Boot backend and the Vite React frontend with a single command:
```bash
npm run dev:all
```
*(Alternatively, you can run `./start.sh` directly)*

Once started:
- **React Frontend:** Available at [http://localhost:5173/](http://localhost:5173/)
- **Spring Boot Backend:** Runs on [http://localhost:5001/](http://localhost:5001/)

Press **`Ctrl+C`** in the terminal to stop both servers cleanly at the same time.

---

## 🛠️ Configuration Details

You can modify and view configurations in the following places:

### Backend Configuration
File: [application.properties](file:///Users/eugen/dev/checkouts/kolTest/wopi-backend/src/main/resources/application.properties)
- `server.port=5001` - Port for API endpoints.
- `wopi.files.dir=wopi-backend/files` - Target directory where documents are read and saved.
- `wopi.sample.path=wopi-backend/sample.docx` - Template document used when creating a new file.

### Connection Settings (UI & LocalStorage)
You can configure connection parameters dynamically in the web UI under **Verbindungs-Einstellungen**:
- **Collabora Online URL (CODE):** `http://localhost:9980` (where your Docker container runs).
- **WOPI Host URL (Backend):** `http://host.docker.internal:5001` (allows the CODE container to resolve the backend API running on the host machine).

---

## 💻 Available Scripts

Run these commands from the root directory:

| Command | Action |
| :--- | :--- |
| `npm run dev:all` | Launches both backend and frontend concurrently (via `start.sh`) |
| `npm run backend` | Launches only the Java Spring Boot WOPI backend |
| `npm run dev` | Launches only the Vite React frontend |
| `npm test` | Runs the Vitest unit testing suite |
| `npm run lint` | Runs the TypeScript compiler check (`tsc --noemit`) |
| `npm run format` | Runs the Prettier check to verify code styling formatting |
| `npm run build` | Compiles typescript assets and builds production bundles in `/dist` |

---

## 📂 Project Structure

```
.
├── package.json            # Node scripts and dev dependencies
├── pom.xml                 # Maven configuration (at root, redirects build)
├── start.sh                # Concurrent startup shell script
├── vite.config.ts          # Vite bundle configuration
├── vitest.config.ts        # Vitest suite configuration
├── src/                    # Frontend source code
│   ├── App.tsx             # React main component (Dashboard UI)
│   ├── App.test.tsx        # Unit tests for dashboard & editor
│   ├── setupTests.ts       # Test framework mocks & setup hooks
│   └── components/
│       └── CollaboraEditor.tsx  # IFrame bridge for Collabora & WOPI forms
└── wopi-backend/           # Java Spring Boot backend
    ├── pom.xml             # Backend Maven project descriptor
    ├── sample.docx         # Template document for creating files
    ├── files/              # Local storage folder for document files
    └── src/main/
        ├── resources/
        │   └── application.properties # Server properties (port, paths)
        └── java/com/example/wopibackend/
            ├── WopiBackendApplication.java # Spring Boot entrypoint
            ├── model/
            │   └── DocumentInfo.java       # Document record model
            └── controller/
                └── WopiController.java     # WOPI and general REST API
```
