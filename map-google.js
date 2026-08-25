class GoogleMapAdapter extends MapAdapter {
  constructor() {
    super();
    this._map = null;
    this._markers = [];
    this._polylines = [];
    this._AdvancedMarkerElement = null;
    this._PinElement = null;
  }

  async init(divId) {
    const { Map } = await google.maps.importLibrary('maps');
    const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary('marker');
    this._AdvancedMarkerElement = AdvancedMarkerElement;
    this._PinElement = PinElement;
    this._map = new Map(document.getElementById(divId), {
      center: { lat: 35.68, lng: 139.69 },
      zoom: 9,
      mapId: GOOGLE_MAP_ID
    });
  }

  setCenter(lat, lng) {
    this._map.setCenter({ lat, lng });
  }

  setZoom(level) {
    this._map.setZoom(level);
  }

  fitBounds(points) {
    if (!points.length) return;
    const bounds = new google.maps.LatLngBounds();
    points.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }));
    this._map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
  }

  addMarker(lat, lng, options) {
    let content;
    if (options && options.icon && options.icon.element) {
      content = options.icon.element;
    } else {
      content = new this._PinElement({
        background: '#e2703f',
        glyphColor: 'white',
        borderColor: '#c85a2a'
      });
    }
    const marker = new this._AdvancedMarkerElement({
      position: { lat, lng },
      map: this._map,
      title: (options && options.title) || '',
      content
    });
    this._markers.push(marker);
    return marker;
  }

  removeMarker(marker) {
    marker.map = null;
    this._markers = this._markers.filter(m => m !== marker);
  }

  clearMarkers() {
    this._markers.forEach(m => { m.map = null; });
    this._markers = [];
  }

  drawPolyline(points, options) {
    const isDashed = options && options.strokeStyle === 'shortdash';
    const polylineOpts = {
      path: points.map(p => ({ lat: p.lat, lng: p.lng })),
      map: this._map,
      strokeColor: (options && options.strokeColor) || '#e2703f',
      strokeWeight: (options && options.strokeWeight) || 4,
      strokeOpacity: isDashed ? 0 : 1
    };
    if (isDashed) {
      polylineOpts.icons = [{
        icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
        offset: '0',
        repeat: '20px'
      }];
    }
    const polyline = new google.maps.Polyline(polylineOpts);
    this._polylines.push(polyline);
    return polyline;
  }

  removePolyline(polyline) {
    if (polyline) polyline.setMap(null);
    this._polylines = this._polylines.filter(p => p !== polyline);
  }

  clearPolyline() {
    this._polylines.forEach(p => p.setMap(null));
    this._polylines = [];
  }

  async fetchRoute(from, to, mode) {
    if (mode === 'transit') {
      return this._fetchTransitRoute(from, to);
    }
    try {
      return await this._fetchDrivingRoute(from, to, mode);
    } catch (e) {
      // Google은 한국 내 도로/도보 경로를 지원하지 않음 → Naver Worker로 폴백
      if (this._isKoreanCoords(from, to) && typeof ROUTE_WORKER_URL !== 'undefined') {
        return await this._fetchNaverRoute(from, to);
      }
      throw e;
    }
  }

  _isKoreanCoords(from, to) {
    function inKorea(p) { return p.lat >= 33 && p.lat <= 39 && p.lng >= 124 && p.lng <= 132; }
    return inKorea(from) || inKorea(to);
  }

  async _fetchNaverRoute(from, to) {
    const url = ROUTE_WORKER_URL + '/route?slat=' + from.lat + '&slng=' + from.lng +
      '&dlat=' + to.lat + '&dlng=' + to.lng;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Naver route failed: ' + res.status);
    const data = await res.json();
    if (!data.path) throw new Error('No path from Naver');
    return {
      path: data.path.map(function(p) { return { lat: p[0], lng: p[1] }; }),
      durationMs: data.durationMs || 0
    };
  }

  _fetchTransitRoute(from, to) {
    const VEHICLE_ICON = { SUBWAY: '🚇', BUS: '🚌', TRAIN: '🚆', RAIL: '🚆', TRAM: '🚊' };
    const VEHICLE_DEFAULT_COLOR = { SUBWAY: '#0067FF', BUS: '#28a745', TRAIN: '#6f42c1', RAIL: '#6f42c1', TRAM: '#fd7e14' };
    return new Promise(function(resolve, reject) {
      new google.maps.DirectionsService().route({
        origin: { lat: from.lat, lng: from.lng },
        destination: { lat: to.lat, lng: to.lng },
        travelMode: google.maps.TravelMode.TRANSIT,
        transitOptions: { departureTime: new Date() }
      }, function(result, status) {
        if (status !== 'OK') { reject(new Error('Transit: ' + status)); return; }
        const route = result.routes[0];
        const path = [];
        const transitSteps = [];
        const stepPaths = [];
        route.legs.forEach(function(leg) {
          leg.steps.forEach(function(step) {
            var stepPath = step.path.map(function(p) { return { lat: p.lat(), lng: p.lng() }; });
            stepPath.forEach(function(p) { path.push(p); });
            if (step.travel_mode === 'WALKING') {
              transitSteps.push({ mode: 'WALKING', duration: step.duration.text });
              stepPaths.push({ path: stepPath, mode: 'WALKING', color: '#aaaaaa', strokeStyle: 'shortdash', strokeWeight: 3 });
            } else if (step.travel_mode === 'TRANSIT' && step.transit) {
              var t = step.transit;
              var vtype = (t.line && t.line.vehicle && t.line.vehicle.type) || 'BUS';
              var rawColor = (t.line && t.line.color) || null;
              var lineColor = rawColor ? (rawColor.startsWith('#') ? rawColor : '#' + rawColor) : (VEHICLE_DEFAULT_COLOR[vtype] || '#0067FF');
              transitSteps.push({
                mode: 'TRANSIT',
                duration: step.duration.text,
                lineName: (t.line && (t.line.short_name || t.line.name)) || '',
                numStops: t.num_stops || 0,
                vehicleType: vtype,
                icon: VEHICLE_ICON[vtype] || '🚌',
                lineColor: lineColor,
                headsign: t.headsign || ''
              });
              stepPaths.push({ path: stepPath, mode: 'TRANSIT', color: lineColor, strokeStyle: 'solid', strokeWeight: 5 });
            }
          });
        });
        const durationMs = route.legs.reduce(function(sum, leg) { return sum + leg.duration.value; }, 0) * 1000;
        resolve({ path, durationMs, transitSteps, stepPaths });
      });
    });
  }

  _fetchDrivingRoute(from, to, mode) {
    const modeMap = {
      driving: google.maps.TravelMode.DRIVING,
      walking: google.maps.TravelMode.WALKING
    };
    const travelMode = modeMap[mode] || google.maps.TravelMode.DRIVING;

    return new Promise((resolve, reject) => {
      new google.maps.DirectionsService().route({
        origin: { lat: from.lat, lng: from.lng },
        destination: { lat: to.lat, lng: to.lng },
        travelMode
      }, (result, status) => {
        if (status !== 'OK') { reject(new Error('Directions failed: ' + status)); return; }
        const route = result.routes[0];
        const path = [];
        route.legs.forEach(function(leg) {
          leg.steps.forEach(function(step) {
            step.path.forEach(function(p) { path.push({ lat: p.lat(), lng: p.lng() }); });
          });
        });
        const durationMs = route.legs.reduce((sum, leg) => sum + leg.duration.value, 0) * 1000;
        resolve({ path, durationMs });
      });
    });
  }

  makeSpotIcon(type) {
    const emoji = SPOT_TYPE_ICON[type] || SPOT_TYPE_ICON.default;
    const el = document.createElement('div');
    el.style.cssText = 'width:34px;height:34px;border-radius:50%;background:#e2703f;display:flex;align-items:center;justify-content:center;font-size:17px;cursor:pointer;';
    el.textContent = emoji;
    return { element: el };
  }
}
