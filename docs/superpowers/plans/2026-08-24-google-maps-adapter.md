# Google Maps 어댑터 패턴 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 국내 여행은 네이버 지도, 해외 여행은 Google Maps를 사용하도록 MapAdapter 패턴을 도입한다.

**Architecture:** `MapAdapter` 인터페이스를 두고 `NaverMapAdapter`(기존 코드 이전)와 `GoogleMapAdapter`(신규)가 구현한다. `app.js`는 어댑터만 호출하며, `trip_type`에 따라 적절한 지도 SDK를 동적으로 로드한다. Admin은 해외 여행 여부에 따라 Google Places Autocomplete로 장소를 등록한다.

**Tech Stack:** Vanilla JS, Naver Maps JS API v3, Google Maps JS API (Maps + Directions + Places), Supabase REST API

## Global Constraints

- JS는 기존 코드 스타일 유지 (let/const, arrow function, async/await)
- 기존 국내 여행 기능은 동작이 깨지면 안 됨
- Google Maps API 키는 Task 1에서 `data.js`에 상수로 추가 — 사용자가 발급 후 교체
- 모든 좌표는 WGS84 `{lat, lng}` 순수 객체로 통일 (SDK 전용 객체 사용 금지)

---

### Task 1: Supabase 스키마 변경 + data.js 업데이트

**Files:**
- Modify: `data.js`
- 수동 작업: Supabase 대시보드 SQL Editor

**Interfaces:**
- Produces: `fetchScheduleData()` → `{ tripId, title, tripType: 'domestic'|'international', days }` (기존에 `tripType` 추가)
- Produces: `GOOGLE_MAPS_API_KEY` 상수

- [ ] **Step 1: Supabase SQL 실행 — trips 테이블에 trip_type 컬럼 추가**

Supabase 대시보드 → SQL Editor에서 아래 실행:
```sql
ALTER TABLE trips ADD COLUMN IF NOT EXISTS trip_type TEXT DEFAULT 'domestic';
```

- [ ] **Step 2: Supabase SQL 실행 — schedule_items 테이블에 google_place_id 컬럼 추가**

```sql
ALTER TABLE schedule_items ADD COLUMN IF NOT EXISTS google_place_id TEXT;
```

- [ ] **Step 3: data.js — GOOGLE_MAPS_API_KEY 상수 추가 및 fetchScheduleData 업데이트**

`data.js` 맨 아래에 다음 추가:
```javascript
const GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY'; // 발급 후 교체
```

`fetchScheduleData` 함수에서 select 쿼리에 `trip_type` 추가:
```javascript
async function fetchScheduleData(tripId) {
  const filter = tripId ? 'id=eq.' + tripId + '&' : '';
  const res = await fetch(
    SUPABASE_URL + '/rest/v1/trips?' + filter + 'select=id,title,trip_type,days(id,label,order_num,schedule_items(id,order_num,from_name,from_lat,from_lng,from_map_coord,from_place_id,to_name,to_lat,to_lng,to_map_coord,to_place_id,transport,duration,memo),spots(id,order_num,name,type,memo,naver_url,lat,lng))',
    { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY } }
  );
  if (!res.ok) throw new Error('Supabase fetch failed: ' + res.status);
  const trips = await res.json();
  if (!trips.length) return { tripId: null, title: null, tripType: 'domestic', days: {} };

  const trip = trips[0];
  const sortedDays = trip.days.slice().sort((a, b) => a.order_num - b.order_num);

  const days = {};
  sortedDays.forEach((day, idx) => {
    days['day' + (idx + 1)] = {
      id: day.id,
      label: day.label,
      items: day.schedule_items.slice().sort((a, b) => a.order_num - b.order_num).map(item => ({
        id: item.id,
        from: item.from_name, fromLat: item.from_lat, fromLng: item.from_lng,
        fromMapCoord: item.from_map_coord, fromPlaceId: item.from_place_id,
        to: item.to_name, toLat: item.to_lat, toLng: item.to_lng,
        toMapCoord: item.to_map_coord, toPlaceId: item.to_place_id,
        transport: item.transport, duration: item.duration, memo: item.memo
      })),
      spots: day.spots.slice().sort((a, b) => a.order_num - b.order_num).map(spot => ({
        id: spot.id, name: spot.name, type: spot.type,
        memo: spot.memo, naverUrl: spot.naver_url, lat: spot.lat, lng: spot.lng
      }))
    };
  });

  return { tripId: trip.id, title: trip.title, tripType: trip.trip_type || 'domestic', days };
}
```

