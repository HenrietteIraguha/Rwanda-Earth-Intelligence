const searchLocation = async (query) => {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&q=' +
        encodeURIComponent(query + ', Rwanda') +
        '&limit=1&addressdetails=1';

    const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
        throw new Error('Location search failed. Please try again.');
    }

    const data = await response.json();

    if (data.length === 0) {
        throw new Error('Location "' + query + '" not found in Rwanda. Try another name.');
    }

    return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        name: data[0].display_name.split(',')[0],
        fullName: data[0].display_name
    };
};

const fetchSoilData = async (lat, lng) => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const formatDate = (d) => d.toISOString().split('T')[0];

    const url = 'https://api.open-meteo.com/v1/forecast?' +
        'latitude=' + lat +
        '&longitude=' + lng +
        '&daily=precipitation_sum,et0_fao_evapotranspiration' +
        '&hourly=soil_moisture_0_to_1cm,soil_temperature_0cm' +
        '&timezone=Africa/Kigali' +
        '&past_days=30' +
        '&forecast_days=1';

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error('Failed to fetch soil data. The weather service may be temporarily unavailable.');
    }

    const data = await response.json();

    const hourlyMoisture = data.hourly.soil_moisture_0_to_1cm || [];
    const hourlyTemp = data.hourly.soil_temperature_0cm || [];
    const dailyRain = data.daily.precipitation_sum || [];
    const dailyET = data.daily.et0_fao_evapotranspiration || [];

    const latestMoisture = hourlyMoisture.filter((v) => v !== null);
    const latestTemp = hourlyTemp.filter((v) => v !== null);

    const currentMoisture = latestMoisture.length > 0
        ? latestMoisture[latestMoisture.length - 1]
        : null;

    const currentTemp = latestTemp.length > 0
        ? latestTemp[latestTemp.length - 1]
        : null;

    const totalRainToday = dailyRain.length > 0
        ? dailyRain[dailyRain.length - 1]
        : 0;

    const last7DaysRain = dailyRain.slice(-7).reduce((sum, val) => sum + (val || 0), 0);
    const last30DaysRain = dailyRain.reduce((sum, val) => sum + (val || 0), 0);

    const avgET = dailyET.length > 0
        ? dailyET.reduce((sum, val) => sum + (val || 0), 0) / dailyET.length
        : null;

    const moisturePercent = currentMoisture !== null
        ? Math.round(currentMoisture * 100)
        : null;

    let droughtRisk = 'unknown';
    if (moisturePercent !== null) {
        if (moisturePercent < 15) droughtRisk = 'high';
        else if (moisturePercent < 35) droughtRisk = 'moderate';
        else droughtRisk = 'low';
    }

    return {
        moisture: moisturePercent,
        temperature: currentTemp !== null ? Math.round(currentTemp * 10) / 10 : null,
        evapotranspiration: avgET !== null ? Math.round(avgET * 10) / 10 : null,
        rainfallToday: Math.round(totalRainToday * 10) / 10,
        rainfallWeek: Math.round(last7DaysRain * 10) / 10,
        rainfallMonth: Math.round(last30DaysRain * 10) / 10,
        droughtRisk: droughtRisk,
        dailyRainfall: dailyRain,
        dailyDates: data.daily.time || []
    };
};

const fetchElevation = async (lat, lng) => {
    const offset = 0.001;

    const url = 'https://api.open-elevation.com/api/v1/lookup?locations=' +
        lat + ',' + lng + '|' +
        (lat + offset) + ',' + (lng + offset);

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error('Failed to fetch elevation data. The service may be temporarily unavailable.');
    }

    const data = await response.json();

    if (!data.results || data.results.length < 2) {
        throw new Error('Elevation data not available for this location.');
    }

    const elevation1 = data.results[0].elevation;
    const elevation2 = data.results[1].elevation;

    const elevationDiff = Math.abs(elevation2 - elevation1);
    const distance = offset * 111000;
    const slopeAngle = Math.round(Math.atan(elevationDiff / distance) * (180 / Math.PI) * 10) / 10;

    let erosionRisk = 'low';
    if (slopeAngle > 15) erosionRisk = 'high';
    else if (slopeAngle > 8) erosionRisk = 'moderate';

    return {
        altitude: Math.round(elevation1),
        slope: slopeAngle,
        erosionRisk: erosionRisk
    };
};

const fetchDisasterEvents = async (days) => {
    const daysParam = days || 30;

    const url = 'https://eonet.gsfc.nasa.gov/api/v3/events?' +
        'days=' + daysParam +
        '&status=open,closed' +
        '&api_key=' + NASA_API_KEY;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error('Failed to fetch disaster events from NASA. Please try again later.');
    }

    const data = await response.json();

    return data.events.map((event) => {
        const lastGeometry = event.geometry[event.geometry.length - 1];
        const coords = lastGeometry.coordinates;

        const rwandaLat = -1.9403;
        const rwandaLng = 29.8739;
        const eventLat = coords[1];
        const eventLng = coords[0];

        const distanceKm = Math.round(
            Math.sqrt(
                Math.pow((eventLat - rwandaLat) * 111, 2) +
                Math.pow((eventLng - rwandaLng) * 111 * Math.cos(rwandaLat * Math.PI / 180), 2)
            )
        );

        return {
            id: event.id,
            title: event.title,
            category: event.categories[0].id,
            categoryTitle: event.categories[0].title,
            date: lastGeometry.date,
            lat: eventLat,
            lng: eventLng,
            distance: distanceKm,
            source: event.sources && event.sources.length > 0 ? event.sources[0].url : null,
            geometry: event.geometry,
            categories: event.categories
        };
    });
};