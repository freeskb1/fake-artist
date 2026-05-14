# 가짜 예술가 (Fake Artist) v0.4

오잉크 게임즈의 "가짜 예술가가 뉴욕에 간다"를 기반으로 한 모바일 웹 게임.

## v0.4 신규 기능

### 3가지 게임 모드
- **자유 모드**: 출제자가 범주/정답을 직접 입력 (인사이드 조크 가능)
- **선택 모드**: 출제자가 카테고리에서 선택
- **빠른 모드**: 출제자 없이 앱이 자동 출제 (3명부터 가능, 모두 그림 참여)

### 가짜 2명 모드 (옵셔너리)
- 3가지 모드 모두에 토글로 적용 가능
- 가짜 2명은 서로의 정체를 모름, 각자 활동
- 한 라운드에 한 명만 지목 가능 (원작 룰)
- 잡힌 가짜만 개별로 정답 추측, 점수 개별 처리

### 최소 인원
- 빠른 모드 + 가짜 1명: 3명
- 빠른 모드 + 가짜 2명: 4명
- 자유/선택 + 가짜 1명: 4명
- 자유/선택 + 가짜 2명: 5명

## 점수 룰 (원작 룰북 기준)

**가짜 1명 모드**
- 가짜 안 잡힘 → 가짜 +2, 출제자 +2
- 가짜 잡힘 + 정답 맞힘 → 가짜 +2, 출제자 +2
- 가짜 잡힘 + 정답 틀림 → 진짜 예술가들 +1 (출제자 제외)

**가짜 2명 모드 (각개활동)**
- 각 가짜별로 위 룰 개별 적용
- 출제자는 가짜 중 1명이라도 win이면 +2
- 진짜 예술가들은 모든 잡힌 가짜가 정답 틀렸을 때만 +1

먼저 **5점** 도달 시 우승

## 기술 스택

- Next.js 15.5 + React 19.1
- TypeScript + Tailwind CSS
- Firebase Realtime Database

## Firebase 환경변수

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_DATABASE_URL
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

## 로컬 개발

```bash
npm install
npm run dev
```

## 배포

GitHub push → Vercel 자동 배포. 환경변수는 Vercel Settings에서 설정.
