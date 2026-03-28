let allEvents = [];
let filteredEvents = [];
let currentFilter = 'all';
let currentSort = 'newest';
let currentDateRange = 30;
let rainfallChart = null;

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

    loading.style.display = 'none';

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
    let result = [...allEvents];

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