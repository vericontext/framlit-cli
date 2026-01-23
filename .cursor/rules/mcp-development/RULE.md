---
description: "framlit-mcp 개발 가이드. MCP 서버 코드 작성 시 참고하세요."
alwaysApply: true
---

# Framlit MCP Development Guide

## 프로젝트 개요

framlit-mcp는 Framlit SaaS의 MCP (Model Context Protocol) 서버입니다.
Cursor 등 IDE에서 직접 Framlit의 영상 생성 기능을 사용할 수 있게 합니다.

## 핵심 원칙

### 1. SaaS Gateway 역할
- MCP는 Framlit SaaS API의 클라이언트 역할만 수행
- 모든 생성 로직은 Framlit SaaS에서 처리
- Credit 차감도 SaaS에서 처리

### 2. 인증
- API Key 기반 인증 (`FRAMLIT_API_KEY` 환경 변수)
- Bearer 토큰 형식으로 API 호출

## 코드 패턴

### Tool 정의
```typescript
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const myTool: Tool = {
  name: 'framlit_<action>',      // 항상 framlit_ prefix
  description: `설명...`,        // 상세한 설명 (비용, 제한 등 포함)
  inputSchema: {
    type: 'object',
    properties: { ... },
    required: ['...'],
  },
};
```

### Tool Handler
```typescript
export async function handleMyTool(
  client: FramlitClient,
  args: Record<string, unknown>
) {
  // 1. 파라미터 추출 및 타입 캐스팅
  const param = args.param as string;
  
  // 2. API 호출
  const result = await client.myMethod(param);
  
  // 3. 결과 반환 (text content)
  return {
    content: [
      {
        type: 'text',
        text: `결과: ${result}`,
      },
    ],
  };
}
```

### 에러 처리
```typescript
// API 클라이언트에서 에러 처리
if (!response.ok) {
  // 특정 에러 코드에 대해 upsell 메시지 추가
  if (data.code === 'INSUFFICIENT_CREDITS') {
    throw new Error(`${error}\n\n💡 Get more credits at https://framlit.app/pricing`);
  }
  throw new Error(error);
}
```

## 네이밍 컨벤션

### Tool 이름
- 형식: `framlit_<action>` (snake_case)
- 예: `framlit_generate_code`, `framlit_list_projects`

### 파일 구조
```
src/
├── index.ts              # 서버 엔트리
├── api/
│   └── client.ts         # Framlit API 클라이언트
├── tools/
│   ├── generate.ts       # 코드 생성 도구
│   ├── projects.ts       # 프로젝트 도구
│   └── ...
└── resources/
    └── user.ts           # 사용자 리소스
```

## Pro 유도 메시지

Credit 부족, 플랜 제한 등의 에러 시 upsell 메시지 포함:

```typescript
// 좋은 예
'Insufficient credits. Get more at https://framlit.app/pricing'

// 나쁜 예 (링크 없음)
'Insufficient credits.'
```

## 테스트

```bash
# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 로컬 테스트 (환경 변수 설정 필요)
FRAMLIT_API_KEY=fml_xxx npm start
```
