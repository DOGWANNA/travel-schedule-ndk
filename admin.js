// ─── API ─────────────────────────────────────────────────────────────────────

function apiHeaders() {
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

async function apiGet(path) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, { headers: apiHeaders() });
  if (!res.ok) throw new Error('조회 실패 (' + res.status + ')');
  return res.json();
}

async function apiPost(table, data) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + table, {
    method: 'POST', headers: apiHeaders(), body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('저장 실패 (' + res.status + ')');
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function apiPatch(table, id, data) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + id, {
    method: 'PATCH', headers: apiHeaders(), body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('수정 실패 (' + res.status + ')');
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function apiDelete(table, id) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + id, {
    method: 'DELETE',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
  });
  if (!res.ok) throw new Error('삭제 실패 (' + res.status + ')');
}

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function searchCoords(name) {
  const res = await fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(name) + '&format=json&countrycodes=kr&limit=1');
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

async function fetchPlaceCoordById(placeId) {
  try {
    const res = await fetch(PLACE_COORD_WORKER_URL + '?id=' + placeId);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.lat && data.lng) return data;
    return null;
  } catch (_) {
    return null;
  }
}

function naverCToWgs84(x, y) {
  const R = 6378137;
  const lng = x / R * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI);
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}

function guessSpotType(name) {
  if (!name) return 'restaurant';
  if (/카페|커피|coffee|cafe/i.test(name)) return 'cafe';
  if (/베이커리|빵집|bakery/i.test(name)) return 'bakery';
  if (/호텔|펜션|모텔|게스트하우스|리조트/i.test(name)) return 'accommodation';
  if (/해수욕장|해변|비치|beach/i.test(name)) return 'beach';
  if (/공원|park/i.test(name)) return 'park';
  if (/박물관|미술관/i.test(name)) return 'museum';
  if (/마트|시장|쇼핑몰|shopping/i.test(name)) return 'shopping';
  if (/횟집|해물|해산물|수산/i.test(name)) return 'seafood';
  if (/술집|포차|이자카야/i.test(name)) return 'bar';
  return 'restaurant';
}

function parseNaverDirectionsUrl(url) {
  const m = url.match(/\/directions\/([A-Za-z0-9]+,[A-Za-z0-9]+),([^,]+),(\d+),PLACE_POI\/([A-Za-z0-9]+,[A-Za-z0-9]+),([^,]+),(\d+),PLACE_POI\/-\/([a-z]+)/);
  if (!m) return null;
  const modeMap = { car: '자동차', transit: '대중교통', bus: '대중교통', walk: '도보', bicycle: '자전거' };
  return {
    from: { mapCoord: m[1], name: decodeURIComponent(m[2]), placeId: m[3] },
    to:   { mapCoord: m[4], name: decodeURIComponent(m[5]), placeId: m[6] },
    mode: modeMap[m[7]] || '자동차'
  };
}

function parseNaverPlaceUrl(url) {
  const idMatch = url.match(/\/place\/(\d+)/);
  if (!idMatch) return null;
  const placeId = idMatch[1];
  let lat = null, lng = null;
  // c= 파라미터: 7값 형식(x,y,zoom,...) vs 5값 형식(zoom,pitch,...) 구분
  // 실제 좌표(Web Mercator)는 백만 단위 → x > 1000으로 판별
  const cMatch = url.match(/[?&]c=([0-9.]+),([0-9.]+)/);
  if (cMatch) {
    const x = parseFloat(cMatch[1]);
    const y = parseFloat(cMatch[2]);
    if (x > 1000 && y > 1000) {
      const wgs = naverCToWgs84(x, y);
      lat = wgs.lat;
      lng = wgs.lng;
    }
  }
  return { placeId, lat, lng };
}

function val(id) { return document.getElementById(id).value.trim(); }
function fval(id) { return parseFloat(document.getElementById(id).value) || null; }

// ─── 상태 ────────────────────────────────────────────────────────────────────

let currentView = 'trips';
let currentTrip = null;
let currentDay  = null;

// ─── DOM ─────────────────────────────────────────────────────────────────────

