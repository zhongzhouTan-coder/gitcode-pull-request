# Cancel Reviewer API

## API Description

This API allows users to cancel reviewers for a specific pull request.

## Endpoints

```
DELETE https://api.gitcode.com/api/v5/repos/:owner/:repo/pulls/:number/reviewers
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
  --url https://api.gitcode.com/api/v5/repos/tangxuanya/ai_test/pulls/2/reviewers \
  --header 'Authorization: Bearer xxxxxxxxxxxxxxx' \
  --header 'Content-Type: application/json' \
  --data '{
	"reviewers": "xuanxuantan"
}'
```

## Example Response

200 OK

```json
[] # return all reviewers remaining after the cancellation
```
