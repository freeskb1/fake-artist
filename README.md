# 가짜 예술가 (Fake Artist) v0.3

오잉크 게임즈의 "가짜 예술가가 뉴욕에 간다"를 기반으로 한 모바일 웹 게임.

## 주요 기능 (v0.3 신규)

- **두 가지 게임 모드**: 선택 모드 (카테고리 선택) / 자유 모드 (직접 입력)
- **출제자 시계방향 순환**: 모두 출제자 역할 공평하게
- **색상 선택 UI**: 5x2 그리드, Firebase transaction으로 동시 클릭 방지
- **다시 하기 준비 시스템**: 멀티 모드에서 모두가 준비해야 다음 판 시작
- **게임 중 종료 버튼**: 어디서든 종료 가능 (경고 팝업)
- **닉네임 어디서나 표시**: 항상 자기 정보 확인
- **내 차례 캔버스 강조**: 본인 색 테두리로 강조
- **130개 주제** (13 카테고리 × 10개)

## 점수 룰

- 가짜 잡힘 + 정답 틀림 → 진짜 예술가들(출제자 제외) +1
- 가짜 잡힘 + 정답 맞힘 → 출제자 +2, 가짜 +2
- 가짜 못 잡힘 → 출제자 +2, 가짜 +2
- 먼저 5점 도달 시 우승

## 기술 스택

- Next.js 15.5 + React 19.1
- TypeScript + Tailwind CSS
- Firebase Realtime Database (transaction 지원)

## Firebase 설정

이전 README 참고. 다음 환경변수 필요:

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
