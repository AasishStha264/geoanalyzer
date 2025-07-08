// Initialize Leaflet map centered on Dhulikhel, Nepal
const map = L.map('map', {
    center: [27.6201, 85.5394], // Dhulikhel, Nepal
    zoom: 13,
    layers: []
});

// Create custom pane for analysis layers
map.createPane('analysisLayer');
map.getPane('analysisLayer').style.zIndex = 3;

// Define base layers
const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
});

const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 19
});

const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    maxZoom: 17
});

// Global variables
let localLayer = L.geoJSON(null, {
    style: { color: '#ff7800', weight: 2, fillOpacity: 0.1 },
    onEachFeature: function(feature, layer) {
        layer.bindPopup(`Local Level: ${feature.properties?.name || 'Unknown'}`);
    }
});

let districtLayer = L.geoJSON(null, {
    style: { color: '#00ff78', weight: 2, fillOpacity: 0.1 },
    onEachFeature: function(feature, layer) {
        layer.bindPopup(`District: ${feature.properties?.name || 'Unknown'}`);
    }
});

let provinceLayer = L.geoJSON(null, {
    style: { color: '#7800ff', weight: 2, fillOpacity: 0.1 },
    onEachFeature: function(feature, layer) {
        layer.bindPopup(`Province: ${feature.properties?.name || 'Unknown'}`);
    }
});

const baseLayers = {
    "OpenStreetMap": osmLayer,
    "Satellite": satelliteLayer,
    "Topographic": topoLayer
};

const overlays = {
    "Local Level": localLayer,
    "District": districtLayer,
    "Province": provinceLayer
};

let layerA = null, layerB = null;
let geojsonA = null, geojsonB = null;
let shapefileAName = null, shapefileBName = null;
let layerRoads = null, layerHouses = null, layerHospitals = null;
let geojsonRoads = null, geojsonHouses = null, geojsonHospitals = null;
let selectedRoadFeature = null, selectedRoadLayer = null;
let analysisLayers = [];
let selectedFeatureLayer = null, selectedParentLayer = null;
let markedPoint = null, layerPoint = null;
let mapClickHandler = null;
let geojsonLocal = null, geojsonDistrict = null, geojsonProvince = null;

// Add default base layer and layer control
osmLayer.addTo(map);
L.control.layers(baseLayers, overlays, { position: 'topright' }).addTo(map);

// General utility functions
function clearSelection() {
    if (selectedFeatureLayer) {
        selectedFeatureLayer.setStyle({ color: selectedFeatureLayer.originalColor });
        selectedFeatureLayer.closePopup();
        selectedFeatureLayer = null;
        selectedParentLayer = null;
        document.getElementById('removeSelectedBtn').style.display = 'none';
    }
}

function enableLayerSelection(layerGroup, layerName) {
    layerGroup.eachLayer(layer => {
        layer.originalColor = layer.options.color || '#f59e0b';
        layer.bindPopup(layerName || 'Analysis Result');
        layer.on('click', function(e) {
            e.originalEvent.stopPropagation();
            if (selectedFeatureLayer === layer) {
                clearSelection();
            } else {
                clearSelection();
                selectedFeatureLayer = layer;
                selectedParentLayer = layerGroup;
                layer.setStyle({ color: '#1d4ed8' });
                layer.openPopup();
                document.getElementById('removeSelectedBtn').style.display = 'block';
            }
        });
    });
}

function removeSelectedLayer() {
    if (!selectedParentLayer) return;
    map.removeLayer(selectedParentLayer);
    analysisLayers = analysisLayers.filter(l => l !== selectedParentLayer);
    clearSelection();
}

function clearAllAnalysisLayers() {
    analysisLayers.forEach(layer => map.removeLayer(layer));
    analysisLayers = [];
    clearSelection();
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Delete' && selectedFeatureLayer) removeSelectedLayer();
});

