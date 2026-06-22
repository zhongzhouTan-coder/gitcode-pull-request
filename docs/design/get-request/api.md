# List Pull Requests API

## API Description

This API allows users to get a pull request details info.

## Endpoints

```
GET https://api.gitcode.com/api/v5/repos/:owner/:repo/pulls/:pull_number
```

## Path Variables
- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: 	Repository Path(path).
- `pull_number`: Pull Request Number.

## Query Parameters
- `access_token`: (Required) The access token for authentication.

## Example Request

```bash
curl --request GET \
  --url 'https://api.gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/pulls/557?access_token=xxxxxxxxxxxxxxxx'
```

## Example Response

```json
{
	"id": 8728417,
	"html_url": "https://gitcode.com/Ascend/MindStudio-ModelSlim/merge_requests/557",
	"number": 557,
	"state": "open",
	"title": "[Feature]权重转换int4-->bf16",
	"url": "https://api.gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/pulls/557",
	"issue_url": "https://api.gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/pulls/557/issues",
	"body": "# PR 提交说明\n\n提交前请阅读 [CONTRIBUTING.md](https://gitcode.com/Ascend/msmodelslim/blob/master/docs/zh/appendix/CONTRIBUTING.md)，开发者文档：[模型接入指南](https://msmodelslim.readthedocs.io/zh-cn/latest/zh/developer_guide/integrating_models/)\n\nPR 标题前缀：[Feature]\n\n## 1. 影响面评估\n\n**接口变更（按需）：** 无\n\n\n**输出件变更（按需）：** 无\n\n\n**非兼容变更（按需）：** 无\n\n\n**SIG 评审结论（按需）：** 无\n\n\n## 2. 修改描述\n\n**修改背景（可选）：**\n权重转换功能支持int4 to bf16\n**修改目的：**\n权重转换功能支持int4 to bf16\n\n**修改内容：**\n将原始int4_packed权重转化为bf16,以某一层为例，其转化前后以及具体转化方法如下所示\n- 转化前\nup_proj.weight_packed  int32      [2048, 896]\nup_proj.weight_scale   bfloat16   [2048, 224]\nup_proj.weight_shape   int32      [2]，内容是 [2048, 7168]\n- 转化后\nup_proj.weight         bfloat16   [2048, 7168]\n- 具体转化方法\nint4 pack 每个int32中有8个int4, `896*8=7168`, 每个`1*32`有个bfloat16的scale   7168/32=224\n\n\n## 3. 功能验证\n\n冒烟由 CI 门禁检查，无需填写「冒烟是否通过」。\n\n- [x] 功能自验\n- [x] 本地自验用例截图（请勿包含个人信息；可附复现命令）\n![image.png](https://raw.gitcode.com/user-images/assets/8444818/fae711ad-866c-47ce-b46f-6a123b7aba83/image.png 'image.png')\n![image.png](https://raw.gitcode.com/user-images/assets/8444818/56ddd49c-cf1f-4625-9670-04940e63b0f7/image.png 'image.png')\n**复现步骤（可选）：**\n\n```bash\nmsmodelslim quant --model_path /mnt/share/xxx/weights/Kimi-K2.5 --save_path /mnt/share/ljj/delete/ --config_path /root/msmodelslim/docs/zh/feature_guide/quick_quantization_v1/convert/kimi_k2_5_int4_per_group_to_bf16.yaml\n```\n\n## 4. 自检（请逐项确认，不适用标 N/A）\n\n**典型安全编码问题**\n\n- [ ] 是否已校验外部数据 N/A \n- [ ] 是否未采集或打印敏感信息 N/A\n- [ ] 是否已正确设置文件权限 N/A\n- [ ] 是否充分考虑浮点运算溢出、除零等异常场景 N/A\n- [ ] 是否已对正则表达式做 ReDos 检查 N/A\n\n**DT**\n\n- [x] 是否具备 UT 测试用例看护\n- [ ] 是否需要添加冒烟：否\n",
	"assignees_number": 0,
	"assignees": [],
	"testers": [],
	"approval_reviewers": [],
	"labels": [
		{
			"id": 1594,
			"color": "#2865E0",
			"name": "stat/needs-squash",
			"repository_id": 8444818,
			"created_at": "2025-05-20T15:07:40+08:00",
			"updated_at": "2026-06-12T09:02:41+08:00"
		},
		{
			"id": 1468,
			"color": "#29e047",
			"name": "ascend-cla/yes",
			"repository_id": 8444818,
			"created_at": "2025-05-19T16:05:15+08:00",
			"updated_at": "2026-06-12T09:02:42+08:00"
		},
		{
			"id": 23600,
			"color": "#35e029",
			"name": "docs-ci-pipeline-success",
			"repository_id": 8444818,
			"created_at": "2025-12-25T16:43:40+08:00",
			"updated_at": "2026-06-15T11:38:48+08:00"
		},
		{
			"id": 4169,
			"color": "#20c22e",
			"name": "ci-pipeline-passed",
			"repository_id": 8444818,
			"created_at": "2025-06-13T14:55:03+08:00",
			"updated_at": "2026-06-15T12:05:23+08:00"
		}
	],
	"created_at": "2026-06-12T09:02:35+08:00",
	"updated_at": "2026-06-15T15:15:06+08:00",
	"closed_at": "",
	"merged_at": "",
	"draft": false,
	"can_merge_check": false,
	"prune_branch": false,
	"mergeable": true,
	"user": {
		"id": "684fd9c15e91be1053d96202",
		"login": "wenba0",
		"name": "wenba0",
		"avatar_url": "",
		"html_url": "https://gitcode.com/wenba0"
	},
	"head": {
		"ref": "convert_new1",
		"sha": "bb88a154a6a86b39a85744258c9be21ac90e183c",
		"label": "convert_new1",
		"repo": {
			"path": "msmodelslim",
			"name": "MindStudio-ModelSlim",
			"namespace": {
				"path": "wenba0"
			},
			"full_name": "wenba0/msmodelslim",
			"html_url": "https://gitcode.com/wenba0/msmodelslim.git"
		},
		"user": {
			"id": "684fd9c15e91be1053d96202",
			"login": "wenba0",
			"name": "wenba0",
			"avatar_url": "",
			"html_url": "https://gitcode.com/wenba0"
		}
	},
	"base": {
		"ref": "master",
		"sha": "314077943fee0b6aa0a8ef04d8e579c1977314e7",
		"label": "master",
		"repo": {
			"path": "msmodelslim",
			"name": "MindStudio-ModelSlim",
			"namespace": {
				"path": "Ascend"
			},
			"full_name": "Ascend/msmodelslim",
			"html_url": "https://gitcode.com/Ascend/msmodelslim.git"
		}
	},
	"mergeable_state": {
		"merge_request_id": 8728417,
		"state": false,
		"status_without_user_auth": true,
		"conflict_passed": true,
		"branch_missing_passed": true,
		"non_ff_passed": true,
		"mr_state_passed": true,
		"merged_by_user_passed": false,
		"work_in_progress_passed": true,
		"resolve_discussion_passed": true,
		"ci_state_passed": true,
		"merge_by_self_passed": true,
		"can_force_merge": false,
		"approval_reviewers_required_passed": true,
		"approval_approvers_required_passed": true,
		"approval_testers_required_passed": true,
		"merge_request_switch": {
			"review_mode": "approval",
			"merge_method": "merge",
			"only_allow_merge_if_all_discussions_are_resolved": true,
			"disable_merge_by_self": true,
			"only_allow_merge_if_pipeline_succeeds": false,
			"disable_squash_merge": false,
			"squash_merge_with_no_merge_commit": true,
			"approval_required_reviewers_count": 0,
			"approval_required_reviewers_branch": "*",
			"add_notes_after_merged": true,
			"mark_auto_merged_mr_as_closed": false,
			"can_force_merge": false,
			"can_reopen": true
		},
		"reason": {
			"merged_by_user_passed": "You are in project members list, but do not have PUSH permission, please check it."
		},
		"check_tasks_num": 0,
		"all_depend_merge_request_merged_passed": true,
		"approval_approvers_result": 2,
		"approval_testers_result": 2
	},
	"visibility_reason": "public",
	"close_related_issue": false
}
```