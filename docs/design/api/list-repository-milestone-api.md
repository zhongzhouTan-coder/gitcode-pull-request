# list-repository-milestone-api

## API Description

This API allows users to list milestones for a repository.
## Endpoints

```
GET https://api.gitcode.com/api/v5/repos/:owner/:repo/milestones
```

## Path Parameters

- `owner`: (Required) The owner of the repository.
- `repo`: (Required) The name of the repository.

## Query Parameters

- `access_token`: (Required) The access token for authentication.
- `state`: (Optional) The state of the milestones to return. Can be `open`, `closed`, or `all`. Defaults to `open`.
- `page`: (Optional) The page number of the results to fetch. Defaults to 1.
- `per_page`: (Optional) The number of results per page. Defaults to 20.

## Example Request

```bash
curl --request GET \
  --url 'https://api.gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/milestones?access_token=xxxxxxxxxxxxx&state=open'
```

## Example Response

```json
[
	{
		"closed_issues": 0,
		"created_at": "2026-06-19T01:26:05+08:00",
		"description": "",
		"number": 557105,
		"open_issues": 0,
		"repository_id": 8444818,
		"state": "active",
		"title": "MindStudio 26.2.0",
		"updated_at": "2026-06-19T01:26:05+08:00",
		"url": "https://gitcode.com/Ascend/msmodelslim/milestones/5"
	},
	{
		"closed_issues": 0,
		"created_at": "2026-03-26T18:30:14+08:00",
		"description": "",
		"due_on": "2026-07-15",
		"number": 253899,
		"open_issues": 0,
		"repository_id": 8444818,
		"state": "active",
		"title": "MindStudio 26.1.0",
		"updated_at": "2026-03-26T18:30:14+08:00",
		"url": "https://gitcode.com/Ascend/msmodelslim/milestones/4"
	},
	{
		"closed_issues": 0,
		"created_at": "2026-03-11T19:27:45+08:00",
		"description": "",
		"due_on": "2026-04-15",
		"number": 247816,
		"open_issues": 0,
		"repository_id": 8444818,
		"state": "active",
		"title": "MindStudio 26.0.0",
		"updated_at": "2026-03-11T19:27:45+08:00",
		"url": "https://gitcode.com/Ascend/msmodelslim/milestones/3"
	},
	{
		"closed_issues": 0,
		"created_at": "2026-02-03T19:44:06+08:00",
		"description": "",
		"due_on": "2026-02-28",
		"number": 214515,
		"open_issues": 0,
		"repository_id": 8444818,
		"state": "active",
		"title": "Doc-tools任务检查&CI门禁",
		"updated_at": "2026-02-09T18:02:51+08:00",
		"url": "https://gitcode.com/Ascend/msmodelslim/milestones/2"
	}
]
```
