---
description: "Framlit API 연동 패턴. API 클라이언트 수정 시 참고하세요."
globs: ["src/api/**"]
---

# Framlit API Integration

## API 엔드포인트

### Base URL
- Production: `https://framlit.app/api/mcp`
- 환경 변수: `FRAMLIT_API_URL` (선택적)

### 인증
- Header: `Authorization: Bearer <API_KEY>`
- API Key 형식: `fml_<random_string>`

## 엔드포인트 목록

| Endpoint | Method | 설명 | Credit |
|----------|--------|------|--------|
| `/user` | GET | 사용자 정보 | 0 |
| `/generate-code` | POST | 코드 생성 | 1 |
| `/modify-code` | POST | 코드 수정 | 1 |
| `/projects` | GET | 프로젝트 목록 | 0 |
| `/projects` | POST | 프로젝트 생성 | 0 |
| `/projects/:id` | GET | 프로젝트 상세 | 0 |
| `/projects/:id` | PUT | 프로젝트 수정 | 0 |
| `/render` | POST | 렌더링 시작 | 0 |
| `/render/:id` | GET | 렌더링 상태 | 0 |
| `/templates` | GET | 템플릿 목록 | 0 |

## 응답 형식

### 성공 응답
```typescript
{
  data: T;          // 실제 데이터
  message?: string; // 선택적 메시지
}
```

### 에러 응답
```typescript
{
  error: string;    // 에러 메시지
  code?: string;    // 에러 코드 (INSUFFICIENT_CREDITS, PLAN_LIMIT_EXCEEDED 등)
  details?: any;    // 추가 정보
}
```

## 에러 코드

| Code | 설명 | 대응 |
|------|------|------|
| `UNAUTHORIZED` | 인증 실패 | API Key 확인 안내 |
| `INSUFFICIENT_CREDITS` | 크레딧 부족 | 충전 링크 제공 |
| `PLAN_LIMIT_EXCEEDED` | 플랜 제한 | 업그레이드 링크 제공 |
| `NOT_FOUND` | 리소스 없음 | 일반 에러 |
| `INTERNAL_ERROR` | 서버 에러 | 재시도 안내 |

## API 클라이언트 패턴

```typescript
private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${this.baseUrl}/api/mcp${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'framlit-mcp/0.1.0',
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    // 에러 처리 + upsell 메시지
    throw new Error(formatError(data));
  }

  return data.data as T;
}
```

## 주의사항

1. **API Key 노출 금지**: 로그에 API Key를 출력하지 않음
2. **에러 메시지에 링크 포함**: 사용자가 바로 조치할 수 있도록
3. **타임아웃 처리**: 코드 생성은 10-30초 걸릴 수 있음
4. **Rate Limiting**: API에서 429 응답 시 재시도 로직 고려
