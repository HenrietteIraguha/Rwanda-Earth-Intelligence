# Rwanda Earth Intelligence Dashboard

An earth intelligence platform that transforms raw satellite and environmental data into actionable insights for Rwandan citizens, farmers, students, and researchers. Inspired by the mission of RwaSat-1 — Rwanda's first satellite launched in 2019.

## The Problem

RwaSat-1 collects data about Rwanda's land, agriculture, and natural disasters. However, there is no public-facing intelligence layer that translates that data into information ordinary people can use. A farmer in Nyabihu cannot easily find out if their soil is too dry, if heavy rain on their steep hillside means a landslide risk, or if there is an active wildfire nearby. This dashboard bridges that gap.

## What It Does

Users search for any location in Rwanda (or click directly on the map), and the dashboard generates a complete intelligence report combining data from multiple sources:

- **Soil moisture analysis** — tells farmers if their soil is dry, adequate, or waterlogged, with plain-English advice like "Start irrigation immediately" or "Conditions are favorable for farming"
- **Rainfall tracking** — shows 7-day and 30-day rainfall totals and whether it is below average, normal, or dangerously high
- **Terrain and erosion risk** — calculates altitude and slope steepness to warn about landslide and erosion danger, with recommendations like "Use terracing and contour farming"
- **Nearby threat detection** — checks for active natural disaster events (wildfires, floods, storms, volcanoes) within 1,000km and includes them in the safety assessment
- **Safety score** — a 0-100 score calculated by combining soil, rainfall, slope, and threat data. This number does not exist in any single API — the application creates it by cross-referencing all data sources
- **Actionable recommendation** — a plain-English paragraph telling the user exactly what to do based on all the data combined

### User Interaction Features

- **Search** — type any location name in Rwanda and the map flies to that location while loading all data
- **Click the map** — click anywhere on the map to analyse that exact point
- **Saved Locations table** — every analysed location is saved for comparison
  - **Filter** — filter saved locations by risk level (All, High Risk, Moderate, Low Risk)
  - **Sort** — sort by newest, driest soil, most rainfall, steepest terrain, highest risk, or name A-Z
  - **Search** — search through saved locations by name
- **Click a saved location** — instantly reload its intelligence report

## APIs Used

### 1. NASA EONET (Earth Observatory Natural Event Tracker) — v3

