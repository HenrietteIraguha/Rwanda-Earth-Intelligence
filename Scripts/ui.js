let allEvents = [];
let filteredEvents = [];
let currentFilter = 'all';
let currentSort = 'newest';
let currentDateRange = 7;
let rainfallChart = null;
let selectedLat = -1.9403;
let selectedLng = 29.8739;
let lastSoilData = null;
let lastElevationData = null;

const showLoading = (cardId) => {
    const loader = document.getElementById(cardId);
    if (loader) loader.classList.add('show');
};

const hideLoading = (cardId) => {
    const loader = document.getElementById(cardId);
    if (loader) loader.classList.remove('show');
};

const showError = (message) => {
    const toast = document.getElementById('error-toast');
    const msgEl = document.getElementById('error-message');
    msgEl.textContent = message;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 6000);
};

const closeError = () => {
    document.getElementById('error-toast').classList.add('hidden');
};

const displayLocationInfo = (name, lat, lng) => {
    document.getElementById('selected-location').textContent = name;
    document.getElementById('selected-coords').textContent =
        lat.toFixed(4) + '° S, ' + lng.toFixed(4) + '° E';
};

const displaySoilData = (data) => {
    lastSoilData = data;
    const moistureBar = document.getElementById('soil-moisture-bar');
    const moistureValue = document.getElementById('soil-moisture-value');
    const tempValue = document.getElementById('soil-temp-value');
    const etValue = document.getElementById('evapotranspiration-value');
    const droughtBadge = document.getElementById('drought-risk');

    if (data.moisture !== null) {
        moistureBar.style.width = data.moisture + '%';
        moistureValue.textContent = data.moisture + '%';

        if (data.moisture < 15) {
            moistureBar.style.background = '#A32D2D';
        } else if (data.moisture < 35) {
            moistureBar.style.background = '#BA7517';
        } else {
            moistureBar.style.background = '#3B6D11';
        }
    } else {
        moistureBar.style.width = '0%';
        moistureValue.textContent = 'N/A';
    }

    tempValue.textContent = data.temperature !== null
        ? data.temperature + '°C'
        : 'N/A';

    etValue.textContent = data.evapotranspiration !== null
        ? data.evapotranspiration + ' mm/day'
        : 'N/A';

    droughtBadge.className = 'risk-badge ' + data.droughtRisk;

    const riskMessages = {
        low: 'Low drought risk — soil moisture is adequate',
        moderate: 'Moderate drought risk — monitor water levels',
        high: 'High drought risk — irrigation may be needed',
        unknown: 'Select a location to assess drought risk'
    };

    droughtBadge.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>' +
        riskMessages[data.droughtRisk] + '</span>';
};

const displayRainfallData = (data) => {
    document.getElementById('rainfall-today').textContent = data.rainfallToday + ' mm';
    document.getElementById('rainfall-week').textContent = data.rainfallWeek + ' mm';
    document.getElementById('rainfall-month').textContent = data.rainfallMonth + ' mm';

    buildRainfallChart(data.dailyDates, data.dailyRainfall);
};

const buildRainfallChart = (dates, rainfall) => {
    const ctx = document.getElementById('rainfall-chart');
    if (!ctx) return;

    if (rainfallChart) {
        rainfallChart.destroy();
    }

    const labels = dates.slice(-14).map((d) => {
        const date = new Date(d);
        return date.getDate() + '/' + (date.getMonth() + 1);
    });

    const values = rainfall.slice(-14).map((v) => v || 0);

    rainfallChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Rainfall (mm)',
                data: values,
                backgroundColor: '#97C459',
                borderRadius: 3,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 9 }, color: '#888780' }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: '#E8E6DD' },
                    ticks: { font: { size: 9 }, color: '#888780' }
                }
            }
        }
    });
};

