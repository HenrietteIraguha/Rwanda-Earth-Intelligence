# Rwanda Earth Intelligence Dashboard

**Live URL:** [https://earthintel.henrietteinc.tech](https://earthintel.henrietteinc.tech)
**Demo Video:** [https://youtu.be/icXeOtV__9Q](https://youtu.be/icXeOtV__9Q)

A dashboard that turns RwaSAT-1 satellite environmental raw data into plain-English intelligence for Rwandan farmers, students, and researchers or any other users.

---

## What It Does

Search any location in Rwanda or click directly on the map. The app fetches soil moisture, rainfall, elevation, and nearby disaster data from 4 different APIs, combines them into a single **Safety Score (0-100)**, and generates an intelligence report with useful information from the raw data and also provides crop recommendations all in plain English.

**Key features:**
- Satellite vegetation overlay (NASA GIBS NDVI) on an interactive Leaflet map
- Real-time soil moisture, rainfall (7-day & 30-day), altitude, and slope analysis
- Nearby threat detection from NASA EONET (wildfires, floods, storms, volcanoes)
- Safety Score calculated from all data sources combined — this number doesn't exist anywhere until the app creates it
- Crop recommendations based on Rwandan altitude zones and soil conditions
- Saved Locations with **filter** (risk level), **sort** (6 options), and **search**
- XSS input sanitization and Rwanda boundary validation
- localStorage persistence for saved locations

---

## APIs Used

| API | Purpose | Auth | Docs |
|-----|---------|------|------|
| **NASA EONET v3** | Nearby disaster events | API key (in submission comments) | [eonet.gsfc.nasa.gov/docs/v3](https://eonet.gsfc.nasa.gov/docs/v3) |
| **Open-Meteo** | Soil moisture, rainfall, elevation | No key (open-source) | [open-meteo.com/en/docs](https://open-meteo.com/en/docs) |
| **Nominatim** | Geocoding (place → coordinates) | No key (open-source) | [nominatim.org](https://nominatim.org/release-docs/latest/api/Search/) |
| **NASA GIBS** | Satellite imagery tiles (NDVI) | No key | [nasa-gibs.github.io](https://nasa-gibs.github.io/gibs-api-docs/) |

All APIs except NASA EONET are open-source and require no authentication. The NASA API key is stored in `config.js` which is excluded from GitHub via `.gitignore`.

---

## Libraries Used
 
| Library | Version | Purpose |
|---------|---------|---------|
| [Leaflet.js](https://leafletjs.com/) | 1.9.4 | Interactive map rendering and tile layers |
| [Font Awesome](https://fontawesome.com/) | 6.5.1 | Icons throughout the UI |
| [DM Sans](https://fonts.google.com/specimen/DM+Sans) | — | Google Font for typography |
 
All libraries are loaded via CDN — no installation required.

## Project Structure

```
Rwanda-Earth-Intelligence/
├── index.html      — App structure
├── style.css       — Earth green theme + responsive design
├── script.js       — All logic: API calls, scoring, UI, search/filter/sort
├── config.js       — NASA API key (not on GitHub)
├── .gitignore      — Excludes config.js
└── README.md       — This file
```

---

## Run Locally
 
### Prerequisites
- A modern web browser (Chrome, Firefox, Edge, or Safari)
- An internet connection (required for API calls and map tiles)
- A NASA API key — get one for free at [api.nasa.gov](https://api.nasa.gov/)
 
### Steps
 
1. Clone the repository:
```bash
git clone https://github.com/HenrietteIraguha/Rwanda-Earth-Intelligence.git
cd Rwanda-Earth-Intelligence
```
 
2. Create a `config.js` file in the root folder (this file is not on GitHub for security):
```javascript
const NASA_API_KEY = "your_nasa_key_here";
```
 
3. Open `index.html` in your browser — double-click the file or right-click and open with your browser.
 
4. Type a location like "Musanze" or "Kigali" and click **Analyse** to generate an intelligence report.
 
---

## Deployment

```
User → https://earthintel.henrietteinc.tech
              ↓
        7035-lb-01 (Nginx + SSL)
        44.202.37.191
          ↙         ↘
   7035-web-01    7035-web-02
   3.92.192.114   54.82.239.91
```

### DNS

| Type | Name | Value |
|------|------|-------|
| A | earthintel | 44.202.37.191 |

### web-01 and web-02 Setup

Files were transferred and Nginx configured on both servers:

```bash
scp -i ~/.ssh/school index.html style.css script.js config.js ubuntu@3.92.192.114:~/
ssh -i ~/.ssh/school ubuntu@3.92.192.114
sudo mv ~/index.html ~/style.css ~/script.js ~/config.js /var/www/html/
```

Edited the Nginx config on both web-01 and web-02 to add the `X-Served-By` header:

```bash
sudo nano /etc/nginx/sites-available/default
```

Added inside the `location /` block:
```nginx
location / {
    try_files $uri $uri/ =404;
    add_header X-Served-By $hostname;
}
```

Then reloaded Nginx on both servers:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### lb-01 Setup (Nginx + SSL)

SSL certificate obtained via Certbot:
```bash
sudo certbot certonly --standalone -d earthintel.henrietteinc.tech
```

Nginx config (`/etc/nginx/sites-available/default`):
```nginx
upstream backend {
    server 3.92.192.114;
    server 54.82.239.91;
}

server {
    listen 80;
    server_name earthintel.henrietteinc.tech;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name earthintel.henrietteinc.tech;

    ssl_certificate /etc/letsencrypt/live/earthintel.henrietteinc.tech/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/earthintel.henrietteinc.tech/privkey.pem;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Then tested and started Nginx:
```bash
sudo nginx -t
sudo systemctl start nginx
```

### Verifying Load Balancer

```bash
curl -s -I https://earthintel.henrietteinc.tech 
```

Traffic alternates between both servers confirming round-robin distribution:
```
X-Served-By: 7035-web-01
X-Served-By: 7035-web-02
```

---

## Challenges

1. **Open-Elevation API kept timing out (504 errors)** — Switched to Open-Meteo which returns elevation in every response. Fetch two nearby points, calculate slope from the difference.

2. **NASA EONET showing US disasters instead of African ones** — Added a distance filter that only keeps events within 1,000km of the user's selected location.

3. **Search returning results outside Rwanda** — Locked Nominatim to `countrycodes=rw` and added a coordinate boundary check.

4. **No single API gives a safety assessment** — Built a custom scoring algorithm combining soil moisture, rainfall, slope, and nearby threats into one 0-100 Safety Score.

5. **Raw API data is unreadable for farmers** — Created interpretation functions that convert numbers into actionable English like "Soil is very dry. Start irrigation immediately."

---

## Security

- NASA API key stored in `config.js`, excluded via `.gitignore`
- Input sanitized with `cleanInput()` to prevent XSS
- Search locked to Rwanda with `countrycodes=rw` + boundary validation
- All open-source APIs used over HTTPS

---

## Credits

- [NASA EONET](https://eonet.gsfc.nasa.gov/docs/v3) — Disaster event tracking (NASA Goddard)
- [Open-Meteo](https://open-meteo.com/) — Open-source weather, soil, and elevation data
- [Nominatim](https://nominatim.org/) — Open-source geocoding (OpenStreetMap Foundation)
- [NASA GIBS](https://nasa-gibs.github.io/gibs-api-docs/) — Satellite imagery tiles (NASA Earthdata)
- [Leaflet.js](https://leafletjs.com/) — Interactive maps (Vladimir Agafonkin)
- [Font Awesome](https://fontawesome.com/) — Icons (Fonticons, Inc.)
- [Let's Encrypt](https://letsencrypt.org/) — Free SSL certificates
- **RwaSat-1** — Rwanda's first satellite (2019), inspiration for this project

---

**Built by Henrie Iraguha  ALU Web  March 2026**