# Create a issue API

## API Description

This API allows users to create an issue in a repository.

## Endpoints

```
POST https://api.gitcode.com/api/v5/repos/:owner/issues
```

## Path Variables
- `owner`: Repository Owner Path (Organization or User Path).

## Query Parameters
- `access_token`: (Required) The access token for authentication.

## Request Body
```json
{
	"repo": "Repository path",
	"title": "Issue Title",
	"body": "Issue Description",
	"assignee": "Issue Owner's username, separated by English commas for multiple ones",
	"milestone": 0,
	"labels": "A comma-separated list of labels, where the name must be between 2-20 characters long and cannot contain special characters. For example: bug,performance",
	"security_hole": "Whether it is a private issue (default is false)",
	"template_path": "issue template path, project templates support files under the .gitcode, .github, .gitee directories, and organization templates only support files under the .gitcode directory of the .gitcode project."
}
```

## Example Request

```bash
curl --request POST \
  --url 'https://api.gitcode.com/api/v5/repos/tangxuanya/issues?access_token=xxxxxxxxxxxxxxxxxx'
```

## Example Request Body

```json
{
	"repo": "ai_test",
	"title": "Issue Title",
	"body": "Issue Description",
	"assignee": "tangxuanya",
	"milestone": 0,
	"labels": "",
	"security_hole": false,
	"template_path": ""
}
```

## Example Response

```json
{
	"id": 4126451,
	"html_url": "https://gitcode.com/tangxuanya/ai_test/issues/1",
	"number": "1",
	"state": "open",
	"title": "Issue Title",
	"body": "Issue Description",
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
	"created_at": "2026-06-30T15:56:11+08:00",
	"updated_at": "2026-06-30T15:56:11+08:00",
	"finished_at": "",
	"issue_state": "待办的",
	"priority": 0,
	"issue_state_detail": {
		"title": "待办的",
		"serial": 0
	}
}
```