// Load administrative overlay layers
async function loadOverlayLayers() {
    const loadingMessage = document.getElementById('loadingMessage');
    loadingMessage.style.display = 'block';
    try {
        const localResponse = await fetch('http://localhost:3000/api/local');
        if (!localResponse.ok) throw new Error('Failed to fetch local level data: ' + localResponse.statusText);
        geojsonLocal = await localResponse.json();
        if (!geojsonLocal || !geojsonLocal.type || !Array.isArray(geojsonLocal.features)) {
            throw new Error('Invalid GeoJSON format for local level data');
        }
        geojsonLocal.features = geojsonLocal.features.filter(feature => feature.geometry && ['Polygon', 'MultiPolygon'].includes(feature.geometry.type));
        localLayer.addData(geojsonLocal);
        enableLayerSelection(localLayer, 'Local Level');
        console.log('Local Level loaded:', geojsonLocal.features.length, 'features');

        const districtResponse = await fetch('http://localhost:3000/api/district');
        if (!districtResponse.ok) throw new Error('Failed to fetch district data: ' + districtResponse.statusText);
        geojsonDistrict = await districtResponse.json();
        if (!geojsonDistrict || !geojsonDistrict.type || !Array.isArray(geojsonDistrict.features)) {
            throw new Error('Invalid GeoJSON format for district data');
        }
        geojsonDistrict.features = geojsonDistrict.features.filter(feature => feature.geometry && ['Polygon', 'MultiPolygon'].includes(feature.geometry.type));
        districtLayer.addData(geojsonDistrict);
        enableLayerSelection(districtLayer, 'District');
        console.log('District loaded:', geojsonDistrict.features.length, 'features');

        const provinceResponse = await fetch('http://localhost:3000/api/province');
        if (!provinceResponse.ok) throw new Error('Failed to fetch province data: ' + provinceResponse.statusText);
        geojsonProvince = await provinceResponse.json();
        if (!geojsonProvince || !geojsonProvince.type || !Array.isArray(geojsonProvince.features)) {
            throw new Error('Invalid GeoJSON format for province data');
        }
        geojsonProvince.features = geojsonProvince.features.filter(feature => feature.geometry && ['Polygon', 'MultiPolygon'].includes(feature.geometry.type));
        provinceLayer.addData(geojsonProvince);
        enableLayerSelection(provinceLayer, 'Province');
        console.log('Province loaded:', geojsonProvince.features.length, 'features');

        if (geojsonLocal?.features?.length) {
            map.fitBounds(localLayer.getBounds());
        } else if (geojsonDistrict?.features?.length) {
            map.fitBounds(districtLayer.getBounds());
        } else if (geojsonProvince?.features?.length) {
            map.fitBounds(provinceLayer.getBounds());
        }
    } catch (err) {
        console.error('Error loading overlay layers:', err);
        alert('Error loading overlay layers: ' + err.message);
    } finally {
        loadingMessage.style.display = 'none';
    }
}

// Section switching and tool visibility
function switchSection(id) {
    document.querySelectorAll('section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    map.invalidateSize();
    clearSelection();
    clearSelectedRoad();
    disablePointSelection();
    if (id === 'road-buffer') {
        loadRoadBufferData();
    } else if (id === 'proximity-analysis') {
        loadProximityData();
    } else {
        clearRoadBufferData();
        clearProximityData();
    }
}

function updateToolVisibility() {
    document.querySelectorAll('.tool-section').forEach(el => el.style.display = 'none');
    const val = document.getElementById('toolSelector').value;
    if (val !== 'none') document.getElementById(`${val}Tool`).style.display = 'block';
    clearSelection();
}

// Shapefile Analysis Tool (Buffer, Intersect, Union)
function loadShapefile(evt, type) {
    const file = evt.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        shp(e.target.result).then(function(geojson) {
            if (type === 'A') {
                if (layerA) map.removeLayer(layerA);
                geojsonA = geojson;
                shapefileAName = file.name.replace('.zip', '');
                layerA = L.geoJSON(geojson, { 
                    style: { color: '#6b7280', weight: 2 },
                    onEachFeature: function(feature, layer) {
                        layer.bindPopup(shapefileAName);
                    }
                }).addTo(map);
                map.fitBounds(layerA.getBounds());
                enableLayerSelection(layerA, shapefileAName);
            } else if (type === 'B') {
                if (layerB) map.removeLayer(layerB);
                geojsonB = geojson;
                shapefileBName = file.name.replace('.zip', '');
                layerB = L.geoJSON(geojson, { 
                    style: { color: '#16a34a', weight: 2 },
                    onEachFeature: function(feature, layer) {
                        layer.bindPopup(shapefileBName);
                    }
                }).addTo(map);
                map.fitBounds(layerB.getBounds());
                enableLayerSelection(layerB, shapefileBName);
            }
        }).catch(err => alert('Error loading shapefile: ' + err.message));
    };
    reader.readAsArrayBuffer(file);
}

