# Get a issue API

## API Description

This API allows users to get a issue details info.

## Endpoints

```
GET https://api.gitcode.com/api/v5/repos/:owner/:repo/issues/:number
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
  --url 'https://api.gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/issues/309?access_token=xxxxxxxxxxxxxxxx'
```

## Example Response

```json
{
	"id": 4098043,
	"html_url": "https://gitcode.com/Ascend/msmodelslim/issues/309",
	"number": "309",
	"state": "open",
	"title": "[Bug] 量化Qwen3.6-w8a8有告警，模型架构不匹配，大量的“UNEXPECTED”。",
	"body": "\n\n## 👉 遇到问题先看这里\n### 🌟 第一次使用工具遇到问题？\n按[🚀 快速入门](https://gitcode.com/Ascend/msmodelslim/docs/zh/quantization_quick_start.md)\n\n### ❓ 搜索历史issue，查看冷门的同类问题\n在[🔖 Issue](https://gitcode.com/Ascend/msmodelslim/issues)中搜索历史类似问题\n\n### 操作系统及版本\n            \nopenEuler 24.03 (LTS-SP2)\n### python版本\n            \n3.11\n### MsModelSlim 工具版本\n            \ncommit ed1e5d6d0c770c431e4e317b7a8f619f566f5c59\n### 是否必现\n            \n是\n### MsModelSlim 执行命令\n            \nmsmodelslim quant --model_path /llm/Qwen3.6-27B/ --save_path /llm_data2/Qwen3.6-27B-w8a8/ --device npu --model_type Qwen3.6-27B --quant_type w8a8 --trust_remote_code True\n### 预期行为\n            \n\n### 实际行为\n            \n```\n\n2026-06-16 03:23:24,415 - msmodelslim.model.qwen3_5_moe.model_adapter - INFO - Loading vision encoder and first text decoder layer...\nThe fast path is not available because one of the required library is not installed. Falling back to torch implementation. To install follow http\ns://github.com/fla-org/flash-linear-attention#installation and https://github.com/Dao-AILab/causal-conv1d                                        Loading weights: 100%|████████████████████████████████████| 350/350 [00:00<00:00, 1754.08it/s, Materializing param=model.visual.pos_embed.weight]\nQwen3_5ForConditionalGeneration LOAD REPORT from: /llm/Qwen3.6-27B\nKey                                                                  | Status     |  |                                                           ---------------------------------------------------------------------+------------+--+-\nmodel.language_model.layers.{1...63}.mlp.gate_proj.weight            | UNEXPECTED |  |\nmodel.language_model.layers.{1...62}.linear_attn.out_proj.weight     | UNEXPECTED |  |                                                           model.language_model.layers.{1...63}.mlp.up_proj.weight              | UNEXPECTED |  |\nmodel.language_model.layers.{1...63}.mlp.down_proj.weight            | UNEXPECTED |  |\nmodel.language_model.layers.{1...63}.post_attention_layernorm.weight | UNEXPECTED |  |\nmodel.language_model.layers.{1...62}.linear_attn.in_proj_qkv.weight  | UNEXPECTED |  |\nmodel.language_model.layers.{3...63}.self_attn.v_proj.weight         | UNEXPECTED |  |                                                           model.language_model.layers.{3...63}.self_attn.k_proj.weight         | UNEXPECTED |  |\nmodel.language_model.layers.{1...62}.linear_attn.A_log               | UNEXPECTED |  |\nmodel.language_model.layers.{1...63}.input_layernorm.weight          | UNEXPECTED |  |\nmodel.language_model.layers.{1...62}.linear_attn.conv1d.weight       | UNEXPECTED |  |\nmodel.language_model.layers.{1...62}.linear_attn.in_proj_a.weight    | UNEXPECTED |  |                                                           model.language_model.layers.{1...62}.linear_attn.in_proj_b.weight    | UNEXPECTED |  |\nmodel.language_model.layers.{1...62}.linear_attn.dt_bias             | UNEXPECTED |  |                                                           model.language_model.layers.{3...63}.self_attn.o_proj.weight         | UNEXPECTED |  |\nmodel.language_model.layers.{1...62}.linear_attn.in_proj_z.weight    | UNEXPECTED |  |\nmodel.language_model.layers.{1...62}.linear_attn.norm.weight         | UNEXPECTED |  |\nmodel.language_model.layers.{3...63}.self_attn.k_norm.weight         | UNEXPECTED |  |\nmodel.language_model.layers.{3...63}.self_attn.q_norm.weight         | UNEXPECTED |  |\nmodel.language_model.layers.{3...63}.self_attn.q_proj.weight         | UNEXPECTED |  |\n\nNotes:\n- UNEXPECTED    :can be ignored when loading from different task/architecture; not ok if you expect identical arch.\n2026-06-16 03:23:24,838 - msmodelslim.model.qwen3_5_moe.model_adapter - INFO - Set model.config.num_attention_heads = 24\n2026-06-16 03:23:24,838 - msmodelslim.model.qwen3_5_moe.model_adapter - INFO - Set model.config.num_key_value_heads = 4\n2026-06-16 03:23:24,839 - msmodelslim.model.qwen3_5_moe.model_adapter - INFO - Model initialized with 64 layers (1 loaded, others will be loaded\non-demand)\n\n```\n\n\n欢迎加入社区，感谢您对社区的贡献 🎉!\n\n",
	"user": {
		"avatar_url": "https://cdn-img.gitcode.com/df/bd/d7292709fb572156d5dab9f4095ae06be4fe54328d3d28d4d3c6e238f8ff5aae.png",
		"html_url": "https://gitcode.com/maojianwei2012",
		"id": "67cd45d09101805e751d93a5",
		"object_id": "67cd45d09101805e751d93a5",
		"login": "maojianwei2012",
		"name": "Jianwei Mao"
	},
	"assignee": {
		"html_url": "https://gitcode.com/yejiajun",
		"id": "6822c9b2398335026946a660",
		"object_id": "6822c9b2398335026946a660",
		"login": "yejiajun",
		"name": "yejj"
	},
	"assignees": [
		{
			"html_url": "https://gitcode.com/yejiajun",
			"id": "6822c9b2398335026946a660",
			"object_id": "6822c9b2398335026946a660",
			"login": "yejiajun",
			"name": "yejj"
		}
	],
	"repository": {
		"id": 8444818,
		"full_name": "Ascend/msmodelslim",
		"path": "msmodelslim",
		"name": "MindStudio-ModelSlim",
		"description": "MindStudio-ModelSlim（msModelSlim）是MindStudio全流程工具链推出的模型量化压缩工具。",
		"created_at": "2025-11-21T16:47:14+08:00",
		"updated_at": "2025-12-30T19:10:29+08:00",
		"assigner": {},
		"paas": ""
	},
	"created_at": "2026-06-16T11:29:27+08:00",
	"updated_at": "2026-06-24T16:09:03+08:00",
	"finished_at": "",
	"labels": [
		{
			"id": 22791,
			"name": "triaged",
			"color": "#2865E0",
			"created_at": "2025-12-18T15:19:13+08:00",
			"updated_at": "2026-06-16T11:29:29+08:00"
		},
		{
			"id": 1503,
			"name": "bug",
			"color": "#f00f0f",
			"created_at": "2025-05-19T21:43:45+08:00",
			"updated_at": "2026-06-16T11:29:29+08:00"
		},
		{
			"id": 22789,
			"name": "resolved",
			"color": "#51e029",
			"created_at": "2025-12-18T15:16:02+08:00",
			"updated_at": "2026-06-24T16:09:04+08:00"
		}
	],
	"issue_state": "TODO",
	"comments": 3,
	"priority": 0,
	"issue_type": "Bug-Report",
	"issue_state_detail": {
		"title": "TODO",
		"serial": 0,
		"id": 264
	},
	"issue_type_detail": {
		"title": "Bug-Report",
		"id": 238,
		"is_system": false
	},
	"issue_priority_detail": {
		"title": "无优先级",
		"id": 111
	},
	"milestone": {
		"created_at": "2026-03-26T18:30:14+08:00",
		"description": "",
		"due_on": "2026-07-15",
		"number": 253899,
		"repository_id": 8444818,
		"state": "active",
		"title": "MindStudio 26.1.0",
		"updated_at": "2026-03-26T18:30:14+08:00",
		"url": "https://gitcode.com/Ascend/msmodelslim/milestones/4"
	},
	"visibility_reason": "public"
}
```
