# Ubuntu - Troubleshooting

## Service Fails to Start

```bash
sudo systemctl status annual-sports-frontend
sudo journalctl -u annual-sports-frontend -n 50
```

```bash
sudo systemctl status annual-sports-backend
sudo journalctl -u annual-sports-backend -n 50
```

## Port Already in Use

```bash
sudo ss -tlnp | grep 5173
sudo ss -tlnp | grep 3001
```

Change Vite port in `vite.config.js` if needed and rebuild.

## Permission Issues

```bash
sudo chown -R ubuntu:ubuntu /var/www/annual-sports-event-full
sudo chmod +x /var/www/annual-sports-event-full
```

## MongoDB Not Running

```bash
sudo systemctl status mongod
sudo systemctl start mongod
```
