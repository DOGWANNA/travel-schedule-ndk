// ─── Supabase 설정 ─────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://vzpujfdihrxuyvekgqgn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cHVqZmRpaHJ4dXl2ZWtncWduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0Njk0NDIsImV4cCI6MjEwMjA0NTQ0Mn0.AwfmBkcauCW-vCUSWylJnD_h3eLwZ_L0CshRFYDcA58';

async function fetchTrips() {
  const res = await fetch(
    SUPABASE_URL + '/rest/v1/trips?select=id,title,start_date,end_date,days(id)&order=start_date.desc.nullslast,created_at.desc',
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
      }
    }
  );
  if (!res.ok) throw new Error('Supabase fetch failed: ' + res.status);
  return res.json();
}

async function fetchScheduleData(tripId) {
  const filter = tripId ? 'id=eq.' + tripId + '&' : '';
  const res = await fetch(
    SUPABASE_URL + '/rest/v1/trips?' + filter + 'select=id,title,trip_type,days(id,label,order_num,schedule_items(id,order_num,from_name,from_lat,from_lng,from_map_coord,from_place_id,to_name,to_lat,to_lng,to_map_coord,to_place_id,transport,duration,memo),spots(id,order_num,name,type,memo,naver_url,lat,lng,google_place_id))',
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
      }
    }
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
        memo: spot.memo, naverUrl: spot.naver_url, lat: spot.lat, lng: spot.lng,
        googlePlaceId: spot.google_place_id
      }))
    };
  });

  return { tripId: trip.id, title: trip.title, tripType: trip.trip_type || 'domestic', days };
}

// ─── 상수 ──────────────────────────────────────────────────────────────────────

const TRANSPORT_SCHEME = {
  "도보": "walk",
  "자동차": "car",
  "차": "car",
  "대중교통": "public",
  "버스": "public"
};

const WEB_ROUTE_MODE = {
  "도보": "walk",
  "자동차": "car",
  "차": "car",
  "대중교통": "transit",
  "버스": "transit"
};

const GOOGLE_ROUTE_MODE = {
  "도보": "walking",
  "자동차": "driving",
  "차": "driving",
  "대중교통": "transit",
  "버스": "transit"
};

const TRANSPORT_ICON = {
  "도보": "🚶",
  "자동차": "🚗",
  "차": "🚗",
  "대중교통": "🚌",
  "버스": "🚌"
};

const SPOT_TYPE_ICON = {
  restaurant:    "🍽️",
  cafe:          "☕",
  bakery:        "🥐",
  bar:           "🍺",
  seafood:       "🐟",
  attraction:    "🏛️",
  museum:        "🎨",
  nature:        "🌿",
  beach:         "🏖️",
  park:          "🌳",
  shopping:      "🛍️",
  accommodation: "🏨",
  default:       "📍"
};

// Naver mapCoord → WGS84 {lat, lng}
// Web Mercator 정수형(14000000,4500000) 또는 WGS84 소수형(37.28,127.05 / 127.05,37.28) 모두 처리
function mapCoordToLatLng(mapCoord) {
  if (!mapCoord) return null;
  const parts = mapCoord.split(',').map(parseFloat);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  const a = parts[0], b = parts[1];
  if (a > 1000 && b > 1000) {
    // Web Mercator (c= 파라미터 형식)
    const R = 6378137;
    const lng = a / R * (180 / Math.PI);
    const lat = (2 * Math.atan(Math.exp(b / R)) - Math.PI / 2) * (180 / Math.PI);
    return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
  }
  if (a >= 33 && a <= 39 && b >= 124 && b <= 132) return { lat: a, lng: b }; // (lat, lng)
  if (b >= 33 && b <= 39 && a >= 124 && a <= 132) return { lat: b, lng: a }; // (lng, lat)
  return null;
}

async function fetchPlaceCoordById(placeId) {
  if (!placeId) return null;
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

const ROUTE_WORKER_URL = "https://naver-route-proxy.9401ndk.workers.dev";
const PLACE_IMAGE_WORKER_URL = "https://place-image-proxy.9401ndk.workers.dev";
const PLACE_COORD_WORKER_URL = "https://place-coord-proxy.9401ndk.workers.dev";
const GOOGLE_MAPS_API_KEY = 'AIzaSyBxTkwWyjM0gGHJuROYBR7d5DbQjrsq310';
