
# Create New Branch API

## API Description

This API allows users to create a new branch in a repository.

## Endpoints

```
POST https://api.gitcode.com/api/v5/repos/:owner/:repo/branches
```

## Path Variables

- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: Repository Path(path).

## Query Parameters

- `access_token`: (Required) The access token for authentication.

## Request Body

```json
{
	"refs": "main",
	"branch_name": "new_branch_3"
}
```

## Example Request

```bash
curl --request POST \
  --url 'https://api.gitcode.com/api/v5/repos/tangxuanya/ai_test/branches?access_token=xxxxxxxxxxxxxxxx' \
  --header 'Content-Type: application/json' \
  --data '{
	"refs": "main",
	"branch_name": "new_branch_3"
}'
```

## Example Response

```json
[
	{
		"name": "main",
		"commit": {
			"commit": {
				"author": {
					"name": "tangxuanya",
					"date": "2026-06-27T15:18:41+08:00",
					"email": "cqyzdp1@163.com"
				},
				"committer": {
					"name": "tangxuanya",
					"date": "2026-06-27T15:18:41+08:00",
					"email": "cqyzdp1@163.com"
				},
				"message": "Initial commit"
			},
			"sha": "dd29456a0da460d26145acaa947bc2d729c58b01",
			"url": "https://gitcode.com/api/v5/repos/tangxuanya/ai_test/commits/dd29456a0da460d26145acaa947bc2d729c58b01"
		},
		"default_branch": true,
		"protected": false
	},
	{
		"name": "new_branch_1",
		"commit": {
			"commit": {
				"author": {
					"name": "tangxuanya",
					"date": "2026-06-27T15:20:00+08:00",
					"email": "cqyzdp1@163.com"
				},
				"committer": {
					"name": "tangxuanya",
					"date": "2026-06-27T15:20:00+08:00",
					"email": "cqyzdp1@163.com"
				},
				"message": "new: 新建文件 1.md"
			},
			"sha": "d594a6b1390028ff94d0dc324ed63dc0adeb4ebe",
			"url": "https://gitcode.com/api/v5/repos/tangxuanya/ai_test/commits/d594a6b1390028ff94d0dc324ed63dc0adeb4ebe"
		},
		"default_branch": false,
		"protected": false
	},
	{
		"name": "new_branch",
		"commit": {
			"commit": {
				"author": {
					"name": "tangxuanya",
					"date": "2026-06-27T15:20:00+08:00",
					"email": "cqyzdp1@163.com"
				},
				"committer": {
					"name": "tangxuanya",
					"date": "2026-06-27T15:20:00+08:00",
					"email": "cqyzdp1@163.com"
				},
				"message": "new: 新建文件 1.md"
			},
			"sha": "d594a6b1390028ff94d0dc324ed63dc0adeb4ebe",
			"url": "https://gitcode.com/api/v5/repos/tangxuanya/ai_test/commits/d594a6b1390028ff94d0dc324ed63dc0adeb4ebe"
		},
		"default_branch": false,
		"protected": false
	}
]
```