function clearUploadedShapefiles() {
    if (layerA) map.removeLayer(layerA);
    if (layerB) map.removeLayer(layerB);
    document.getElementById('shapefileA').value = '';
    document.getElementById('shapefileA_intersect').value = '';
    document.getElementById('shapefileB_intersect').value = '';
    document.getElementById('shapefileA_union').value = '';
    document.getElementById('shapefileB_union').value = '';
    layerA = null; layerB = null;
    geojsonA = null; geojsonB = null;
    shapefileAName = null; shapefileBName = null;
    clearSelection();
}

function applyBufferTool() {
    if (!geojsonA) return alert("Upload Shapefile A first.");
    const km = parseFloat(document.getElementById('bufferDistance').value);
    if (isNaN(km) || km <= 0) return alert("Enter a valid positive distance.");
    try {
        const buffered = turf.buffer(geojsonA, km, { units: 'kilometers' });
        const bufferLayer = L.geoJSON(buffered, { 
            style: { color: '#f59e0b', weight: 2, fillOpacity: 0.2 },
            onEachFeature: function(feature, layer) {
                layer.bindPopup('Buffer Result');
            }
        }).addTo(map);
        analysisLayers.push(bufferLayer);
        enableLayerSelection(bufferLayer, 'Buffer Result');
        map.fitBounds(bufferLayer.getBounds());
        clearSelection();
    } catch (err) {
        console.error('Error in applyBufferTool:', err);
        alert('Error creating buffer: ' + err.message);
    }
}

function intersectTool() {
    if (!geojsonA || !geojsonB) return alert("Upload both shapefiles.");
    try {
        const results = [];
        geojsonA.features.forEach(f1 => {
            geojsonB.features.forEach(f2 => {
                if (turf.booleanIntersects(f1, f2)) {
                    const inter = turf.intersect(f1, f2);
                    if (inter) results.push(inter);
                }
            });
        });
        if (!results.length) return alert("No intersections found.");
        const layer = L.geoJSON({ type: "FeatureCollection", features: results }, { 
            style: { color: '#dc2626', weight: 2, fillOpacity: 0.2 },
            onEachFeature: function(feature, layer) {
                layer.bindPopup('Intersect Result');
            }
        }).addTo(map);
        analysisLayers.push(layer);
        enableLayerSelection(layer, 'Intersect Result');
        map.fitBounds(layer.getBounds());
        clearSelection();
    } catch (err) {
        console.error('Error in intersectTool:', err);
        alert('Error performing intersect: ' + err.message);
    }
}

function unionTool() {
    if (!geojsonA || !geojsonB) return alert("Upload both shapefiles.");
    try {
        const results = [];
        geojsonA.features.forEach(f1 => {
            geojsonB.features.forEach(f2 => {
                try {
                    const union = turf.union(f1, f2);
                    if (union) results.push(union);
                } catch (e) {
                    console.warn('Union operation failed for some features:', e.message);
                }
            });
        });
        if (!results.length) return alert("No valid unions found.");
        const layer = L.geoJSON({ type: "FeatureCollection", features: results }, { 
            style: { color: '#8b5cf6', weight: 2, fillOpacity: 0.2 },
            onEachFeature: function(feature, layer) {
                layer.bindPopup('Union Result');
            }
        }).addTo(map);
        analysisLayers.push(layer);
        enableLayerSelection(layer, 'Union Result');
        map.fitBounds(layer.getBounds());
        clearSelection();
    } catch (err) {
        console.error('Error in unionTool:', err);
        alert('Error performing union: ' + err.message);
    }
}

