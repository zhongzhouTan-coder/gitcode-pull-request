
# Compare Branch API

## API Description

This API allows users to compare two branches in a repository.

## Endpoints

```
GET https://api.gitcode.com/api/v5/repos/:owner/:repo/compare/:base...:head
```

## Path Variables

- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: Repository Path(path).
- `base`: The starting point for comparison. Commit SHA, branch name, or tag name.
- `head`: The end point for comparison. Can be a commit SHA, branch name, or tag name.

## Query Parameters

- `access_token`: (Required) The access token for authentication.
- `straight`: (Optional) Whether to perform a straight comparison. Defaults to false.
- `suffix`: (Optional) Filter files by file extension, such as .txt. Affects only files.

## Example Request

```bash
curl --request GET \
  --url 'https://api.gitcode.com/api/v5/repos/tangxuanya/ai_test/compare/main...new_branch_1?access_token=xxxxxxxxxxxxxxxx'
```

## Example Response

```json
{
	"base_commit": {
		"url": "https://api.gitcode.com/api/v5/repos/tangxuanya/ai_test/commits/dd29456a0da460d26145acaa947bc2d729c58b01",
		"sha": "dd29456a0da460d26145acaa947bc2d729c58b01",
		"html_url": "https://gitcode.com/tangxuanya/ai_test/commit/dd29456a0da460d26145acaa947bc2d729c58b01",
		"comments_url": "https://gitcode.com/api/v5/repos/tangxuanya/ai_test/commits/dd29456a0da460d26145acaa947bc2d729c58b01/comments",
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
			"tree": {
				"sha": "5b8dab3b90b69c143ec68dfb1d383b9025fb80ef",
				"url": "https://api.gitcode.com/repos/tangxuanya/ai_test/git/trees/5b8dab3b90b69c143ec68dfb1d383b9025fb80ef"
			},
			"message": "Initial commit"
		},
		"author": {
			"name": "tangxuanya",
			"id": 9573307,
			"login": "tangxuanya",
			"type": "User"
		},
		"committer": {
			"name": "tangxuanya",
			"id": 9573307,
			"login": "tangxuanya",
			"type": "User"
		}
	},
	"merge_base_commit": {
		"url": "https://api.gitcode.com/api/v5/repos/tangxuanya/ai_test/commits/dd29456a0da460d26145acaa947bc2d729c58b01",
		"sha": "dd29456a0da460d26145acaa947bc2d729c58b01",
		"html_url": "https://gitcode.com/tangxuanya/ai_test/commit/dd29456a0da460d26145acaa947bc2d729c58b01",
		"comments_url": "https://gitcode.com/api/v5/repos/tangxuanya/ai_test/commits/dd29456a0da460d26145acaa947bc2d729c58b01/comments",
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
			"tree": {
				"sha": "5b8dab3b90b69c143ec68dfb1d383b9025fb80ef",
				"url": "https://api.gitcode.com/repos/tangxuanya/ai_test/git/trees/5b8dab3b90b69c143ec68dfb1d383b9025fb80ef"
			},
			"message": "Initial commit"
		},
		"author": {
			"name": "tangxuanya",
			"id": 9573307,
			"login": "tangxuanya",
			"type": "User"
		},
		"committer": {
			"name": "tangxuanya",
			"id": 9573307,
			"login": "tangxuanya",
			"type": "User"
		}
	},
	"commits": [
		{
			"sha": "d594a6b1390028ff94d0dc324ed63dc0adeb4ebe",
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
				"message": "new: 新建文件 1.md\n\n\nSigned-off-by: tangxuanya <cqyzdp1@163.com>"
			},
			"author": {
				"name": "tangxuanya",
				"id": 9573307,
				"login": "tangxuanya"
			},
			"committer": {
				"name": "tangxuanya",
				"id": 9573307,
				"login": "tangxuanya"
			}
		}
	],
	"files": [
		{
			"sha": "39b0eca9342b6352c79e833c7e0fd8484454ff98",
			"filename": "content/1.md",
			"status": "added",
			"additions": 1,
			"deletions": 0,
			"changes": 1,
			"blob_url": "https://gitcode.com/tangxuanya/ai_test/blob/39b0eca9342b6352c79e833c7e0fd8484454ff98/content/1.md",
			"raw_url": "https://raw.gitcode.com/tangxuanya/ai_test/raw/39b0eca9342b6352c79e833c7e0fd8484454ff98/content/1.md",
			"patch": "@@ -0,0 +1 @@\n+hello this is just the test\n\\ No newline at end of file\n",
			"truncated": false
		}
	],
	"truncated": false
}
```