- [ ] **Step 4: 브라우저에서 동작 확인**

기존 국내 여행 페이지(`schedule.html?trip=<기존ID>`)를 열어 일정이 정상 표시되는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add data.js
git commit -m "feat: fetchScheduleData에 tripType 반환 추가, GOOGLE_MAPS_API_KEY 상수 추가"
```

---

### Task 2: MapAdapter 인터페이스 정의 (map-adapter.js 신규)

**Files:**
- Create: `map-adapter.js`

**Interfaces:**
- Produces: `MapAdapter` 클래스 — `NaverMapAdapter`, `GoogleMapAdapter`가 상속

- [ ] **Step 1: map-adapter.js 생성**

```javascript
class MapAdapter {
  init(divId) { throw new Error('init() not implemented'); }
  setCenter(lat, lng) { throw new Error('setCenter() not implemented'); }
  setZoom(level) { throw new Error('setZoom() not implemented'); }
  fitBounds(points) { throw new Error('fitBounds() not implemented'); }
  addMarker(lat, lng, options) { throw new Error('addMarker() not implemented'); }
  removeMarker(marker) { throw new Error('removeMarker() not implemented'); }
  clearMarkers() { throw new Error('clearMarkers() not implemented'); }
  drawPolyline(points, options) { throw new Error('drawPolyline() not implemented'); }
  removePolyline(polyline) { throw new Error('removePolyline() not implemented'); }
  clearPolyline() { throw new Error('clearPolyline() not implemented'); }
  async fetchRoute(from, to) { throw new Error('fetchRoute() not implemented'); }
  makeSpotIcon(type) { throw new Error('makeSpotIcon() not implemented'); }
}
```

- [ ] **Step 2: 커밋**

```bash
git add map-adapter.js
git commit -m "feat: MapAdapter 인터페이스 추가"
```

---

### Task 3: NaverMapAdapter 구현 (map-naver.js 신규)

**Files:**
- Create: `map-naver.js`

**Interfaces:**
- Consumes: `MapAdapter` (map-adapter.js), `ROUTE_WORKER_URL` (data.js), `SPOT_TYPE_ICON` (data.js)
- Produces: `NaverMapAdapter` 클래스

- [ ] **Step 1: map-naver.js 생성**

```javascript
class NaverMapAdapter extends MapAdapter {
  constructor() {
    super();
    this._map = null;
    this._markers = [];
    this._polyline = null;
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
    this._polyline = new naver.maps.Polyline({
      map: this._map,
      path,
      strokeColor: (options && options.strokeColor) || '#e2703f',
      strokeWeight: (options && options.strokeWeight) || 4,
      strokeStyle: (options && options.strokeStyle) || 'solid'
    });
    return this._polyline;
  }

  removePolyline(polyline) {
    if (polyline) polyline.setMap(null);
    if (this._polyline === polyline) this._polyline = null;
  }

