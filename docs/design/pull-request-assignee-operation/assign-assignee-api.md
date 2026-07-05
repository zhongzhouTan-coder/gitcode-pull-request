# Assign Assignee API

## API Description

This API allows users to assign assignees to a specific pull request.

## Endpoints

```
POST https://api.gitcode.com/api/v5/repos/:owner/:repo/pulls/:number/assignees
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
  --url 'https://api.gitcode.com/api/v5/repos/tangxuanya/ai_test/pulls/2/assignees' \
  --header 'Authorization: Bearer xxxxxxxxxxxxxx' \
  --header 'Content-Type: application/json' \
  --data '{
	"assignees": "xuanxuantan"
}'
```

## Example Response

```json
{
	"assignees_number": 1
}
```
