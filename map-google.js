class GoogleMapAdapter extends MapAdapter {
  constructor() {
    super();
    this._map = null;
    this._markers = [];
    this._polyline = null;
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
      const pin = new this._PinElement({
        background: '#e2703f',
        glyphColor: 'white',
        borderColor: '#c85a2a'
      });
      content = pin.element;
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
    this._polyline = new google.maps.Polyline(polylineOpts);
    return this._polyline;
  }

  removePolyline(polyline) {
    if (polyline) polyline.setMap(null);
    if (this._polyline === polyline) this._polyline = null;
  }

  clearPolyline() {
    if (this._polyline) { this._polyline.setMap(null); this._polyline = null; }
  }

  async fetchRoute(from, to, mode) {
    const travelModeMap = {
      driving: 'DRIVE',
      transit: 'TRANSIT',
      walking: 'WALK'
    };
    const travelMode = travelModeMap[mode] || 'DRIVE';

    const { Route } = await google.maps.importLibrary('routes');
    const { encoding } = await google.maps.importLibrary('geometry');

    const request = {
      origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
      destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
      travelMode,
      computeAlternativeRoutes: false,
      languageCode: 'ko-KR'
    };

    if (travelMode === 'TRANSIT') {
      request.transitPreferences = { routingPreference: 'FEWER_TRANSFERS' };
    }

    const response = await new Route().computeRoutes(request);
    if (!response.routes || !response.routes.length) throw new Error('No route found');

    const r = response.routes[0];
    const path = encoding.decodePath(r.polyline.encodedPolyline)
      .map(p => ({ lat: p.lat(), lng: p.lng() }));
    const durationMs = r.legs.reduce((sum, leg) => sum + parseInt(leg.duration), 0) * 1000;

    return { path, durationMs };
  }

  makeSpotIcon(type) {
    const emoji = SPOT_TYPE_ICON[type] || SPOT_TYPE_ICON.default;
    const el = document.createElement('div');
    el.style.cssText = 'width:34px;height:34px;border-radius:50%;background:#e2703f;display:flex;align-items:center;justify-content:center;font-size:17px;cursor:pointer;';
    el.textContent = emoji;
    return { element: el };
  }
}
