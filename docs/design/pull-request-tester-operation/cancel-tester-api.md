# Cancel Testers API

## API Description

This API allows users to cancel testers for a specific pull request.

## Endpoints

```
DELETE https://api.gitcode.com/api/v5/repos/:owner/:repo/pulls/:number/testers
```

## Path Variables

- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: 	Repository Path(path).
- `number`: Pull Request Number.

## Query Parameters

- `access_token`: (Required) The access token for authentication.

## Example Request

```bash
curl --request DELETE \
  --url https://api.gitcode.com/api/v5/repos/tangxuanya/ai_test/pulls/2/testers \
  --header 'Authorization: Bearer xxxxxxxxxxxxxxxx' \
  --header 'Content-Type: application/json' \
  --data '{
	"testers": "xuanxuantan"
}'
```

## Example Response

200 OK

```json
[] # return all testers remaining after the cancellation
```
