# List pull request operation logs

## API Description

This API allows users to list the pull request operation logs in a repository.

## Endpoints

```
GET https://api.gitcode.com/api/v5/repos/:owner/:repo/pulls/:number/operate_logs
```

## Path Variables
- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: 	Repository Path(path).
- `number`: Pull Request Number.

## Query Parameters
- `access_token`: (Required) The access token for authentication.
- `sort`: (Optional) The field to sort by. Sorted in descending order by default.
- `page`: (Optional) The current page number. Defaults to 1.
- `per_page`: (Optional) The number of items per page, with a maximum of 100. The default is 20.

## Example Request

```bash
curl --request GET \
  --url 'https://api.gitcode.com/api/v5/repos/tangxuanya/msmodelslim/pulls/2/operate_logs?access_token=xxxxxxx' 
```

## Example Response

```json
[
	{
		"content": "resolved all discussions",
		"id": 177934270,
		"action": "discussion",
		"merge_request_id": 8797630,
		"created_at": "2026-07-01T00:10:02+08:00",
		"updated_at": "2026-07-01T00:10:02+08:00",
		"discussion_id": "16d6c1ab551818dd9e758137be483d79161a7f41",
		"project": "tangxuanya/msmodelslim",
		"user": {
			"id": "695337496415d64a21d4d6c7",
			"name": "tangxuanya",
			"login": "tangxuanya",
			"iam_id": "OkHqxXUduQJpeUFmvagZMsIrlr99OSb6",
			"nick_name": "tangxuanya",
			"state": "active",
			"email": "cqyzdp1@163.com",
			"name_cn": "",
			"web_url": "https://gitcode.com/tangxuanya"
		},
		"action_type": "discussion"
	},
	{
		"content": "resolved all discussions",
		"id": 177932452,
		"action": "discussion",
		"merge_request_id": 8797630,
		"created_at": "2026-06-30T23:36:55+08:00",
		"updated_at": "2026-06-30T23:36:55+08:00",
		"discussion_id": "30aabb0213bc0ecf04ce0981008f43d5e3667cb5",
		"project": "tangxuanya/msmodelslim",
		"user": {
			"id": "695337496415d64a21d4d6c7",
			"name": "tangxuanya",
			"login": "tangxuanya",
			"iam_id": "OkHqxXUduQJpeUFmvagZMsIrlr99OSb6",
			"nick_name": "tangxuanya",
			"state": "active",
			"email": "cqyzdp1@163.com",
			"name_cn": "",
			"web_url": "https://gitcode.com/tangxuanya"
		},
		"action_type": "discussion"
	},
	{
		"content": "resolved all discussions",
		"id": 177932425,
		"action": "discussion",
		"merge_request_id": 8797630,
		"created_at": "2026-06-30T23:36:39+08:00",
		"updated_at": "2026-06-30T23:36:39+08:00",
		"discussion_id": "ceac537ba6f3100a424b6d8fb36ef54703d3ca0b",
		"project": "tangxuanya/msmodelslim",
		"user": {
			"id": "695337496415d64a21d4d6c7",
			"name": "tangxuanya",
			"login": "tangxuanya",
			"iam_id": "OkHqxXUduQJpeUFmvagZMsIrlr99OSb6",
			"nick_name": "tangxuanya",
			"state": "active",
			"email": "cqyzdp1@163.com",
			"name_cn": "",
			"web_url": "https://gitcode.com/tangxuanya"
		},
		"action_type": "discussion"
	},
	{
		"content": "resolved all discussions",
		"id": 177930823,
		"action": "discussion",
		"merge_request_id": 8797630,
		"created_at": "2026-06-30T23:18:16+08:00",
		"updated_at": "2026-06-30T23:18:16+08:00",
		"discussion_id": "5a3a9e27474b1e55a84a0d98fd4f2df246cbf453",
		"project": "tangxuanya/msmodelslim",
		"user": {
			"id": "695337496415d64a21d4d6c7",
			"name": "tangxuanya",
			"login": "tangxuanya",
			"iam_id": "OkHqxXUduQJpeUFmvagZMsIrlr99OSb6",
			"nick_name": "tangxuanya",
			"state": "active",
			"email": "cqyzdp1@163.com",
			"name_cn": "",
			"web_url": "https://gitcode.com/tangxuanya"
		},
		"action_type": "discussion"
	},
	{
		"content": "resolved all discussions",
		"id": 177930821,
		"action": "discussion",
		"merge_request_id": 8797630,
		"created_at": "2026-06-30T23:18:12+08:00",
		"updated_at": "2026-06-30T23:18:12+08:00",
		"discussion_id": "ed96821a19853a3d05a96c5f8cb2da75bf5025c9",
		"project": "tangxuanya/msmodelslim",
		"user": {
			"id": "695337496415d64a21d4d6c7",
			"name": "tangxuanya",
			"login": "tangxuanya",
			"iam_id": "OkHqxXUduQJpeUFmvagZMsIrlr99OSb6",
			"nick_name": "tangxuanya",
			"state": "active",
			"email": "cqyzdp1@163.com",
			"name_cn": "",
			"web_url": "https://gitcode.com/tangxuanya"
		},
		"action_type": "discussion"
	},
	{
		"content": "resolved all discussions",
		"id": 177930806,
		"action": "discussion",
		"merge_request_id": 8797630,
		"created_at": "2026-06-30T23:17:58+08:00",
		"updated_at": "2026-06-30T23:17:58+08:00",
		"discussion_id": "4b1d6abc4d555dea444f90ff3849cc81ce24bb87",
		"project": "tangxuanya/msmodelslim",
		"user": {
			"id": "695337496415d64a21d4d6c7",
			"name": "tangxuanya",
			"login": "tangxuanya",
			"iam_id": "OkHqxXUduQJpeUFmvagZMsIrlr99OSb6",
			"nick_name": "tangxuanya",
			"state": "active",
			"email": "cqyzdp1@163.com",
			"name_cn": "",
			"web_url": "https://gitcode.com/tangxuanya"
		},
		"action_type": "discussion"
	},
	{
		"content": "reopen from codehub",
		"id": 177881960,
		"action": "opened",
		"merge_request_id": 8797630,
		"created_at": "2026-06-30T18:53:40+08:00",
		"updated_at": "2026-06-30T18:53:40+08:00",
		"discussion_id": "ae7fcde668f2e9573cc89c64509139b5d20a3691",
		"project": "tangxuanya/msmodelslim",
		"user": {
			"id": "695337496415d64a21d4d6c7",
			"name": "tangxuanya",
			"login": "tangxuanya",
			"iam_id": "OkHqxXUduQJpeUFmvagZMsIrlr99OSb6",
			"nick_name": "tangxuanya",
			"state": "active",
			"email": "cqyzdp1@163.com",
			"name_cn": "",
			"web_url": "https://gitcode.com/tangxuanya"
		},
		"action_type": "opened"
	},
	{
		"content": "closed from codehub",
		"id": 177881954,
		"action": "closed",
		"merge_request_id": 8797630,
		"created_at": "2026-06-30T18:53:37+08:00",
		"updated_at": "2026-06-30T18:53:37+08:00",
		"discussion_id": "3b4676c4ff53b86fcfc12610f16cb854240077cf",
		"project": "tangxuanya/msmodelslim",
		"user": {
			"id": "695337496415d64a21d4d6c7",
			"name": "tangxuanya",
			"login": "tangxuanya",
			"iam_id": "OkHqxXUduQJpeUFmvagZMsIrlr99OSb6",
			"nick_name": "tangxuanya",
			"state": "active",
			"email": "cqyzdp1@163.com",
			"name_cn": "",
			"web_url": "https://gitcode.com/tangxuanya"
		},
		"action_type": "closed"
	},
	{
		"content": "add label bug",
		"id": 177783820,
		"action": "label",
		"merge_request_id": 8797630,
		"created_at": "2026-06-30T11:17:38+08:00",
		"updated_at": "2026-06-30T11:17:38+08:00",
		"discussion_id": "153a38bf7e22d83d8d5dff4ccc9891b972f92043",
		"project": "tangxuanya/msmodelslim",
		"user": {
			"id": "695337496415d64a21d4d6c7",
			"name": "tangxuanya",
			"login": "tangxuanya",
			"iam_id": "OkHqxXUduQJpeUFmvagZMsIrlr99OSb6",
			"nick_name": "tangxuanya",
			"state": "active",
			"email": "cqyzdp1@163.com",
			"name_cn": "",
			"web_url": "https://gitcode.com/tangxuanya"
		},
		"action_type": "label"
	},
	{
		"content": "changed title from **Docs/Minimax W8w8 Mxf8** to **[feature] Docs/Minimax W8w8 Mxf8**",
		"id": 177768935,
		"action": "title",
		"merge_request_id": 8797630,
		"created_at": "2026-06-30T10:30:10+08:00",
		"updated_at": "2026-06-30T10:30:10+08:00",
		"discussion_id": "4be9012fb297f50703a5e3af11004222bf9f5e4f",
		"project": "tangxuanya/msmodelslim",
		"user": {
			"id": "695337496415d64a21d4d6c7",
			"name": "tangxuanya",
			"login": "tangxuanya",
			"iam_id": "OkHqxXUduQJpeUFmvagZMsIrlr99OSb6",
			"nick_name": "tangxuanya",
			"state": "active",
			"email": "cqyzdp1@163.com",
			"name_cn": "",
			"web_url": "https://gitcode.com/tangxuanya"
		},
		"action_type": "title"
	},
	{
		"content": "unmarked as a **Work In Progress**",
		"id": 177767011,
		"action": "title",
		"merge_request_id": 8797630,
		"created_at": "2026-06-30T10:23:27+08:00",
		"updated_at": "2026-06-30T10:23:27+08:00",
		"discussion_id": "e1b7b732ae9bc761d7721134ca75de5fbb5f25a7",
		"project": "tangxuanya/msmodelslim",
		"user": {
			"id": "695337496415d64a21d4d6c7",
			"name": "tangxuanya",
			"login": "tangxuanya",
			"iam_id": "OkHqxXUduQJpeUFmvagZMsIrlr99OSb6",
			"nick_name": "tangxuanya",
			"state": "active",
			"email": "cqyzdp1@163.com",
			"name_cn": "",
			"web_url": "https://gitcode.com/tangxuanya"
		},
		"action_type": "title"
	},
	{
		"content": "reopen from codehub",
		"id": 177766957,
		"action": "opened",
		"merge_request_id": 8797630,
		"created_at": "2026-06-30T10:23:18+08:00",
		"updated_at": "2026-06-30T10:23:18+08:00",
		"discussion_id": "7e1085bee7351e4a80f069c15aeda231aa4a1a17",
		"project": "tangxuanya/msmodelslim",
		"user": {
			"id": "695337496415d64a21d4d6c7",
			"name": "tangxuanya",
			"login": "tangxuanya",
			"iam_id": "OkHqxXUduQJpeUFmvagZMsIrlr99OSb6",
			"nick_name": "tangxuanya",
			"state": "active",
			"email": "cqyzdp1@163.com",
			"name_cn": "",
			"web_url": "https://gitcode.com/tangxuanya"
		},
		"action_type": "opened"
	},
	{
		"content": "closed from codehub",
		"id": 177766922,
		"action": "closed",
		"merge_request_id": 8797630,
		"created_at": "2026-06-30T10:23:10+08:00",
		"updated_at": "2026-06-30T10:23:10+08:00",
		"discussion_id": "3584fe66fef7c19ac19574a024c3eaea6f5a06d8",
		"project": "tangxuanya/msmodelslim",
		"user": {
			"id": "695337496415d64a21d4d6c7",
			"name": "tangxuanya",
			"login": "tangxuanya",
			"iam_id": "OkHqxXUduQJpeUFmvagZMsIrlr99OSb6",
			"nick_name": "tangxuanya",
			"state": "active",
			"email": "cqyzdp1@163.com",
			"name_cn": "",
			"web_url": "https://gitcode.com/tangxuanya"
		},
		"action_type": "closed"
	},
	{
		"content": "changed the description",
		"id": 177765719,
		"action": "description",
		"merge_request_id": 8797630,
		"created_at": "2026-06-30T10:19:04+08:00",
		"updated_at": "2026-06-30T10:19:04+08:00",
		"discussion_id": "76e588c9cf49ba5703bd91e7272250e38f280dfd",
		"project": "tangxuanya/msmodelslim",
		"user": {
			"id": "695337496415d64a21d4d6c7",
			"name": "tangxuanya",
			"login": "tangxuanya",
			"iam_id": "OkHqxXUduQJpeUFmvagZMsIrlr99OSb6",
			"nick_name": "tangxuanya",
			"state": "active",
			"email": "cqyzdp1@163.com",
			"name_cn": "",
			"web_url": "https://gitcode.com/tangxuanya"
		},
		"action_type": "description"
	}
]
```