  clearPolyline() {
    if (this._polyline) { this._polyline.setMap(null); this._polyline = null; }
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
```

- [ ] **Step 2: 커밋**

```bash
git add map-naver.js
git commit -m "feat: NaverMapAdapter 추가 (기존 naver.maps.* 코드 이전)"
```

---

### Task 4: app.js 리팩토링 — mapAdapter 기반으로 전환

**Files:**
- Modify: `app.js`

**Interfaces:**
- Consumes: `MapAdapter`, `NaverMapAdapter`, `GoogleMapAdapter` (선언만, 실 로드는 런타임), `GOOGLE_MAPS_API_KEY` (data.js), `fetchScheduleData()` → `{ tripType }` 포함
- Produces: `mapAdapter` (전역), `currentTripType` (전역)

- [ ] **Step 1: app.js 상단 — 전역 변수 교체**

기존:
```javascript
let naverMap = null;
let mapMarkers = [];
let mapPolyline = null;
let mapRequestSeq = 0;
```

교체 후:
```javascript
let mapAdapter = null;
let currentTripType = 'domestic';
let mapRequestSeq = 0;
```

- [ ] **Step 2: app.js — loadMapSDK 함수 추가**

`// ─── 네이버 지도 ───` 섹션 전체를 아래 내용으로 교체:

```javascript
// ─── 지도 SDK 로드 ─────────────────────────────────────────────────────────────

function loadMapSDK(tripType) {
  return new Promise((resolve) => {
    if (tripType === 'international') {
      window.__googleMapsReady = function() {
        delete window.__googleMapsReady;
        resolve(new GoogleMapAdapter());
      };
      const script = document.createElement('script');
      script.src = 'https://maps.googleapis.com/maps/api/js?key=' + GOOGLE_MAPS_API_KEY +
        '&libraries=places&callback=__googleMapsReady';
      script.async = true;
      document.head.appendChild(script);
    } else {
      const script = document.createElement('script');
      script.src = 'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=mi7v1rjuhb&submodules=geocoder';
      script.onload = () => resolve(new NaverMapAdapter());
      script.onerror = () => resolve(new NaverMapAdapter()); // SDK 로드 실패 시에도 계속
      document.head.appendChild(script);
    }
  });
}
```

- [ ] **Step 3: app.js — clearMapPins 교체**

기존 `clearMapPins` 함수를 아래로 교체:
```javascript
function clearMapPins() {
  if (!mapAdapter) return;
  mapAdapter.clearMarkers();
  mapAdapter.clearPolyline();
}
```

- [ ] **Step 4: app.js — showMapPins 교체**

기존 `showMapPins`, `drawPolyline`, `fetchDrivingRoute` 함수 3개를 아래 하나로 교체:
```javascript
async function showMapPins(item) {
  if (!mapAdapter) return;

  let fromLat = item.fromLat, fromLng = item.fromLng;
  let toLat = item.toLat, toLng = item.toLng;

  if (!fromLat && item.fromMapCoord) {
    const c = mapCoordToLatLng(item.fromMapCoord);
    if (c) { fromLat = c.lat; fromLng = c.lng; }
  }
  if (!toLat && item.toMapCoord) {
    const c = mapCoordToLatLng(item.toMapCoord);
    if (c) { toLat = c.lat; toLng = c.lng; }
  }

  const needsFrom = !fromLat && item.fromPlaceId;
  const needsTo = !toLat && item.toPlaceId;
  if (needsFrom || needsTo) {
    try {
      const [fromCoords, toCoords] = await Promise.all([
        needsFrom ? fetchPlaceCoordById(item.fromPlaceId) : null,
        needsTo ? fetchPlaceCoordById(item.toPlaceId) : null
      ]);
      if (fromCoords) { fromLat = fromCoords.lat; fromLng = fromCoords.lng; }
      if (toCoords) { toLat = toCoords.lat; toLng = toCoords.lng; }
    } catch (_) {}
  }

  if (!fromLat || !toLat) return;
  const mySeq = ++mapRequestSeq;
  clearMapPins();

  mapAdapter.addMarker(fromLat, fromLng, { title: item.from });
  mapAdapter.addMarker(toLat, toLng, { title: item.to });
  mapAdapter.fitBounds([{ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng }]);

  const isCarMode = TRANSPORT_SCHEME[item.transport] === 'car';
  if (isCarMode) {
    try {
      const { path, durationMs } = await mapAdapter.fetchRoute(
        { lat: fromLat, lng: fromLng },
        { lat: toLat, lng: toLng }
      );
      if (mySeq !== mapRequestSeq) return;
      mapAdapter.drawPolyline(path, { strokeColor: '#e2703f', strokeWeight: 4, strokeStyle: 'solid' });
      if (durationMs) updateDurationDisplay(durationMs);
      return;
    } catch (_) {}
  }

  if (mySeq !== mapRequestSeq) return;
  mapAdapter.drawPolyline(
    [{ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng }],
    { strokeColor: '#e2703f', strokeWeight: 3, strokeStyle: 'shortdash' }
  );
}
```

- [ ] **Step 5: app.js — renderSpotOnMap 교체**

기존 `spotMarkerIcon`, `renderSpotOnMap` 함수 2개를 아래로 교체:
```javascript
async function renderSpotOnMap(spot) {
  if (!spot) {
    mapSelectedInfoEl.innerHTML = '<p class="empty-hint" style="margin-top:16px;">일정을 눌러 보세요.</p>';
    clearMapPins();
    return;
  }

  const mapUrl = currentTripType === 'international'
    ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(spot.name)
    : (spot.naverUrl || '#');
  const mapLabel = currentTripType === 'international'
    ? '🗺️ Google Maps에서 보기'
    : '🗺️ 네이버 지도에서 보기';

  mapSelectedInfoEl.innerHTML = `
    <div class="map-selected-info">
      <div class="route-line">${SPOT_TYPE_ICON[spot.type] || SPOT_TYPE_ICON.default} ${spot.name}</div>
      <div style="font-size:13px;color:var(--text-sub);margin-top:4px;">${spot.memo}</div>
      <div class="route-actions" style="margin-top:12px;">
        <a class="naver-link-btn" href="${mapUrl}" target="_blank" rel="noopener noreferrer">${mapLabel}</a>
      </div>
    </div>
  `;

  clearMapPins();

  if (spot.lat && spot.lng && mapAdapter) {
    const icon = mapAdapter.makeSpotIcon(spot.type);
    mapAdapter.addMarker(spot.lat, spot.lng, { title: spot.name, icon });
    mapAdapter.setCenter(spot.lat, spot.lng);
    mapAdapter.setZoom(16);
  }
}
```

- [ ] **Step 6: app.js — linkButtonsHtml 교체 (해외 여행 Google Maps 링크)**

기존 `linkButtonsHtml` 함수 교체:
```javascript
function linkButtonsHtml(item) {
  if (currentTripType === 'international') {
    const origin = item.fromLat ? item.fromLat + ',' + item.fromLng : encodeURIComponent(item.from);
    const dest = item.toLat ? item.toLat + ',' + item.toLng : encodeURIComponent(item.to);
    const googleUrl = 'https://www.google.com/maps/dir/?api=1&origin=' + origin + '&destination=' + dest + '&travelmode=driving';
    return `<div class="route-actions"><a class="naver-link-btn" href="${googleUrl}" target="_blank" rel="noopener noreferrer">🗺️ Google Maps에서 길찾기</a></div>`;
  }
  const hasRealRoute = !!(item.fromMapCoord && item.toMapCoord);
  const label = hasRealRoute
    ? '🗺️ 네이버 지도에서 길찾기 열기'
    : '목적지(' + item.to + ') 위치만 웹에서 검색';
  return `<div class="route-actions"><a class="naver-link-btn" href="${naverRouteUrl(item)}" target="_blank" rel="noopener noreferrer">${label}</a></div>`;
}
```

- [ ] **Step 7: app.js — 스팟 카드의 "지도 보기" 링크 수정**

`renderScheduleList()` 함수 내 spot 카드 HTML에서 `spot.naverUrl`을 쓰는 부분:
```javascript
// 기존
`<a class="spot-naver-btn" href="${spot.naverUrl}" target="_blank" rel="noopener noreferrer">지도 보기</a>`

// 교체
const spotMapUrl = currentTripType === 'international'
  ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(spot.name)
  : (spot.naverUrl || '#');
// spotCard.innerHTML의 해당 부분:
`<a class="spot-naver-btn" href="${spotMapUrl}" target="_blank" rel="noopener noreferrer">지도 보기</a>`
```

`renderScheduleList()` 안 `pageSpots.forEach` 블록 전체:
```javascript
pageSpots.forEach((spot, localIdx) => {
  const globalIdx = pageStart + localIdx;
  const spotCard = document.createElement('div');
  spotCard.className = 'spot-card' + (selectedSpotIndex === globalIdx ? ' selected' : '');
  const spotMapUrl = currentTripType === 'international'
    ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(spot.name)
    : (spot.naverUrl || '#');

  spotCard.innerHTML = `
    <div class="spot-thumb-wrap">
      <span class="spot-icon">${SPOT_TYPE_ICON[spot.type] || SPOT_TYPE_ICON.default}</span>
      <img class="spot-thumb" alt="${spot.name}" />
    </div>
    <div class="spot-info">
      <div class="spot-name">${spot.name}</div>
      <div class="spot-memo">${spot.memo}</div>
    </div>
    <a class="spot-naver-btn" href="${spotMapUrl}" target="_blank" rel="noopener noreferrer">지도 보기</a>
  `;

  if (currentTripType === 'domestic') loadSpotImage(spotCard, spot.naverUrl);

  spotCard.addEventListener('click', () => {
    selectedSpotIndex = (selectedSpotIndex === globalIdx) ? null : globalIdx;
    selectedIndex = null;
    renderScheduleList();
    renderSpotOnMap(selectedSpotIndex !== null ? spot : null);
  });

  spotCard.querySelector('.spot-naver-btn').addEventListener('click', (e) => e.stopPropagation());
  section.appendChild(spotCard);
});
```

- [ ] **Step 8: app.js — init() 2단계 초기화로 교체**

맨 아래의 `initNaverMap(); ... init();` 전체를:
```javascript
// ─── 초기화 ────────────────────────────────────────────────────────────────────

async function init() {
  const params = new URLSearchParams(window.location.search);
  const tripId = params.get('trip');
  if (!tripId) { window.location.href = 'index.html'; return; }

  scheduleListEl.innerHTML = '<p class="empty-hint" style="margin-top:16px;">일정을 불러오는 중...</p>';

  let result;
  try {
    result = await fetchScheduleData(tripId);
  } catch (e) {
    scheduleListEl.innerHTML = '<p class="empty-hint" style="margin-top:16px;">데이터를 불러오지 못했습니다.</p>';
    return;
  }

  activeTripId = result.tripId;
  scheduleData = result.days;
  currentTripType = result.tripType || 'domestic';
  activeDay = Object.keys(scheduleData)[0] || null;

  if (result.title) {
    document.getElementById('tripTitle').textContent = result.title;
    document.title = result.title;
  }

  mapAdapter = await loadMapSDK(currentTripType);
  mapAdapter.init('naverMap');

  renderDayTabs();
  renderScheduleList();
  renderMapPanel();
}

init();
```

- [ ] **Step 9: 커밋**

```bash
git add app.js
git commit -m "refactor: app.js를 MapAdapter 기반으로 전환, SDK 동적 로드 추가"
```

---

### Task 5: schedule.html — Naver SDK 정적 로드 제거 + 어댑터 파일 추가

**Files:**
- Modify: `schedule.html`

**Interfaces:**
- Consumes: `map-adapter.js`, `map-naver.js`, `map-google.js` (script 태그)

- [ ] **Step 1: schedule.html 스크립트 태그 교체**

기존:
```html
<script type="text/javascript" src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=mi7v1rjuhb&submodules=geocoder"></script>
<script src="data.js"></script>
<script src="app.js"></script>
```

교체:
```html
<script src="data.js"></script>
<script src="map-adapter.js"></script>
<script src="map-naver.js"></script>
<script src="map-google.js"></script>
<script src="app.js"></script>
```

- [ ] **Step 2: 브라우저에서 기존 국내 여행 동작 확인**

`schedule.html?trip=<기존국내여행ID>` 열어 지도, 마커, 경로 모두 정상 표시되는지 확인.

- [ ] **Step 3: 커밋**

```bash
git add schedule.html
git commit -m "feat: schedule.html에서 Naver SDK 정적 로드 제거, 어댑터 파일 script 태그 추가"
```

---

### Task 6: GoogleMapAdapter 구현 (map-google.js 신규)

**Files:**
- Create: `map-google.js`

**Interfaces:**
- Consumes: `MapAdapter` (map-adapter.js), `SPOT_TYPE_ICON` (data.js)
- Produces: `GoogleMapAdapter` 클래스

- [ ] **Step 1: map-google.js 생성**

```javascript
class GoogleMapAdapter extends MapAdapter {
  constructor() {
    super();
    this._map = null;
    this._markers = [];
    this._polyline = null;
  }

  init(divId) {
    this._map = new google.maps.Map(document.getElementById(divId), {
      center: { lat: 35.68, lng: 139.69 }, // 기본 중심: 도쿄 (해외 여행)
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

  async fetchRoute(from, to) {
    return new Promise((resolve, reject) => {
      new google.maps.DirectionsService().route({
        origin: { lat: from.lat, lng: from.lng },
        destination: { lat: to.lat, lng: to.lng },
        travelMode: google.maps.TravelMode.DRIVING
      }, (result, status) => {
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
```

- [ ] **Step 2: Supabase에서 테스트용 해외 여행 생성**

Supabase 대시보드 → `trips` 테이블에 `trip_type = 'international'`인 여행 레코드를 직접 insert:
```sql
INSERT INTO trips (title, trip_type, start_date, end_date)
VALUES ('테스트 해외 여행', 'international', '2026-09-01', '2026-09-05');
```

insert 후 반환된 `id`를 메모해 둠.

- [ ] **Step 3: Google Maps API 키 발급 및 설정**

1. [Google Cloud Console](https://console.cloud.google.com/) → 프로젝트 생성
2. APIs & Services → Library → 아래 3개 활성화:
   - **Maps JavaScript API**
   - **Directions API**
   - **Places API**
3. APIs & Services → Credentials → API 키 생성
4. API 키 → Application restrictions → HTTP referrers → 자신의 도메인 추가
5. `data.js`의 `GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY'`를 실제 키로 교체

- [ ] **Step 4: 브라우저에서 해외 여행 지도 동작 확인**

`schedule.html?trip=<해외여행ID>` 열어:
- Google Maps가 표시되는지
- 일정 카드 클릭 시 마커가 찍히는지 (일정 항목이 있는 경우)

- [ ] **Step 5: 커밋**

```bash
git add map-google.js data.js
git commit -m "feat: GoogleMapAdapter 추가, Google Maps API 키 설정"
```

---

### Task 7: Admin — trip_type 선택 UI

**Files:**
- Modify: `admin.js`

**Interfaces:**
- Consumes: `currentTrip.trip_type`
- Produces: 여행 생성/수정 시 `trip_type` 저장, `currentTrip.trip_type` 활용

- [ ] **Step 1: admin.js — openTripModal에 trip_type 라디오 버튼 추가**

기존 `openTripModal` 함수 교체:
```javascript
function openTripModal(trip) {
  const isDomestic = !trip || !trip.trip_type || trip.trip_type === 'domestic';
  openFormModal(trip ? '여행 수정' : '새 여행 추가',
    '<div class="form-field"><label>여행 제목</label><input type="text" id="f_title" value="' + esc(trip ? trip.title : '') + '" placeholder="예: 여수 여행"></div>' +
    '<div class="form-field"><label>여행 타입</label>' +
    '<div style="display:flex;gap:16px;margin-top:4px;">' +
    '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="radio" name="f_trip_type" value="domestic"' + (isDomestic ? ' checked' : '') + '> 🇰🇷 국내</label>' +
    '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="radio" name="f_trip_type" value="international"' + (!isDomestic ? ' checked' : '') + '> 🌍 해외</label>' +
    '</div></div>' +
    '<div class="form-field"><label>시작일</label><input type="date" id="f_start_date" value="' + esc(trip ? (trip.start_date || '') : '') + '"></div>' +
    '<div class="form-field"><label>종료일</label><input type="date" id="f_end_date" value="' + esc(trip ? (trip.end_date || '') : '') + '"></div>',
    async function() {
      const title = val('f_title');
      if (!title) throw new Error('여행 제목을 입력해주세요');
      const start_date = val('f_start_date') || null;
      const end_date = val('f_end_date') || null;
      const trip_type = document.querySelector('input[name="f_trip_type"]:checked').value;
      if (trip) await apiPatch('trips', trip.id, { title, start_date, end_date, trip_type });
      else await apiPost('trips', { title, start_date, end_date, trip_type });
      showTripsView();
    }
  );
  document.getElementById('f_title').focus();
}
```

- [ ] **Step 2: admin.js — showTripView에서 currentTrip에 trip_type 포함되도록 확인**

`apiGet('trips?select=*&...')` 쿼리가 이미 `*`를 쓰므로 `trip_type`이 자동으로 포함됨. 확인만:
```javascript
// showTripsView() 내부 apiGet 호출
let trips;
try { trips = await apiGet('trips?select=*&order=created_at'); }
// trip.trip_type이 존재함 — 추가 수정 불필요
```

- [ ] **Step 3: admin.html에 Google Maps SDK 추가 (Places Autocomplete용)**

`admin.html`의 `</body>` 바로 위에 추가:
```html
<script src="data.js"></script>
<script>
  // Google Maps SDK는 data.js 로드 후 동적 삽입
  (function() {
    var s = document.createElement('script');
    s.src = 'https://maps.googleapis.com/maps/api/js?key=' + (typeof GOOGLE_MAPS_API_KEY !== 'undefined' ? GOOGLE_MAPS_API_KEY : '') + '&libraries=places';
    s.async = true;
    document.head.appendChild(s);
  })();
</script>
```

> 주의: `admin.html`에 이미 `<script src="data.js">` 태그가 있다면 중복 제거.

- [ ] **Step 4: 브라우저에서 trip_type 저장 확인**

admin에서 새 여행을 "🌍 해외"로 생성 → Supabase 대시보드에서 `trip_type = 'international'` 저장되었는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add admin.js admin.html
git commit -m "feat: admin trip_type 선택 UI 추가 (국내/해외)"
```

---

### Task 8: Admin — 해외 여행 장소 등록 (Google Places Autocomplete)

**Files:**
- Modify: `admin.js`

**Interfaces:**
- Consumes: `currentTrip.trip_type`, `google.maps.places.Autocomplete`
- Produces: 해외 schedule_item 저장 시 `from_lat`, `from_lng`, `to_lat`, `to_lng` WGS84 좌표

- [ ] **Step 1: admin.js — 해외 여행용 itemFormHtml 추가**

기존 `itemFormHtml` 함수 아래에 해외 버전 추가:
```javascript
function itemFormHtmlInternational(item) {
  const v = item || {};
  return (
    '<div class="form-field"><label>일정 내용</label><textarea id="f_memo" placeholder="예: 호텔에서 시부야로 이동!">' + esc(v.memo || '') + '</textarea></div>' +
    '<div class="form-section">출발지 검색</div>' +
    '<div class="url-parse-row"><input type="text" id="f_from_search" placeholder="출발지 이름 입력 (예: Shibuya Station)"></div>' +
    '<div class="form-field"><label>출발지 이름</label><input type="text" id="f_from_name" value="' + esc(v.from_name || '') + '" placeholder="자동 입력됩니다"></div>' +
    '<div class="form-section">도착지 검색</div>' +
    '<div class="url-parse-row"><input type="text" id="f_to_search" placeholder="도착지 이름 입력 (예: Tokyo Tower)"></div>' +
    '<div class="form-field"><label>도착지 이름</label><input type="text" id="f_to_name" value="' + esc(v.to_name || '') + '" placeholder="자동 입력됩니다"></div>' +
    '<div class="form-field"><label>이동 수단</label>' +
    '<select id="f_transport">' +
    ['자동차','도보','대중교통','버스'].map(function(t) {
      return '<option value="' + t + '"' + (v.transport === t ? ' selected' : '') + '>' + (TRANSPORT_ICON[t] || '') + ' ' + t + '</option>';
    }).join('') +
    '</select></div>' +
    '<input type="hidden" id="f_from_lat" value="' + (v.from_lat || '') + '">' +
    '<input type="hidden" id="f_from_lng" value="' + (v.from_lng || '') + '">' +
    '<input type="hidden" id="f_to_lat" value="' + (v.to_lat || '') + '">' +
    '<input type="hidden" id="f_to_lng" value="' + (v.to_lng || '') + '">'
  );
}
```

- [ ] **Step 2: admin.js — 해외 여행용 attachItemFormEvents 추가**

```javascript
function attachItemFormEventsInternational() {
  function bindAutocomplete(inputId, nameId, latId, lngId) {
    const input = document.getElementById(inputId);
    if (!input || typeof google === 'undefined') return;
    const ac = new google.maps.places.Autocomplete(input);
    ac.addListener('place_changed', function() {
      const place = ac.getPlace();
      if (!place.geometry) return;
      document.getElementById(nameId).value = place.name || '';
      document.getElementById(latId).value = place.geometry.location.lat();
      document.getElementById(lngId).value = place.geometry.location.lng();
    });
  }
  bindAutocomplete('f_from_search', 'f_from_name', 'f_from_lat', 'f_from_lng');
  bindAutocomplete('f_to_search', 'f_to_name', 'f_to_lat', 'f_to_lng');
}
```

- [ ] **Step 3: admin.js — openItemModal에서 trip_type 분기 추가**

기존 `openItemModal` 함수 교체:
```javascript
function openItemModal(item, count) {
  const isInternational = currentTrip && currentTrip.trip_type === 'international';
  const formHtml = isInternational ? itemFormHtmlInternational(item) : itemFormHtml(item);

  openFormModal(item ? '이동 일정 수정' : '이동 일정 추가', formHtml, async function() {
    const from_name = val('f_from_name');
    const to_name = val('f_to_name');
    if (!from_name || !to_name) throw new Error(isInternational ? '출발지와 도착지를 검색해서 선택해주세요.' : 'URL을 입력하고 추출 버튼을 눌러주세요.');
    const data = {
      day_id: currentDay.id,
      order_num: item ? item.order_num : count + 1,
      from_name, from_lat: fval('f_from_lat'), from_lng: fval('f_from_lng'),
      from_map_coord: isInternational ? null : (val('f_from_map_coord') || null),
      from_place_id: isInternational ? null : (val('f_from_place_id') || null),
      to_name, to_lat: fval('f_to_lat'), to_lng: fval('f_to_lng'),
      to_map_coord: isInternational ? null : (val('f_to_map_coord') || null),
      to_place_id: isInternational ? null : (val('f_to_place_id') || null),
      transport: document.getElementById('f_transport').value || '자동차',
      duration: null,
      memo: val('f_memo') || null
    };
    if (item) await apiPatch('schedule_items', item.id, data);
    else await apiPost('schedule_items', data);
    showDayView(currentDay);
  });

  if (isInternational) {
    attachItemFormEventsInternational();
  } else {
    attachItemFormEvents();
  }
}
```

- [ ] **Step 4: 브라우저에서 해외 여행 일정 등록 확인**

1. admin에서 "해외" trip 선택 → 일차 추가 → "이동 일정 추가" 버튼 클릭
2. Google Places Autocomplete가 표시되는지 확인
3. 출발지/도착지 검색 후 선택 → lat/lng가 hidden input에 채워지는지 확인
4. 저장 후 `schedule.html?trip=<ID>`에서 지도에 마커가 표시되는지 확인

- [ ] **Step 5: 커밋**

```bash
git add admin.js
git commit -m "feat: 해외 여행 일정 등록에 Google Places Autocomplete 추가"
```
