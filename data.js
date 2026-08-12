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
      },
      {
        name: "카페 마애",
        type: "cafe",
        memo: "우리 숙소 바로옆 카페!",
        naverUrl: "https://map.naver.com/p/entry/place/1602030574?c=17.07,0,0,0,dh",
        lat: 34.6238073,
        lng: 127.6359557
      }
    ]
  },
  day2: {
    label: "2일차",
    items: [
      {
        from: "나탄스테이",
        fromLat: 34.6239125,
        fromLng: 127.6354580,
        fromMapCoord: "3zJfuI,2yMzYx",
        fromPlaceId: "1574024669",
        to: "이순신광장 공영주차장",
        toLat: 34.7394476,
        toLng: 127.7364569,
        toMapCoord: "3zNufW,2yRqwd",
        toPlaceId: "1074132927",
        transport: "자동차",
        duration: "약 1시간",
        memo: "숙소에서 여수 시내로 이동!"
      },
      {
        from: "이순신광장",
        fromLat: 34.7382897,
        fromLng: 127.7386760,
        fromMapCoord: "3zNt8t,2yRqRB",
        fromPlaceId: "17281819",
        to: "유진상가",
        toLat: 37.591624,
        toLng: 126.943068,
        toMapCoord: "3zgaTm,2AN5Ui",
        toPlaceId: "13305205",
        transport: "자동차",
        duration: "약 4시간",
        memo: "여수에서 효주네로 출발!"
      },
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
        transport: "자동차",
        duration: "약 40분",
        memo: "효주 내려주고 나도 집으로!"
      }
    ],
    spots: [
      {
        name: "꽃돌게장1번가",
        type: "restaurant",
        memo: "유명한 게장집! 리필 바에 돌게장은 무한으로 먹을 수 있어",
        naverUrl: "https://map.naver.com/p/entry/place/36469012?c=13.27,0,0,0,dh",
        lat: 34.7330688,
        lng: 127.7261044
      },
      {
        name: "오동도",
        type: "park",
        memo: "1~2시간 산책하기 좋은 곳. 날씨가 괜찮다면 좋을듯!",
        naverUrl: "https://map.naver.com/p/entry/place/11491916?c=13.27,0,0,0,dh",
        lat: 34.7450350,
        lng: 127.7670926
      },
      {
        name: "이순신광장",
        type: "attraction",
        memo: "광장 근처에 소품샵, 카페 등등 구경거리!",
        naverUrl: "https://map.naver.com/p/entry/place/17281819?c=16.06,0,0,0,dh",
        lat: 34.7382897,
        lng: 127.7386760
      },
      {
        name: "낭만포차거리",
        type: "bar",
        memo: "넘 덥고 밤에 가야해서 가능할지 모르겠지만 유명해서 추가!",
        naverUrl: "https://map.naver.com/p/entry/place/49252227?c=16.06,0,0,0,dh",
        lat: 34.7379142,
        lng: 127.7468923
      },
      {
        name: "꼬북샌드",
        type: "bakery",
        memo: "이순신 광장 근처. 여수오면 선물용으로 많이 사가나봥",
        naverUrl: "https://map.naver.com/p/entry/place/1410396555?c=16.06,0,0,0,dh",
        lat: 34.7396079,
        lng: 127.7325073
      },
      {
        name: "바다김밥 중앙본점",
        type: "restaurant",
        memo: "갓김치가 들어간 김밥이랭! 이순신 광장 쪽",
        naverUrl: "https://map.naver.com/p/entry/place/1648862917?c=15.30,0,0,0,dh",
        lat: 34.7408108,
        lng: 127.7359230
      },
      {
        name: "이순신 수제버거",
        type: "restaurant",
        memo: "여기도 이순신광장쪽!",
        naverUrl: "https://map.naver.com/p/entry/place/38010379",
        lat: 34.7402221,
        lng: 127.7356832
      },
      {
        name: "덕일감자국",
        type: "restaurant",
        memo: "친구 추천 맛집! 숙소에서 넘어올 때 먹어도 좋아보영",
        naverUrl: "https://map.naver.com/p/entry/place/32219663",
        lat: 34.7645010,
        lng: 127.6376380
      },
      {
        name: "윤심이네실비집",
        type: "restaurant",
        memo: "갓김치들어간 김치찌개",
        naverUrl: "https://map.naver.com/p/entry/place/2001621465",
        lat: 34.7337688,
        lng: 127.7213060
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
const PLACE_IMAGE_WORKER_URL = "https://place-image-proxy.9401ndk.workers.dev";