const contentEl      = document.getElementById('adminContent');
const breadcrumbEl   = document.getElementById('breadcrumb');
const formModal      = document.getElementById('formModal');
const formTitleEl    = document.getElementById('formTitle');
const formBodyEl     = document.getElementById('formBody');
const formSaveBtn    = document.getElementById('formSave');
const formCancelBtn  = document.getElementById('formCancel');
const deleteModal    = document.getElementById('deleteModal');
const deleteMsgEl    = document.getElementById('deleteMessage');
const deleteCancelBtn  = document.getElementById('deleteCancel');
const deleteConfirmBtn = document.getElementById('deleteConfirm');

// ─── 모달 ────────────────────────────────────────────────────────────────────

function openFormModal(title, bodyHtml, onSave) {
  formTitleEl.textContent = title;
  formBodyEl.innerHTML = bodyHtml;
  formModal.hidden = false;
  formSaveBtn.disabled = false;
  formSaveBtn.onclick = async function() {
    formSaveBtn.disabled = true;
    try { await onSave(); closeFormModal(); }
    catch (e) { alert(e.message); formSaveBtn.disabled = false; }
  };
}
function closeFormModal() {
  formModal.hidden = true;
  formBodyEl.innerHTML = '';
  formSaveBtn.onclick = null;
}
function openDeleteModal(message, onConfirm) {
  deleteMsgEl.textContent = message;
  deleteModal.hidden = false;
  deleteConfirmBtn.disabled = false;
  deleteConfirmBtn.onclick = async function() {
    deleteConfirmBtn.disabled = true;
    try { await onConfirm(); deleteModal.hidden = true; }
    catch (e) { alert(e.message); deleteConfirmBtn.disabled = false; }
  };
}

formCancelBtn.addEventListener('click', closeFormModal);
formModal.addEventListener('click', function(e) { if (e.target === formModal) closeFormModal(); });
deleteCancelBtn.addEventListener('click', function() { deleteModal.hidden = true; });
deleteModal.addEventListener('click', function(e) { if (e.target === deleteModal) deleteModal.hidden = true; });

// ─── 브레드크럼 ───────────────────────────────────────────────────────────────

function renderBreadcrumb() {
  const parts = [];
  if (currentView === 'trips') {
    parts.push('<span class="breadcrumb-current">여행 목록</span>');
  } else if (currentView === 'trip') {
    parts.push('<span class="breadcrumb-item" data-goto="trips">여행 목록</span><span class="breadcrumb-sep">›</span><span class="breadcrumb-current">' + esc(currentTrip.title) + '</span>');
  } else {
    parts.push('<span class="breadcrumb-item" data-goto="trips">여행 목록</span><span class="breadcrumb-sep">›</span><span class="breadcrumb-item" data-goto="trip">' + esc(currentTrip.title) + '</span><span class="breadcrumb-sep">›</span><span class="breadcrumb-current">' + esc(currentDay.label) + '</span>');
  }
  breadcrumbEl.innerHTML = parts.join('');
  breadcrumbEl.querySelectorAll('[data-goto]').forEach(function(el) {
    el.addEventListener('click', function() {
      if (el.dataset.goto === 'trips') showTripsView();
      else if (el.dataset.goto === 'trip') showTripView(currentTrip);
    });
  });
}

// ─── 뷰: 여행 목록 ───────────────────────────────────────────────────────────

async function showTripsView() {
  currentView = 'trips'; currentTrip = null; currentDay = null;
  renderBreadcrumb();
  contentEl.innerHTML = '<p class="empty-hint" style="margin-top:16px;">불러오는 중...</p>';
  let trips;
  try { trips = await apiGet('trips?select=*&order=created_at'); }
  catch (e) { contentEl.innerHTML = '<p class="empty-hint" style="margin-top:16px;">불러오기 실패: ' + e.message + '</p>'; return; }

  let html = '<div class="view-header"><button class="btn-add" id="addTripBtn">+ 새 여행 추가</button></div>';
  if (!trips.length) {
    html += '<div class="admin-empty">등록된 여행이 없습니다.</div>';
  } else {
    html += '<div class="admin-list">';
    trips.forEach(function(trip) {
      const dateRange = (trip.start_date && trip.end_date)
        ? trip.start_date.replace(/-/g, '.') + ' ~ ' + trip.end_date.replace(/-/g, '.')
        : (trip.start_date ? trip.start_date.replace(/-/g, '.') + ' ~' : '');
      html += '<div class="admin-list-item clickable" data-action="go" data-id="' + trip.id + '"><div class="item-main"><div class="item-title">' + esc(trip.title) + '</div>' + (dateRange ? '<div class="item-sub">' + esc(dateRange) + '</div>' : '') + '</div><div class="item-actions"><button class="btn-edit" data-action="edit" data-id="' + trip.id + '">수정</button><button class="btn-delete-sm" data-action="del" data-id="' + trip.id + '">삭제</button></div></div>';
    });
    html += '</div>';
  }
  contentEl.innerHTML = html;

  document.getElementById('addTripBtn').addEventListener('click', function() { openTripModal(null); });
  contentEl.querySelectorAll('[data-action]').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      const trip = trips.find(function(t) { return t.id === el.dataset.id; });
      if (el.dataset.action === 'go') showTripView(trip);
      else if (el.dataset.action === 'edit') openTripModal(trip);
      else if (el.dataset.action === 'del') confirmDeleteTrip(trip);
    });
  });
}

