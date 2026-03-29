// the center of rwanda on the map
const RW_center = [-1.9403, 29.8739];
let saved = JSON.parse(localStorage.getItem('savedLocations') || '[]');
let Filterthis = 'all';

// setting up the leaflet map
const map = L.map('map', {
    center: RW_center,
    zoom: 9,
    minZoom: 7,
    maxZoom: 14
});

// the  map layer from openstreetmap api
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
}).addTo(map);


L.tileLayer(
    'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/2024-03-05/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png',
    { maxZoom: 9, opacity: 0.6 }
).addTo(map);

let Markthis = null;


const showError = (msg) => {
    const toast = document.getElementById('error-toast');
    document.getElementById('error-message').textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 5000);
};

document.getElementById('toast-close').addEventListener('click', () => {
    document.getElementById('error-toast').classList.add('hidden');
});

// searches for the place the user types in using  nominatim
const searchplace = async (query) => {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&q=' +
        encodeURIComponent(query) + '&countrycodes=rw&limit=1';
// nominatim geocoding turns thw  place name to lat/lng

    const res = await fetch(url);
    if (!res.ok) throw new Error('Search failed. Try again.');
    const data = await res.json();
    if (data.length === 0) throw new Error('"' + query + '" not found in Rwanda. Try a district name like Musanze or Gasabo.');

    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);

// making sure its actually inside rwanda borders
    if (lat < -2.85 || lat > -1.05 || lng < 28.85 || lng > 30.9) {
        throw new Error('Thats outside Rwanda. Try searching for a place within the country.');
    }

    return {
        lat: lat,
        lng: lng,
        name: data[0].display_name.split(',')[0],
        fullName: data[0].display_name
    };
};
// getting the  soil and rainfall data from the  open-meteo api
const getsoil = async (lat, lng) => {
    const url = 'https://api.open-meteo.com/v1/forecast?' +
        'latitude=' + lat + '&longitude=' + lng +
        '&daily=precipitation_sum,et0_fao_evapotranspiration' +
        '&hourly=soil_moisture_0_to_1cm,soil_temperature_0cm' +
        '&timezone=Africa/Kigali&past_days=30&forecast_days=1';

    const res = await fetch(url);
    if (!res.ok) throw new Error('Could not get soil data.');
    const data = await res.json();

    const moisture = data.hourly.soil_moisture_0_to_1cm.filter((v) => v !== null);
    const temp = data.hourly.soil_temperature_0cm.filter((v) => v !== null);
    const rain = data.daily.precipitation_sum || [];

    const currentMoisture = moisture.length > 0 ? moisture[moisture.length - 1] : null;
    const moisturePercent = currentMoisture !== null ? Math.round(currentMoisture * 100) : null;
    const weekRain = rain.slice(-7).reduce((s, v) => s + (v || 0), 0);
    const monthRain = rain.reduce((s, v) => s + (v || 0), 0);

    console.log('soil data loaded - moisture:', moisturePercent, '% rainfall:', Math.round(weekRain*10)/10, 'mm');

    return {
        moisture: moisturePercent,
        temperature: temp.length > 0 ? Math.round(temp[temp.length - 1] * 10) / 10 : null,
        rainfallWeek: Math.round(weekRain * 10) / 10,
        rainfallMonth: Math.round(monthRain * 10) / 10
    };
};

const getelevation = async (lat, lng) => {
    const offset = 0.005;

    const url1 = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat +
        '&longitude=' + lng + '&daily=precipitation_sum&forecast_days=1&timezone=Africa/Kigali';
    const url2 = 'https://api.open-meteo.com/v1/forecast?latitude=' + (lat + offset) +
        '&longitude=' + (lng + offset) + '&daily=precipitation_sum&forecast_days=1&timezone=Africa/Kigali';

    const [res1, res2] = await Promise.all([fetch(url1), fetch(url2)]);

    if (!res1.ok || !res2.ok) throw new Error('Elevation data not available right now.');

    const data1 = await res1.json();
    const data2 = await res2.json();

    const elev = data1.elevation || 0;
    const elev2 = data2.elevation || 0;

    const diff = Math.abs(elev2 - elev);
    const dist = offset * 111000; 
    const slope = Math.round(Math.atan(diff / dist) * (180 / Math.PI) * 10) / 10;

    return { altitude: Math.round(elev), slope: slope };
};

