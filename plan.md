# MyFlix 코드 리뷰 종합 보고서 및 작업 계획

## 1. 개요

이 보고서는 Master의 요청에 따라 `/workspace/myflix` 프로젝트의 코드를 직접 검토하고, Codex와 Gemini가 제안한 솔루션을 종합하여 어떤 부분을 적용해야 하는지 판단한 결과입니다.

### 검토 대상 파일
- `server/index.js` (409줄) - 백엔드 서버
- `src/App.jsx` (344줄) - 메인 앱 컴포넌트
- `src/components/VideoPlayer.jsx` (228줄) - 비디오 플레이어
- `src/components/FolderSidebar.jsx` (130줄) - 폴더 탐색 사이드바
- `src/components/DirectoryInput.jsx` (85줄) - 디렉토리 입력 폼
- `src/components/ImageViewer.jsx` (114줄) - 이미지 뷰어
- `vite.config.js` (16줄) - Vite 설정

---

## 2. 불필요한 재귀 호출 분석

### 결론: 불필요한 재귀 호출 없음 ✅

| 분석 항목 | 결과 | Codex 동의 | Gemini 동의 |
|-----------|------|------------|-------------|
| 재귀 호출 존재 여부 | 없음 | ✅ | ✅ |

**직접 검토 결과:**
- `scanDirectory()`, `getFolderTree()` 등 모든 함수가 단일 레벨만 처리
- 하위 폴더 재귀 탐색 없이 현재 디렉토리만 스캔
- React 컴포넌트에도 재귀적 렌더링 패턴 없음

**판단: 수정 불필요**

---

## 3. 모듈화 부족 분석

### 3.1 서버 단일 파일 집중 (server/index.js)

| 항목 | 현재 상태 | 제안 | 적용 여부 | 출처 |
|------|-----------|------|-----------|------|
| 설정 로드/저장 | `loadConfig()`, `saveConfig()` 인라인 | `config/configManager.js`로 분리 | ⚠️ 권장 | Codex |
| 파일 스캔 로직 | `scanDirectory()`, `scanImages()` 인라인 | `services/fileScanner.js`로 분리 | ✅ 적용 필요 | Codex, Gemini |
| 자막 변환 | `convertSrtToVtt()` 인라인 | `utils/subtitleConverter.js`로 분리 | ✅ 적용 필요 | Codex, Gemini |
| 스트리밍 로직 | 라우트 핸들러 내부에 직접 구현 | `services/streamingService.js`로 분리 | ⚠️ 권장 | Codex |
| API 라우팅 | 모든 라우트가 index.js에 직접 정의 | `routes/` 폴더로 분리 | ⚠️ 선택적 | Codex |

**직접 검토 의견:**
- `server/index.js`가 409줄로 여러 책임을 가지고 있음
- 특히 `scanDirectory()` (47줄), `convertSrtToVtt()` (28줄)은 명확히 분리 가능
- 단, 현재 규모에서는 과도한 분리보다 핵심 유틸리티만 분리하는 것이 실용적

### 3.2 프론트엔드 App.jsx 집중

| 항목 | 현재 상태 | 제안 | 적용 여부 | 출처 |
|------|-----------|------|-----------|------|
| 상태 관리 | 14개 useState가 App에 집중 | Context 또는 커스텀 훅 분리 | ⚠️ 권장 | Codex |
| 데이터 패칭 | `fetchVideos()`, `fetchImages()` 등 | `hooks/useVideoData.js` 분리 | ✅ 적용 필요 | Codex |
| 키보드 단축키 | App 내부 useEffect로 처리 | `hooks/useKeyboardShortcuts.js` 분리 | ⚠️ 선택적 | Codex |
| 라우팅 상태 | history.pushState 직접 관리 | `hooks/useHistoryNavigation.js` 분리 | ⚠️ 선택적 | Codex |

**직접 검토 의견:**
- App.jsx가 344줄로 많은 로직 포함
- 특히 `fetchVideos`, `fetchImages`, `fetchCurrentDirectory`는 커스텀 훅으로 분리 시 재사용성 향상
- 하지만 현재 구조도 동작에 문제없으며, 우선순위는 낮음

### 3.3 VideoPlayer.jsx 기능 과밀 (가장 심각)