function openTripModal(trip) {
  openFormModal(trip ? '여행 수정' : '새 여행 추가',
    '<div class="form-field"><label>여행 제목</label><input type="text" id="f_title" value="' + esc(trip ? trip.title : '') + '" placeholder="예: 여수 여행"></div>' +
    '<div class="form-field"><label>시작일</label><input type="date" id="f_start_date" value="' + esc(trip ? (trip.start_date || '') : '') + '"></div>' +
    '<div class="form-field"><label>종료일</label><input type="date" id="f_end_date" value="' + esc(trip ? (trip.end_date || '') : '') + '"></div>',
    async function() {
      const title = val('f_title');
      if (!title) throw new Error('여행 제목을 입력해주세요');
      const start_date = val('f_start_date') || null;
      const end_date = val('f_end_date') || null;
      if (trip) await apiPatch('trips', trip.id, { title, start_date, end_date });
      else await apiPost('trips', { title, start_date, end_date });
      showTripsView();
    }
  );
  document.getElementById('f_title').focus();
}

function confirmDeleteTrip(trip) {
  openDeleteModal('"' + trip.title + '" 여행을 삭제하면 일차·일정·장소가 모두 삭제됩니다. 계속할까요?', async function() {
    await apiDelete('trips', trip.id);
    showTripsView();
  });
}

// ─── 뷰: 일차 목록 ───────────────────────────────────────────────────────────

async function showTripView(trip) {
  currentView = 'trip'; currentTrip = trip; currentDay = null;
  renderBreadcrumb();
  contentEl.innerHTML = '<p class="empty-hint" style="margin-top:16px;">불러오는 중...</p>';
  let days;
  try { days = await apiGet('days?trip_id=eq.' + trip.id + '&select=*&order=order_num'); }
  catch (e) { contentEl.innerHTML = '<p class="empty-hint" style="margin-top:16px;">불러오기 실패</p>'; return; }

  let html = '<div class="view-header"><h2>' + esc(trip.title) + '</h2><button class="btn-add" id="addDayBtn">+ 일차 추가</button></div>';
  if (!days.length) {
    html += '<div class="admin-empty">등록된 일차가 없습니다.</div>';
  } else {
    html += '<div class="admin-list">';
    days.forEach(function(day) {
      html += '<div class="admin-list-item clickable" data-action="go" data-id="' + day.id + '"><div class="item-main"><div class="item-title">' + esc(day.label) + '</div></div><div class="item-actions"><button class="btn-edit" data-action="edit" data-id="' + day.id + '">수정</button><button class="btn-delete-sm" data-action="del" data-id="' + day.id + '">삭제</button></div></div>';
    });
    html += '</div>';
  }
  contentEl.innerHTML = html;

  document.getElementById('addDayBtn').addEventListener('click', function() { openDayModal(null, days.length); });
  contentEl.querySelectorAll('[data-action]').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      const day = days.find(function(d) { return d.id === el.dataset.id; });
      if (el.dataset.action === 'go') showDayView(day);
      else if (el.dataset.action === 'edit') openDayModal(day, days.length);
      else if (el.dataset.action === 'del') confirmDeleteDay(day);
    });
  });
}