const getnearevents = async (lat, lng) => {
    try {
        const url = 'https://eonet.gsfc.nasa.gov/api/v3/events?' +
            'days=30&api_key=' + NASA_API_KEY;

        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();

        if (!data.events || data.events.length === 0) return [];

        return data.events
            .filter((e) => e.geometry && e.geometry.length > 0)
            .map((e) => {
                const coords = e.geometry[e.geometry.length - 1].coordinates;
                const eLat = coords[1];
                const eLng = coords[0];

        // distance formula not super accurate but good enough for this
                const dist = Math.round(Math.sqrt(
                    Math.pow((eLat - lat) * 111, 2) +
                    Math.pow((eLng - lng) * 111 * Math.cos(lat * Math.PI / 180), 2)
                ));
                return {
                    title: e.title,
                    category: e.categories[0].title,
                    distance: dist,
                    date: e.geometry[e.geometry.length - 1].date
                };
            })
            .filter((e) => e.distance <= 1000)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5);
    } catch (err) {
        console.log('nasa eonet failed:', err.message);
        return [];
    }
};
// turning the numbers into english for users 
const findmoistureinfo = (moisture) => {
    if (moisture === null) return { text: 'No data', badge: '', class: '' };
    if (moisture < 15) return { text: 'Very dry — crops need water urgently', badge: 'Critical', class: 'bad' };
    if (moisture < 25) return { text: 'Dry — consider irrigation soon', badge: 'Low', class: 'moderate' };
    if (moisture < 45) return { text: 'Adequate — monitor regularly', badge: 'OK', class: 'moderate' };
    return { text: 'Good moisture — favorable for farming', badge: 'Good', class: 'good' };
};

const findraininfo = (rain) => {
    if (rain < 5) return { text: 'Very little rain — drought conditions possible', badge: 'Low', class: 'bad' };
    if (rain < 20) return { text: 'Below average — may not sustain all crops', badge: 'Below avg', class: 'moderate' };
    if (rain < 60) return { text: 'Normal rainfall — good for farming', badge: 'Normal', class: 'good' };
    return { text: 'Heavy rain — watch for flooding on slopes', badge: 'High', class: 'moderate' };
};

const findslopeinfo = (slope) => {
    if (slope < 5) return { text: 'Flat land — safe for all farming', badge: 'Flat', class: 'good' };
    if (slope < 10) return { text: 'Gentle slope — low erosion risk', badge: 'Gentle', class: 'good' };
    if (slope < 20) return { text: 'Moderate slope — use terracing', badge: 'Moderate', class: 'moderate' };
    return { text: 'Steep — high erosion and landslide risk', badge: 'Steep', class: 'bad' };
};

const calculatescore = (moisture, rain, slope) => {
    let score = 100;

    if (moisture !== null) {
        if (moisture < 15) score -= 30;
        else if (moisture < 25) score -= 15;
        else if (moisture < 45) score -= 5;
    }

    if (rain < 5) score -= 25;
    else if (rain < 20) score -= 10;
    else if (rain > 60) score -= 10;

    if (slope > 20) score -= 25;
    else if (slope > 10) score -= 10;
    else if (slope > 5) score -= 5;

    return Math.max(0, Math.min(100, score));
};

const findscoreinfo = (score) => {
    if (score >= 75) return { text: 'Conditions are favorable', badge: 'Safe', class: 'good' };
    if (score >= 50) return { text: 'Some risks — monitor closely', badge: 'Caution', class: 'moderate' };
    return { text: 'High risk — take precautions', badge: 'Warning', class: 'bad' };
};

// showing crop suggestions based on the altitudes for the area in Rwanda 
const showcroprecom = (altitude, moisture, rain) => {
    const crops = [];

    if (altitude > 2000) {
        crops.push('Irish potatoes', 'wheat', 'peas', 'pyrethrum');
        if (moisture !== null && moisture > 25) crops.push('cabbage', 'carrots');
    } else if (altitude > 1500) {
        crops.push('beans', 'maize', 'sorghum', 'sweet potatoes');
        if (rain > 20) crops.push('tea', 'coffee');
        if (moisture !== null && moisture > 30) crops.push('tomatoes', 'onions');
    } else if (altitude > 1000) {
        crops.push('cassava', 'bananas', 'maize', 'groundnuts');
        if (rain > 30) crops.push('rice', 'sugar cane');
        if (moisture !== null && moisture > 20) crops.push('soybeans', 'vegetables');
    } else {
        crops.push('cassava', 'bananas', 'palm oil', 'tropical fruits');
        if (rain > 40) crops.push('rice', 'sugar cane');
    }

    if (moisture !== null && moisture < 15) {
        return 'Due to very dry conditions, drought-resistant crops are recommended: sorghum, cassava, millet, and sweet potatoes.';
    }

    return 'Based on this altitude (' + altitude + 'm) and conditions, suitable crops include: ' + crops.slice(0, 5).join(', ') + '.';
};

