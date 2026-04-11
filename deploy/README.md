# Deploying on Hetzner

## Step 1 — Rent a Server

1. Go to [hetzner.com](https://hetzner.com) → Cloud → Create Server
2. Choose **Ubuntu 22.04**, at least **CX21** (2 vCPU, 4GB RAM)
3. Note your server's IP address

## Step 2 — Point Your Domain

At your domain registrar (Namecheap, GoDaddy, etc.):

- Add an **A record**: `@` → your server IP
- Add a **wildcard A record**: `*` → your server IP

This gives deployed apps their own subdomains automatically.

## Step 3 — Set Up Your Server

SSH into your server:

```bash
ssh root@YOUR_SERVER_IP
```

Install Docker:

```bash
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin
```

## Step 4 — Deploy the Platform

Upload your project to the server:

```bash
scp -r . root@YOUR_SERVER_IP:/opt/platform
ssh root@YOUR_SERVER_IP
cd /opt/platform
```

Copy and fill in your environment variables:

```bash
cp .env.example .env
nano .env   # fill in your domain, API key, and passwords
```

Start everything:

```bash
docker compose up -d
```

Your platform is now live at `https://yourdomain.com`

## Step 5 — Set Up CI/CD (Auto-redeployment)

Add these secrets to your GitHub repository:
- `SERVER_HOST` — your server IP
- `SERVER_USER` — `root`
- `SERVER_SSH_KEY` — your private SSH key

The included `.github/workflows/deploy.yml` will automatically redeploy on every push to `main`.

## Maintenance

```bash
# View logs
docker compose logs -f

# Restart everything
docker compose restart

# Update and redeploy
git pull && docker compose up -d --build

# Check running user apps
docker ps | grep userapp
```
