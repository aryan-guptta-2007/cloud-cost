# SentraAI Infrastructure

Deployment configurations, Docker setups, and containerization orchestration for development and production environments.

## Directory Layout

* `docker-compose.yml`: For running PostgreSQL, Redis, backend webhook receiver, and worker locally.
* `docker/`: Holds service-specific Dockerfiles.
  * `docker/backend.Dockerfile`
  * `docker/worker.Dockerfile`