| 항목 | 현재 상태 | 제안 | 적용 여부 | 출처 |
|------|-----------|------|-----------|------|
| Video.js 초기화 | 컴포넌트 내부 useEffect (120줄+) | `hooks/useVideoPlayer.js` 분리 | ✅ 적용 필요 | Codex, Gemini |
| 자막 메뉴 패치 | 컴포넌트 내부에 클래스 정의 | `utils/subtitleMenuPatch.js` 분리 | ✅ 적용 필요 | Codex, Gemini |
| SubtitleSizeItem 클래스 | 컴포넌트 내부 정의 | 별도 파일로 분리 | ✅ 적용 필요 | Gemini |
| 모바일/데스크톱 분기 | 단일 컴포넌트에서 조건부 렌더링 | `MobileVideoPlayer`, `DesktopVideoPlayer` 분리 고려 | ⚠️ 선택적 | Gemini |

**직접 검토 의견:**
- `VideoPlayer.jsx`가 228줄 중 약 100줄이 Video.js 자막 메뉴 커스터마이징
- `SubtitleSizeItem`, `SubtitleSizeHeader` 클래스가 컴포넌트 내부에 정의됨 (line 74-116)
- 이 부분은 명확히 분리되어야 유지보수 가능
- **가장 우선적으로 리팩토링 필요**

### 3.4 중복 함수 정의

| 항목 | 위치 | 제안 | 적용 여부 | 출처 |
|------|------|------|-----------|------|
| `getParentDirectory()` | `App.jsx:128`, `FolderSidebar.jsx:43` | `utils/pathUtils.js`로 통합 | ✅ 적용 필요 | 직접 발견 |

**직접 검토 의견:**
- 동일한 로직이 두 파일에 중복 정의됨
- Codex와 Gemini가 언급하지 않았으나 명확한 중복

---

## 4. 하드코딩 분석

### 4.1 서버 하드코딩

| 항목 | 위치 | 현재 값 | 제안 | 적용 여부 | 출처 |
|------|------|---------|------|-----------|------|
| 포트 번호 | `server/index.js:13` | `5000` | 환경 변수 `process.env.PORT` | ✅ 적용 필요 | Codex, Gemini |
| 지원 비디오 포맷 | `server/index.js:62` | 배열 직접 정의 | `constants/formats.js` | ✅ 적용 필요 | Codex, Gemini |
| 지원 이미지 포맷 | `server/index.js:111` | 배열 직접 정의 | `constants/formats.js` | ✅ 적용 필요 | Codex |
| Content-Type | `server/index.js:289,297` | `'video/mp4'` 고정 | MIME 타입 동적 결정 | ✅ 적용 필요 | Codex, Gemini |
| Windows 명령어 | `server/index.js:394` | `start "" "${videoPath}"` | OS별 분기 또는 open 패키지 사용 | ⚠️ 권장 | Codex |

**직접 검토 의견:**
- `'video/mp4'` 고정은 mkv, avi 등 다른 포맷 스트리밍 시 문제 가능
- 포맷 배열이 `scanDirectory()`와 `scanImages()`에서 각각 정의됨 (중복)
- Windows 전용 `start` 명령어는 크로스 플랫폼 지원 시 문제

### 4.2 프론트엔드 하드코딩

| 항목 | 위치 | 현재 값 | 제안 | 적용 여부 | 출처 |
|------|------|---------|------|-----------|------|
| API 경로 | 여러 파일 | `/api/videos`, `/api/set-directory` 등 | `constants/api.js` | ⚠️ 권장 | Codex |
| localStorage 키 | `App.jsx:104,216` | `'defaultDirectory'` | `constants/storageKeys.js` | ⚠️ 선택적 | Codex |
| 자막 언어 라벨 | `VideoPlayer.jsx:62,192` | `'한국어'`, `'ko'` | 상수 또는 i18n | ⚠️ 선택적 | Codex, Gemini |
| UI 텍스트 | 여러 파일 | `'Video Kiosk'`, `'로딩 중...'` 등 | i18n 또는 상수 | ❌ 불필요 | Codex |

**직접 검토 의견:**
- API 경로 상수화는 리팩토링 시 유용하나 현재 규모에서는 선택적
- UI 텍스트 i18n은 다국어 지원 계획 없으면 불필요
- localStorage 키는 한 곳에서만 사용되므로 분리 필요성 낮음

### 4.3 Vite 설정 하드코딩

