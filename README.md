# 시계탑에 흐른 피 – 파티룸 도우미

파티룸에서 호스트(이야기꾼)가 노트북/태블릿으로 방을 만들고, 참가자가 폰으로 4자리 코드를 입력해 들어오는 P2P 보조 도구입니다.
서버 없이 정적 호스팅(GitHub Pages)만으로 동작하며, 연결 중계(시그널링)만 PeerJS 공개 서버를 씁니다.

## 실행
```bash
npm install
npm run dev      # 개발
npm run build    # dist/ 생성 (PWA 포함)
```
`main` 브랜치에 push 하면 `.github/workflows/deploy.yml` 이 GitHub Pages 로 배포합니다
(저장소 Settings → Pages → Source 를 "GitHub Actions"로 설정).

## 구조
- `src/data/roles.ts` — 직업/시나리오/인원별 구성 데이터 (한글 문구는 자유롭게 수정)
- `src/lib/game.ts` — 상태 타입, 자동 배정, 플레이어별 뷰 생성(본인 몫만 전송)
- `src/lib/net.ts` — PeerJS 호스트/클라이언트 훅, 재접속, 호스트 상태 localStorage 저장
- `src/screens/` — Home, HostScreen(이야기꾼), PlayerScreen(참가자)

## 알아둘 점
- 오프라인: PWA 로 앱 자체는 오프라인에서도 열리지만, 기기 간 연결을 맺으려면 인터넷(시그널링)이 필요합니다.
- 파티룸 와이파이가 "기기 간 격리(AP isolation)"를 켜 두면 연결이 안 될 수 있어요. 그땐 호스트 폰 핫스팟을 쓰세요.
- 공식 아이콘은 저작권상 포함하지 않았습니다.