const displayrecom = (moisture, rain, slope, score, threats, altitude) => {
    const tips = [];

    if (moisture !== null && moisture < 15) {
        tips.push('Soil is very dry. Start irrigation immediately if possible. Mulching can help retain what moisture is left.');
    } else if (moisture !== null && moisture < 25) {
        tips.push('Soil moisture is low. Water crops in the early morning or late evening to reduce evaporation.');
    }

    if (rain < 5) {
        tips.push('Very little rain this week. Prioritize watering root crops and seedlings first.');
    } else if (rain > 60 && slope > 10) {
        tips.push('Heavy rain on sloped land increases landslide risk. Avoid working on steep hillsides for 48 hours after heavy rain.');
    }

    if (slope > 20) {
        tips.push('This terrain is steep. Terracing and contour farming will reduce soil erosion and protect crops.');
    } else if (slope > 10 && rain > 40) {
        tips.push('Ground saturation on slopes increases erosion. Check drainage channels and reinforce terrace walls.');
    }

    if (threats && threats.length > 0) {
        const closest = threats[0];
        tips.push('Active ' + closest.category.toLowerCase() + ' detected ' + closest.distance + 'km away (' + closest.title + '). Stay alert and monitor updates from local authorities.');
    }

    tips.push(showcroprecom(altitude, moisture, rain));

    if (tips.length === 1) {
        tips.unshift('Conditions look good for farming. No nearby threats detected. Continue regular monitoring and maintain soil health with organic matter.');
    }

    return tips.join(' ');
};


const showstats = (soil, elev) => {
    const moistureInfo = findmoistureinfo(soil.moisture);
    const rainInfo = findraininfo(soil.rainfallWeek);
    const slopeInfo = findslopeinfo(elev.slope);
    const score = calculatescore(soil.moisture, soil.rainfallWeek, elev.slope);
    const scoreInfo = findscoreinfo(score);

    document.getElementById('moisture-value').textContent = soil.moisture !== null ? soil.moisture + '%' : '--';
    document.getElementById('moisture-bar').style.width = (soil.moisture || 0) + '%';
    document.getElementById('moisture-bar').style.background = soil.moisture < 15 ? '#E24B4A' : soil.moisture < 25 ? '#EF9F27' : '#639922';
    document.getElementById('moisture-desc').textContent = moistureInfo.text;

    document.getElementById('rain-value').textContent = soil.rainfallWeek + 'mm';
    document.getElementById('rain-bar').style.width = Math.min(100, (soil.rainfallWeek / 80) * 100) + '%';
    document.getElementById('rain-desc').textContent = rainInfo.text;

    document.getElementById('slope-value').textContent = elev.slope + '°';
    document.getElementById('slope-bar').style.width = Math.min(100, (elev.slope / 30) * 100) + '%';
    document.getElementById('slope-bar').style.background = elev.slope > 20 ? '#E24B4A' : elev.slope > 10 ? '#EF9F27' : '#639922';
    document.getElementById('slope-desc').textContent = slopeInfo.text;

    document.getElementById('score-value').textContent = score + '/100';
    document.getElementById('score-bar').style.width = score + '%';
    document.getElementById('score-bar').style.background = score >= 75 ? '#639922' : score >= 50 ? '#EF9F27' : '#E24B4A';
    document.getElementById('score-desc').textContent = scoreInfo.text;

    return { moistureInfo, rainInfo, slopeInfo, score, scoreInfo };
};