| 항목 | 위치 | 현재 값 | 제안 | 적용 여부 | 출처 |
|------|------|---------|------|-----------|------|
| 프론트엔드 포트 | `vite.config.js:7` | `3000` | 환경 변수 | ⚠️ 선택적 | Codex |
| 백엔드 프록시 | `vite.config.js:10` | `http://localhost:5000` | 환경 변수 | ⚠️ 선택적 | Codex, Gemini |

**직접 검토 의견:**
- 개발 환경 설정이므로 배포 시에는 영향 없음
- 팀 개발이나 다중 환경 필요시에만 적용

---

## 5. Codex/Gemini 의견 차이점 분석

### 5.1 포맷 중복 정의

| 분석가 | 의견 |
|--------|------|
| Codex | "src/App.jsx와 server/index.js에서 비디오 포맷 리스트가 중복" |
| Gemini | "클라이언트와 서버 간의 중복은 아님, 서버 내에서만 중복" |
| 직접 검토 | **Gemini가 정확함** - 프론트엔드에는 포맷 정의 없음. 서버 내 `scanDirectory()`:62와 `scanImages()`:112에서만 중복 |

### 5.2 분리 범위

| 분석가 | 의견 |
|--------|------|
| Codex | 광범위한 모듈화 제안 (config, services, routes, utils, constants 등) |
| Gemini | Codex 의견에 대체로 동의, VideoPlayer 복잡성 특히 강조 |
| 직접 검토 | 현재 프로젝트 규모(약 1,500줄)에서는 **선택적 적용**이 적절. 과도한 분리는 오히려 복잡성 증가 |

---

## 6. 최종 권고 사항 (우선순위별)

### 🔴 높음 (반드시 적용)

| # | 항목 | 설명 | 출처 |
|---|------|------|------|
| 1 | VideoPlayer 자막 메뉴 로직 분리 | `SubtitleSizeItem`, `SubtitleSizeHeader` 클래스를 `utils/videoJsPlugins.js`로 분리 | Codex + Gemini |
| 2 | 서버 포맷 상수 통합 | `supportedFormats`, `imageFormats`를 `constants/mediaFormats.js`로 분리하여 중복 제거 | Codex |
| 3 | Content-Type 동적 처리 | 확장자 기반 MIME 타입 결정 로직 추가 | Codex + Gemini |
| 4 | 중복 함수 제거 | `getParentDirectory()`를 `utils/pathUtils.js`로 통합 | 직접 발견 |

### 🟡 중간 (권장)

| # | 항목 | 설명 | 출처 |
|---|------|------|------|
| 5 | 서버 포트 환경 변수화 | `PORT = process.env.PORT \|\| 5000` | Codex + Gemini |
| 6 | 파일 스캔 로직 분리 | `scanDirectory()`, `scanImages()`를 `services/fileScanner.js`로 분리 | Codex + Gemini |
| 7 | 자막 변환 유틸 분리 | `convertSrtToVtt()`를 `utils/subtitleConverter.js`로 분리 | Codex |
| 8 | 데이터 패칭 훅 분리 | `fetchVideos`, `fetchImages`를 `hooks/useMediaData.js`로 분리 | Codex |
| 9 | OS별 비디오 열기 처리 | `open` 패키지 사용 또는 OS 분기 처리 | Codex |

### 🟢 낮음 (선택적)

| # | 항목 | 설명 | 출처 |
|---|------|------|------|
| 10 | API 경로 상수화 | `constants/api.js` 생성 | Codex |
| 11 | Vite 환경 변수화 | `.env`에서 포트 설정 로드 | Codex + Gemini |
| 12 | localStorage 키 상수화 | `constants/storageKeys.js` 생성 | Codex |
| 13 | UI 텍스트 i18n | 다국어 지원 필요시에만 | Codex |
| 14 | 키보드 단축키 훅 분리 | `hooks/useKeyboardShortcuts.js` | Codex |

### ❌ 불필요 (적용 안함)

| # | 항목 | 이유 |
|---|------|------|
| - | 불필요한 재귀 수정 | 재귀 호출 없음 (Codex, Gemini 모두 동의) |
| - | 프론트엔드 포맷 정의 분리 | 프론트엔드에 포맷 정의 없음 (Codex 오류, Gemini 수정) |
| - | 전면적 라우팅 분리 | 현재 규모에서 과도한 분리 |

