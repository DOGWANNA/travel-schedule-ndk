class NaverMapAdapter extends MapAdapter {
  constructor() {
    super();
    this._map = null;
    this._markers = [];
    this._polylines = [];
  }

  init(divId) {
    this._map = new naver.maps.Map(divId, {
      center: new naver.maps.LatLng(37.43, 127.02),
      zoom: 9
    });
  }

  setCenter(lat, lng) {
    this._map.setCenter(new naver.maps.LatLng(lat, lng));
  }

  setZoom(level) {
    this._map.setZoom(level);
  }

  fitBounds(points) {
    if (!points.length) return;
    const first = new naver.maps.LatLng(points[0].lat, points[0].lng);
    const bounds = new naver.maps.LatLngBounds(first, first);
    points.forEach(p => bounds.extend(new naver.maps.LatLng(p.lat, p.lng)));
    this._map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
  }

  addMarker(lat, lng, options) {
    const opts = { position: new naver.maps.LatLng(lat, lng), map: this._map };
    if (options && options.title) opts.title = options.title;
    if (options && options.icon) opts.icon = options.icon;
    const marker = new naver.maps.Marker(opts);
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
    const path = points.map(p => new naver.maps.LatLng(p.lat, p.lng));
    const polyline = new naver.maps.Polyline({
      map: this._map,
      path,
      strokeColor: (options && options.strokeColor) || '#e2703f',
      strokeWeight: (options && options.strokeWeight) || 4,
      strokeStyle: (options && options.strokeStyle) || 'solid'
    });
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

  async fetchRoute(from, to) {
    const url = ROUTE_WORKER_URL + '/route?slat=' + from.lat + '&slng=' + from.lng +
      '&dlat=' + to.lat + '&dlng=' + to.lng;
    const res = await fetch(url);
    if (!res.ok) throw new Error('route fetch failed');
    const data = await res.json();
    if (!data.path) throw new Error('no path in response');
    return {
      path: data.path.map(([lat, lng]) => ({ lat, lng })),
      durationMs: data.durationMs
    };
  }

  makeSpotIcon(type) {
    const emoji = SPOT_TYPE_ICON[type] || SPOT_TYPE_ICON.default;
    return {
      content: `<div style="background:#e2703f;color:#fff;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 3px 10px rgba(226,112,63,0.45);">${emoji}</div>`,
      anchor: new naver.maps.Point(17, 17)
    };
  }
}
