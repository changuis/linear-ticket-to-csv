## Linear Ticket to CSV

Next.js UI for generating Japanese CSV test cases from Linear tickets via OpenAI.

### Setup
1) Install deps: `npm install` (or `pnpm install`).
2) Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY` and (optional if you fetch by ID) `LINEAR_API_KEY`.
   - Keys entered in the settings page are stored in `localStorage` and only sent with the request; they are not persisted server-side.

### Run
```bash
npm run dev
# open http://localhost:3000
```

### API
`POST /api/generate-test-cases` body:
```json
{
  "issueIds": ["ENG-123", "ENG-124"],
  "description": "optional direct description",
  "model": "gpt-4o-mini",
  "cases": 5,
  "openaiApiKey": "optional override",
  "linearApiKey": "optional override"
}
```
`issueIds` also accepts a single string separated by commas, spaces, or newlines.

Response:
```json
{
  "header": "項目,ユーザーロール（管理者かユーザー）,操作手順,期待結果",
  "csv": "ログイン,全員,ログインボタンをクリックする,SSO認証を選択しシステムにログインできる\n..."
}
```
