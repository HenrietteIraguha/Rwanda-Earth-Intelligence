const loadLocationData = async (lat, lng, name) => {
    displayLocationInfo(name, lat, lng);
    setSelectedLocation(lat, lng, name);
    flyToLocation(lat, lng, 11);

    showLoading('soil-loading');
    showLoading('rainfall-loading');
    showLoading('elevation-loading');

    try {
        const soilData = await fetchSoilData(lat, lng);
        displaySoilData(soilData);
        displayRainfallData(soilData);
    } catch (err) {
        showError(err.message);
    } finally {
        hideLoading('soil-loading');
        hideLoading('rainfall-loading');
    }

    try {
        const elevData = await fetchElevation(lat, lng);
        displayElevationData(elevData);
    } catch (err) {
        showError(err.message);
    } finally {
        hideLoading('elevation-loading');
    }

    updateLastUpdated();
};

const handleSearch = async () => {
    const input = document.getElementById('location-search');
    const query = input.value.trim();

    if (!query) {
        showError('Please enter a location name to search.');
        return;
    }

    try {
        const location = await searchLocation(query);
        await loadLocationData(location.lat, location.lng, location.name);
    } catch (err) {
        showError(err.message);
    }
};

const loadDisasterEvents = async () => {
    const loading = document.getElementById('alerts-loading');
    loading.style.display = 'block';

    try {
        const events = await fetchDisasterEvents(currentDateRange);
        allEvents = events;
        applyFilters();
    } catch (err) {
        showError(err.message);
        loading.style.display = 'none';
    }

    updateLastUpdated();
};

document.getElementById('search-btn').addEventListener('click', handleSearch);

document.getElementById('location-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        handleSearch();
    }
});

map.on('click', async (e) => {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    const name = 'Selected Point';
    await loadLocationData(lat, lng, name);
});

document.querySelectorAll('.map-layer-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.map-layer-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        switchLayer(btn.dataset.layer);
    });
});

document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        setFilter(btn.dataset.filter);
    });
});

document.querySelectorAll('.sort-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        setSort(btn.dataset.sort);
    });
});

document.getElementById('date-range-filter').addEventListener('change', async (e) => {
    setDateRange(parseInt(e.target.value));
    await loadDisasterEvents();
});

document.getElementById('alerts-search-input').addEventListener('input', () => {
    applyFilters();
});

document.getElementById('toast-close').addEventListener('click', closeError);

const initDashboard = async () => {
    await loadDisasterEvents();
    await loadLocationData(-1.9403, 29.8739, 'Kigali, Rwanda');
};

initDashboard();