- **Purpose**: Fetches active natural disaster events (wildfires, floods, storms, volcanoes) and checks proximity to the user's selected location
- **Endpoint**: `https://eonet.gsfc.nasa.gov/api/v3/events`
- **Authentication**: API key required (provided in submission comments)
- **Rate limits**: No strict limit documented; standard responsible usage applies
- **Documentation**: [https://eonet.gsfc.nasa.gov/docs/v3](https://eonet.gsfc.nasa.gov/docs/v3)
- **Developer**: NASA Goddard Space Flight Center

### 2. Open-Meteo Climate API

- **Purpose**: Provides soil moisture, soil temperature, evapotranspiration, and daily precipitation data
- **Endpoint**: `https://api.open-meteo.com/v1/forecast`
- **Authentication**: No API key required
- **Rate limits**: 10,000 requests per day for non-commercial use
- **Documentation**: [https://open-meteo.com/en/docs](https://open-meteo.com/en/docs)
- **Developer**: Open-Meteo (open-source weather API)

### 3. Open-Elevation API

- **Purpose**: Returns altitude data for any coordinates. The app fetches two nearby points and calculates slope angle to assess erosion and landslide risk
- **Endpoint**: `https://api.open-elevation.com/api/v1/lookup`
- **Authentication**: No API key required
- **Rate limits**: Reasonable use; no strict published limit
- **Documentation**: [https://open-elevation.com/](https://open-elevation.com/)
- **Developer**: Open-Elevation (open-source)

### 4. Nominatim Geocoding API (OpenStreetMap)

- **Purpose**: Converts location names (e.g., "Musanze") into latitude/longitude coordinates so other APIs can fetch data for that point
- **Endpoint**: `https://nominatim.openstreetmap.org/search`
- **Authentication**: No API key required
- **Rate limits**: Maximum 1 request per second
- **Documentation**: [https://nominatim.org/release-docs/latest/api/Search/](https://nominatim.org/release-docs/latest/api/Search/)
- **Developer**: OpenStreetMap Foundation

### 5. NASA GIBS (Global Imagery Browse Services)

- **Purpose**: Provides satellite imagery tiles (NDVI vegetation health layer) rendered on the interactive map
- **Endpoint**: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/`
- **Authentication**: No API key required
- **Rate limits**: No strict limit for tile requests
- **Documentation**: [https://nasa-gibs.github.io/gibs-api-docs/](https://nasa-gibs.github.io/gibs-api-docs/)
- **Developer**: NASA Earthdata

## Libraries Used

- **Leaflet.js** (v1.9.4) — open-source interactive map library ([https://leafletjs.com/](https://leafletjs.com/))
- **Font Awesome** (v6.5.1) — icon library ([https://fontawesome.com/](https://fontawesome.com/))
- **DM Sans** — Google Font used for typography ([https://fonts.google.com/specimen/DM+Sans](https://fonts.google.com/specimen/DM+Sans))

## How to Run Locally

### Prerequisites

- A modern web browser (Chrome, Firefox, Edge, or Safari)
- A text editor (VS Code recommended)
- A NASA API key (get one for free at [https://api.nasa.gov/](https://api.nasa.gov/))

### Setup Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/HenrietteIraguha/Rwanda-Earth-Intelligence
   cd Rwanda_Earth-Intelligence
   ```

2. Create a `config.js` file in the root folder (this file is excluded from GitHub via `.gitignore`):
   ```javascript
   const NASA_API_KEY = "YOUR_NASA_API_KEY_HERE";
   ```

3. Open `index.html` in your browser:
   - Option A: Double-click the file
   - Option B: Right-click > Open with > your browser
   - Option C: Use a local server like VS Code's Live Server extension

4. The dashboard will load with a map of Rwanda. Type a location name (e.g., "Musanze") and click Analyse to generate an intelligence report.

## How to Deploy to Web Servers

### Server Setup

The application is deployed on two web servers (Web01 and Web02) with a load balancer (Lb01) distributing traffic between them.

### Step 1: Transfer Files to Both Servers

```bash
scp -r index.html style.css script.js config.js ubuntu@WEB01_IP:/var/www/html/
scp -r index.html style.css script.js config.js ubuntu@WEB02_IP:/var/www/html/
```

### Step 2: Configure Nginx on Web01 and Web02

On both web servers, ensure Nginx is installed and configured to serve the application:

```bash
sudo apt update
sudo apt install nginx -y
```

The default Nginx configuration serves files from `/var/www/html/`, which is where we placed our files. Verify by visiting `http://WEB01_IP` and `http://WEB02_IP` in a browser.

### Step 3: Configure the Load Balancer (Lb01)

SSH into the load balancer server and edit the Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/default
```

Replace the contents with:

```nginx
upstream backend {
    server WEB01_IP;
    server WEB02_IP;
}

server {
    listen 80;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Then restart Nginx:

```bash
sudo nginx -t
sudo systemctl restart nginx
```

### Step 4: Test the Load Balancer

Visit `http://LB01_IP` in your browser. The dashboard should load. Refresh multiple times — the load balancer distributes requests between Web01 and Web02 automatically.

To verify traffic distribution, check the access logs on each web server:

```bash
sudo tail -f /var/log/nginx/access.log
```

You should see requests appearing on both servers as you refresh.

## API Key Security

- The NASA API key is stored in `config.js`, which is listed in `.gitignore` and excluded from the GitHub repository
- The key is provided in the assignment submission comment section as required
- Other APIs (Open-Meteo, Open-Elevation, Nominatim, NASA GIBS) do not require keys and are documented accordingly in this README

## Project Structure

```
language_barrier_bridge/
├── index.html      — Main HTML page
├── style.css       — Earth green theme styling
├── script.js       — All application logic (API calls, UI, search/filter/sort)
├── config.js       — NASA API key (not on GitHub)
├── .gitignore      — Excludes config.js and system files
└── README.md       — This file
```

## Challenges and Solutions

**Challenge 1: Finding a satellite data API accessible from the browser.**
RwaSat-1's actual data is not publicly available through an API. I solved this by using open-source APIs that mirror exactly what RwaSat-1 monitors — soil moisture and vegetation from Open-Meteo, terrain data from Open-Elevation, and satellite imagery from NASA GIBS.

**Challenge 2: Making raw data meaningful for non-technical users.**
APIs return numbers like "soil_moisture_0_to_1cm: 0.27". A farmer doesn't know what that means. I solved this by creating interpretation functions that convert every number into plain English: "Soil moisture is at 27%, which is below optimal. Monitor conditions closely and consider supplemental watering."

**Challenge 3: Calculating a unified Safety Score.**
No single API tells you "this location is safe." I created a scoring algorithm that combines soil moisture, rainfall, slope steepness, and nearby threat data into a single 0-100 score with clear thresholds: 75+ is low risk, 50-74 is moderate, below 50 is high risk.

**Challenge 4: Disaster data relevance.**
NASA EONET tracks global events, but most are in the US. I filtered events by distance from the user's selected location (within 1,000km) so only relevant nearby threats appear in the intelligence report.

**Challenge 5: API rate limits and error handling.**
Some APIs have usage limits or can be temporarily unavailable. I implemented try/catch error handling for every API call with user-friendly error messages, and used Promise.all to fetch data in parallel for faster load times.

## Credits

- **NASA EONET** — Earth Observatory Natural Event Tracker by NASA Goddard Space Flight Center
- **Open-Meteo** — Free open-source weather and climate API
- **Open-Elevation** — Open-source elevation data API
- **Nominatim** — Geocoding service by OpenStreetMap Foundation
- **NASA GIBS** — Global Imagery Browse Services by NASA Earthdata
- **Leaflet.js** — Open-source JavaScript library for interactive maps by Vladimir Agafonkin
- **Font Awesome** — Icon library by Fonticons, Inc.
- **RwaSat-1** — Rwanda's first satellite, launched November 2019, developed under the Rwanda Utilities Regulatory Authority (RURA) for agricultural monitoring and disaster detection. This project is inspired by its mission to make earth observation data accessible.

## Author

Built by Henrie Iraguha for the ALU Web Development course — Playing Around with APIs assignment, March 2026.