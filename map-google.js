class GoogleMapAdapter extends MapAdapter {
  constructor() {
    super();
    this._map = null;
    this._markers = [];
    this._polyline = null;
  }

  init(divId) {
    this._map = new google.maps.Map(document.getElementById(divId), {
      center: { lat: 35.68, lng: 139.69 },
      zoom: 9
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
    const opts = {
      position: { lat, lng },
      map: this._map,
      title: (options && options.title) || ''
    };
    if (options && options.icon && options.icon.googleIcon) {
      opts.icon = options.icon.googleIcon;
    }
    const marker = new google.maps.Marker(opts);
    this._markers.push(marker);
    return marker;
  }

  removeMarker(marker) {
    marker.setMap(null);
    this._markers = this._markers.filter(m => m !== marker);
  }

  clearMarkers() {
    this._markers.forEach(m => m.setMap(null));
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
    const modeMap = {
      driving: google.maps.TravelMode.DRIVING,
      transit: google.maps.TravelMode.TRANSIT,
      walking: google.maps.TravelMode.WALKING
    };
    const travelMode = modeMap[mode] || google.maps.TravelMode.DRIVING;
    return new Promise((resolve, reject) => {
      const request = {
        origin: { lat: from.lat, lng: from.lng },
        destination: { lat: to.lat, lng: to.lng },
        travelMode
      };
      if (travelMode === google.maps.TravelMode.TRANSIT) {
        request.transitOptions = { departureTime: new Date() };
      }
      new google.maps.DirectionsService().route(request, (result, status) => {
        if (status !== 'OK') { reject(new Error('Directions failed: ' + status)); return; }
        const route = result.routes[0];
        const path = route.overview_path.map(p => ({ lat: p.lat(), lng: p.lng() }));
        const durationMs = route.legs.reduce((sum, leg) => sum + leg.duration.value, 0) * 1000;
        resolve({ path, durationMs });
      });
    });
  }

  makeSpotIcon(type) {
    const emoji = SPOT_TYPE_ICON[type] || SPOT_TYPE_ICON.default;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34">
      <circle cx="17" cy="17" r="17" fill="#e2703f"/>
      <text x="17" y="23" text-anchor="middle" font-size="17">${emoji}</text>
    </svg>`;
    return {
      googleIcon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(34, 34),
        anchor: new google.maps.Point(17, 17)
      }
    };
  }
}
