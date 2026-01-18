# Other Deployment Options

## Frontend: Static Hosting (Vercel/Netlify/S3 + CloudFront)
1. Build the frontend:
   ```bash
   npm run build
   ```
2. Set `VITE_API_URL` at build time to your backend URL.
3. Upload the `dist/` folder to your hosting provider and configure SPA routing.

## Backend: PaaS (Render/Railway/Heroku)
1. Set environment variables in the platform settings (`PORT`, `MONGODB_URI`, `JWT_SECRET`, email vars).
2. Set the start command to `node server.js`.
3. Ensure the platform exposes the port defined by `PORT`.

## Docker (Without Compose)
1. Build images:
   ```bash
   docker build -f Dockerfile.backend -t annual-sports-backend .
   docker build -f Dockerfile.frontend -t annual-sports-frontend .
   ```
2. Run containers with required environment variables and port mappings.

## Kubernetes (Optional)
Deploy using separate Deployments/Services for frontend and backend, plus a MongoDB StatefulSet.
Set the same environment variables used in `.env.example`.