---

## 7. 작업 계획

### Phase 1: 핵심 리팩토링 (높음 우선순위)

```
작업 1.1: VideoPlayer 자막 메뉴 로직 분리
├── src/utils/videoJsPlugins.js 생성
├── SubtitleSizeItem, SubtitleSizeHeader 클래스 이동
├── VideoPlayer.jsx에서 import하여 사용
└── 출처: Codex + Gemini

작업 1.2: 미디어 포맷 상수 통합
├── server/constants/mediaFormats.js 생성
├── VIDEO_FORMATS, IMAGE_FORMATS 상수 정의
├── server/index.js에서 import하여 사용
└── 출처: Codex

작업 1.3: Content-Type 동적 처리
├── 확장자-MIME 매핑 객체 생성
├── 스트리밍 라우트에서 동적 Content-Type 설정
└── 출처: Codex + Gemini

작업 1.4: 중복 함수 통합
├── src/utils/pathUtils.js 생성
├── getParentDirectory() 함수 정의
├── App.jsx, FolderSidebar.jsx에서 import
└── 출처: 직접 발견
```

### Phase 2: 모듈화 개선 (중간 우선순위)

```
작업 2.1: 서버 포트 환경 변수화
├── PORT = process.env.PORT || 5000
└── 출처: Codex + Gemini

작업 2.2: 파일 스캔 서비스 분리
├── server/services/fileScanner.js 생성
├── scanDirectory(), scanImages(), getFolderTree() 이동
└── 출처: Codex + Gemini

작업 2.3: 자막 변환 유틸 분리
├── server/utils/subtitleConverter.js 생성
├── convertSrtToVtt() 함수 이동
└── 출처: Codex

작업 2.4: 미디어 데이터 훅 분리
├── src/hooks/useMediaData.js 생성
├── fetchVideos, fetchImages, fetchCurrentDirectory 통합
└── 출처: Codex

작업 2.5: OS별 비디오 열기 처리
├── open 패키지 설치 또는 OS 분기 로직 추가
└── 출처: Codex
```

### Phase 3: 선택적 개선 (낮음 우선순위)

```
작업 3.1: API 경로 상수화 (선택)
작업 3.2: Vite 환경 변수화 (선택)
작업 3.3: localStorage 키 상수화 (선택)
작업 3.4: 키보드 단축키 훅 분리 (선택)
```

---

## 8. 예상 파일 구조 (Phase 1-2 완료 후)

```
/workspace/myflix/
├── server/
│   ├── index.js                    # 메인 서버 (라우팅만)
│   ├── constants/
│   │   └── mediaFormats.js         # VIDEO_FORMATS, IMAGE_FORMATS
│   ├── services/
│   │   └── fileScanner.js          # scanDirectory, scanImages, getFolderTree
│   └── utils/
│       └── subtitleConverter.js    # convertSrtToVtt
│
├── src/
│   ├── App.jsx                     # 메인 앱 (간소화됨)
│   ├── hooks/
│   │   └── useMediaData.js         # 미디어 데이터 패칭 훅
│   ├── utils/
│   │   ├── pathUtils.js            # getParentDirectory
│   │   └── videoJsPlugins.js       # SubtitleSizeItem, SubtitleSizeHeader
│   └── components/
│       └── VideoPlayer.jsx         # 비디오 플레이어 (간소화됨)
│
└── ...
```

---

## 9. 결론

### Codex 분석 평가: ★★★★☆ (4/5)
- 대부분의 지적이 정확하고 유용함
- 비디오 포맷 중복 위치에 대한 오류 있음 (프론트/백엔드 → 서버 내부)
- 일부 제안은 현재 규모에서 과도함

### Gemini 분석 평가: ★★★★★ (5/5)
- Codex 의견을 정확히 검증하고 수정함
- VideoPlayer 복잡성을 특히 잘 지적
- 실용적인 우선순위 판단 제공

### 최종 권고
1. **Phase 1 (높음 우선순위)** 작업은 반드시 수행 권장
2. **Phase 2 (중간 우선순위)** 작업은 시간이 허용되면 수행
3. **Phase 3 (낮음 우선순위)** 작업은 향후 확장 시 고려

---

*작성일: 2026-01-19*
*작성자: Claude Code*
*검토 대상: /workspace/myflix*