// Road Buffer Tool
async function loadRoadBufferData() {
    try {
        if (layerRoads) map.removeLayer(layerRoads);
        if (layerHouses) map.removeLayer(layerHouses);
        if (layerHospitals) map.removeLayer(layerHospitals);
        layerRoads = null;
        layerHouses = null;
        layerHospitals = null;
        geojsonRoads = null;
        geojsonHouses = null;
        geojsonHospitals = null;

        const roadResponse = await fetch('http://localhost:3000/api/roads');
        if (!roadResponse.ok) throw new Error('Failed to fetch roads: ' + roadResponse.statusText);
        geojsonRoads = await roadResponse.json();
        if (!geojsonRoads || !geojsonRoads.type || !Array.isArray(geojsonRoads.features)) {
            throw new Error('Invalid GeoJSON format for roads');
        }
        layerRoads = L.geoJSON(geojsonRoads, { 
            style: { color: '#1e40af', weight: 3 },
            onEachFeature: function(feature, layer) {
                layer.bindPopup(`Road ID: ${feature.properties.id || 'Unknown'}`);
                layer.on('click', function(e) {
                    e.originalEvent.stopPropagation();
                    if (selectedRoadFeature === layer) {
                        clearSelectedRoad();
                    } else {
                        clearSelectedRoad();
                        selectedRoadFeature = layer;
                        selectedRoadLayer = layerRoads;
                        layer.setStyle({ color: '#f97316' });
                        document.getElementById('removeSelectedRoadBtn').style.display = 'block';
                    }
                });
            }
        }).addTo(map);
        map.fitBounds(layerRoads.getBounds());

        const houseResponse = await fetch('http://localhost:3000/api/buildings');
        if (!houseResponse.ok) throw new Error('Failed to fetch buildings: ' + houseResponse.statusText);
        geojsonHouses = await houseResponse.json();
        if (!geojsonHouses || !geojsonHouses.type || !Array.isArray(geojsonHouses.features)) {
            throw new Error('Invalid GeoJSON format for buildings');
        }
        layerHouses = L.geoJSON(geojsonHouses, { 
            style: { color: '#be123c', weight: 2, fillOpacity: 0.5 },
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, { radius: 5, color: '#be123c', fillOpacity: 0.5 });
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup(`Building ID: ${feature.properties.id || 'Unknown'}`);
            }
        }).addTo(map);

        const hospitalResponse = await fetch('http://localhost:3000/api/hospitaa');
        if (!hospitalResponse.ok) throw new Error('Failed to fetch hospitals: ' + hospitalResponse.statusText);
        geojsonHospitals = await hospitalResponse.json();
        if (!geojsonHospitals || !geojsonHospitals.type || !Array.isArray(geojsonHospitals.features)) {
            throw new Error('Invalid GeoJSON format for hospitals');
        }
        layerHospitals = L.geoJSON(geojsonHospitals, { 
            style: { color: '#16a34a', weight: 2, fillOpacity: 0.5 },
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, { radius: 6, color: '#16a34a', fillOpacity: 0.7 });
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup(
                    `Hospital ID: ${feature.properties.id || 'Unknown'}<br>` +
                    `Name: ${feature.properties.name || 'N/A'}<br>` +
                    `Type: ${feature.properties.type || 'N/A'}`
                );
            }
        }).addTo(map);

    } catch (err) {
        console.error('Error loading PostGIS data:', err);
        alert('Error loading PostGIS data: ' + err.message);
    }
}

function clearSelectedRoad() {
    if (selectedRoadFeature) {
        selectedRoadFeature.setStyle({ color: '#1e40af' });
        selectedRoadFeature = null;
        selectedRoadLayer = null;
        document.getElementById('removeSelectedRoadBtn').style.display = 'none';
    }
}

function clearRoadBufferData() {
    if (layerRoads) map.removeLayer(layerRoads);
    if (layerHouses) map.removeLayer(layerHouses);
    if (layerHospitals) map.removeLayer(layerHospitals);
    clearAllAnalysisLayers();
    clearSelectedRoad();
    document.getElementById('roadBufferDistance').value = '';
    document.getElementById('affectedHousesResult').innerHTML = '';
    layerRoads = null; layerHouses = null; layerHospitals = null;
    geojsonRoads = null; geojsonHouses = null; geojsonHospitals = null;
}

