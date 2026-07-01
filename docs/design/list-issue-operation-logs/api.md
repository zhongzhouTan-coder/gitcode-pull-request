# List issue operation logs

## API Description

This API allows users to list the issue operation logs in a repository.

## Endpoints

```
GET https://api.gitcode.com/api/v5/repos/:owner/issues/:number/operate_logs
```

## Path Variables
- `owner`: Repository Owner Path (Organization or User Path).
- `number`: Issue Number.

## Query Parameters
- `access_token`: (Required) The access token for authentication.
- `repo`: 	Repository Path(path).

## Example Request

```bash
curl --request GET \
  --url 'https://api.gitcode.com/api/v5/repos/tangxuanya/issues/1/operate_logs?access_token=xxxxxxxxxxxx&repo=msmodelslim' 
```

## Example Response

```json
[
	{
		"id": 177875197,
		"user": {
			"html_url": "https://gitcode.com/tangxuanya",
			"id": "695337496415d64a21d4d6c7",
			"login": "tangxuanya",
			"name": "tangxuanya"
		},
		"content": "changed title from **[issue] test issue create** to **[issue] test issue create new**",
		"created_at": "2026-06-30T17:58:21+08:00",
		"action_type": "title",
		"update_at": "2026-06-30T17:58:21+08:00",
		"issue_id": "4126565"
	},
	{
		"id": 177874658,
		"user": {
			"html_url": "https://gitcode.com/tangxuanya",
			"id": "695337496415d64a21d4d6c7",
			"login": "tangxuanya",
			"name": "tangxuanya"
		},
		"content": "changed milestone to new_milstone",
		"created_at": "2026-06-30T17:55:30+08:00",
		"action_type": "milestone",
		"update_at": "2026-06-30T17:55:30+08:00",
		"issue_id": "4126565"
	},
	{
		"id": 177874643,
		"user": {
			"html_url": "https://gitcode.com/tangxuanya",
			"id": "695337496415d64a21d4d6c7",
			"login": "tangxuanya",
			"name": "tangxuanya"
		},
		"content": "add label perf",
		"created_at": "2026-06-30T17:55:25+08:00",
		"action_type": "label",
		"update_at": "2026-06-30T17:55:25+08:00",
		"issue_id": "4126565"
	},
	{
		"id": 177847342,
		"user": {
			"html_url": "https://gitcode.com/tangxuanya",
			"id": "695337496415d64a21d4d6c7",
			"login": "tangxuanya",
			"name": "tangxuanya"
		},
		"content": "add label bug",
		"created_at": "2026-06-30T16:24:29+08:00",
		"action_type": "label",
		"update_at": "2026-06-30T16:24:29+08:00",
		"issue_id": "4126565"
	}
]
```