const displayElevationData = (data) => {
    lastElevationData = data;
    document.getElementById('elevation-value').textContent = data.altitude + ' m';
    document.getElementById('slope-value').textContent = data.slope + '°';

    const erosionBadge = document.getElementById('erosion-risk');
    erosionBadge.className = 'risk-badge ' + data.erosionRisk;

    const riskMessages = {
        low: 'Low erosion risk — relatively flat terrain',
        moderate: 'Moderate erosion risk — sloped terrain, monitor during rains',
        high: 'High erosion/landslide risk — steep terrain, take precautions'
    };

    erosionBadge.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>' +
        riskMessages[data.erosionRisk] + '</span>';
};

const displayDisasterEvents = (events) => {
    const list = document.getElementById('alerts-list');
    const empty = document.getElementById('alerts-empty');
    const loading = document.getElementById('alerts-loading');

    if (loading) loading.style.display = 'none';

    if (events.length === 0) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');

    list.innerHTML = events.map((event) => {
        let typeClass = '';
        let iconClass = 'fa-circle-exclamation';

        if (event.category === 'wildfires') {
            typeClass = 'fire';
            iconClass = 'fa-fire';
        } else if (event.category === 'severeStorms') {
            typeClass = 'storm';
            iconClass = 'fa-bolt';
        } else if (event.category === 'floods') {
            typeClass = 'flood';
            iconClass = 'fa-water';
        } else if (event.category === 'volcanoes') {
            typeClass = 'volcano';
            iconClass = 'fa-volcano';
        }

        const eventDate = new Date(event.date);
        const now = new Date();
        const daysAgo = Math.floor((now - eventDate) / (1000 * 60 * 60 * 24));
        const timeText = daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1 day ago' : daysAgo + ' days ago';

        return '<div class="alert-item ' + typeClass + '" data-event-id="' + event.id + '" data-lat="' + event.lat + '" data-lng="' + event.lng + '">' +
            '<div class="alert-icon ' + typeClass + '">' +
            '<i class="fas ' + iconClass + '"></i>' +
            '</div>' +
            '<div class="alert-text">' +
            '<div class="alert-title">' + event.title + '</div>' +
            '<div class="alert-meta">' + event.categoryTitle + ' · ' + timeText + '</div>' +
            '</div>' +
            '<div class="alert-distance">' + event.distance + ' km</div>' +
            '</div>';
    }).join('');

    const items = list.querySelectorAll('.alert-item');
    items.forEach((item) => {
        item.addEventListener('click', () => {
            const lat = parseFloat(item.dataset.lat);
            const lng = parseFloat(item.dataset.lng);
            flyToLocation(lat, lng, 8);
        });
    });
};

