let scheduleData = {};
let activeTripId = null;
let activeDay = null;
let selectedIndex = null;
let selectedSpotIndex = null;
let spotPage = 0;
const SPOTS_PER_PAGE = 5;

let mapAdapter = null;
let currentTripType = 'domestic';
let mapRequestSeq = 0;

const dayTabsEl = document.getElementById("dayTabs");
const scheduleListEl = document.getElementById("scheduleList");
const mapSelectedInfoEl = document.getElementById("mapSelectedInfo");

// ─── URL 빌더 ──────────────────────────────────────────────────────────────────

function naverPlaceSearchUrl(name) {
  return "https://map.naver.com/p/search/" + encodeURIComponent(name);
}

function naverRouteUrl(item) {
  if (!item.fromMapCoord || !item.toMapCoord) return naverPlaceSearchUrl(item.to);
  const mode = WEB_ROUTE_MODE[item.transport] || "car";
  return (
    "https://map.naver.com/p/directions/" +
    item.fromMapCoord + "," + encodeURIComponent(item.from) + "," + item.fromPlaceId + ",PLACE_POI/" +
    item.toMapCoord + "," + encodeURIComponent(item.to) + "," + item.toPlaceId + ",PLACE_POI/-/" + mode +
    "?c=15.00,0,0,0,dh"
  );
}

function linkButtonsHtml(item) {
  if (currentTripType === 'international') {
    const origin = item.fromLat ? item.fromLat + ',' + item.fromLng : encodeURIComponent(item.from);
    const dest = item.toLat ? item.toLat + ',' + item.toLng : encodeURIComponent(item.to);
    const travelmode = GOOGLE_ROUTE_MODE[item.transport] || 'driving';
    const googleUrl = 'https://www.google.com/maps/dir/?api=1&origin=' + origin + '&destination=' + dest + '&travelmode=' + travelmode;
    return `<div class="route-actions"><a class="naver-link-btn" href="${googleUrl}" target="_blank" rel="noopener noreferrer">🗺️ Google Maps에서 길찾기</a></div>`;
  }
  const hasRealRoute = !!(item.fromMapCoord && item.toMapCoord);
  const label = hasRealRoute
    ? "🗺️ 네이버 지도에서 길찾기 열기"
    : "목적지(" + item.to + ") 위치만 웹에서 검색";
  return `
    <div class="route-actions">
      <a class="naver-link-btn" href="${naverRouteUrl(item)}" target="_blank" rel="noopener noreferrer">${label}</a>
    </div>
  `;
}

// ─── 장소 이미지 ──────────────────────────────────────────────────────────────

function extractPlaceId(naverUrl) {
  const m = naverUrl.match(/\/place\/(\d+)/);
  return m ? m[1] : null;
}

function loadSpotImage(spotCard, naverUrl) {
  const placeId = extractPlaceId(naverUrl);
  if (!placeId) return;

  const cacheKey = 'simg_v2_' + placeId;
  const cached = localStorage.getItem(cacheKey);
  if (cached !== null) {
    if (cached) applySpotImage(spotCard, cached);
    return;
  }

  fetch(PLACE_IMAGE_WORKER_URL + '/v2/place-image?id=' + placeId)
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      const url = (data && data.imageUrl) ? data.imageUrl : '';
      try { localStorage.setItem(cacheKey, url); } catch (_) {}
      if (url) applySpotImage(spotCard, url);
    })
    .catch(function() {});
}

function applySpotImage(spotCard, url) {
  const img = spotCard.querySelector('.spot-thumb');
  if (!img) return;
  img.onload = function() { img.classList.add('loaded'); };
  img.onerror = function() {};
  img.src = url;
}

async function loadSpotImageGoogle(spotCard, spot) {
  if (!spot.googlePlaceId) return;
  if (typeof google === 'undefined' || !google.maps || !google.maps.places) return;
  try {
    const place = new google.maps.places.Place({ id: spot.googlePlaceId });
    await place.fetchFields({ fields: ['photos'] });
    if (!place.photos || !place.photos.length) return;
    applySpotImage(spotCard, place.photos[0].getURI({ maxWidth: 400 }));
  } catch (e) {
    console.warn('[spot photo]', e.message);
  }
}

// ─── 렌더링 ────────────────────────────────────────────────────────────────────

