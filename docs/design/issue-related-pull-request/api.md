# Get a issue related pull request list

## API Description

This API allows users to get a issue related pull request list info.

## Endpoints

```
GET https://api.gitcode.com/api/v5/repos/:owner/:repo/issues/:number/pull_requests
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
  --url 'https://api.gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/issues/304/pull_requests?access_token=xxxxxxxxxxxxxxxx'
```

## Example Response

```json
[
	{
		"id": 8781288,
		"html_url": "https://gitcode.com/Ascend/msmodelslim/merge_requests/613",
		"diff_url": "https://gitcode.com/Ascend/msmodelslim/merge_requests/613/diffs",
		"number": 613,
		"state": "closed",
		"title": "[Bugfix] Fix the error in qwen2.5-vl w4a8 v0",
		"body": "# PR 提交说明\n\n提交前请阅读 [CONTRIBUTING.md](https://gitcode.com/Ascend/msmodelslim/blob/master/docs/zh/contributing/contributing_guide.md)，开发者文档：[模型接入指南](https://msmodelslim.readthedocs.io/zh-cn/latest/zh/development_guide/integrating_models)\n\nPR 标题前缀：[Feature]、[Bugfix]、[Doc]、[Test]（与 CONTRIBUTING 一致）\n\n## 1. 影响面评估\n\n**接口变更（按需）：** 无\n\n> 备注：若无变更请保留「无」；涉及 CLI、API、YAML 等请在此项补充说明。\n\n**输出件变更（按需）：** 无\n\n> 备注：若无变更请保留「无」；涉及导出格式、产物路径等请在此项补充说明。\n\n**非兼容变更（按需）：** 无\n\n> 备注：若无变更请保留「无」；若有非兼容变更请说明迁移方式。\n\n**SIG 评审结论（按需）：** 无\n\n> 提醒：非兼容、安全风险等高危 PR 须经 SIG 评审后合入；无则保留「无」。\n\n## 2. 修改描述\n\n**修改背景（可选）：**\n解决issue：https://gitcode.com/Ascend/msmodelslim/issues/304\n问题现象是v0 qwen2.5-vl w4a8量化报错\n问题根因是权重bf16和scale fp32在量化时算子校验类型不匹配报错\n\n**修改目的：**\n消除报错\n\n**修改内容：**（按「概念 - 变化」分条，示例：core/算法：新增 SmoothQuant 离群值抑制）\n\n1.判断是w4a8场景\n2.在quant之前将权重转换成fp32，规避此报错\n\n**概念域参考（填写提示）：**\n\n- cli：命令行 quant / analyze / tune\n- app：最佳实践量化、量化分析、精度反馈自动调优等\n- core：算法、量化服务、调度、张量量化、调优策略、最佳实践、上下文等\n- infra：模型适配、调优计划/历史/缓存、测评服务等\n- utils：日志、错误处理、插件等\n\n## 3. 功能验证\n\n以验证新、老版本量化，均无报错\n\n- [x] 功能自验\n- [x] 本地自验用例截图（请勿包含个人信息；可附复现命令）\n\n**复现步骤（可选）：**\n\n```bash\npython quant_qwen2_5vl.py --model_path Qwen2.5-VL-7B-Instruct --save_directory Qwen2.5-VL-7B-Instruct_quant_w4a8 --calib_images qwen2vl_coco_pic/ --w_bit 4 --a_bit 8 --act_method 1 --device_type npu --trust_remote_code True --anti_method m4 --open_outlier False --is_dynamic True --is_lowbit True --group_size 256\n```\n\n## 4. 自检（请逐项确认，不适用标 N/A）\n\n**典型安全编码问题**\n\n- [x] 是否已校验外部数据\n- [x] 是否未采集或打印敏感信息\n- [x] 是否已正确设置文件权限\n- [x] 是否充分考虑浮点运算溢出、除零等异常场景\n- [x] 是否已对正则表达式做 ReDos 检查\n\n**DT**\n\n- [x] 是否具备 UT 测试用例看护（路径：用例路径；未添加请说明原因）\n- [x] 是否需要添加冒烟：否（若「是」请说明冒烟场景及对应用途）\n",
		"created_at": "2026-06-25T10:57:50.120+08:00",
		"updated_at": "2026-06-25T12:28:29.160+08:00",
		"closed_at": "2026-06-25T12:28:28.906+08:00",
		"head": {
			"ref": "qwen2_5vl_v0",
			"sha": "a9510a5a17b46b631c24686166704c36477c46c9",
			"repo": {
				"path": "msmodelslim",
				"name": "MindStudio-ModelSlim",
				"full_name": "caishengcheng/msmodelslim"
			},
			"assigner": {
				"login": "caishengcheng",
				"name": "caishengcheng"
			}
		},
		"base": {
			"ref": "master",
			"sha": "8942246ff7b5de5d91e7f30e9b05bd85c4afb96c",
			"repo": {
				"path": "msmodelslim",
				"name": "MindStudio-ModelSlim",
				"full_name": "Ascend/msmodelslim"
			}
		},
		"assignees": [],
		"testers": [],
		"labels": [
			{
				"id": 1591,
				"color": "#e0293b",
				"name": "ascend-cla/no",
				"created_at": "2025-05-20T14:43:49+08:00",
				"updated_at": "2026-06-25T10:57:57+08:00"
			},
			{
				"id": 4168,
				"color": "#DB2828",
				"name": "ci-pipeline-failed",
				"created_at": "2025-06-13T14:55:03+08:00",
				"updated_at": "2026-06-25T11:02:58+08:00"
			},
			{
				"id": 23600,
				"color": "#35e029",
				"name": "docs-ci-pipeline-success",
				"created_at": "2025-12-25T16:43:40+08:00",
				"updated_at": "2026-06-25T11:30:39+08:00"
			}
		],
		"can_merge_check": false
	},
	{
		"id": 8781564,
		"html_url": "https://gitcode.com/Ascend/msmodelslim/merge_requests/615",
		"diff_url": "https://gitcode.com/Ascend/msmodelslim/merge_requests/615/diffs",
		"number": 615,
		"state": "open",
		"title": "[Bugfix] Fix the error in qwen2.5-vl w4a8 v0",
		"body": "# PR 提交说明\n\n提交前请阅读 [CONTRIBUTING.md](https://gitcode.com/Ascend/msmodelslim/blob/master/docs/zh/contributing/contributing_guide.md)，开发者文档：[模型接入指南](https://msmodelslim.readthedocs.io/zh-cn/latest/zh/development_guide/integrating_models)\n\nPR 标题前缀：[Feature]、[Bugfix]、[Doc]、[Test]（与 CONTRIBUTING 一致）\n\n## 1. 影响面评估\n\n**接口变更（按需）：** 无\n\n> 备注：若无变更请保留「无」；涉及 CLI、API、YAML 等请在此项补充说明。\n\n**输出件变更（按需）：** 无\n\n> 备注：若无变更请保留「无」；涉及导出格式、产物路径等请在此项补充说明。\n\n**非兼容变更（按需）：** 无\n\n> 备注：若无变更请保留「无」；若有非兼容变更请说明迁移方式。\n\n**SIG 评审结论（按需）：** 无\n\n> 提醒：非兼容、安全风险等高危 PR 须经 SIG 评审后合入；无则保留「无」。\n\n## 2. 修改描述\n\n**修改背景（可选）：**\n解决issue：https://gitcode.com/Ascend/msmodelslim/issues/304\n问题现象是v0 qwen2.5-vl w4a8量化报错\n问题根因是权重bf16和scale fp32在量化时算子校验类型不匹配报错\n\n**修改目的：**\n消除报错\n\n**修改内容：**（按「概念 - 变化」分条，示例：core/算法：新增 SmoothQuant 离群值抑制）\n\n1.判断是w4a8场景\n2.在quant之前将权重转换成fp32，规避此报错\n\n**概念域参考（填写提示）：**\n\n- cli：命令行 quant / analyze / tune\n- app：最佳实践量化、量化分析、精度反馈自动调优等\n- core：算法、量化服务、调度、张量量化、调优策略、最佳实践、上下文等\n- infra：模型适配、调优计划/历史/缓存、测评服务等\n- utils：日志、错误处理、插件等\n\n## 3. 功能验证\n\n以验证新、老版本量化，均无报错\n\n- [x] 功能自验\n- [x] 本地自验用例截图（请勿包含个人信息；可附复现命令）\n\n**复现步骤（可选）：**\n\n```bash\npython quant_qwen2_5vl.py --model_path Qwen2.5-VL-7B-Instruct --save_directory Qwen2.5-VL-7B-Instruct_quant_w4a8 --calib_images qwen2vl_coco_pic/ --w_bit 4 --a_bit 8 --act_method 1 --device_type npu --trust_remote_code True --anti_method m4 --open_outlier False --is_dynamic True --is_lowbit True --group_size 256\n```\n\n## 4. 自检（请逐项确认，不适用标 N/A）\n\n**典型安全编码问题**\n\n- [x] 是否已校验外部数据\n- [x] 是否未采集或打印敏感信息\n- [x] 是否已正确设置文件权限\n- [x] 是否充分考虑浮点运算溢出、除零等异常场景\n- [x] 是否已对正则表达式做 ReDos 检查\n\n**DT**\n\n- [x] 是否具备 UT 测试用例看护（路径：用例路径；未添加请说明原因）\n- [x] 是否需要添加冒烟：否（若「是」请说明冒烟场景及对应用途）\n",
		"created_at": "2026-06-25T11:28:14.504+08:00",
		"updated_at": "2026-06-25T12:03:40.945+08:00",
		"head": {
			"ref": "qwen25vl_v0",
			"sha": "5fadc9e7afb0d8e5e28507f5e2e68dca3e7fbf1c",
			"repo": {
				"path": "msmodelslim",
				"name": "MindStudio-ModelSlim",
				"full_name": "caishengcheng/msmodelslim"
			},
			"assigner": {
				"login": "caishengcheng",
				"name": "caishengcheng"
			}
		},
		"base": {
			"ref": "master",
			"sha": "8942246ff7b5de5d91e7f30e9b05bd85c4afb96c",
			"repo": {
				"path": "msmodelslim",
				"name": "MindStudio-ModelSlim",
				"full_name": "Ascend/msmodelslim"
			}
		},
		"assignees": [],
		"testers": [],
		"labels": [
			{
				"id": 1468,
				"color": "#29e047",
				"name": "ascend-cla/yes",
				"created_at": "2025-05-19T16:05:15+08:00",
				"updated_at": "2026-06-25T11:28:21+08:00"
			},
			{
				"id": 23600,
				"color": "#35e029",
				"name": "docs-ci-pipeline-success",
				"created_at": "2025-12-25T16:43:40+08:00",
				"updated_at": "2026-06-25T11:30:39+08:00"
			},
			{
				"id": 4169,
				"color": "#20c22e",
				"name": "ci-pipeline-passed",
				"created_at": "2025-06-13T14:55:03+08:00",
				"updated_at": "2026-06-25T11:56:59+08:00"
			}
		],
		"can_merge_check": false
	}
]
```