function roadBufferTool() {
    if (!geojsonRoads || !geojsonHouses || !geojsonHospitals) {
        alert("Road, building, or hospital data not loaded. Please ensure data is fetched from the server.");
        return;
    }

    if (!selectedRoadFeature || !selectedRoadFeature.feature) {
        alert("Please select a road by clicking on it on the map.");
        return;
    }

    const km = parseFloat(document.getElementById('roadBufferDistance').value);
    if (isNaN(km) || km <= 0) {
        alert("Please enter a valid positive buffer distance in kilometers.");
        return;
    }

    try {
        console.log('Selected road feature:', selectedRoadFeature.feature);
        const roadsToBuffer = { type: "FeatureCollection", features: [selectedRoadFeature.feature] };
        const roadGeometryType = turf.getType(selectedRoadFeature.feature);
        console.log('Road geometry type:', roadGeometryType);
        if (!['LineString', 'MultiLineString'].includes(roadGeometryType)) {
            alert("Invalid road geometry. Please select a valid LineString or MultiLineString road.");
            return;
        }

        const buffered = turf.buffer(roadsToBuffer, km, { units: 'kilometers' });
        console.log('Buffered geometry:', buffered);
        if (!buffered || !buffered.features.length) {
            alert("Failed to create buffer. Please try a different road or distance.");
            return;
        }

        const affectedHouses = [];
        const affectedHospitals = [];
        let houseCount = 0;
        let hospitalCount = 0;

        geojsonHouses.features.forEach(house => {
            try {
                const houseGeometryType = turf.getType(house);
                const isPoint = ['Point', 'MultiPoint'].includes(houseGeometryType);
                const isWithin = isPoint ? turf.booleanWithin(house, buffered.features[0]) : turf.intersect(house, buffered.features[0]);
                if (isWithin) {
                    affectedHouses.push(house);
                    houseCount++;
                }
            } catch (err) {
                console.warn(`Error processing house ID ${house.properties.id || 'Unknown'}:`, err.message);
            }
        });

        geojsonHospitals.features.forEach(hospital => {
            try {
                const hospitalGeometryType = turf.getType(hospital);
                const isPoint = ['Point', 'MultiPoint'].includes(hospitalGeometryType);
                const isWithin = isPoint ? turf.booleanWithin(hospital, buffered.features[0]) : turf.intersect(hospital, buffered.features[0]);
                if (isWithin) {
                    affectedHospitals.push(hospital);
                    hospitalCount++;
                }
            } catch (err) {
                console.warn(`Error processing hospital ID ${hospital.properties.id || 'Unknown'}:`, err.message);
            }
        });

        clearAllAnalysisLayers();

        map.getPane('analysisLayer').style.zIndex = 450;

        if (layerRoads && map && !map.hasLayer(layerRoads)) layerRoads.addTo(map);
        if (layerHouses && map && !map.hasLayer(layerHouses)) layerHouses.addTo(map);
        if (layerHospitals && map && !map.hasLayer(layerHospitals)) layerHospitals.addTo(map);

        const bufferLayer = L.geoJSON(buffered, {
            style: { color: '#f59e0b', weight: 3, fillOpacity: 0.5 },
            onEachFeature: function(feature, layer) {
                layer.bindPopup(`Road Buffer (${km} km)`);
            },
            pane: 'analysisLayer'
        }).addTo(map);
        console.log('Buffer layer added to map:', bufferLayer);

        const affectedHousesLayer = L.geoJSON({ type: "FeatureCollection", features: affectedHouses }, {
            style: { color: '#dc2626', weight: 2, fillOpacity: 0.5 },
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, { radius: 5, color: '#dc2626', fillOpacity: 0.5 });
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup(`Building ID: ${feature.properties.id || 'Unknown'}`);
            },
            pane: 'analysisLayer'
        }).addTo(map);

        const affectedHospitalsLayer = L.geoJSON({ type: "FeatureCollection", features: affectedHospitals }, {
            style: { color: '#16a34a', weight: 2, fillOpacity: 0.7 },
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, { radius: 6, color: '#16a34a', fillOpacity: 0.7 });
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup(
                    `Hospital ID: ${feature.properties.id || 'Unknown'}<br>` +
                    `Name: ${feature.properties.name || 'N/A'}<br>` +
                    `Type: ${feature.properties.type || 'N/A'}`
                );
            },
            pane: 'analysisLayer'
        }).addTo(map);

        analysisLayers.push(bufferLayer, affectedHousesLayer, affectedHospitalsLayer);
        enableLayerSelection(bufferLayer, 'Road Buffer');
        enableLayerSelection(affectedHousesLayer, 'Affected Buildings');
        enableLayerSelection(affectedHospitalsLayer, 'Affected Hospitals');

        document.getElementById('affectedHousesResult').innerHTML = 
            `Number of buildings affected: ${houseCount}<br>` +
            `Number of hospitals affected: ${hospitalCount}`;

        map.fitBounds(bufferLayer.getBounds());
        setTimeout(() => map.invalidateSize(), 100);

        clearSelectedRoad();
    } catch (err) {
        console.error("Error in roadBufferTool:", err);
        alert("An error occurred while processing the road buffer: " + err.message);
    }
}

