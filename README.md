# 가짜 예술가 (Fake Artist)

오잉크 게임즈의 "가짜 예술가가 뉴욕에 간다"를 기반으로 한 모바일 웹 게임입니다.

## 기능

- 📱 **한 폰으로 같이** - 한 폰을 돌려가며 플레이 (백엔드 불필요)
- 🌐 **각자 폰으로** - Firebase 실시간 멀티플레이 (방 코드 + QR 초대)
- 5~10인용
- 원작 점수 시스템 (5점 먼저 도달 승리)
- 한 방에서 여러 판 연속 플레이

## 기술 스택

- Next.js 15 (App Router) + React 19
- TypeScript + Tailwind CSS
- Firebase Realtime Database (멀티플레이)
- Vercel 배포 호환

## 빠른 시작

```bash
npm install
npm run dev
```

→ http://localhost:3000

> 패스앤플레이 모드는 Firebase 없이도 작동합니다. 멀티플레이는 아래 Firebase 설정 필요.

---

## 1️⃣ Firebase 설정

### 1.1 Firebase 프로젝트 만들기

1. https://console.firebase.google.com 접속
2. **"프로젝트 추가"** 클릭
3. 프로젝트 이름 입력 (예: `fake-artist-game`)
4. Google Analytics는 선택사항 (건너뛰어도 됨)
5. 프로젝트 생성 완료

### 1.2 Realtime Database 활성화

1. 좌측 메뉴 **"빌드 > Realtime Database"** 클릭
2. **"데이터베이스 만들기"** 클릭
3. 위치 선택: **us-central1** 또는 **asia-southeast1** (서울 지연 낮음)
4. **테스트 모드로 시작** 선택 (나중에 보안 규칙 강화)
5. 만들기 완료

### 1.3 웹 앱 등록 후 config 받기

1. 프로젝트 개요 (좌측 상단 ⚙️ > 프로젝트 설정)
2. 하단 **"내 앱"** > 웹 아이콘 `</>` 클릭
3. 앱 닉네임 입력 (예: `fake-artist-web`)
4. Firebase Hosting은 체크 안 함
5. 앱 등록 → **firebaseConfig 객체** 표시됨

```javascript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "https://....firebaseio.com",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

이 값들을 `.env.local`로 옮겨요.

### 1.4 .env.local 만들기

프로젝트 루트에 `.env.local` 파일 생성:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://xxx-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123...
NEXT_PUBLIC_FIREBASE_APP_ID=1:123...
```

`.env.example`을 참고하세요.

### 1.5 보안 규칙 (선택, 권장)

테스트 모드는 30일 후 만료돼요. 보안 규칙을 다음과 같이 설정하세요:

Realtime Database → 규칙 탭에서:

```json
{
  "rules": {
    "rooms": {
      "$code": {
        ".read": true,
        ".write": true,
        ".validate": "$code.matches(/^[0-9]{3}$/)"
      }
    }
  }
}
```

이건 인증 없이 접근 가능하지만, 방 코드는 3자리 숫자여야만 작성 가능해요. 더 안전하게 만들고 싶으면 Firebase Auth 익명 로그인을 추가하세요 (현재 버전엔 미포함).

---

## 2️⃣ GitHub + Vercel 배포

### 2.1 GitHub 저장소 생성

```bash
# 프로젝트 폴더에서
git init
git add .
git commit -m "Initial commit"
git branch -M main
# GitHub에서 new repository 생성 후
git remote add origin https://github.com/YOUR_USERNAME/fake-artist-game.git
git push -u origin main
```

> `.env.local`은 .gitignore에 들어있어서 푸시되지 않아요. (의도된 동작)

### 2.2 Vercel 연결

1. https://vercel.com 가입/로그인 (GitHub 계정 추천)
2. **"New Project"** 클릭
3. 방금 만든 저장소 import
4. Framework Preset: Next.js (자동 인식)
5. **"Environment Variables"** 섹션 펼치기
6. `.env.local`의 모든 변수를 하나씩 추가:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
7. **"Deploy"** 클릭

1~2분 후 `https://fake-artist-game-xxx.vercel.app` URL이 생성됩니다.

### 2.3 자동 재배포

이후 `git push`만 하면 Vercel이 자동 재배포해요.

### 2.4 커스텀 도메인 (선택)

Vercel 프로젝트 > Settings > Domains에서 본인 도메인 연결 가능.

---

## 게임 룰

### 역할
- **출제자 (1명)**: 주제를 알고 가짜를 알지만 그림에 참여하지 않음
- **가짜 예술가 (1명)**: 범주만 알고 주제는 모름. 분위기 맞춰 그리기
- **예술가 (나머지)**: 주제를 알고 그림. 가짜에게 너무 명확한 힌트는 금물

### 진행
1. 각자 한 획씩 시계 방향으로 두 바퀴 그림
2. 모든 화가가 가짜를 지목 (출제자는 투표 안 함)
3. 가짜가 지목됐다면 마지막 기회로 주제 추측

### 점수
- 가짜 못 찾음: 가짜 + 출제자 +1점
- 가짜 잡힘 + 주제 못 맞힘: 진짜 예술가들 모두 +1점
- 가짜 잡힘 + 주제 맞힘: 가짜 +1점

**먼저 5점 도달하는 플레이어 우승**

---

## 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx                  ← 홈 (모드 선택)
│   ├── local/page.tsx            ← 패스앤플레이 모드
│   ├── room/new/page.tsx         ← 방 만들기
│   └── room/[code]/page.tsx      ← 멀티플레이 게임 흐름
├── components/
│   ├── DrawingCanvas.tsx         ← 한 획 그리기 + 라이브 스트리밍
│   ├── ResultCanvas.tsx
│   ├── PassDeviceOverlay.tsx
│   └── RoleCard.tsx
├── lib/
│   ├── firebase.ts               ← Firebase 클라이언트 초기화
│   ├── room.ts                   ← Realtime DB CRUD
│   ├── gameLogic.ts              ← 차례/점수/검증
│   ├── colors.ts                 ← 10가지 색상 팔레트
│   └── topics.ts                 ← 주제 카드 풀 (15 카테고리, 120개)
└── types/game.ts                 ← 도메인 타입
```

---

## 라이선스

원작 보드게임의 IP는 Oink Games 소유. 이 프로젝트는 개인 학습/팬 프로젝트입니다.
