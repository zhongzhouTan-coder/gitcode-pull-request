# Assign Reviewer API

## API Description

This API allows users to assign reviewers to a specific pull request.

## Endpoints

```
POST https://api.gitcode.com/api/v5/repos/:owner/:repo/pulls/:number/reviewers
```

## Path Variables

- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: 	Repository Path(path).
- `number`: Pull Request Number.

## Query Parameters

- `access_token`: (Required) The access token for authentication.

## Example Request

```bash
curl --request POST \
  --url 'https://api.gitcode.com/api/v5/repos/tangxuanya/ai_test/pulls/2/reviewers' \
  --header 'Authorization: Bearer xxxxxxxxxxxxxxx' \
  --header 'Content-Type: application/json' \
  --data '{
	"reviewers": "xuanxuantan",
	"add": false
}'
```

## Example Response

```json
[
	{
		"id": 11897222,
		"login": "xuanxuantan",
		"name": "xuanxuantan",
		"object_id": "6a4717e8b625670e4e839bb2"
	}
]
```
