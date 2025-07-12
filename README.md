# Copima: GitLab Crawler Study Platform

Copima is a modular platform for conducting, managing, and analyzing privacy-focused GitLab crawler studies. It consists of two main components—**copilot-study** and **crawlz**—orchestrated via Docker Compose for seamless deployment and integration.

---

## Project Structure

```
/
├── copilot-study/   # Svelte-based participant & admin UI, socket server
│   ├── README.md
│   └── docs/
├── crawlz/          # Bun-based, privacy-focused GitLab crawler
│   ├── README.md
│   └── docs/
├── analysis/        # (Optional) Analysis scripts and reports
├── data/            # Persistent data storage (mounted as Docker volumes)
├── docker-compose.yml
└── README.md        # (You are here)
```

---

## Components Overview

### 1. copilot-study

- **Type:** SvelteKit web application & integrated Bun-based socket server
- **Purpose:**  
  - **Primary entrypoint for study participants:**  
    - Allows participants to authorize data collection via an oAuth flow (e.g., GitLab login).
    - Enables participants to view the progress of data collection across authorized areas, projects, and jobs.
    - Provides participants with the ability to download all data collected in their name.
  - **Admin UI:**  
    - For configuring, launching, and monitoring GitLab crawler studies.
    - Manages study metadata, user accounts, and real-time communication with crawler instances.
- **Key Participant Flows:**
  - **Authentication:**  
    - Participants access the platform and are prompted to log in via an oAuth provider (such as GitLab).
    - The login flow is handled at `/login`, presenting a simple login form that initiates the oAuth process.
  - **Progress Viewing:**  
    - After authentication, participants see an overview of their authorized GitLab accounts and the progress of data collection jobs.
    - The UI displays the status of each area, project, and job, updating in real time.
  - **Data Download:**  
    - Participants can download all data collected in their name via the `/data/download` route.
    - The download interface ensures participants have direct access to their personal study data.
- **Key Features:**
  - Study/job management dashboard (admin)
  - Real-time crawler status and logs via WebSockets
  - User authentication and access control (participant & admin)
  - REST and socket APIs for integration
- **Architecture:**  
  - SvelteKit frontend (participant & admin UI)
  - Bun backend (socket server, REST API, integrated into the web-app)
  - Connects to a persistent database (via Docker volume)
- **Further Documentation:**  
  See [`copilot-study/README.md`](copilot-study/README.md) and [`copilot-study/docs/`](copilot-study/docs/).

### 2. crawlz

- **Type:** Bun-based CLI application
- **Purpose:** Privacy-focused GitLab crawler that executes study jobs as configured by copilot-study. Collects, processes, and stores data according to strict privacy guidelines.
- **Key Features:**
  - Configurable crawling scopes and schedules
  - Privacy-preserving data collection and storage
  - Healthchecks and robust error handling
  - Communicates with copilot-study via sockets
- **Architecture:**  
  - Bun runtime (TypeScript/JavaScript)
  - Modular core, API, and storage layers
  - Uses Docker volumes for persistent data
- **Further Documentation:**  
  See [`crawlz/README.md`](crawlz/README.md) and [`crawlz/docs/`](crawlz/docs/).

---

## Quick Start: Running with Docker Compose

The recommended way to run Copima is via Docker Compose, which orchestrates both services and manages networking, volumes, and environment configuration.

### 1. Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/) installed

### 2. Setup

1. **Clone the repository:**
   ```sh
   git clone https://github.com/your-org/copima.git
   cd copima
   ```

2. **Configure environment variables:**
   - Copy and edit `.env.example` files in each component as needed.
   - Review environment variables in [`docker-compose.yml`](docker-compose.yml) for service-specific options.

3. **Start the platform:**
   ```sh
   docker compose up --build
   ```

4. **Alternative: One-Command Startup with `run` Script**

   For the simplest startup, you can use the provided [`run`](run) script. This script requires only [Docker](https://docs.docker.com/get-docker/) to be installed and will:
   - Remove old log files from `./data/logs/`
   - Shut down any running Docker Compose stack for the project
   - Start the platform using Docker Compose with the desired log level (default: `debug`)

   **Usage:**
   ```sh
   ./run
   ```

   Optionally, set the `LOG_LEVEL` environment variable to control logging verbosity:
   ```sh
   LOG_LEVEL=info ./run
   ```

   The script will handle setup and launch all services as described above.

5. **Access the participant & admin UI:**
   - Open [http://localhost:5173](http://localhost:5173) (default; see `docker-compose.yml` for port mapping).
   - Participants will be guided through authentication and can monitor progress or download their data directly from the UI.

### 3. Docker Compose Details

- **Services:**
  - `copilot-study`: Exposes participant/admin UI and socket server (default port: 5173)
  - `crawlz`: Runs the crawler engine (default port: 3000)
- **Volumes:**
  - Persistent storage for database, logs, and crawl data (`data/` directory)
- **Environment Variables:**
  - Set via `.env` files or directly in `docker-compose.yml`
- **Healthchecks:**
  - Both services include healthchecks for robust orchestration and monitoring

For detailed configuration, see comments in [`docker-compose.yml`](docker-compose.yml).

---

## Further Documentation

- **copilot-study:**  
  - [`copilot-study/README.md`](copilot-study/README.md)  
  - [`copilot-study/docs/`](copilot-study/docs/)
- **crawlz:**  
  - [`crawlz/README.md`](crawlz/README.md)  
  - [`crawlz/docs/`](crawlz/docs/)
- **Analysis scripts:**  
  - [`analysis/README.md`](analysis/README.md)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) (if available) or open an issue for questions and suggestions.

---

## License

See [LICENSE](LICENSE) for license details.

---