# Get all comments of a issue API

## API Description

This API allows users to get all comments of a specific issue.
## Endpoints

```
GET https://api.gitcode.com/api/v5/repos/:owner/:repo/issues/:number/comments
```

## Path Variables
- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: 	Repository Path(path).
- `number`: Issue Number.

## Query Parameters
- `access_token`: (Required) The access token for authentication.

## Example Request

```bash
curl --request GET \
  --url 'https://api.gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/issues/309/comments?access_token=xxxxxxxxxxxxxxxx'
```

## Example Response

```json
[
	{
		"id": 176916694,
		"body": "/label add resolved",
		"user": {
			"html_url": "https://gitcode.com/yejiajun",
			"id": "6822c9b2398335026946a660",
			"object_id": "6822c9b2398335026946a660",
			"login": "yejiajun",
			"name": "yejj"
		},
		"target": {
			"issue": {
				"id": 4098043,
				"title": "",
				"number": 309
			}
		},
		"created_at": "2026-06-24T16:09:03+08:00",
		"updated_at": "2026-06-24T16:09:03+08:00"
	},
	{
		"id": 176194985,
		"body": "这里的日志在逐层量化场景都会有类似的日志，并不是报错。  transformers5.0.0之后都会有类似现象",
		"user": {
			"html_url": "https://gitcode.com/yejiajun",
			"id": "6822c9b2398335026946a660",
			"object_id": "6822c9b2398335026946a660",
			"login": "yejiajun",
			"name": "yejj"
		},
		"target": {
			"issue": {
				"id": 4098043,
				"title": "",
				"number": 309
			}
		},
		"created_at": "2026-06-18T09:52:04+08:00",
		"updated_at": "2026-06-18T09:52:04+08:00"
	},
	{
		"id": 175866237,
		"body": "👋 您好,欢迎向 **MindStudio msModelSlim** 提交 Issue！\n我们已收到您的反馈，感谢你对开源社区的支持。🎉\n\n📅**处理时效**： 维护团队将在**24小时内** 查看并回复您的问题（工作日）。\n🔍**自助查询**： 在等待期间，建议您先查阅以下资料，可能已有解决方案：\n\n📖 [MindStudio msModelSlim 官方文档](https://msmodelslim.readthedocs.io/zh-cn/latest/)\n📝 [贡献者指南](https://gitcode.com/Ascend/msmodelslim)\n\n请确保 Issue 描述清晰，包含复现步骤和日志，这将帮助我们更快定位问题。谢谢！",
		"user": {
			"html_url": "https://gitcode.com/anreywmh",
			"id": "6839c471b5d4fc36d75fa0b2",
			"object_id": "6839c471b5d4fc36d75fa0b2",
			"login": "anreywmh",
			"name": "anreywmh"
		},
		"target": {
			"issue": {
				"id": 4098043,
				"title": "",
				"number": 309
			}
		},
		"created_at": "2026-06-16T11:29:28+08:00",
		"updated_at": "2026-06-16T11:29:28+08:00"
	}
]
```