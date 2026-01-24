# Video Kiosk

넷플릭스 스타일의 비디오 썸네일 그리드 뷰어

## 기능

- 폴더에서 MP4 + JPG 파일 자동 검색
- 반응형 그리드 레이아웃 (창 크기에 따라 자동 조정)
- 썸네일 lazy loading (스켈레톤 UI)
- 비디오 클릭 시 플레이어 재생
- PC 웹 브라우저 지원
- 향후 Android 앱 빌드 가능 (Capacitor)

## 설치

```bash
npm install
```

## 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

## 사용 방법

1. `media` 폴더를 만들고 비디오와 썸네일 파일을 넣기
   - 예: `video1.mp4` + `video1.jpg`
   - 파일명이 같아야 매칭됨

2. 또는 서버에서 다른 폴더 설정:
   - `server/index.js`의 `SCAN_DIRECTORY` 변경

## 프로젝트 구조

```
Kiosk/
├── src/
│   ├── components/
│   │   ├── VideoGrid.jsx          # 그리드 레이아웃
│   │   ├── VideoThumbnail.jsx     # 썸네일 + Lazy loading
│   │   └── VideoPlayer.jsx        # 비디오 플레이어
│   ├── App.jsx
│   └── main.jsx
├── server/
│   └── index.js                   # Express 서버
└── package.json
```

## 기술 스택

- **프론트엔드**: React + Vite
- **백엔드**: Node.js + Express
- **스타일**: CSS (반응형)
- **향후**: Capacitor (Android 앱 빌드)

## API

- `GET /api/videos` - 비디오 목록
- `GET /api/thumbnail/:path` - 썸네일 이미지
- `GET /api/video/:path` - 비디오 스트리밍
- `POST /api/set-directory` - 스캔 폴더 변경