// Hospital Proximity Analysis Tool
async function loadProximityData() {
    try {
        if (!map) throw new Error('Map not initialized');
        console.log('Map container state:', map.getContainer());

        if (layerHouses && map.hasLayer(layerHouses)) map.removeLayer(layerHouses);
        if (layerHospitals && map.hasLayer(layerHospitals)) map.removeLayer(layerHospitals);
        layerHouses = null;
        layerHospitals = null;
        geojsonHouses = null;
        geojsonHospitals = null;

        const houseResponse = await fetch('http://localhost:3000/api/buildings');
        if (!houseResponse.ok) throw new Error('Failed to fetch buildings: ' + houseResponse.statusText);
        geojsonHouses = await houseResponse.json();
        if (!geojsonHouses || !geojsonHouses.type || !Array.isArray(geojsonHouses.features)) {
            throw new Error('Invalid GeoJSON format for buildings');
        }
        geojsonHouses.features = geojsonHouses.features.filter(feature => {
            if (!feature.geometry) {
                console.warn('Invalid building feature, missing geometry:', feature);
                return false;
            }
            const type = feature.geometry.type;
            if (!['Point', 'MultiPoint'].includes(type)) {
                console.warn('Invalid building geometry type:', type, feature);
                return false;
            }
            return true;
        });
        console.log('Filtered buildings:', geojsonHouses.features.length, 'valid features');
        if (geojsonHouses.features.length === 0) {
            console.warn('No valid building features after filtering');
        }

        layerHouses = L.geoJSON(geojsonHouses, { 
            style: { color: '#be123c', weight: 2, fillOpacity: 0.7 },
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, { radius: 5, color: '#be123c', fillOpacity: 0.7 });
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup(`Building ID: ${feature.properties?.id || 'Unknown'}`);
            },
            pane: map.getPane('leaflet-overlay-pane') ? 'leaflet-overlay-pane' : undefined
        }).addTo(map);
        console.log('Buildings layer added to map:', geojsonHouses.features.length, 'features');
        enableLayerSelection(layerHouses, 'Building');

        const hospitalResponse = await fetch('http://localhost:3000/api/hospitaa');
        if (!hospitalResponse.ok) throw new Error('Failed to fetch hospitals: ' + hospitalResponse.statusText);
        geojsonHospitals = await hospitalResponse.json();
        if (!geojsonHospitals || !geojsonHospitals.type || !Array.isArray(geojsonHospitals.features)) {
            throw new Error('Invalid GeoJSON format for hospitals');
        }
        geojsonHospitals.features = geojsonHospitals.features.filter(feature => {
            if (!feature.geometry) {
                console.warn('Invalid hospital feature, missing geometry:', feature);
                return false;
            }
            return true;
        });
        console.log('Filtered hospitals:', geojsonHospitals.features.length, 'valid features');
        if (geojsonHospitals.features.length === 0) {
            console.warn('No valid hospital features after filtering');
        }

        layerHospitals = L.geoJSON(geojsonHospitals, { 
            style: { color: '#16a34a', weight: 2, fillOpacity: 0.7 },
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, { radius: 6, color: '#16a34a', fillOpacity: 0.7 });
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup(
                    `Hospital ID: ${feature.properties?.id || 'Unknown'}<br>` +
                    `Name: ${feature.properties?.name || 'N/A'}<br>` +
                    `Type: ${feature.properties?.type || 'N/A'}`
                );
            },
            pane: map.getPane('leaflet-overlay-pane') ? 'leaflet-overlay-pane' : undefined
        }).addTo(map);
        console.log('Hospitals layer added to map:', geojsonHospitals.features.length, 'features');
        enableLayerSelection(layerHospitals, 'Hospital');

        if (layerHouses && geojsonHouses.features.length > 0) {
            map.fitBounds(layerHouses.getBounds());
        } else if (layerHospitals && geojsonHospitals.features.length > 0) {
            map.fitBounds(layerHospitals.getBounds());
        }
        setTimeout(() => map.invalidateSize(), 100);
        console.log('Proximity data loaded and map updated');
    } catch (err) {
        console.error('Error in loadProximityData:', err);
        alert('Error loading proximity data: ' + err.message);
    }
}