const showreport = (name, fullName, soil, elev, infos, threats) => {
    const { moistureInfo, rainInfo, slopeInfo, score, scoreInfo } = infos;

    document.getElementById('report-title').textContent = 'Intelligence Report — ' + name;

    let threatBadge = '<span class="badge good">None nearby</span>';
    let threatText = 'No active events';
    if (threats && threats.length > 0) {
        if (threats[0].distance < 200) {
            threatBadge = '<span class="badge bad">' + threats.length + ' nearby</span>';
        } else {
            threatBadge = '<span class="badge moderate">' + threats.length + ' in region</span>';
        }
        threatText = threats[0].title + ' (' + threats[0].distance + 'km)';
    }

    const table = document.getElementById('report-table');
    table.innerHTML =
        '<div class="report-row">' +
            '<span class="report-row-label">Location</span>' +
            '<span class="report-row-value">' + fullName.split(',').slice(0, 2).join(', ') + '</span>' +
        '</div>' +
        '<div class="report-row">' +
            '<span class="report-row-label">Soil moisture</span>' +
            '<span class="report-row-value">' + (soil.moisture !== null ? soil.moisture + '%' : 'N/A') + ' <span class="badge ' + moistureInfo.class + '">' + moistureInfo.badge + '</span></span>' +
        '</div>' +
        '<div class="report-row">' +
            '<span class="report-row-label">Rainfall (7 days)</span>' +
            '<span class="report-row-value">' + soil.rainfallWeek + 'mm <span class="badge ' + rainInfo.class + '">' + rainInfo.badge + '</span></span>' +
        '</div>' +
        '<div class="report-row">' +
            '<span class="report-row-label">Altitude</span>' +
            '<span class="report-row-value">' + elev.altitude + 'm</span>' +
        '</div>' +
        '<div class="report-row">' +
            '<span class="report-row-label">Slope steepness</span>' +
            '<span class="report-row-value">' + elev.slope + '° <span class="badge ' + slopeInfo.class + '">' + slopeInfo.badge + '</span></span>' +
        '</div>' +
        '<div class="report-row">' +
            '<span class="report-row-label">Nearby threats</span>' +
            '<span class="report-row-value">' + threatText + ' ' + threatBadge + '</span>' +
        '</div>' +
        '<div class="report-row">' +
            '<span class="report-row-label">Safety score</span>' +
            '<span class="report-row-value">' + score + '/100 <span class="badge ' + scoreInfo.class + '">' + scoreInfo.badge + '</span></span>' +
        '</div>';

    const rec = document.getElementById('report-recommendation');
    rec.classList.remove('hidden');

    const recommendation = displayrecom(soil.moisture, soil.rainfallWeek, elev.slope, score, threats, elev.altitude);

    if (score >= 75) {
        rec.style.background = '#EAF3DE';
        rec.style.borderColor = '#C0DD97';
    } else if (score >= 50) {
        rec.style.background = '#FAEEDA';
        rec.style.borderColor = '#FAC775';
    } else {
        rec.style.background = '#FCEBEB';
        rec.style.borderColor = '#F09595';
    }

    document.getElementById('recommendation-text').textContent = 'Recommendation: ' + recommendation;
};



const addtohistory = (name, fullName, soil, elev, score) => {
    const exists = saved.find((l) => l.name === name);
    if (exists) {
        Object.assign(exists, { fullName, soil, elev, score, time: Date.now() });
    } else {
        saved.push({ name, fullName, soil, elev, score, time: Date.now() });
    }
    localStorage.setItem('savedLocations', JSON.stringify(saved));
    renderHistory();
};

const findrisklevel = (score) => {
    if (score >= 75) return 'low';
    if (score >= 50) return 'moderate';
    return 'high';
};


