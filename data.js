// ─── 일정 데이터 ───────────────────────────────────────────────────────────────
// items: 이동 일정 (출발 → 도착)
//   fromLat/fromLng, toLat/toLng : 지도 마커·자동차 경로 조회용 좌표
//   fromMapCoord/fromPlaceId     : 네이버 지도 길찾기 URL에서 복사한 값
//                                  (없으면 목적지 검색으로 대체)
//   transport                    : "버스" | "자동차" | "도보" | "대중교통"
//   duration                     : 예상 소요시간 (자동차는 클릭 시 실시간으로 교체됨)
//
// spots: 가볼만한 곳 (단순 마커)
//   type    : restaurant | cafe | bakery | bar | seafood | attraction |
//             museum | nature | beach | park | shopping | accommodation
//   lat/lng : OpenStreetMap Nominatim 등으로 조회한 좌표 (반드시 채울 것)
//   naverUrl: https://map.naver.com/p/entry/place/{placeId}
// ───────────────────────────────────────────────────────────────────────────────
const scheduleData = {
  day1: {
    label: "1일차",
    items: [
      {
        from: "유진상가",
        fromLat: 37.591624,
        fromLng: 126.943068,
        fromMapCoord: "3zgaTm,2AN5Ui",
        fromPlaceId: "13305205",
        to: "벽산아파트",
        toLat: 37.2652049,
        toLng: 127.0818973,
        toMapCoord: "3zm63J,2AzsqM",
        toPlaceId: "19214014",
        transport: "버스",
        duration: "약 1시간 30분",
        memo: "쥬쥬 집에서 도도네로 이동"
      },
      {
        from: "벽산아파트",
        fromLat: 37.2652049,
        fromLng: 127.0818973,
        fromMapCoord: "3zm63J,2AzsqM",
        fromPlaceId: "19214014",
        to: "나탄스테이",
        toLat: 34.6239125,
        toLng: 127.6354580,
        toMapCoord: "3zJfuI,2yMzYx",
        toPlaceId: "1574024669",
        transport: "자동차",
        duration: "약 4시간",
        memo: "도도네에서 나탄스테이로 이동"
      }
    ],
    spots: [
      {
        name: "여수사시사철삼치회",
        type: "restaurant",
        memo: "숙소 가기 전에 포장해가면 좋을듯!",
        naverUrl: "https://map.naver.com/p/entry/place/11821464?c=15.00,0,0,0,dh",
        lat: 34.7397962,
        lng: 127.7342268
      },
      {
        name: "이마트 여수점",
        type: "shopping",
        memo: "이것 저것 몽땅 사갈만한 곳",
        naverUrl: "https://map.naver.com/p/entry/place/11605057?c=14.43,0,0,0,dh",
        lat: 34.7579626,
        lng: 127.7149526
      }
    ]
  }
};

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

const ROUTE_WORKER_URL = "https://naver-route-proxy.9401ndk.workers.dev";