function openDayModal(day, count) {
  openFormModal(day ? '일차 수정' : '일차 추가',
    '<div class="form-field"><label>일차 이름</label><input type="text" id="f_label" value="' + esc(day ? day.label : (count + 1) + '일차') + '" placeholder="예: 1일차"></div>' +
    '<div class="form-field"><label>순서</label><input type="number" id="f_order" value="' + (day ? day.order_num : count + 1) + '" min="1"></div>',
    async function() {
      const label = val('f_label');
      const order_num = parseInt(document.getElementById('f_order').value, 10) || (count + 1);
      if (!label) throw new Error('일차 이름을 입력해주세요');
      if (day) await apiPatch('days', day.id, { label, order_num });
      else await apiPost('days', { trip_id: currentTrip.id, label, order_num });
      showTripView(currentTrip);
    }
  );
  document.getElementById('f_label').focus();
}

function confirmDeleteDay(day) {
  openDeleteModal('"' + day.label + '"을 삭제하면 이동 일정과 가볼만한 곳이 모두 삭제됩니다.', async function() {
    await apiDelete('days', day.id);
    showTripView(currentTrip);
  });
}

// ─── 뷰: 일차 상세 ───────────────────────────────────────────────────────────

async function showDayView(day) {
  currentView = 'day'; currentDay = day;
  renderBreadcrumb();
  contentEl.innerHTML = '<p class="empty-hint" style="margin-top:16px;">불러오는 중...</p>';
  let items, spots;
  try {
    [items, spots] = await Promise.all([
      apiGet('schedule_items?day_id=eq.' + day.id + '&select=*&order=order_num'),
      apiGet('spots?day_id=eq.' + day.id + '&select=*&order=order_num')
    ]);
  } catch (e) { contentEl.innerHTML = '<p class="empty-hint" style="margin-top:16px;">불러오기 실패</p>'; return; }

  let html = '<div class="view-header"><h2>' + esc(day.label) + '</h2></div>';

  // 이동 일정 섹션
  html += '<div class="admin-section-title">🚗 이동 일정 <button class="btn-add sm" id="addItemBtn">+ 추가</button></div>';
  if (!items.length) {
    html += '<div class="admin-empty" style="padding:20px 0;">등록된 이동 일정이 없습니다.</div>';
  } else {
    html += '<div class="admin-list">';
    items.forEach(function(item) {
      html += '<div class="admin-list-item"><div class="item-main"><div class="item-title">' + esc(item.from_name) + ' → ' + esc(item.to_name) + '</div><div class="item-sub">' + (TRANSPORT_ICON[item.transport] || '') + ' ' + esc(item.transport) + (item.duration ? ' · ' + esc(item.duration) : '') + '</div></div><div class="item-actions"><button class="btn-edit" data-action="edit-item" data-id="' + item.id + '">수정</button><button class="btn-delete-sm" data-action="del-item" data-id="' + item.id + '">삭제</button></div></div>';
    });
    html += '</div>';
  }

  // 가볼만한 곳 섹션
  html += '<div class="admin-section-title">📍 가볼만한 곳 <button class="btn-add sm" id="addSpotBtn">+ 추가</button></div>';
  if (!spots.length) {
    html += '<div class="admin-empty" style="padding:20px 0;">등록된 장소가 없습니다.</div>';
  } else {
    html += '<div class="admin-list">';
    spots.forEach(function(spot) {
      html += '<div class="admin-list-item"><div class="item-main"><div class="item-title">' + (SPOT_TYPE_ICON[spot.type] || '📍') + ' ' + esc(spot.name) + '</div><div class="item-sub">' + esc(spot.memo || '') + '</div></div><div class="item-actions"><button class="btn-edit" data-action="edit-spot" data-id="' + spot.id + '">수정</button><button class="btn-delete-sm" data-action="del-spot" data-id="' + spot.id + '">삭제</button></div></div>';
    });
    html += '</div>';
  }

  contentEl.innerHTML = html;

  document.getElementById('addItemBtn').addEventListener('click', function() { openItemModal(null, items.length); });
  document.getElementById('addSpotBtn').addEventListener('click', function() { openSpotModal(null, spots.length); });

  contentEl.querySelectorAll('[data-action]').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      const id = el.dataset.id;
      const action = el.dataset.action;
      if (action === 'edit-item') openItemModal(items.find(function(i) { return i.id === id; }), items.length);
      else if (action === 'del-item') confirmDeleteItem(items.find(function(i) { return i.id === id; }));
      else if (action === 'edit-spot') openSpotModal(spots.find(function(s) { return s.id === id; }), spots.length);
      else if (action === 'del-spot') confirmDeleteSpot(spots.find(function(s) { return s.id === id; }));
    });
  });
}

