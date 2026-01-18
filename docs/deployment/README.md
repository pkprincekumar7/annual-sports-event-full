# Deployment Guides

This folder splits deployment instructions by operating system so you can follow a focused, beginner-friendly guide.

For general product and API documentation, see `docs/guides`.

## Ubuntu (Linux)
- `ubuntu/quick-start.md` - Local setup and running the app
- `ubuntu/docker-engine-install.md` - Install Docker Engine + Compose
- `ubuntu/docker-compose.md` - Run the full stack with Compose
- `ubuntu/systemd-frontend.md` - Frontend as a systemd service
- `ubuntu/systemd-backend.md` - Backend as a systemd service (includes MongoDB)
- `ubuntu/nginx-reverse-proxy.md` - Nginx reverse proxy for frontend/backend
- `ubuntu/troubleshooting.md` - Common service and port issues

## Windows
- `windows/quick-start.md` - Local setup and running the app
- `windows/docker-desktop.md` - Install Docker Desktop + WSL2
- `windows/docker-compose.md` - Run the full stack with Compose
- `windows/services.md` - Run frontend/backend as Windows services (NSSM)

## macOS
- `macos/quick-start.md` - Local setup and running the app
- `macos/docker-desktop.md` - Install Docker Desktop
- `macos/docker-compose.md` - Run the full stack with Compose
- `macos/launchd-services.md` - Run frontend/backend as launchd services

## Other Deployment Options
- `other-options.md` - Static hosting, PaaS, Docker without Compose, Kubernetes
