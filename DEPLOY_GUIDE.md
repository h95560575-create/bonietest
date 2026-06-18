# 재소단 재고관리 웹앱 배포 안내

## 0. 중요한 원칙

- 기존 로컬 프로그램과 `data/inventory-state.json`은 지우지 않습니다.
- 배포용 사이트는 GitHub, Supabase, Railway로 따로 올립니다.
- 비밀번호와 Supabase 비밀키는 GitHub에 올리지 않습니다.
- Railway의 Variables에만 비밀값을 넣습니다.

## 1. GitHub에 코드 올리기

1. GitHub에서 새 저장소를 만듭니다.
2. 저장소 이름 예시: `jaesodan-inventory`
3. 이 웹앱 폴더를 GitHub Desktop 또는 Git 명령으로 올립니다.
4. `.env.example`은 올려도 됩니다.
5. 실제 `.env` 파일이나 Supabase 비밀키는 올리면 안 됩니다.

## 2. Supabase 만들기

1. Supabase에서 새 프로젝트를 만듭니다.
2. 왼쪽 메뉴에서 `SQL Editor`를 엽니다.
3. 이 폴더의 `supabase-schema.sql` 내용을 붙여넣고 실행합니다.
4. `Authentication > Users`에서 관리자 계정을 하나 만듭니다.
5. `supabase-schema.sql` 아래쪽의 관리자 등록 예시 SQL에서 이메일을 본인 이메일로 바꿔 실행합니다.

## 3. Railway에 배포하기

1. Railway에서 새 프로젝트를 만듭니다.
2. `Deploy from GitHub repo`를 선택합니다.
3. GitHub에 올린 `jaesodan-inventory` 저장소를 연결합니다.
4. Railway의 `Variables`에 아래 값을 넣습니다.

```text
SUPABASE_URL=Supabase Project URL
SUPABASE_ANON_KEY=Supabase anon public key
SUPABASE_SERVICE_ROLE_KEY=Supabase service_role secret key
NODE_ENV=production
```

5. Railway가 자동 배포를 시작합니다.
6. 배포가 끝나면 Railway에서 제공하는 웹주소로 접속합니다.

## 4. 보안 구조

- 브라우저에는 비밀번호 목록이 들어가지 않습니다.
- 브라우저는 아이디/비밀번호를 서버에만 보냅니다.
- 서버가 Supabase Auth로 로그인 확인을 합니다.
- 로그인 토큰은 `HttpOnly` 쿠키에 저장되어 자바스크립트에서 읽을 수 없습니다.
- Supabase `service_role` 비밀키는 Railway 서버 안에서만 사용합니다.
- 개발자도구로 버튼을 억지로 풀어도 서버가 권한을 다시 검사합니다.

## 5. 권한 종류

- `can_upload_inventory`: 재고목록/주문서 등록
- `can_edit_memo`: 메모 수정
- `can_edit_schedule`: 입고일정/입고수량 수정
- `can_manage_links`: 변경코드/메인코드 수정
- `can_manage_users`: 관리자모드에서 사용자 권한 수정

## 6. 기존 로컬 데이터 옮기기

1. 로컬 웹앱의 `data/inventory-state.json` 파일은 그대로 보관합니다.
2. Supabase 표를 만든 뒤, 아래 명령으로 기존 데이터를 Supabase에 복사합니다.

```powershell
$env:SUPABASE_URL="https://YOUR_PROJECT_ID.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
npm run upload:state
```

3. 이 작업은 기존 파일을 삭제하지 않고 Supabase로 복사만 합니다.
4. 복사 후 배포 사이트에 로그인하면 기존 재고/메모/입고일정이 보입니다.
