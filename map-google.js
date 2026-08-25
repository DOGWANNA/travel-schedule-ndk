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
    if (mode === 'transit') {
      return this._fetchTransitRoute(from, to);
    }
    return this._fetchDrivingRoute(from, to, mode);
  }

  async _fetchTransitRoute(from, to) {
    const { encoding } = await google.maps.importLibrary('geometry');

    // 1차: google.maps.routes.Route (Google 권장 신규 API)
    try {
      const routesLib = await google.maps.importLibrary('routes');
      const RouteClass = routesLib.Route;
      const TravelModeEnum = routesLib.TravelMode;
      if (RouteClass) {
        const request = {
          origin: { lat: from.lat, lng: from.lng },
          destination: { lat: to.lat, lng: to.lng },
          travelMode: TravelModeEnum ? TravelModeEnum.TRANSIT : 'TRANSIT'
        };
        const fetchFields = [
          'routes.duration',
          'routes.polyline.encodedPolyline',
          'routes.legs.duration',
          'routes.legs.steps.polyline.encodedPolyline'
        ];
        const callFn = typeof RouteClass.computeRoutes === 'function'
          ? function(req, f) { return RouteClass.computeRoutes(req, f); }
          : function(req, f) { return new RouteClass().computeRoutes(req, f); };
        const result = await callFn(request, fetchFields);
        try {
          console.log('[routes.Route result type]:', typeof result);
          if (result && result.routes) {
            console.log('[routes count]:', result.routes.length);
            if (result.routes.length > 0) {
              var r0 = result.routes[0];
              console.log('[route[0] keys]:', Object.keys(r0).join(', '));
              console.log('[route[0].duration]:', r0.duration);
              console.log('[route[0].polyline]:', r0.polyline);
              console.log('[route[0].legs count]:', r0.legs ? r0.legs.length : 'no legs');
            }
          } else {
            console.log('[routes.Route result raw]:', result);
          }
        } catch (_) {}
        if (result && result.routes && result.routes.length) {
          const r = result.routes[0];
          let path = [];
          if (r.polyline && r.polyline.encodedPolyline) {
            path = encoding.decodePath(r.polyline.encodedPolyline).map(function(p) { return { lat: p.lat(), lng: p.lng() }; });
          } else if (r.legs) {
            r.legs.forEach(function(leg) {
              (leg.steps || []).forEach(function(step) {
                if (step.polyline && step.polyline.encodedPolyline) {
                  encoding.decodePath(step.polyline.encodedPolyline).forEach(function(p) { path.push({ lat: p.lat(), lng: p.lng() }); });
                }
              });
            });
          }
          const durationMs = r.duration ? (typeof r.duration === 'string' ? parseInt(r.duration) * 1000 : (r.duration.seconds || 0) * 1000) : 0;
          if (path.length) return { path, durationMs };
        }
        throw new Error('routes.Route: no usable route');
      }
    } catch (e) {
      console.warn('[routes.Route failed]:', e.message);
    }

    // 2차 fallback: DirectionsService TRANSIT
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
        route.legs.forEach(function(leg) {
          leg.steps.forEach(function(step) {
            step.path.forEach(function(p) { path.push({ lat: p.lat(), lng: p.lng() }); });
          });
        });
        const durationMs = route.legs.reduce(function(sum, leg) { return sum + leg.duration.value; }, 0) * 1000;
        resolve({ path, durationMs });
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