function renderDayTabs() {
  dayTabsEl.innerHTML = "";
  Object.keys(scheduleData).forEach((dayKey) => {
    const tab = document.createElement("div");
    tab.className = "day-tab" + (dayKey === activeDay ? " active" : "");
    tab.textContent = scheduleData[dayKey].label;
    tab.addEventListener("click", () => {
      activeDay = dayKey;
      selectedIndex = null;
      selectedSpotIndex = null;
      spotPage = 0;
      renderDayTabs();
      renderScheduleList();
      renderMapPanel();
    });
    dayTabsEl.appendChild(tab);
  });
}

function renderScheduleList() {
  scheduleListEl.innerHTML = "";
  if (!activeDay || !scheduleData[activeDay]) return;
  const items = scheduleData[activeDay].items;

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-hint";
    empty.textContent = "등록된 이동 일정이 없습니다.";
    scheduleListEl.appendChild(empty);
  }

  items.forEach((item, idx) => {
    const card = document.createElement("div");
    card.className = "schedule-card" + (selectedIndex === idx ? " selected" : "");
    const isCar = TRANSPORT_SCHEME[item.transport] === "car";
    const durationText = item.duration || (isCar ? "계산 중..." : null);

    card.innerHTML = `
      <div class="schedule-route">
        <span class="schedule-index">${idx + 1}</span>
        <span>${item.from}</span>
        <span class="arrow">&#8594;</span>
        <span>${item.to}</span>
      </div>
      <div class="schedule-meta">
        <span class="chip">${TRANSPORT_ICON[item.transport] || "🚶"} ${item.transport}</span>
        ${durationText ? `<span class="chip duration-chip">⏱ ${durationText}</span>` : ''}
      </div>
      <div class="schedule-detail">
        <div class="row"><div class="k">이동 수단</div><div class="v">${item.transport}</div></div>
        ${durationText ? `<div class="row"><div class="k">이동 시간</div><div class="v duration-value">${durationText}</div></div>` : ''}
        ${item.memo ? `<div class="memo-box"><div class="memo-label">일정 내용</div><div class="memo-text">${item.memo}</div></div>` : ''}
        ${linkButtonsHtml(item)}
      </div>
    `;

    card.addEventListener("click", () => {
      selectedIndex = (selectedIndex === idx) ? null : idx;
      selectedSpotIndex = null;
      renderScheduleList();
      renderMapPanel();
    });

    card.querySelectorAll(".naver-link-btn").forEach((el) => {
      el.addEventListener("click", (e) => e.stopPropagation());
    });

    scheduleListEl.appendChild(card);
  });

  const spots = scheduleData[activeDay].spots;
  if (spots && spots.length > 0) {
    const divider = document.createElement("hr");
    divider.className = "spots-divider";
    scheduleListEl.appendChild(divider);

    const section = document.createElement("div");
    section.className = "spots-section";

    const totalPages = Math.ceil(spots.length / SPOTS_PER_PAGE);
    const pageStart = spotPage * SPOTS_PER_PAGE;
    const pageSpots = spots.slice(pageStart, pageStart + SPOTS_PER_PAGE);

    const header = document.createElement("div");
    header.className = "spots-header";
    header.textContent = "📍 가볼만한 곳 (" + spots.length + "곳)";
    section.appendChild(header);

    pageSpots.forEach((spot, localIdx) => {
      const globalIdx = pageStart + localIdx;
      const spotCard = document.createElement("div");
      spotCard.className = "spot-card" + (selectedSpotIndex === globalIdx ? " selected" : "");
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
      else loadSpotImageGoogle(spotCard, spot);

      spotCard.addEventListener("click", () => {
        selectedSpotIndex = (selectedSpotIndex === globalIdx) ? null : globalIdx;
        selectedIndex = null;
        renderScheduleList();
        renderSpotOnMap(selectedSpotIndex !== null ? spot : null);
      });

      spotCard.querySelector(".spot-naver-btn").addEventListener("click", (e) => e.stopPropagation());

      section.appendChild(spotCard);
    });

    if (totalPages > 1) {
      const paginationEl = document.createElement("div");
      paginationEl.className = "spots-pagination";

      const prevBtn = document.createElement("button");
      prevBtn.className = "spots-page-btn";
      prevBtn.textContent = "‹ 이전";
      prevBtn.disabled = spotPage === 0;
      prevBtn.addEventListener("click", () => {
        spotPage--;
        selectedSpotIndex = null;
        renderScheduleList();
        renderMapPanel();
      });

      const pageInfo = document.createElement("span");
      pageInfo.className = "spots-page-info";
      pageInfo.textContent = (spotPage + 1) + " / " + totalPages;

      const nextBtn = document.createElement("button");
      nextBtn.className = "spots-page-btn";
      nextBtn.textContent = "다음 ›";
      nextBtn.disabled = spotPage >= totalPages - 1;
      nextBtn.addEventListener("click", () => {
        spotPage++;
        selectedSpotIndex = null;
        renderScheduleList();
        renderMapPanel();
      });

      paginationEl.appendChild(prevBtn);
      paginationEl.appendChild(pageInfo);
      paginationEl.appendChild(nextBtn);
      section.appendChild(paginationEl);
    }

    scheduleListEl.appendChild(section);
  }
}