// ─── 이동 일정 폼 ────────────────────────────────────────────────────────────

function itemFormHtml(item) {
  const v = item || {};
  return (
    '<div class="form-field"><label>일정 내용</label><textarea id="f_memo" placeholder="예: 숙소에서 여수 시내로 이동!">' + esc(v.memo || '') + '</textarea></div>' +
    '<div class="form-section">네이버 지도 길찾기 URL</div>' +
    '<p class="url-guide">URL을 붙여넣고 추출 버튼을 누르면 출발지·도착지·이동수단이 자동으로 입력됩니다.</p>' +
    '<div class="url-parse-row"><input type="text" id="f_naver_url" placeholder="https://map.naver.com/p/directions/..."><button type="button" class="btn-coord" id="parseUrlBtn">추출</button></div>' +
    '<div class="form-section">자동 추출 정보</div>' +
    '<div class="form-field"><label>출발지</label><input type="text" id="f_from_name" value="' + esc(v.from_name || '') + '" disabled placeholder="추출 후 자동 입력"></div>' +
    '<div class="form-field"><label>도착지</label><input type="text" id="f_to_name" value="' + esc(v.to_name || '') + '" disabled placeholder="추출 후 자동 입력"></div>' +
    '<div class="form-field"><label>이동 수단</label><input type="text" id="f_transport_display" value="' + esc(v.transport || '') + '" disabled placeholder="추출 후 자동 입력"></div>' +
    '<input type="hidden" id="f_transport" value="' + esc(v.transport || '자동차') + '">' +
    '<input type="hidden" id="f_from_lat" value="' + (v.from_lat || '') + '">' +
    '<input type="hidden" id="f_from_lng" value="' + (v.from_lng || '') + '">' +
    '<input type="hidden" id="f_from_map_coord" value="' + esc(v.from_map_coord || '') + '">' +
    '<input type="hidden" id="f_from_place_id" value="' + esc(v.from_place_id || '') + '">' +
    '<input type="hidden" id="f_to_lat" value="' + (v.to_lat || '') + '">' +
    '<input type="hidden" id="f_to_lng" value="' + (v.to_lng || '') + '">' +
    '<input type="hidden" id="f_to_map_coord" value="' + esc(v.to_map_coord || '') + '">' +
    '<input type="hidden" id="f_to_place_id" value="' + esc(v.to_place_id || '') + '">'
  );
}

function attachItemFormEvents() {
  document.getElementById('parseUrlBtn').addEventListener('click', async function() {
    const url = val('f_naver_url');
    if (!url) { alert('URL을 먼저 입력해주세요.'); return; }
    const parsed = parseNaverDirectionsUrl(url);
    if (!parsed) { alert('URL에서 정보를 추출하지 못했습니다.\n네이버 지도 길찾기 URL인지 확인해주세요.'); return; }

    document.getElementById('f_from_name').value = parsed.from.name;
    document.getElementById('f_to_name').value = parsed.to.name;
    document.getElementById('f_from_map_coord').value = parsed.from.mapCoord;
    document.getElementById('f_from_place_id').value = parsed.from.placeId;
    document.getElementById('f_to_map_coord').value = parsed.to.mapCoord;
    document.getElementById('f_to_place_id').value = parsed.to.placeId;
    document.getElementById('f_transport').value = parsed.mode;
    document.getElementById('f_transport_display').value = parsed.mode;

    const btn = this;
    btn.textContent = '추출 중...'; btn.disabled = true;
    try {
      const [fromCoords, toCoords] = await Promise.all([
        searchCoords(parsed.from.name),
        searchCoords(parsed.to.name)
      ]);
      if (fromCoords) {
        document.getElementById('f_from_lat').value = fromCoords.lat;
        document.getElementById('f_from_lng').value = fromCoords.lng;
      }
      if (toCoords) {
        document.getElementById('f_to_lat').value = toCoords.lat;
        document.getElementById('f_to_lng').value = toCoords.lng;
      }
    } catch (_) {}
    btn.textContent = '추출'; btn.disabled = false;
  });
}

