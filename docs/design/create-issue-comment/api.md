# Create issue comment API

## Description

This API is used to create a comment on an issue.

## API Endpoint

POST `https://api.gitcode.com/api/v5/repos/:owner/:repo/issues/:number/comments`

## Path variables
- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: Repository Name Path.
- `number`: Issue Number.

## Query Parameters
- `access_token`: (Required) The access token for authentication.

## Request Body
```json
{
    "body": "Comment content"
}
```

## Example Request

```bash
curl --request POST \
  --url 'https://api.gitcode.com/api/v5/repos/tangxuanya/msmodelslim/issues/1/comments?access_token=xxxxxxxxxxxxxxx' \
  --header 'Content-Type: application/json' \
  --data '{
	"body": "The contents of the comment."
}'
```

## Response
200 OK

```json
{
	"id": 178014294,
	"body": "The contents of the comment.",
	"user": {
		"html_url": "https://gitcode.com/tangxuanya",
		"id": "695337496415d64a21d4d6c7",
		"object_id": "695337496415d64a21d4d6c7",
		"login": "tangxuanya",
		"name": "tangxuanya"
	},
	"target": {
		"issue": {
			"id": 4126565,
			"title": "",
			"number": 1
		}
	},
	"created_at": "2026-07-01T14:13:41+08:00",
	"updated_at": "2026-07-01T14:13:41+08:00"
}
```