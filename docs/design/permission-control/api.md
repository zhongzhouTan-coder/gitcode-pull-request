# Check the permission points of the current member repository API

## API Description

This API allows you to check the permission points of the current member repository. You can use this API to determine whether a user has the necessary permissions to perform certain actions on a repository.

## Endpoints

```
GET https://api.gitcode.com/api/v5/repos/:owner/:repo/collaborators/self-permission
```

## Path Variables
- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: 	Repository Path(path).

## Query Parameters
- `access_token`: (Required) The access token for authentication.

## Example Request

```bash
curl --request GET \
  --url https://api.gitcode.com/api/v5/repos/tangxuanya/ai_test/collaborators/self-permission \
  --header 'Authorization: Bearer xxxxxxxxxxxxxxxxxxx'
```

## Example Response

```json
{
	"role_info": {
		"role_uuid": "45a9-276d8e546f1b05f9f98ce1ffdc6",
		"name": "Owner",
		"cn_name": "管理员",
		"roles_type": 1,
		"access_level": 50
	},
	"resource_trees": [
		{
			"resource_id": 2,
			"name": "repo",
			"cn_name": "项目",
			"scope": "repo",
			"actions": [
				{
					"permission_id": 5,
					"action": "fork",
					"name": "fork",
					"cn_name": "fork",
					"selected": true
				},
				{
					"permission_id": 6,
					"action": "update",
					"name": "update",
					"cn_name": "更新",
					"selected": true
				},
				{
					"permission_id": 7,
					"action": "delete",
					"name": "delete",
					"cn_name": "删除",
					"selected": true
				},
				{
					"permission_id": 8,
					"action": "setting",
					"name": "setting",
					"cn_name": "设置",
					"selected": true
				},
				{
					"permission_id": 9,
					"action": "archive",
					"name": "archive",
					"cn_name": "归档",
					"selected": true
				},
				{
					"permission_id": 10,
					"action": "transfer",
					"name": "transfer",
					"cn_name": "转移",
					"selected": true
				}
			]
		},
		{
			"resource_id": 4,
			"name": "code",
			"cn_name": "代码",
			"scope": "code",
			"actions": [
				{
					"permission_id": 14,
					"action": "push",
					"name": "push",
					"cn_name": "推送",
					"selected": true
				},
				{
					"permission_id": 15,
					"action": "download",
					"name": "download",
					"cn_name": "下载",
					"selected": true
				}
			]
		},
		{
			"resource_id": 14,
			"name": "wiki",
			"cn_name": "Wiki",
			"scope": "wiki",
			"actions": [
				{
					"permission_id": 48,
					"action": "push",
					"name": "push",
					"cn_name": "推送",
					"selected": true
				},
				{
					"permission_id": 49,
					"action": "download",
					"name": "download",
					"cn_name": "下载",
					"selected": true
				}
			]
		},
		{
			"resource_id": 5,
			"name": "member",
			"cn_name": "成员",
			"scope": "member",
			"actions": [
				{
					"permission_id": 16,
					"action": "create",
					"name": "create",
					"cn_name": "邀请",
					"selected": true
				},
				{
					"permission_id": 17,
					"action": "update",
					"name": "update",
					"cn_name": "更新",
					"selected": true
				},
				{
					"permission_id": 18,
					"action": "delete",
					"name": "delete",
					"cn_name": "移除",
					"selected": true
				}
			]
		},
		{
			"resource_id": 6,
			"name": "issue",
			"cn_name": "Issue",
			"scope": "issue",
			"actions": [
				{
					"permission_id": 19,
					"action": "create",
					"name": "create",
					"cn_name": "创建",
					"selected": true
				},
				{
					"permission_id": 20,
					"action": "update",
					"name": "update",
					"cn_name": "更新",
					"selected": true
				},
				{
					"permission_id": 22,
					"action": "reopen",
					"name": "reopen",
					"cn_name": "关闭/重开",
					"selected": true
				},
				{
					"permission_id": 23,
					"action": "pin",
					"name": "pin",
					"cn_name": "置顶",
					"selected": true
				},
				{
					"permission_id": 24,
					"action": "lock",
					"name": "lock",
					"cn_name": "锁定",
					"selected": true
				},
				{
					"permission_id": 11,
					"action": "delete",
					"name": "delete",
					"cn_name": "删除",
					"selected": true
				},
				{
					"permission_id": 50,
					"action": "transfer",
					"name": "transfer",
					"cn_name": "转移",
					"selected": true
				}
			]
		},
		{
			"resource_id": 7,
			"name": "label",
			"cn_name": "Label",
			"scope": "label",
			"actions": [
				{
					"permission_id": 25,
					"action": "create",
					"name": "create",
					"cn_name": "创建",
					"selected": true
				},
				{
					"permission_id": 26,
					"action": "update",
					"name": "update",
					"cn_name": "更新",
					"selected": true
				},
				{
					"permission_id": 27,
					"action": "delete",
					"name": "delete",
					"cn_name": "删除",
					"selected": true
				}
			]
		},
		{
			"resource_id": 8,
			"name": "milestone",
			"cn_name": "里程碑",
			"scope": "milestone",
			"actions": [
				{
					"permission_id": 28,
					"action": "create",
					"name": "create",
					"cn_name": "创建",
					"selected": true
				},
				{
					"permission_id": 29,
					"action": "update",
					"name": "update",
					"cn_name": "更新",
					"selected": true
				},
				{
					"permission_id": 30,
					"action": "delete",
					"name": "delete",
					"cn_name": "删除",
					"selected": true
				}
			]
		},
		{
			"resource_id": 9,
			"name": "branch",
			"cn_name": "分支",
			"scope": "branch",
			"actions": [
				{
					"permission_id": 31,
					"action": "create",
					"name": "create",
					"cn_name": "创建",
					"selected": true
				},
				{
					"permission_id": 32,
					"action": "delete",
					"name": "delete",
					"cn_name": "删除",
					"selected": true
				}
			]
		},
		{
			"resource_id": 10,
			"name": "tag",
			"cn_name": "Tag",
			"scope": "tag",
			"actions": [
				{
					"permission_id": 33,
					"action": "create",
					"name": "create",
					"cn_name": "创建",
					"selected": true
				},
				{
					"permission_id": 34,
					"action": "delete",
					"name": "delete",
					"cn_name": "删除",
					"selected": true
				}
			]
		},
		{
			"resource_id": 12,
			"name": "pr",
			"cn_name": "PullRequest",
			"scope": "pr",
			"actions": [
				{
					"permission_id": 38,
					"action": "create",
					"name": "create",
					"cn_name": "创建",
					"selected": true
				},
				{
					"permission_id": 39,
					"action": "update",
					"name": "update",
					"cn_name": "更新",
					"selected": true
				},
				{
					"permission_id": 40,
					"action": "review",
					"name": "review",
					"cn_name": "评审",
					"selected": true
				},
				{
					"permission_id": 41,
					"action": "approve",
					"name": "approve",
					"cn_name": "审查",
					"selected": true
				},
				{
					"permission_id": 42,
					"action": "merge",
					"name": "merge",
					"cn_name": "合并",
					"selected": true
				},
				{
					"permission_id": 43,
					"action": "close",
					"name": "close",
					"cn_name": "关闭",
					"selected": true
				},
				{
					"permission_id": 44,
					"action": "reopen",
					"name": "reopen",
					"cn_name": "重开",
					"selected": true
				},
				{
					"permission_id": 47,
					"action": "test",
					"name": "test",
					"cn_name": "测试",
					"selected": true
				}
			]
		},
		{
			"resource_id": 13,
			"name": "note",
			"cn_name": "评论",
			"scope": "note",
			"actions": [
				{
					"permission_id": 45,
					"action": "create",
					"name": "create",
					"cn_name": "创建",
					"selected": true
				},
				{
					"permission_id": 46,
					"action": "resolve",
					"name": "resolve",
					"cn_name": "解决",
					"selected": true
				}
			]
		},
		{
			"resource_id": 0,
			"name": "pipeline",
			"cn_name": "流水线",
			"scope": "pipeline",
			"path": "/gitcode/repo/pipeline/*",
			"is_own": 1,
			"order_num": 10,
			"actions": [
				{
					"permission_id": 0,
					"action": "create",
					"name": "create",
					"cn_name": "创建",
					"selected": true
				},
				{
					"permission_id": 0,
					"action": "update",
					"name": "update",
					"cn_name": "更新",
					"selected": true
				},
				{
					"permission_id": 0,
					"action": "delete",
					"name": "delete",
					"cn_name": "删除（构建记录）",
					"selected": true
				},
				{
					"permission_id": 0,
					"action": "run",
					"name": "run",
					"cn_name": "运行",
					"selected": true
				},
				{
					"permission_id": 0,
					"action": "rerun",
					"name": "rerun",
					"cn_name": "重新运行",
					"selected": true
				}
			]
		},
		{
			"resource_id": 0,
			"name": "discussion",
			"cn_name": "讨论",
			"scope": "discussion",
			"path": "/gitcode/repo/discussion/*",
			"is_own": 1,
			"order_num": 15,
			"actions": [
				{
					"permission_id": 0,
					"action": "create",
					"name": "create",
					"cn_name": "创建",
					"selected": true
				},
				{
					"permission_id": 0,
					"action": "update",
					"name": "update",
					"cn_name": "更新",
					"selected": true
				},
				{
					"permission_id": 0,
					"action": "lock",
					"name": "lock",
					"cn_name": "锁定",
					"selected": true
				},
				{
					"permission_id": 0,
					"action": "pin",
					"name": "pin",
					"cn_name": "置顶",
					"selected": true
				},
				{
					"permission_id": 0,
					"action": "close",
					"name": "close",
					"cn_name": "关闭/重开",
					"selected": true
				},
				{
					"permission_id": 0,
					"action": "delete",
					"name": "delete",
					"cn_name": "删除",
					"selected": true
				}
			]
		},
		{
			"resource_id": 0,
			"name": "kanban",
			"cn_name": "看板",
			"scope": "kanban",
			"path": "/gitcode/repo/kanban/*",
			"is_own": 1,
			"order_num": 16,
			"actions": [
				{
					"permission_id": 0,
					"action": "create",
					"name": "create",
					"cn_name": "创建",
					"selected": true
				},
				{
					"permission_id": 0,
					"action": "update",
					"name": "update",
					"cn_name": "更新",
					"selected": true
				},
				{
					"permission_id": 0,
					"action": "delete",
					"name": "delete",
					"cn_name": "删除",
					"selected": true
				},
				{
					"permission_id": 0,
					"action": "close",
					"name": "close",
					"cn_name": "关闭/重开",
					"selected": true
				}
			]
		},
		{
			"resource_id": 0,
			"name": "collection",
			"cn_name": "合集",
			"scope": "collection",
			"path": "/gitcode/repo/collection/*",
			"is_own": 1,
			"order_num": 18,
			"actions": [
				{
					"permission_id": 0,
					"action": "create",
					"name": "create",
					"cn_name": "创建",
					"selected": true
				},
				{
					"permission_id": 0,
					"action": "update",
					"name": "update",
					"cn_name": "更新",
					"selected": true
				},
				{
					"permission_id": 0,
					"action": "delete",
					"name": "delete",
					"cn_name": "删除",
					"selected": true
				}
			]
		}
	]
}
```