function enablePointSelection() {
    if (mapClickHandler) {
        map.off('click', mapClickHandler);
    }
    mapClickHandler = function(e) {
        if (layerPoint && map && map.hasLayer(layerPoint)) map.removeLayer(layerPoint);
        clearAllAnalysisLayers();
        markedPoint = turf.point([e.latlng.lng, e.latlng.lat]);
        layerPoint = L.geoJSON(markedPoint, {
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, { radius: 10, color: '#8b5cf6', fillOpacity: 0.9 });
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup('Marked Location');
            },
            pane: map.getPane('analysisLayer') ? 'analysisLayer' : undefined
        }).addTo(map);
        console.log('Marked point added to map at:', e.latlng);
        enableLayerSelection(layerPoint, 'Marked Location');
        document.getElementById('proximityResults').innerHTML = '✅ Location marked. Click "Find Nearest Hospital" to proceed.';
        map.fitBounds(layerPoint.getBounds());
        if (layerHouses && map) layerHouses.addTo(map);
        if (layerHospitals && map) layerHospitals.addTo(map);
        setTimeout(() => map.invalidateSize(), 100);
    };
    map.on('click', mapClickHandler);
    document.getElementById('proximityResults').innerHTML = '🖱️ Click on the map to mark a location.';
}

function disablePointSelection() {
    if (mapClickHandler) {
        map.off('click', mapClickHandler);
        mapClickHandler = null;
    }
}

function clearProximityData() {
    if (layerPoint && map && map.hasLayer(layerPoint)) map.removeLayer(layerPoint);
    if (layerHouses && map && map.hasLayer(layerHouses)) map.removeLayer(layerHouses);
    if (layerHospitals && map && map.hasLayer(layerHospitals)) map.removeLayer(layerHospitals);
    clearAllAnalysisLayers();
    disablePointSelection();
    document.getElementById('proximityRadius').value = '';
    document.getElementById('proximityResults').innerHTML = '';
    layerPoint = null; markedPoint = null;
    layerHouses = null; layerHospitals = null;
    geojsonHouses = null; geojsonHospitals = null;
    if (map) setTimeout(() => map.invalidateSize(), 100);
}

