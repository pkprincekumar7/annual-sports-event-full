# macOS - Run as launchd Services

This uses launchd to run the frontend preview server and backend API as services.

## 1) Configure Environment

```bash
cd ~/projects/annual-sports-event-full
cp .env.example .env
```

Set `VITE_API_URL` to your backend URL before building.

## 2) Build the Frontend

```bash
cd ~/projects/annual-sports-event-full
npm install
npm run build
```

## 3) Frontend launchd Service

Create `~/Library/LaunchAgents/com.annualsports.frontend.plist`:

Before editing, find your npm path:
```bash
which npm
```
Use that path in `ProgramArguments` (e.g., `/opt/homebrew/bin/npm` on Apple Silicon).

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.annualsports.frontend</string>
    <key>ProgramArguments</key>
    <array>
      <string>/usr/local/bin/npm</string>
      <string>run</string>
      <string>preview</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/YOUR_USER/projects/annual-sports-event-full</string>
    <key>EnvironmentVariables</key>
    <dict>
      <key>NODE_ENV</key>
      <string>production</string>
      <key>PORT</key>
      <string>5173</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
  </dict>
</plist>
```

Load the service:
```bash
launchctl load ~/Library/LaunchAgents/com.annualsports.frontend.plist
```

## 4) Backend launchd Service

Create `~/Library/LaunchAgents/com.annualsports.backend.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.annualsports.backend</string>
    <key>ProgramArguments</key>
    <array>
      <string>/usr/local/bin/npm</string>
      <string>start</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/YOUR_USER/projects/annual-sports-event-full</string>
    <key>EnvironmentVariables</key>
    <dict>
      <key>NODE_ENV</key>
      <string>production</string>
      <key>PORT</key>
      <string>3001</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
  </dict>
</plist>
```

Load the service:
```bash
launchctl load ~/Library/LaunchAgents/com.annualsports.backend.plist
```

## 5) Manage Services

```bash
launchctl list | grep annualsports
launchctl unload ~/Library/LaunchAgents/com.annualsports.frontend.plist
launchctl unload ~/Library/LaunchAgents/com.annualsports.backend.plist
```
