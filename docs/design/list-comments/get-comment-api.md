# Get a comment for a specific comment id

## API Description

This API allows users to get a comment for a specific comment id of a pull request.

## Endpoints

```
GET https://api.gitcode.com/api/v5/repos/:owner/:repo/pulls/comments/:id
```

## Path Variables
- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: 	Repository Path(path).
- `id`: Comment ID.

## Query Parameters
- `access_token`: (Required) The access token for authentication.

## Example Request

```bash
curl --request GET \
  --url 'https://api.gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/pulls/comments/176157991?access_token=xxxxxxxxxxxxx'
```

## Example Response

```json
{
	"id": 176157991,
	"discussion_id": "02564a3e864addd5a27f6a321a82944c0ddbe65b",
	"body": "解释一下这里的作用，和之前的都存在差异",
	"comment_type": "DiffNote",
	"user": {
		"id": "5578870",
		"object_id": "6822c9b2398335026946a660",
		"login": "yejiajun",
		"name": "yejj",
		"type": "User"
	},
	"created_at": "2026-06-17T19:48:56+08:00",
	"updated_at": "2026-06-17T19:48:56+08:00",
	"is_outdated": false,
	"position": {
		"base_sha": "9c64e8d69af9c620d7e3f62979f9a939012df331",
		"start_sha": "4a77d9defca3cac9e9e69e7d37095343c516666a",
		"head_sha": "50f2a196ae3d3101186d7fa066214eb0ff7e7e04",
		"old_path": "lab_practice/glm_5/glm_5_1_w4a4c8_mxfp4.yaml",
		"new_path": "lab_practice/glm_5/glm_5_1_w4a4c8_mxfp4.yaml",
		"position_type": "text",
		"new_line": 35
	}
}
```