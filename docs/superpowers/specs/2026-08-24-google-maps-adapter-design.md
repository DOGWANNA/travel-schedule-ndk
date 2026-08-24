# Google Maps 어댑터 패턴 도입 설계

**날짜:** 2026-08-24  
**작업자:** 나도관  
**상태:** 승인됨

---

## 목표

국내 여행은 네이버 지도, 해외 여행은 Google Maps를 사용할 수 있도록 지도 제공자를 여행(trip) 단위로 고정 선택 가능하게 한다.

---

## 아키텍처 개요

```
schedule.html
    └─ app.js
         └─ MapAdapter (인터페이스)
              ├─ NaverMapAdapter  → naver.maps.* (국내)
              └─ GoogleMapAdapter → google.maps.* (해외)
```

`app.js`는 `MapAdapter` 인터페이스만 호출하며 `naver.maps.*` / `google.maps.*`를 직접 참조하지 않는다.

---

## MapAdapter 인터페이스

`map-adapter.js`에 정의. 두 어댑터가 동일 메서드를 구현해야 한다.

| 메서드 | 설명 |
|--------|------|
| `init(divId)` | 지도 초기화 |
| `setCenter(lat, lng)` | 지도 중심 이동 |
| `setZoom(level)` | 줌 레벨 설정 |
| `fitBounds(points[])` | 마커들이 모두 보이도록 뷰 조정 |
| `addMarker(lat, lng, options)` | 마커 추가, 마커 인스턴스 반환 |
| `removeMarker(marker)` | 마커 제거 |
| `drawPolyline(points[], options)` | 폴리라인 그리기, 인스턴스 반환 |
| `removePolyline(polyline)` | 폴리라인 제거 |
| `fetchRoute(from, to)` | 경로 조회, `{path[], durationMs}` 반환 |

---

## 파일 구성

| 파일 | 역할 |
|------|------|
| `map-adapter.js` | 인터페이스 정의 (메서드 명세) |
| `map-naver.js` | NaverMapAdapter 구현 (app.js의 기존 코드 이전) |
| `map-google.js` | GoogleMapAdapter 구현 (신규) |
| `app.js` | mapAdapter 변수만 사용하도록 리팩토링 |
| `schedule.html` | 네이버 SDK 정적 로드 제거, app.js가 동적 주입 |
| `admin.js` | 해외 여행 장소 등록용 Google Places Autocomplete 추가 |
| `admin.html` | 여행 타입 선택 UI, 해외 장소 등록 UI 추가 |

---

## SDK 동적 로드 (2단계 초기화)

`schedule.html`은 지도 SDK를 정적으로 로드하지 않는다.

```
[1단계] app.js 시작
  → Supabase에서 trip 데이터 조회 (trip_type 확인)
  → trip_type에 맞는 SDK 스크립트 태그를 <head>에 동적 주입

[2단계] SDK onload 콜백
  → NaverMapAdapter 또는 GoogleMapAdapter 인스턴스 생성
  → mapAdapter.init('naverMap') 호출
  → 일정 렌더링 시작
```

---

## 경로 조회 방식

| | NaverMapAdapter | GoogleMapAdapter |
|---|---|---|
| 방식 | Cloudflare Worker 프록시 (기존) | google.maps.DirectionsService (SDK 내장) |
| 서버 프록시 | 필요 | 불필요 |
| 반환 형태 | `{path: [{lat,lng},...], durationMs}` | 동일 형태로 변환 |

---

## 데이터 모델 변경

### Supabase `trips` 테이블

```sql
ALTER TABLE trips ADD COLUMN trip_type TEXT DEFAULT 'domestic';
-- 'domestic' | 'international'
```

### Supabase `schedules` 테이블

```sql
ALTER TABLE schedules ADD COLUMN google_place_id TEXT;
-- 해외 장소의 Google place ID (nullable)
```

기존 `lat`, `lng` 컬럼은 변경 없음 — WGS84 좌표는 두 지도 모두 호환.

---

## Admin 변경 사항

### 여행 생성/수정

- 국내 / 해외 선택 라디오 버튼 추가
- `trip_type` 값을 Supabase에 저장

### 일정 항목 등록 (trip_type 기반 분기)

**국내 (domestic):**
- 기존 흐름 유지: 네이버 지도 URL 붙여넣기 → URL 파싱 → 좌표 추출

**해외 (international):**
- Google Places Autocomplete 검색창 표시
- 장소 선택 시 `{lat, lng, name, google_place_id}` 자동 입력
- 장소 이미지: Google Places Photos API 사용

---

## Google Maps API 키

- Maps JavaScript API (지도 표시, Directions Service 포함)
- Places API (Autocomplete, Place Details, Photos)
- 도메인 제한으로 키 보호
- 월 $200 무료 크레딧 내에서 개인 앱 수준 사용 가능

---

## 구현 순서 (개략)

1. Supabase 스키마 변경 (trip_type, google_place_id 컬럼 추가)
2. `map-adapter.js` 인터페이스 작성
3. `map-naver.js` — app.js 기존 map 함수 이전
4. `app.js` — mapAdapter 변수 기반으로 리팩토링, SDK 동적 로드 추가
5. `map-google.js` — GoogleMapAdapter 구현
6. `admin.html` / `admin.js` — trip_type 선택 UI, 해외 장소 등록 UI
7. `schedule.html` — 네이버 SDK 정적 로드 제거
