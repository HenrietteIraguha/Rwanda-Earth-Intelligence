const RWANDA_CENTER = [-1.9403, 29.8739];
const RWANDA_ZOOM = 9;

const map = L.map('map', {
    center: RWANDA_CENTER,
    zoom: RWANDA_ZOOM,
    minZoom: 7,
    maxZoom: 14,
    zoomControl: true
});

const baseLayers = {
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }),

    vegetation: L.tileLayer(
        'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/2024-03-05/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png',
        {
            attribution: '&copy; NASA GIBS',
            maxZoom: 9,
            opacity: 0.7
        }
    ),

    truecolor: L.tileLayer(
        'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2024-03-05/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
        {
            attribution: '&copy; NASA GIBS',
            maxZoom: 9,
            opacity: 0.85
        }
    ),

    temperature: L.tileLayer(
        'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/2024-03-05/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png',
        {
            attribution: '&copy; NASA GIBS',
            maxZoom: 7,
            opacity: 0.7
        }
    )
};

baseLayers.osm.addTo(map);
baseLayers.vegetation.addTo(map);

let currentOverlay = 'vegetation';

function switchLayer(layerName) {
    if (currentOverlay === layerName) return;

    if (baseLayers[currentOverlay] && currentOverlay !== 'osm') {
        map.removeLayer(baseLayers[currentOverlay]);
    }

    if (baseLayers[layerName]) {
        baseLayers[layerName].addTo(map);
        currentOverlay = layerName;
    }

    const legendTitle = document.querySelector('.legend-title');
    const legendGradient = document.querySelector('.legend-gradient');

    if (layerName === 'vegetation') {
        legendTitle.textContent = 'Vegetation Health';
        legendGradient.style.background = 'linear-gradient(90deg, #8B4513, #DAA520, #97C459, #2D5016)';
    } else if (layerName === 'truecolor') {
        legendTitle.textContent = 'True Color Satellite';
        legendGradient.style.background = 'linear-gradient(90deg, #2255AA, #44AA66, #887744, #DDDDDD)';
    } else if (layerName === 'temperature') {
        legendTitle.textContent = 'Land Surface Temperature';
        legendGradient.style.background = 'linear-gradient(90deg, #0000FF, #00CCCC, #00FF00, #FFFF00, #FF0000)';
    }
}

const disasterMarkers = L.layerGroup().addTo(map);
let selectedMarker = null;

function setSelectedLocation(lat, lng, name) {
    if (selectedMarker) {
        map.removeLayer(selectedMarker);
    }

    selectedMarker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'selected-marker',
            html: '<div style="width:14px;height:14px;background:#3B6D11;border:3px solid white;border-radius:50;box-shadow:0 0 6px rgba(0,0,0,0.3);"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        })
    }).addTo(map);

    selectedMarker.bindPopup('<strong>' + name + '</strong><br>' + lat.toFixed(4) + '°, ' + lng.toFixed(4) + '°').openPopup();
}

function addDisasterMarker(event) {
    const coords = event.geometry[event.geometry.length - 1].coordinates;
    const lng = coords[0];
    const lat = coords[1];

    let color = '#888780';
    let icon = 'fa-circle-exclamation';

    const category = event.categories[0].id;

    if (category === 'wildfires') {
        color = '#A32D2D';
        icon = 'fa-fire';
    } else if (category === 'severeStorms') {
        color = '#534AB7';
        icon = 'fa-bolt';
    } else if (category === 'floods') {
        color = '#185FA5';
        icon = 'fa-water';
    } else if (category === 'volcanoes') {
        color = '#993C1D';
        icon = 'fa-volcano';
    }

    const marker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'disaster-marker',
            html: '<div style="width:28px;height:28px;background:' + color + ';border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 6px rgba(0,0,0,0.3);"><i class="fas ' + icon + '" style="color:white;font-size:11px;"></i></div>',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        })
    });

    marker.bindPopup(
        '<strong>' + event.title + '</strong><br>' +
        '<span style="font-size:12px;color:#888;">' + new Date(event.geometry[event.geometry.length - 1].date).toLocaleDateString() + '</span>'
    );

    marker.eventData = event;
    disasterMarkers.addLayer(marker);

    return marker;
}

function clearDisasterMarkers() {
    disasterMarkers.clearLayers();
}

function flyToLocation(lat, lng, zoom) {
    map.flyTo([lat, lng], zoom || 11, {
        duration: 1.5
    });
}