const renderHistory = () => {
    const container = document.getElementById('history-table');
    const searchTerm = document.getElementById('history-search').value.toLowerCase().trim();
    const sortBy = document.getElementById('sort-select').value;

    let filtered = [...saved];

    if (searchTerm) {
        filtered = filtered.filter((l) => l.name.toLowerCase().includes(searchTerm));
    }

    if (Filterthis !== 'all') {
        filtered = filtered.filter((l) => findrisklevel(l.score) === Filterthis);
    }

    if (sortBy === 'newest') filtered.sort((a, b) => b.time - a.time);
    else if (sortBy === 'driest') filtered.sort((a, b) => (a.soil.moisture || 100) - (b.soil.moisture || 100));
    else if (sortBy === 'wettest') filtered.sort((a, b) => b.soil.rainfallWeek - a.soil.rainfallWeek);
    else if (sortBy === 'steepest') filtered.sort((a, b) => b.elev.slope - a.elev.slope);
    else if (sortBy === 'risk') filtered.sort((a, b) => a.score - b.score);
    else if (sortBy === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));

    if (filtered.length === 0) {
        container.innerHTML = '<div class="history-empty"><i class="fas fa-map-marked-alt"></i><p>No locations found. Search or click the map to start.</p></div>';
        return;
    }

    container.innerHTML = filtered.map((l) => {
        const risk = findrisklevel(l.score);
        const badgeClass = risk === 'low' ? 'good' : risk === 'moderate' ? 'moderate' : 'bad';
        const badgeText = risk === 'low' ? 'Low risk' : risk === 'moderate' ? 'Moderate' : 'High risk';

        return '<div class="history-item" data-name="' + l.name + '">' +
            '<span class="history-item-name">' + l.name + '</span>' +
            '<span class="history-item-value">' + (l.soil.moisture !== null ? l.soil.moisture + '%' : '--') + '</span>' +
            '<span class="history-item-value">' + l.soil.rainfallWeek + 'mm</span>' +
            '<span class="history-item-value">' + l.elev.slope + '°</span>' +
            '<span class="history-item-risk"><span class="badge ' + badgeClass + '">' + badgeText + '</span></span>' +
            '</div>';
    }).join('');

    container.querySelectorAll('.history-item').forEach((item) => {
        item.addEventListener('click', () => {
            const loc = saved.find((l) => l.name === item.dataset.name);
            if (loc) {
                const infos = showstats(loc.soil, loc.elev);
                showreport(loc.name, loc.fullName, loc.soil, loc.elev, infos);
            }
        });
    });
};
// this is the main function - runs when user searches or clicks the map

const runanalysis = async (lat, lng, name, fullName) => {
    document.getElementById('location-name').textContent = name;
    document.getElementById('stats-loading').classList.remove('hidden');
    document.querySelector('.stats-grid').style.opacity = '0.3';

    if (Markthis) map.removeLayer(Markthis);
    Markthis = L.marker([lat, lng]).addTo(map);
    Markthis.bindPopup('<strong>' + name + '</strong>').openPopup();
    map.flyTo([lat, lng], 11, { duration: 1.2 });

    try {
        const [soil, elev, threats] = await Promise.all([
            getsoil(lat, lng),
            getelevation(lat, lng),
            getnearevents(lat, lng)
        ]);

        document.querySelector('.stats-grid').style.opacity = '1';
        document.getElementById('stats-loading').classList.add('hidden');

        const infos = showstats(soil, elev);
        showreport(name, fullName, soil, elev, infos, threats);

        const score = calculatescore(soil.moisture, soil.rainfallWeek, elev.slope);
        addtohistory(name, fullName, soil, elev, score);
        console.log('analysis done for', name, '- score:', score);

    } catch (err) {
        document.querySelector('.stats-grid').style.opacity = '1';
        document.getElementById('stats-loading').classList.add('hidden');
        showError(err.message);
    }
};


let busy = false;

const cleanInput = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.trim();
};

document.getElementById('search-btn').addEventListener('click', async () => {
    if (busy) return;

    let query = document.getElementById('location-search').value.trim();
    if (!query) { showError('Type a location name first.'); return; }
    if (query.length > 100) { showError('Search text is too long.'); return; }

    query = cleanInput(query);
    if (!query) { showError('Please enter a valid location name.'); return; }

    busy = true;
    try {
        const loc = await searchplace(query);
        await runanalysis(loc.lat, loc.lng, loc.name, loc.fullName);
    } catch (err) {
        showError(err.message);
    } finally {
        busy = false;
    }
});

document.getElementById('location-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('search-btn').click();
});

map.on('click', async (e) => {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    if (lat < -2.85 || lat > -1.05 || lng < 28.85 || lng > 30.9) {
        showError('Please click within Rwanda to analyse a location.');
        return;
    }

    await runanalysis(lat, lng, 'Selected Point', 'Custom location');
});

document.querySelectorAll('.pill').forEach((pill) => {
    pill.addEventListener('click', () => {
        document.querySelectorAll('.pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        Filterthis = pill.dataset.filter;
        renderHistory();
    });
});

document.getElementById('sort-select').addEventListener('change', renderHistory);
document.getElementById('history-search').addEventListener('input', renderHistory);

document.getElementById('clear-history').addEventListener('click', () => {
    saved = [];
    localStorage.removeItem('savedLocations');
    renderHistory();
});

renderHistory();