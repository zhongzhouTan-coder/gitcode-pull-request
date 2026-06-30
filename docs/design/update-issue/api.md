
# Edit issue API

## API Description

This API allows users to edit an existing issue in a repository. Users can update the title, description, and other attributes of the issue.

## Endpoints

```
PATCH https://api.gitcode.com/api/v5/repos/:owner/:repo/issues/:number
```

## Path Variables

- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: 	Repository Path(path).
- `number`: Issue number.

## Query Parameters

- `access_token`: (Required) The access token for authentication.

## Request Body

The request body should be in JSON format and include the following fields:

```json
{
	"repo": "Repository path",
	"title": "Issue title",
	"body": "Issue Description",
	"assignee": "Issue Owner's username, separated by English commas for multiple ones",
	"milestone": "Milestone Sequence Number",
	"labels": "A comma-separated list of labels, where the name must be between 2-20 characters long and cannot contain special characters. For example: bug,performance",
	"security_hole": false, # Whether it is a private issue (default is false)
	"state": "Issue Status, reopen (open)、close (closed)"
}
```

## Example Request

```bash
curl --request PATCH \
  --url 'https://api.gitcode.com/api/v5/repos/tangxuanya/issues/1?access_token=xxxxxxxxxxxxxxxx'
```

## Example Request Body

```json
{
	"repo": "ai_test",
	"title": "issue title",
	"body": "issue description updated",
	"assignee": "tangxuanya",
	"milestone": 575939,
	"labels": "bug,perf",
	"security_hole": false,
	"state": "reopen"
}
```

## Example Response

```json
{
	"id": 4126451,
	"html_url": "https://gitcode.com/tangxuanya/ai_test/issues/1",
	"number": "1",
	"state": "open",
	"title": "issue title",
	"body": "issue description updated",
	"user": {
		"html_url": "https://gitcode.com/tangxuanya",
		"id": "695337496415d64a21d4d6c7",
		"object_id": "695337496415d64a21d4d6c7",
		"login": "tangxuanya",
		"name": "tangxuanya"
	},
	"assignee": {
		"html_url": "https://gitcode.com/tangxuanya",
		"id": "695337496415d64a21d4d6c7",
		"object_id": "695337496415d64a21d4d6c7",
		"login": "tangxuanya",
		"name": "tangxuanya"
	},
	"assignees": [
		{
			"html_url": "https://gitcode.com/tangxuanya",
			"id": "695337496415d64a21d4d6c7",
			"object_id": "695337496415d64a21d4d6c7",
			"login": "tangxuanya",
			"name": "tangxuanya"
		}
	],
	"repository": {
		"id": 4126451,
		"full_name": "tangxuanya/ai_test",
		"path": "ai_test",
		"name": "ai_test",
		"description": "",
		"created_at": "2026-06-30T15:56:11+08:00",
		"updated_at": "2026-06-30T17:19:56+08:00"
	},
	"created_at": "2026-06-30T15:56:11+08:00",
	"updated_at": "2026-06-30T17:19:56+08:00",
	"finished_at": "",
	"labels": [
		{
			"id": 13244332,
			"name": "bug",
			"color": "#ED4014",
			"created_at": "2026-06-27T15:22:10+08:00",
			"updated_at": "2026-06-30T17:08:12+08:00"
		},
		{
			"id": 13244568,
			"name": "perf",
			"color": "#428BCA",
			"created_at": "2026-06-30T17:15:52+08:00",
			"updated_at": "2026-06-30T17:15:52+08:00"
		}
	],
	"issue_state": "进行中",
	"comments": 0
}
```
