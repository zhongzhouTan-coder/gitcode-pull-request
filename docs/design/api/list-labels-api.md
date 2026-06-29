# list labels API

## API Description

This API allows users to list all labels in a repository.

## Endpoints

```
GET https://api.gitcode.com/api/v5/repos/:owner/:repo/labels
```

## Path Variables

- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: 	Repository Path(path).

## Query Parameters

- `access_token`: (Required) The access token for authentication.
- `page`: (Optional) The page number to retrieve. Defaults to 1.
- `per_page`: (Optional) The number of labels to retrieve per page. Defaults to 100. Maximum is 100.

## Example Request

```bash
curl --request GET \
  --url 'https://api.gitcode.com/api/v5/repos/tangxuanya/ai_test/labels?access_token=xxxxxxxxxxxxxxxx'
```

## Example Response

```json
[
	{
		"id": 56808,
		"name": "pend",
		"color": "#DA203E",
		"repository_id": 8444818,
		"created_at": "2026-06-27T14:47:15.325+08:00",
		"updated_at": "2026-06-27T14:47:15.325+08:00",
		"description": ""
	},
	{
		"id": 55972,
		"name": "requirement",
		"color": "#2865E0",
		"repository_id": 8444818,
		"created_at": "2026-06-22T20:29:04.959+08:00",
		"updated_at": "2026-06-22T20:29:04.959+08:00"
	},
	{
		"id": 53156,
		"name": "pr-audit-failed",
		"color": "#db2828",
		"repository_id": 8444818,
		"created_at": "2026-06-07T09:17:44.507+08:00",
		"updated_at": "2026-06-08T09:23:54.642+08:00",
		"description": ""
	},
	{
		"id": 53047,
		"name": "npugraph_ex",
		"color": "#2865E0",
		"repository_id": 8444818,
		"created_at": "2026-06-06T15:30:18.029+08:00",
		"updated_at": "2026-06-06T15:30:18.029+08:00"
	},
	{
		"id": 52011,
		"name": "triaged-review",
		"color": "#2865E0",
		"repository_id": 8444818,
		"created_at": "2026-05-31T21:30:35.201+08:00",
		"updated_at": "2026-05-31T21:30:35.201+08:00"
	},
	{
		"id": 50683,
		"name": "smoke-pipeline-running",
		"color": "#2865E0",
		"repository_id": 8444818,
		"created_at": "2026-05-24T18:31:25.423+08:00",
		"updated_at": "2026-05-24T18:31:25.423+08:00"
	},
	{
		"id": 50680,
		"name": "benchmark-pipeline-running",
		"color": "#2865E0",
		"repository_id": 8444818,
		"created_at": "2026-05-24T18:20:49.893+08:00",
		"updated_at": "2026-05-24T18:20:49.893+08:00"
	},
	{
		"id": 50679,
		"name": "regression-pipeline-running",
		"color": "#2865E0",
		"repository_id": 8444818,
		"created_at": "2026-05-24T18:20:06.651+08:00",
		"updated_at": "2026-05-24T18:20:06.651+08:00"
	}
]
```