function openItemModal(item, count) {
  openFormModal(item ? '이동 일정 수정' : '이동 일정 추가', itemFormHtml(item), async function() {
    const from_name = val('f_from_name');
    const to_name = val('f_to_name');
    if (!from_name || !to_name) throw new Error('URL을 입력하고 추출 버튼을 눌러주세요.');
    const data = {
      day_id: currentDay.id,
      order_num: item ? item.order_num : count + 1,
      from_name, from_lat: fval('f_from_lat'), from_lng: fval('f_from_lng'),
      from_map_coord: val('f_from_map_coord') || null, from_place_id: val('f_from_place_id') || null,
      to_name, to_lat: fval('f_to_lat'), to_lng: fval('f_to_lng'),
      to_map_coord: val('f_to_map_coord') || null, to_place_id: val('f_to_place_id') || null,
      transport: document.getElementById('f_transport').value || '자동차',
      duration: null,
      memo: val('f_memo') || null
    };
    if (item) await apiPatch('schedule_items', item.id, data);
    else await apiPost('schedule_items', data);
    showDayView(currentDay);
  });
  attachItemFormEvents();
}

function confirmDeleteItem(item) {
  openDeleteModal('"' + item.from_name + ' → ' + item.to_name + '" 일정을 삭제할까요?', async function() {
    await apiDelete('schedule_items', item.id);
    showDayView(currentDay);
  });
}

// ─── 가볼만한 곳 폼 ──────────────────────────────────────────────────────────

function spotFormHtml(spot) {
  const v = spot || {};
  const typeMap = { restaurant:'🍽️ 음식점', cafe:'☕ 카페', bakery:'🥐 베이커리', bar:'🍺 바/술집', seafood:'🐟 해산물', attraction:'🏛️ 명소', museum:'🎨 박물관', nature:'🌿 자연', beach:'🏖️ 해변', park:'🌳 공원', shopping:'🛍️ 쇼핑', accommodation:'🏨 숙소' };

  const typeHtml = spot
    ? '<div class="form-field"><label>종류</label><select id="f_type">' +
      Object.keys(typeMap).map(function(t) {
        return '<option value="' + t + '"' + (v.type === t ? ' selected' : '') + '>' + typeMap[t] + '</option>';
      }).join('') +
      '</select></div>'
    : '<input type="hidden" id="f_type" value="' + esc(v.type || 'restaurant') + '">';

  return (
    '<div class="form-section">네이버 지도 URL</div>' +
    '<p class="url-guide">URL 붙여넣고 추출 → 좌표 자동 입력. 장소명은 직접 입력하세요.</p>' +
    '<div class="url-parse-row"><input type="text" id="f_naver_url" value="' + esc(v.naver_url || '') + '" placeholder="https://map.naver.com/p/entry/place/12345?c=..."><button type="button" class="btn-coord" id="parseSpotUrlBtn">추출</button></div>' +
    '<div class="coord-status" id="coordStatus"></div>' +
    '<div class="form-field"><label>장소 이름</label>' +
    '<input type="text" id="f_name" value="' + esc(v.name || '') + '" placeholder="예: 꽃돌게장1번가" autocomplete="off"></div>' +
    '<div class="coord-row">' +
    '<div class="form-field" style="flex:1"><label>위도 <span class="label-hint">직접 수정 가능</span></label>' +
    '<input type="number" id="f_lat" value="' + (v.lat || '') + '" step="any" placeholder="34.7604"></div>' +
    '<div class="form-field" style="flex:1"><label>경도</label>' +
    '<input type="number" id="f_lng" value="' + (v.lng || '') + '" step="any" placeholder="127.6622"></div>' +
    '</div>' +
    typeHtml +
    '<div class="form-field"><label>메모</label><textarea id="f_memo" placeholder="예: 유명한 게장집!">' + esc(v.memo || '') + '</textarea></div>'
  );
}