async function runProximityAnalysis() {
    if (!markedPoint) {
        alert("Please mark a location on the map by clicking 'Mark Location' and selecting a point.");
        return;
    }
    if (!geojsonHospitals) {
        alert("Hospital data not loaded. Please ensure data is fetched from the server.");
        return;
    }
    const km = parseFloat(document.getElementById('proximityRadius').value);
    if (isNaN(km) || km <= 0) {
        alert("Please enter a valid positive search radius in kilometers.");
        return;
    }
    try {
        console.log('markedPoint:', markedPoint);
        console.log('Search radius (km):', km);

        let buffered = turf.buffer(markedPoint, km, { units: 'kilometers' });
        if (!buffered) {
            alert("Failed to create buffer. Please try a different radius.");
            return;
        }
        if (buffered.type !== 'FeatureCollection') {
            buffered = {
                type: 'FeatureCollection',
                features: [buffered]
            };
        }
        console.log('Buffered output:', buffered);

        let nearestHospital = null;
        let minDistance = Infinity;
        let nearestHospitalFeature = null;
        geojsonHospitals.features.forEach(hospital => {
            try {
                const hospitalPoint = turf.centroid(hospital);
                const distance = turf.distance(markedPoint, hospitalPoint, { units: 'kilometers' });
                if (distance <= km && distance < minDistance) {
                    minDistance = distance;
                    nearestHospital = hospital;
                    nearestHospitalFeature = hospitalPoint;
                }
            } catch (err) {
                console.warn(`Error processing hospital ID ${hospital.properties?.id || 'Unknown'}:`, err.message);
            }
        });
        if (!nearestHospital) {
            document.getElementById('proximityResults').innerHTML = 'No hospitals found within the specified radius.';
            return;
        }
        const line = turf.lineString([
            markedPoint.geometry.coordinates,
            nearestHospitalFeature.geometry.coordinates
        ]);
        clearAllAnalysisLayers();
        const bufferLayer = L.geoJSON(buffered, {
            style: { color: '#8b5cf6', weight: 3, fillOpacity: 0.3 },
            onEachFeature: function(feature, layer) {
                layer.bindPopup('Search Radius');
            },
            pane: map.getPane('analysisLayer') ? 'analysisLayer' : undefined
        }).addTo(map);
        console.log('Buffer layer added to map:', buffered.features.length, 'features');
        if (layerPoint && map) layerPoint.addTo(map);
        console.log('Marked point layer re-added to map');
        
        const nearestHospitalLayer = L.geoJSON(nearestHospital, {
            style: { color: '#16a34a', weight: 3, fillOpacity: 0.9 },
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, { radius: 10, color: '#16a34a', fillOpacity: 0.9 });
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup(
                    `Hospital ID: ${feature.properties?.id || 'Unknown'}<br>` +
                    `Name: ${feature.properties?.name || 'N/A'}<br>` +
                    `Type: ${feature.properties?.type || 'N/A'}`
                );
            },
            pane: map.getPane('analysisLayer') ? 'analysisLayer' : undefined
        }).addTo(map);
        console.log('Nearest hospital layer added to map');
        const lineLayer = L.geoJSON(line, {
            style: { color: '#ff0000', weight: 4, opacity: 0.8, dashArray: '5, 10' },
            onEachFeature: function(feature, layer) {
                layer.bindPopup(`Distance: ${minDistance.toFixed(2)} km`);
            },
            pane: map.getPane('analysisLayer') ? 'analysisLayer' : undefined
        }).addTo(map);
        console.log('Connecting line layer added to map');
        analysisLayers.push(bufferLayer, nearestHospitalLayer, lineLayer);
        enableLayerSelection(bufferLayer, 'Search Radius');
        enableLayerSelection(nearestHospitalLayer, 'Nearest Hospital');
        enableLayerSelection(lineLayer, 'Distance Line');
        document.getElementById('proximityResults').innerHTML = 
            `<strong>Nearest Hospital</strong><br>` +
            `Hospital ID: ${nearestHospital.properties?.id || 'Unknown'}<br>` +
            `Name: ${nearestHospital.properties?.name || 'N/A'}<br>` +
            `Type: ${nearestHospital.properties?.type || 'N/A'}<br>` +
            `Distance: ${minDistance.toFixed(2)} km`;
        map.fitBounds(bufferLayer.getBounds());
        if (layerHouses && map) layerHouses.addTo(map);
        if (layerHospitals && map) layerHospitals.addTo(map);
        setTimeout(() => map.invalidateSize(), 100);
        console.log('Context layers re-added and map updated');
    } catch (err) {
        console.error("Error in runProximityAnalysis:", err);
        alert("An error occurred while processing the proximity analysis: " + err.message);
    }
}

// Event listeners
document.getElementById('shapefileA').addEventListener('change', function(evt) { loadShapefile(evt, 'A'); });
document.getElementById('shapefileA_intersect').addEventListener('change', function(evt) { loadShapefile(evt, 'A'); });
document.getElementById('shapefileB_intersect').addEventListener('change', function(evt) { loadShapefile(evt, 'B'); });
document.getElementById('shapefileA_union').addEventListener('change', function(evt) { loadShapefile(evt, 'A'); });
document.getElementById('shapefileB_union').addEventListener('change', function(evt) { loadShapefile(evt, 'B'); });

map.on('click', function(e) {
    if (mapClickHandler && document.getElementById('proximity-analysis').classList.contains('active')) {
        mapClickHandler(e);
    } else {
        clearSelection();
        clearSelectedRoad();
    }
});

// Initialize overlay layers
loadOverlayLayers();