const applyFilters = () => {
    let result = allEvents.map((event) => {
        const distanceKm = Math.round(
            Math.sqrt(
                Math.pow((event.lat - selectedLat) * 111, 2) +
                Math.pow((event.lng - selectedLng) * 111 * Math.cos(selectedLat * Math.PI / 180), 2)
            )
        );
        return Object.assign({}, event, { distance: distanceKm });
    });

    const searchTerm = document.getElementById('alerts-search-input').value.toLowerCase().trim();
    if (searchTerm) {
        result = result.filter((event) =>
            event.title.toLowerCase().includes(searchTerm) ||
            event.categoryTitle.toLowerCase().includes(searchTerm)
        );
    }

    if (currentFilter !== 'all') {
        const filterMap = {
            wildfires: 'wildfires',
            floods: 'floods',
            storms: 'severeStorms',
            volcanoes: 'volcanoes'
        };
        const categoryId = filterMap[currentFilter];
        result = result.filter((event) => event.category === categoryId);
    }

    if (currentSort === 'newest') {
        result.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (currentSort === 'closest') {
        result.sort((a, b) => a.distance - b.distance);
    } else if (currentSort === 'alphabetical') {
        result.sort((a, b) => a.title.localeCompare(b.title));
    }

    filteredEvents = result;

    clearDisasterMarkers();
    filteredEvents.forEach((event) => {
        addDisasterMarker({
            title: event.title,
            categories: event.categories,
            geometry: event.geometry,
            sources: event.source ? [{ url: event.source }] : []
        });
    });

    displayDisasterEvents(filteredEvents);
    displayNearbyThreats(result);
    generateRiskReport();
};

const updateSelectedCoords = (lat, lng) => {
    selectedLat = lat;
    selectedLng = lng;
};

const displayNearbyThreats = (events) => {
    const summary = document.getElementById('threats-summary');
    const list = document.getElementById('threats-list');

    const nearby = events.filter((e) => e.distance <= 500).sort((a, b) => a.distance - b.distance);

    if (nearby.length === 0) {
        summary.innerHTML = '<div class="risk-badge low"><i class="fas fa-check-circle"></i><span>No active threats within 500km of this location</span></div>';
        list.innerHTML = '';
        return;
    }

    const counts = {};
    nearby.forEach((e) => {
        const cat = e.category;
        if (!counts[cat]) counts[cat] = { count: 0, closest: e.distance, title: e.categoryTitle };
        counts[cat].count++;
        if (e.distance < counts[cat].closest) counts[cat].closest = e.distance;
    });

    const iconMap = {
        wildfires: { icon: 'fa-fire', cls: 'fire' },
        severeStorms: { icon: 'fa-bolt', cls: 'storm' },
        floods: { icon: 'fa-water', cls: 'flood' },
        volcanoes: { icon: 'fa-volcano', cls: 'volcano' }
    };

    let summaryHtml = '';
    Object.keys(counts).forEach((cat) => {
        const info = iconMap[cat] || { icon: 'fa-circle-exclamation', cls: '' };
        summaryHtml += '<div class="threat-count">' +
            '<div class="threat-count-icon ' + info.cls + '"><i class="fas ' + info.icon + '"></i></div>' +
            '<span class="threat-count-text">' + counts[cat].count + ' ' + counts[cat].title + '</span>' +
            '<span class="threat-count-distance">Nearest: ' + counts[cat].closest + ' km</span>' +
            '</div>';
    });
    summary.innerHTML = summaryHtml;

    let listHtml = '';
    nearby.slice(0, 5).forEach((e) => {
        listHtml += '<div class="threat-item" data-lat="' + e.lat + '" data-lng="' + e.lng + '">' +
            '<span class="threat-item-title">' + e.title + '</span>' +
            '<span class="threat-item-distance">' + e.distance + ' km</span>' +
            '</div>';
    });
    list.innerHTML = listHtml;

    list.querySelectorAll('.threat-item').forEach((item) => {
        item.addEventListener('click', () => {
            flyToLocation(parseFloat(item.dataset.lat), parseFloat(item.dataset.lng), 8);
        });
    });
};

const generateRiskReport = () => {
    const report = document.getElementById('risk-report');

    if (!lastSoilData && !lastElevationData) {
        report.innerHTML = '<p class="no-report">Select a location to generate a full risk report</p>';
        return;
    }

    let html = '';
    let riskScore = 0;

    if (lastSoilData) {
        let soilMessage = '';
        if (lastSoilData.droughtRisk === 'high') {
            soilMessage = 'Soil moisture is critically low at ' + lastSoilData.moisture + '%. Crops are at risk of drought stress. Irrigation is strongly recommended.';
            riskScore += 3;
        } else if (lastSoilData.droughtRisk === 'moderate') {
            soilMessage = 'Soil moisture is at ' + lastSoilData.moisture + '%, which is below optimal. Monitor conditions closely and consider supplemental watering.';
            riskScore += 2;
        } else {
            soilMessage = 'Soil moisture is healthy at ' + lastSoilData.moisture + '%. Conditions are favorable for crop growth.';
            riskScore += 0;
        }

        html += '<div class="report-item">' +
            '<div class="report-label">Soil & drought</div>' +
            '<div class="report-text">' + soilMessage + '</div>' +
            '</div>';

        let rainMessage = '';
        if (lastSoilData.rainfallWeek < 5) {
            rainMessage = 'Only ' + lastSoilData.rainfallWeek + 'mm of rain in the past 7 days. This is very low and contributes to drought conditions.';
            riskScore += 2;
        } else if (lastSoilData.rainfallWeek < 20) {
            rainMessage = lastSoilData.rainfallWeek + 'mm of rain in the past 7 days. Rainfall is moderate but may not sustain water-intensive crops.';
            riskScore += 1;
        } else {
            rainMessage = lastSoilData.rainfallWeek + 'mm of rain in the past 7 days. Rainfall is adequate for most agricultural activities.';
        }

        html += '<div class="report-item">' +
            '<div class="report-label">Rainfall</div>' +
            '<div class="report-text">' + rainMessage + '</div>' +
            '</div>';
    }

    if (lastElevationData) {
        let elevMessage = '';
        if (lastElevationData.erosionRisk === 'high') {
            elevMessage = 'Altitude is ' + lastElevationData.altitude + 'm with a steep slope of ' + lastElevationData.slope + '°. High risk of soil erosion and landslides during heavy rainfall. Terracing is recommended.';
            riskScore += 3;
        } else if (lastElevationData.erosionRisk === 'moderate') {
            elevMessage = 'Altitude is ' + lastElevationData.altitude + 'm with a slope of ' + lastElevationData.slope + '°. Moderate erosion risk — soil conservation measures would help.';
            riskScore += 1;
        } else {
            elevMessage = 'Altitude is ' + lastElevationData.altitude + 'm on relatively flat terrain (' + lastElevationData.slope + '°). Low erosion risk.';
        }

        html += '<div class="report-item">' +
            '<div class="report-label">Terrain & erosion</div>' +
            '<div class="report-text">' + elevMessage + '</div>' +
            '</div>';
    }

    const nearbyThreats = allEvents.filter((e) => {
        const d = Math.round(Math.sqrt(
            Math.pow((e.lat - selectedLat) * 111, 2) +
            Math.pow((e.lng - selectedLng) * 111 * Math.cos(selectedLat * Math.PI / 180), 2)
        ));
        return d <= 500;
    });

    let threatMessage = '';
    if (nearbyThreats.length === 0) {
        threatMessage = 'No active natural disaster events detected within 500km. Conditions are stable.';
    } else if (nearbyThreats.length <= 2) {
        threatMessage = nearbyThreats.length + ' active event(s) detected nearby. Stay informed and monitor updates.';
        riskScore += 1;
    } else {
        threatMessage = nearbyThreats.length + ' active events detected in the region. Exercise caution and prepare emergency plans.';
        riskScore += 3;
    }

    html += '<div class="report-item">' +
        '<div class="report-label">Nearby threats</div>' +
        '<div class="report-text">' + threatMessage + '</div>' +
        '</div>';

    let overallRisk = 'low';
    let overallText = 'LOW RISK — Conditions are favorable';
    if (riskScore >= 6) {
        overallRisk = 'high';
        overallText = 'HIGH RISK — Take immediate precautions';
    } else if (riskScore >= 3) {
        overallRisk = 'moderate';
        overallText = 'MODERATE RISK — Monitor conditions closely';
    }

    html += '<div class="report-overall ' + overallRisk + '">' +
        '<div class="report-overall-label">Overall assessment</div>' +
        '<div class="report-overall-text">' + overallText + '</div>' +
        '</div>';

    report.innerHTML = html;
};

const setFilter = (filter) => {
    currentFilter = filter;

    document.querySelectorAll('.filter-btn').forEach((btn) => {
        btn.classList.remove('active');
    });
    document.querySelector('.filter-btn[data-filter="' + filter + '"]').classList.add('active');

    applyFilters();
};

const setSort = (sort) => {
    currentSort = sort;

    document.querySelectorAll('.sort-btn').forEach((btn) => {
        btn.classList.remove('active');
    });
    document.querySelector('.sort-btn[data-sort="' + sort + '"]').classList.add('active');

    applyFilters();
};

const setDateRange = (days) => {
    currentDateRange = days;
};

const updateLastUpdated = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const el = document.getElementById('last-updated');
    el.innerHTML = '<i class="fas fa-clock"></i><span>Updated ' + timeStr + '</span>';
};