function attachSpotFormEvents(isEdit) {
  const statusEl = document.getElementById('coordStatus');

  document.getElementById('parseSpotUrlBtn').addEventListener('click', async function() {
    const url = val('f_naver_url');
    if (!url) { alert('URL을 먼저 입력해주세요.'); return; }
    const parsed = parseNaverPlaceUrl(url);
    if (!parsed) {
      statusEl.textContent = '⚠️ 네이버 지도 장소 URL이 아닙니다';
      statusEl.className = 'coord-status warn';
      return;
    }
    if (parsed.lat && parsed.lng) {
      document.getElementById('f_lat').value = parsed.lat;
      document.getElementById('f_lng').value = parsed.lng;
      statusEl.textContent = '✅ 좌표 추출 완료 — 장소 이름을 직접 입력해주세요';
      statusEl.className = 'coord-status found';
    } else {
      // URL에 좌표 없음 → Worker로 placeId 조회
      const btn = this;
      btn.textContent = '조회 중...'; btn.disabled = true;
      statusEl.textContent = '🔍 좌표 조회 중...';
      statusEl.className = 'coord-status searching';
      try {
        const info = await fetchPlaceCoordById(parsed.placeId);
        if (info) {
          document.getElementById('f_lat').value = info.lat;
          document.getElementById('f_lng').value = info.lng;
          if (!isEdit && info.type) {
            document.getElementById('f_type').value = info.type;
          }
          if (info.name && !val('f_name')) {
            document.getElementById('f_name').value = info.name;
          }
          statusEl.textContent = '✅ 좌표·장소명 추출 완료 — 내용을 확인 후 저장하세요';
          statusEl.className = 'coord-status found';
        } else {
          statusEl.textContent = '⚠️ 좌표 조회 실패 — 장소명 입력 시 자동 검색됩니다';
          statusEl.className = 'coord-status warn';
        }
      } catch (_) {
        statusEl.textContent = '⚠️ 좌표 조회 실패 — 장소명 입력 시 자동 검색됩니다';
        statusEl.className = 'coord-status warn';
      }
      btn.textContent = '추출'; btn.disabled = false;
    }
  });

  document.getElementById('f_name').addEventListener('blur', async function() {
    const name = this.value.trim();
    if (!name) return;
    if (!isEdit) {
      document.getElementById('f_type').value = guessSpotType(name);
    }
    if (document.getElementById('f_lat').value) return;
    statusEl.textContent = '🔍 좌표 자동 검색 중...';
    statusEl.className = 'coord-status searching';
    try {
      const coords = await searchCoords(name);
      if (coords) {
        document.getElementById('f_lat').value = coords.lat;
        document.getElementById('f_lng').value = coords.lng;
        statusEl.textContent = '📍 자동 입력됨 — 지도에서 확인 후 틀리면 수정하세요';
        statusEl.className = 'coord-status warn';
      } else {
        statusEl.textContent = '⚠️ 자동 검색 실패 — 좌표를 직접 입력해주세요';
        statusEl.className = 'coord-status warn';
      }
    } catch (_) {
      statusEl.textContent = '⚠️ 자동 검색 실패 — 좌표를 직접 입력해주세요';
      statusEl.className = 'coord-status warn';
    }
  });
}

function openSpotModal(spot, count) {
  const isEdit = !!spot;
  openFormModal(spot ? '장소 수정' : '장소 추가', spotFormHtml(spot), async function() {
    const name = val('f_name');
    if (!name) throw new Error('장소 이름을 입력해주세요');
    const data = {
      day_id: currentDay.id,
      order_num: spot ? spot.order_num : count + 1,
      name,
      type: document.getElementById('f_type').value || 'restaurant',
      memo: val('f_memo') || null,
      naver_url: val('f_naver_url') || null,
      lat: fval('f_lat'), lng: fval('f_lng')
    };
    if (spot) await apiPatch('spots', spot.id, data);
    else await apiPost('spots', data);
    showDayView(currentDay);
  });
  attachSpotFormEvents(isEdit);
  document.getElementById('f_name').focus();
}

function confirmDeleteSpot(spot) {
  openDeleteModal('"' + spot.name + '"을 삭제할까요?', async function() {
    await apiDelete('spots', spot.id);
    showDayView(currentDay);
  });
}

// ─── 초기화 ──────────────────────────────────────────────────────────────────

showTripsView();
