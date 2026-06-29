
# Get a Repository

## API Description

This API allows users to retrieve information about a specific repository.

## Endpoints

```
GET https://api.gitcode.com/api/v5/repos/:owner/:repo
```

## Path Variables

- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: 	Repository Path(path).

## Query Parameters
- `access_token`: (Required) The access token for authentication.

## Example Request

```bash
curl --request GET \
  --url 'https://api.gitcode.com/api/v5/repos/tangxuanya/ai_test?access_token=xxxxxxxxxxxxxxxx'
```

## Example Response

```json
{
	"id": 10233341,
	"full_name": "tangxuanya/ai_test",
	"human_name": "tangxuanya / ai_test",
	"url": "https://api.gitcode.com/api/v5/repos/tangxuanya/ai_test",
	"namespace": {
		"id": 11448161,
		"name": "tangxuanya",
		"path": "tangxuanya",
		"html_url": "https://gitcode.com/tangxuanya"
	},
	"path": "ai_test",
	"name": "ai_test",
	"description": "",
	"status": "开始",
	"ssh_url_to_repo": "git@gitcode.com:tangxuanya/ai_test.git",
	"http_url_to_repo": "https://gitcode.com/tangxuanya/ai_test.git",
	"web_url": "https://gitcode.com/tangxuanya/ai_test",
	"readme_url": "https://gitcode.com/tangxuanya/ai_test/blob/main/README.md",
	"created_at": "2026-06-27T15:18:40.674+08:00",
	"updated_at": "2026-06-27T15:18:40.674+08:00",
	"creator": {
		"id": "695337496415d64a21d4d6c7",
		"arts_id": "9573307",
		"username": "tangxuanya",
		"nickname": "tangxuanya",
		"email": "cqyzdp1@163.com"
	},
	"members": [
		"tangxuanya"
	],
	"forks_count": 0,
	"stargazers_count": 0,
	"project_labels": [],
	"license": "Apache-2.0",
	"internal": false,
	"open_issues_count": 0,
	"watchers_count": 0,
	"assignees_number": 0,
	"enterprise": {
		"id": 11448161,
		"path": "tangxuanya",
		"html_url": "https://gitcode.com/tangxuanya",
		"type": "user"
	},
	"default_branch": "main",
	"fork": false,
	"pushed_at": "2026-06-27T15:18:40.674+08:00",
	"owner": {
		"id": "9573307",
		"login": "tangxuanya",
		"name": "tangxuanya",
		"html_url": "https://gitcode.com/tangxuanya",
		"type": "User",
		"url": "https://api.gitcode.com/api/v5/users/tangxuanya"
	},
	"assigner": {
		"id": "9573307",
		"login": "tangxuanya",
		"name": "tangxuanya",
		"html_url": "https://gitcode.com/tangxuanya",
		"type": "User",
		"url": "https://api.gitcode.com/api/v5/users/tangxuanya"
	},
	"issue_template_source": "project",
	"repository_type": "code",
	"private": false,
	"public": true
}
```
