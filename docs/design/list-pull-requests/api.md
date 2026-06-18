# List Pull Requests API

## API Description

This API allows users to list pull requests for a specific repository.

## Endpoints

```
GET https://api.gitcode.com/api/v5/repos/:owner/:repo/pulls
```

## Path Variables
- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: 	Repository Path(path).

## Query Parameters
- `access_token`: (Required) The access token for authentication.
- `page`: (Optional) Current Page Number，default:1, default:1.
- `per_page`: (Optional) Items Per Page, Maximum 100,default:20,default:20.

## Example Request

```bash
curl --request GET \
  --url 'https://api.gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/pulls?access_token=xxxxxxxxxxxxxxxx'
```

## Example Response

```json
[
	{
		"number": 567,
		"html_url": "https://gitcode.com/Ascend/msmodelslim/merge_requests/567",
		"url": "https://gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/pulls/567",
		"close_related_issue": 0,
		"prune_branch": true,
		"draft": false,
		"labels": [
			{
				"id": 1468,
				"color": "#29e047",
				"name": "ascend-cla/yes",
				"title": "ascend-cla/yes",
				"repository_id": 8444818,
				"created_at": "2025-05-19T16:05:15+08:00",
				"updated_at": "2026-06-15T19:49:33+08:00"
			},
			{
				"id": 23600,
				"color": "#35e029",
				"name": "docs-ci-pipeline-success",
				"title": "docs-ci-pipeline-success",
				"repository_id": 8444818,
				"created_at": "2025-12-25T16:43:40+08:00",
				"updated_at": "2026-06-15T19:52:00+08:00"
			}
		],
		"user": {
			"id": "6888399edea8931fab65569e",
			"user_id": "6594516",
			"object_id": "6888399edea8931fab65569e",
			"login": "code_mingming",
			"name": "code_mingming",
			"state": "active",
			"email": "",
			"name_cn": "",
			"html_url": "https://gitcode.com/code_mingming"
		},
		"assignees": [],
		"testers": [],
		"head": {
			"label": "master-utguide",
			"ref": "master-utguide",
			"sha": "1cc96e0b0dad9521b8f37332bb35df5df5dd4053",
			"user": {
				"id": "6888399edea8931fab65569e",
				"object_id": "6888399edea8931fab65569e",
				"login": "code_mingming",
				"name": "code_mingming",
				"state": "active",
				"email": "limingyu35@h-partners.com",
				"name_cn": "",
				"html_url": "https://gitcode.com/code_mingming"
			},
			"repo": {
				"id": 8743542,
				"full_path": "code_mingming/msmodelslim",
				"full_name": "code_mingming/msmodelslim",
				"human_name": "code_mingming / MindStudio-ModelSlim",
				"name": "MindStudio-ModelSlim",
				"path": "msmodelslim",
				"description": "MindStudio-ModelSlim（msModelSlim）是MindStudio全流程工具链推出的模型量化压缩工具。",
				"owner": {
					"id": "6888399edea8931fab65569e",
					"object_id": "6888399edea8931fab65569e",
					"login": "code_mingming",
					"name": "code_mingming",
					"state": "active",
					"email": "limingyu35@h-partners.com",
					"name_cn": "",
					"html_url": "https://gitcode.com/code_mingming"
				},
				"assigner": {
					"id": "6888399edea8931fab65569e",
					"object_id": "6888399edea8931fab65569e",
					"login": "code_mingming",
					"name": "code_mingming",
					"state": "active",
					"email": "limingyu35@h-partners.com",
					"name_cn": "",
					"html_url": "https://gitcode.com/code_mingming"
				},
				"internal": false,
				"html_url": "https://gitcode.com/code_mingming/msmodelslim.git"
			}
		},
		"base": {
			"label": "master",
			"ref": "master",
			"sha": "69bf78510bafbd238d7507b1fe084fec31ec34ec",
			"user": {
				"id": "680e157b4e445c0df960c4c4",
				"object_id": "680e157b4e445c0df960c4c4",
				"login": "ascend-robot",
				"name": "ascend-robot",
				"state": "active",
				"avatar_url": "https://cdn-img.gitcode.com/ad/ec/4a22097de2cd8cd630c843b4fb17bd85bc7dd082a7e3a0e7089c373e836a3524.png?time=1753510752944",
				"email": "zhongyuanke@huawei.com",
				"name_cn": "",
				"html_url": "https://gitcode.com/ascend-robot"
			},
			"repo": {
				"id": 8444818,
				"full_path": "Ascend/msmodelslim",
				"full_name": "Ascend/msmodelslim",
				"human_name": "Ascend / MindStudio-ModelSlim",
				"name": "MindStudio-ModelSlim",
				"path": "msmodelslim",
				"description": "MindStudio-ModelSlim（msModelSlim）是MindStudio全流程工具链推出的模型量化压缩工具。",
				"owner": {
					"id": "680e157b4e445c0df960c4c4",
					"object_id": "680e157b4e445c0df960c4c4",
					"login": "ascend-robot",
					"name": "ascend-robot",
					"state": "active",
					"avatar_url": "https://cdn-img.gitcode.com/ad/ec/4a22097de2cd8cd630c843b4fb17bd85bc7dd082a7e3a0e7089c373e836a3524.png?time=1753510752944",
					"email": "zhongyuanke@huawei.com",
					"name_cn": "",
					"html_url": "https://gitcode.com/ascend-robot"
				},
				"assigner": {
					"id": "680e157b4e445c0df960c4c4",
					"object_id": "680e157b4e445c0df960c4c4",
					"login": "ascend-robot",
					"name": "ascend-robot",
					"state": "active",
					"avatar_url": "https://cdn-img.gitcode.com/ad/ec/4a22097de2cd8cd630c843b4fb17bd85bc7dd082a7e3a0e7089c373e836a3524.png?time=1753510752944",
					"email": "zhongyuanke@huawei.com",
					"name_cn": "",
					"html_url": "https://gitcode.com/ascend-robot"
				},
				"internal": false,
				"html_url": "https://gitcode.com/Ascend/msmodelslim.git"
			}
		},
		"id": 8742018,
		"iid": 567,
		"project_id": 8444818,
		"title": "[Doc] 增加开发者测试指南“单元测试编写”章节",
		"body": "# PR 提交说明\n\n## 1. 影响面评估\n\n**接口变更（按需）：** 无\n\n**输出件变更（按需）：** 无\n\n**非兼容变更（按需）：** 无\n\n**SIG 评审结论（按需）：** 无\n\n## 2. 修改描述\n\n**修改背景（可选）：**（问题现象、使用场景等）\n\n**修改目的：**（本 PR 要达成什么目标）\n增加开发者测试指南“单元测试编写”章节\n\n**修改内容：**（按「概念 - 变化」分条，示例：core/算法：新增 SmoothQuant 离群值抑制）\n\n增加开发者测试指南“单元测试编写”章节，指导如何编写测试用例及测试用例规范。\n\n## 3. 功能验证\n\n冒烟由 CI 门禁检查，无需填写「冒烟是否通过」。\n\n- [ ] 功能自验\n- [ ] 本地自验用例截图（请勿包含个人信息；可附复现命令）\n\n**复现步骤（可选）：**\n\n```bash\n# 在此粘贴可复现命令\n```\n\n## 4. 自检（请逐项确认，不适用标 N/A）\n\n**典型安全编码问题**\n\n- [x] 是否已校验外部数据N/A\n- [x] 是否未采集或打印敏感信息N/A\n- [x] 是否已正确设置文件权限N/A\n- [x] 是否充分考虑浮点运算溢出、除零等异常场景N/A\n- [x] 是否已对正则表达式做 ReDos 检查N/A\n\n**DT**\n\n- [ ] 是否具备 UT 测试用例看护 N/A\n- [ ] 是否需要添加冒烟：否\n",
		"state": "open",
		"assignees_number": 0,
		"testers_number": 0,
		"created_at": "2026-06-15T19:49:26+08:00",
		"updated_at": "2026-06-15T19:52:00+08:00",
		"merged_at": "",
		"closed_at": "",
		"target_branch": "master",
		"source_branch": "master-utguide",
		"source_project_id": 8743542,
		"force_remove_source_branch": true,
		"web_url": "https://gitcode.com/Ascend/msmodelslim/merge_requests/567",
		"merge_request_type": "MergeRequest",
		"added_lines": 131,
		"removed_lines": 2,
		"diff_refs": {
			"base_sha": "314077943fee0b6aa0a8ef04d8e579c1977314e7",
			"head_sha": "1cc96e0b0dad9521b8f37332bb35df5df5dd4053",
			"start_sha": "69bf78510bafbd238d7507b1fe084fec31ec34ec"
		},
		"notes": 4,
		"source_git_url": "git@gitcode.com:code_mingming/msmodelslim.git",
		"can_merge_check": false,
		"mergeable": true,
		"locked": false,
		"visibility_reason": "public"
	}
]
```