function renderMapPanel() {
  if (selectedSpotIndex !== null) {
    const spot = scheduleData[activeDay].spots[selectedSpotIndex];
    renderSpotOnMap(spot);
    return;
  }

  if (selectedIndex === null) {
    mapSelectedInfoEl.innerHTML = '<p class="empty-hint" style="margin-top:16px;">일정을 눌러 보세요.</p>';
    clearMapPins();
    return;
  }

  const item = scheduleData[activeDay].items[selectedIndex];

  const isCarItem = TRANSPORT_SCHEME[item.transport] === "car";
  const mapDurationText = item.duration || (isCarItem ? "계산 중..." : null);

  mapSelectedInfoEl.innerHTML = `
    <div class="map-selected-info">
      <div class="route-line">${item.from} <span class="arrow">&#8594;</span> ${item.to}</div>
      <div>${item.transport}${mapDurationText ? ' · <span class="duration-value">' + mapDurationText + '</span>' : ''}</div>
      ${linkButtonsHtml(item)}
    </div>
  `;

  showMapPins(item);
}

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
      script.onerror = () => resolve(new NaverMapAdapter());
      document.head.appendChild(script);
    }
  });
}

function clearMapPins() {
  if (!mapAdapter) return;
  mapAdapter.clearMarkers();
  mapAdapter.clearPolyline();
}

function formatDuration(durationMs) {
  const totalMinutes = Math.round(durationMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return "약 " + hours + "시간" + (minutes > 0 ? " " + minutes + "분" : "");
  return "약 " + minutes + "분";
}

function updateDurationDisplay(durationMs) {
  const text = formatDuration(durationMs) + " (실시간)";
  document.querySelectorAll(".schedule-card.selected .duration-chip").forEach((el) => {
    el.textContent = "⏱ " + text;
  });
  document.querySelectorAll(".schedule-card.selected .duration-value").forEach((el) => {
    el.textContent = text;
  });
  const mapDurationEl = mapSelectedInfoEl.querySelector(".duration-value");
  if (mapDurationEl) mapDurationEl.textContent = text;
}

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
  const shouldFetchRoute = isCarMode || currentTripType === 'international';
  if (shouldFetchRoute) {
    const routeMode = GOOGLE_ROUTE_MODE[item.transport] || 'driving';
    try {
      const { path, durationMs } = await mapAdapter.fetchRoute(
        { lat: fromLat, lng: fromLng },
        { lat: toLat, lng: toLng },
        routeMode
      );
      if (mySeq !== mapRequestSeq) return;
      mapAdapter.drawPolyline(path, { strokeColor: '#e2703f', strokeWeight: 4, strokeStyle: 'solid' });
      if (durationMs) updateDurationDisplay(durationMs);
      return;
    } catch (e) { console.warn('[route]', routeMode, e.message); }
  }

  if (mySeq !== mapRequestSeq) return;
  mapAdapter.drawPolyline(
    [{ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng }],
    { strokeColor: '#e2703f', strokeWeight: 3, strokeStyle: 'shortdash' }
  );
}

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

// ─── 이용 안내 팝업 ────────────────────────────────────────────────────────────

const noteInfoBtn = document.getElementById("noteInfoBtn");
const noteModalOverlay = document.getElementById("noteModalOverlay");
const noteModalClose = document.getElementById("noteModalClose");

noteInfoBtn.addEventListener("click", () => { noteModalOverlay.hidden = false; });
noteModalClose.addEventListener("click", () => { noteModalOverlay.hidden = true; });
noteModalOverlay.addEventListener("click", (e) => {
  if (e.target === noteModalOverlay) noteModalOverlay.hidden = true;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !noteModalOverlay.hidden) noteModalOverlay.hidden = true;
});

// ─── 초기화 ────────────────────────────────────────────────────────────────────

async function init() {
  const params = new URLSearchParams(window.location.search);
  const tripId = params.get('trip');
  if (!tripId) {
    window.location.href = 'index.html';
    return;
  }

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
