# List issues API

## API Description

This API allows users to list the issues in a repository.

## Endpoints

```
GET https://api.gitcode.com/api/v5/repos/:owner/:repo/issues
```

## Path Variables
- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: 	Repository Path(path).

## Query Parameters
- `access_token`: (Required) The access token for authentication.
- `state`: (Optional) Issue state: open, closed, or all. Default is all.
- `labels`: (Optional) A list of comma-separated label names. Example: `bug,enhancement`.
- `sort`: (Optional) Sorting criterion: creation time (created), update time (updated). Default: created
- `direction`: (Optional) Sort order: asc for ascending, desc for descending. Default: desc
- `per_page`: (Optional) The number of issues to return per page. Default is 20. Maximum is 100.
- `page`: (Optional) The page number of the results to return. Default is 1.
- `assignee`: (Optional) Issue Assignee ID
- `creator`: (Optional) The username of the user who creates the Issues

## Example Request

```bash
curl --request GET \
  --url 'https://api.gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/issues?access_token=MRyxwJ9QE3JFr5P5x89oyNGo&state=open' 
```

## Example Response

```json
[
	{
		"id": 4113535,
		"html_url": "https://gitcode.com/Ascend/msmodelslim/issues/321",
		"number": "321",
		"state": "open",
		"title": "[Bug] 根据资料example操作执行Wan2.1-14B W8A8动态量化，在A5环境量化失败：RuntimeError: Current device only support aclnn operator, but current operator npu_layer_norm_eval do not have aclnn implementation",
		"body": "\n\n## 👉 遇到问题先看这里\n### 🌟 第一次使用工具遇到问题？\n按[🚀 快速入门](https://gitcode.com/Ascend/msmodelslim/blob/master/docs/zh/quick_start/quantization_quick_start.md)\n\n### ❓ 搜索历史issue，查看冷门的同类问题\n在[🔖 Issue](https://gitcode.com/Ascend/msmodelslim/issues)中搜索历史类似问题\n\n### 操作系统及版本\n            \nopenEuler 24.03 (LTS-SP4)\n### python版本\n            \n3.11\n### MsModelSlim 工具版本\n            \n ee8661a3d999715183da77c56420aaeb8d24c207\n### 是否必现\n            \n是\n### MsModelSlim 执行命令\n            \nmsmodelslim quant --device npu --model_path /mnt/weight/Wan2.1-T2V-14B --model_type Wan2_1 --quant_type w8a8 --save_path /home/autotest/AutoTestProperty/modelslim/llm_ptq/output/Wan2.1-T2V-14B_quant_wan21_t2v_14b_quant_type_w8a8 --trust_remote_code True\n### 预期行为\n            \n1、量化成功\n### 实际行为\n            \n1、量化报错：\n![image.png](https://raw.gitcode.com/user-images/assets/8444818/63a4248f-8cf7-45cd-9fde-c94560ccf3f1/image.png 'image.png')\nFile \"/home/miniconda3/envs/sd_ptq_py311_pt290/Lib/python3.11/site-packages/msmodelslim/core/quant_service/multimodal_sd_v1/quant_service.py\", Line 297, in _quant_process_legacy\ncalib data = load cached data for models(\nvvvvvvvvvvvvvvwvvvvvvvvvvvvv的\nFile \"/home/miniconda3/envs/sd_ptq_py311_pt290/Lib/python3.11/site-packages/msmodelslim/utils/exception_decorator.py\", Line 88, in __call_\nreturn self._func(*args, **kwargs)\nvvvvvvvvvvvvvwwwwwwwwvvvvvv\nFile \"/home/miniconda3/envs/sd_ptq_py311_pt290/Lib/python3.11/site-packages/msmodelslim/utils/cache/pth.py\", line 100, in load_cached_data_for_models\ngenerate func()\ndaddeuм uT '7t9 aut ' Adr6uT66O1/s1T4N/wT1s19powsw/sobexped-a1Ts/TT 2UOU1Ad/qT1/06ZAd TTSAd_bad-ps/SAU?/SepuooTuTW/awOy/。 a1TH\n(sбueмX** 'sbue*)oung uungad\naouadaguT_qTTeo_und uT '68T auT1 ' Ad uaqdepe Zapow/T~ZueM/1apow/wT1S73powsw/sabexped-aqTs/TT 2u0uqAd/qT7/06Z4d TT£Ad-bad-ps/SAUЭ/£epuooTuTw/awoy/, alTH\n= self.wan_t2v.generate(\nvvvvvvvvvvvwwvvvvvvvvv\naqeuаuаб ит '8/7 auth ' AdroapTлz4xaq/ueM/T ZueM/1dTuos/bad-W17/wT1SL8pow/Aquadoud4S8104NV/189101ne/awoy/。 aLTH\nnoise_pred_cond = self.model(\nvvvvvvvvvvv\nFile \"/home/miniconda3/envs/sd_ptq_py311_pt290/Lib/python3.11/site-packages/torch/nn/modules/module.py\", Line 1775, in _wrapped_call_impl\nreturn self. call_impl(*args, **kwargs)\nvvvvvvvvvvvwwwwwwwvvvvvvvvvvvvvv\nFile \"/home/miniconda3/envs/sd ptq_py311 pt290/Lib/python3.11/site-packages/torch/nn/modules/module.py\", Line 1786, in _call_impl\nreturn forward_call(*args, **kwargs)\nvvvvvvvvvvvvvwwvvvvvvvvvvvvvv\nFile \"/home/miniconda3/envs/sd_ptq_py311_pt290/Lib/python3.11/site-packages/msmodelslim/utils/cache/pth.py\", Line 173, in wrapper\n(SbJeMX**  SDJex)oung - 17nsaJ\nvvvvvvvvvvwwwvvvvvvvv\npJeMdoJ uT  ZZL auT7 ’,Ad 7apow/sa7npow/ueM/T ZueM/2dTJOS/b2d-w77/wT7578pow/AqJadoud1S81090V/1Sа404ne/awoy/. alT日\n× = block(x, **kwargs)\nvvvvvvvvwvvvvvvvvv\nldwT Tleo paddeuM~ uT 'SZZT auth ' Ad aznpow/salnpow/uu/Y0J01/sabexped-aqTs/TT £u0UpAd/qT7/06ZAd TT£Ad-bad-ps/SAUЭ/£epuooTuTw/awoy/, alTH\nreturn self._call impl(*args, **kwargs)\nvvvvvvvvvvvvvvwvwvwwwwwwvvvwvvvv\nFile \"/home/miniconda3/envs/sd_ptq_py311_pt290/Lib/python3.11/site-packages/torch/nn/modules/module.py\", Line 1786, in _call_impl\nreturn forward call(*args, **kwargs)\nvvvvvvvwvwvvvwwvvvvvvvvvvvvvv\npueмиoy uT 'so7 aut1 ' Ad 1apow/sa1npow/ueM/T ZueM/1dTuos/bad-w11/wT1s1apow/Aquadoud)S9101NY/1S9104Ne/aWOU/, aTTH\nself.norm1(x, 1 + e[1], e[0])\nvvvvvvvvwwwwwvvvvvvvvvvvvvv\nFile \"/home/miniconda3/envs/sd_ptq_py311_pt290/Lib/python3.11/site-packages/torch/nn/modules/module.py\", Line 1775, in _wrapped_call_impl\nreturn self._call impl(*args, **kwargs)\nFile \"/home/miniconda3/envs/sd_ptq_py311_pt290/Lib/python3.11/site-packages/torch/nn/modules/module.py\", Line 1786, in _call_impl\nreturn forward_call(*args, **kwargs)\nvvvvvvvvvvvvvvvvvvvvvvvvvvvvv\npueмJog uT 'szt auth ' Ad Tapow/salnpow/ueM/T ZueM/1dTuos/bad w17/wT7S7Αpow/AqJadoud4S8104NW/4saqoqne/awoy/. aLTH\nreturn torch_npu.npu_layer norm_eval(\nvvvvvvvvvvvyvvvwvvvvvvvvvvvvvv\nFile \"/home/miniconda3/envs/sd pta py311 pt290/Lib/python3.11/site-packages/torch/ ops.py” Line 1255. in  call\n(sbueмx** 'sbuex)do  Jlos uungad\nvvvvvvwwwwwwwvvvvwvwvwwvv\nRuntimeError: Current device only support aclnn operator, but current operator npu_layer_norm_eval do not have aclnn implementation\npaquoddns qou aunqeag WId Z0000883 (T-:OIXuey 19:30TAa0 187£6/8£:0Id) 97:/T:2T-07-90-9707 [80883]\n\n\n\n设置以下环境变量的话可以正常量化成功：\nexport ENABLE_LAYERNORM_SCALE_SHIFT=1\nexport ENABLE_FUSED_VAE_RMSNORM=1\nexport ENABLE_FAST_LAYERNORM=1\nexport ENABLE_FAST_GELU=1\nexport ENABLE_ROPE_BF16=1\n\n但是推理仓和量化资料均未提到需要设置这些环境变量，需要确认是否必须开启，如果必须开启需要资料增加说明\n\n\n欢迎加入社区，感谢您对社区的贡献 🎉!\n\n",
		"user": {
			"html_url": "https://gitcode.com/mominhua",
			"id": "681c79b1c644db757fcc1b97",
			"object_id": "681c79b1c644db757fcc1b97",
			"login": "mominhua",
			"name": "不甜"
		},
		"assignee": {
			"avatar_url": "https://cdn-img.gitcode.com/ae/bf/6ae718b547fb7947c59af28da62caf624a8e34acc52a8cd8574d0d0d5eb5dfec.png?time=1766480013909",
			"html_url": "https://gitcode.com/tanxiangyuu",
			"id": "6819af11fae9f95e8e53b032",
			"object_id": "6819af11fae9f95e8e53b032",
			"login": "tanxiangyuu",
			"name": "tanxiangyuu"
		},
		"assignees": [
			{
				"avatar_url": "https://cdn-img.gitcode.com/ae/bf/6ae718b547fb7947c59af28da62caf624a8e34acc52a8cd8574d0d0d5eb5dfec.png?time=1766480013909",
				"html_url": "https://gitcode.com/tanxiangyuu",
				"id": "6819af11fae9f95e8e53b032",
				"object_id": "6819af11fae9f95e8e53b032",
				"login": "tanxiangyuu",
				"name": "tanxiangyuu"
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
		"created_at": "2026-06-24T15:42:38+08:00",
		"updated_at": "2026-06-24T15:43:19+08:00",
		"finished_at": "",
		"labels": [
			{
				"id": 22791,
				"name": "triaged",
				"color": "#2865E0",
				"created_at": "2025-12-18T15:19:13+08:00",
				"updated_at": "2026-06-24T15:42:39+08:00"
			},
			{
				"id": 1503,
				"name": "bug",
				"color": "#f00f0f",
				"created_at": "2025-05-19T21:43:45+08:00",
				"updated_at": "2026-06-24T15:42:38+08:00"
			},
			{
				"id": 22793,
				"name": "high-priority",
				"color": "#e02929",
				"created_at": "2025-12-18T15:21:41+08:00",
				"updated_at": "2026-06-24T15:42:38+08:00"
			}
		],
		"issue_state": "TODO",
		"comments": 1,
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
	},
	{
		"id": 4112579,
		"html_url": "https://gitcode.com/Ascend/msmodelslim/issues/320",
		"number": "320",
		"state": "open",
		"title": "[Bug] [自提]新构建方案需求，脚本尚未支持运行测试",
		"body": "\n\n## 👉 遇到问题先看这里\n### 🌟 第一次使用工具遇到问题？\n按[🚀 快速入门](https://gitcode.com/Ascend/msmodelslim/blob/master/docs/zh/quick_start/quantization_quick_start.md)\n\n### ❓ 搜索历史issue，查看冷门的同类问题\n在[🔖 Issue](https://gitcode.com/Ascend/msmodelslim/issues)中搜索历史类似问题\n\n### 操作系统及版本\n            \nNA\n### python版本\n            \n3.11\n### MsModelSlim 工具版本\n            \nNA\n### 是否必现\n            \n是\n### MsModelSlim 执行命令\n            \npython build.py test\n### 预期行为\n            \n安装依赖并执行测试\n### 实际行为\n            \n尚未支持\n\n\n欢迎加入社区，感谢您对社区的贡献 🎉!\n\n",
		"user": {
			"html_url": "https://gitcode.com/code_mingming",
			"id": "6888399edea8931fab65569e",
			"object_id": "6888399edea8931fab65569e",
			"login": "code_mingming",
			"name": "code_mingming"
		},
		"assignee": {
			"html_url": "https://gitcode.com/code_mingming",
			"id": "6888399edea8931fab65569e",
			"object_id": "6888399edea8931fab65569e",
			"login": "code_mingming",
			"name": "code_mingming"
		},
		"assignees": [
			{
				"html_url": "https://gitcode.com/code_mingming",
				"id": "6888399edea8931fab65569e",
				"object_id": "6888399edea8931fab65569e",
				"login": "code_mingming",
				"name": "code_mingming"
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
		"created_at": "2026-06-24T10:22:25+08:00",
		"updated_at": "2026-06-24T10:23:08+08:00",
		"finished_at": "",
		"labels": [
			{
				"id": 41210,
				"name": "need-detail-desc",
				"color": "#e02978",
				"created_at": "2026-04-02T11:58:31+08:00",
				"updated_at": "2026-06-24T10:22:48+08:00"
			},
			{
				"id": 22791,
				"name": "triaged",
				"color": "#2865E0",
				"created_at": "2025-12-18T15:19:13+08:00",
				"updated_at": "2026-06-24T15:42:39+08:00"
			},
			{
				"id": 1503,
				"name": "bug",
				"color": "#f00f0f",
				"created_at": "2025-05-19T21:43:45+08:00",
				"updated_at": "2026-06-24T15:42:38+08:00"
			}
		],
		"issue_state": "TODO",
		"comments": 2,
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
	},
	{
		"id": 4112398,
		"html_url": "https://gitcode.com/Ascend/msmodelslim/issues/319",
		"number": "319",
		"state": "open",
		"title": "[Bug] py39环境：执行一键量化，报错match data:           ^ SyntaxError: invalid syntax",
		"body": "\n\n## 👉 遇到问题先看这里\n### 🌟 第一次使用工具遇到问题？\n按[🚀 快速入门](https://gitcode.com/Ascend/msmodelslim/blob/master/docs/zh/quick_start/quantization_quick_start.md)\n\n### ❓ 搜索历史issue，查看冷门的同类问题\n在[🔖 Issue](https://gitcode.com/Ascend/msmodelslim/issues)中搜索历史类似问题\n\n### 操作系统及版本\n            \nopeneuler24.03\n### python版本\n            \n其他\n### MsModelSlim 工具版本\n            \nmaster0624\n### 是否必现\n            \n是\n### MsModelSlim 执行命令\n            \nmsmodelslim quant --model_path /home/autotest/AutoTestProperty/modelslim/llm_ptq/model/Qwen3-32B --save_path /home/autotest/AutoTestProperty/modelslim/llm_ptq/output/Qwen3-32B_quant_qwen3_32b_w8a8_v1_match --device npu --model_type Qwen3-32B --config_path /home/autotest/AutoTestProperty/modelslim/llm_ptq/config/qwen3-32b-dense-w8a8-auto-v1.yaml --trust_remote_code True 2>&1 | tee /home/autotest/AutoTestProperty/modelslim/llm_ptq/output/Qwen3-32B_quant_qwen3_32b_w8a8_v1_match.log\n### 预期行为\n            \npy39环境：执行一键量化，预期执行成功\n### 实际行为\n            \n当前资料说明：\n![image.png](https://raw.gitcode.com/user-images/assets/8444818/60397e79-e38d-471d-a9ba-aa3ee36431e7/image.png 'image.png')\n在py_39执行后实际结果：\n```\nTraceback (most recent call last):\n  File \"/root/miniconda3/envs/py_39/bin/msmodelslim\", line 6, in <module>\n    sys.exit(main())\n  File \"/root/miniconda3/envs/py_39/lib/python3.9/site-packages/msmodelslim/cli/__main__.py\", line 234, in main\n    from msmodelslim.cli.naive_quantization.__main__ import main as quant_main\n  File \"/root/miniconda3/envs/py_39/lib/python3.9/site-packages/msmodelslim/cli/naive_quantization/__main__.py\", line 31, in <module>\n    from msmodelslim.infra.debug_info_persistence import DebugInfoPersistence\n  File \"/root/miniconda3/envs/py_39/lib/python3.9/site-packages/msmodelslim/infra/debug_info_persistence.py\", line 30, in <module>\n    from msmodelslim.core.quant_service.modelslim_v1.save.utils.json import JsonWriter\n  File \"/root/miniconda3/envs/py_39/lib/python3.9/site-packages/msmodelslim/core/quant_service/modelslim_v1/__init__.py\", line 29, in <module>\n    from .quant_config import ModelslimV1QuantConfig\n  File \"/root/miniconda3/envs/py_39/lib/python3.9/site-packages/msmodelslim/core/quant_service/modelslim_v1/quant_config.py\", line 27, in <module>\n    from msmodelslim.processor.base import AutoProcessorConfigList\n  File \"/root/miniconda3/envs/py_39/lib/python3.9/site-packages/msmodelslim/processor/__init__.py\", line 71, in <module>\n    from .anti_outlier import (\n  File \"/root/miniconda3/envs/py_39/lib/python3.9/site-packages/msmodelslim/processor/anti_outlier/__init__.py\", line 59, in <module>\n    from .awq import AWQProcessorConfig, AWQProcessor\n  File \"/root/miniconda3/envs/py_39/lib/python3.9/site-packages/msmodelslim/processor/anti_outlier/awq/__init__.py\", line 22, in <module>\n    from .processor import AWQProcessorConfig\n  File \"/root/miniconda3/envs/py_39/lib/python3.9/site-packages/msmodelslim/processor/anti_outlier/awq/processor.py\", line 35, in <module>\n    from .awq_stats_collector import AWQStatsCollector\n  File \"/root/miniconda3/envs/py_39/lib/python3.9/site-packages/msmodelslim/processor/anti_outlier/awq/awq_stats_collector.py\", line 30, in <module>\n    from msmodelslim.processor.anti_outlier.awq.common import get_global_awq_stats, offload\n  File \"/root/miniconda3/envs/py_39/lib/python3.9/site-packages/msmodelslim/processor/anti_outlier/awq/common.py\", line 72\n    match data:\n          ^\nSyntaxError: invalid syntax\n/root/miniconda3/envs/py_39/lib/python3.9/tempfile.py:830: ResourceWarning: Implicitly cleaning up <TemporaryDirectory '/tmp/tmpms1vxwdf'>\n  _warnings.warn(warn_message, ResourceWarning)\n[ERROR] 2026-06-23-19:38:13 (PID:1982680, Device:-1, RankID:-1) ERR99999 UNKNOWN applicaiton exception\n```\n\n\n欢迎加入社区，感谢您对社区的贡献 🎉!\n\n",
		"user": {
			"avatar_url": "https://cdn-img.gitcode.com/be/db/b1e4d986be8f623cd56f1df1cdc72d17cb64b2a3112ac7c2ccc20c511ef819f0.png?time=1776048654901",
			"html_url": "https://gitcode.com/yejingjing",
			"id": "68882984dea8931fab6548e8",
			"object_id": "68882984dea8931fab6548e8",
			"login": "yejingjing",
			"name": "yejingjing"
		},
		"assignee": {
			"html_url": "https://gitcode.com/LeeQT",
			"id": "685a1de9d8f0940af050632f",
			"object_id": "685a1de9d8f0940af050632f",
			"login": "LeeQT",
			"name": "LeeQT"
		},
		"assignees": [
			{
				"html_url": "https://gitcode.com/LeeQT",
				"id": "685a1de9d8f0940af050632f",
				"object_id": "685a1de9d8f0940af050632f",
				"login": "LeeQT",
				"name": "LeeQT"
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
		"created_at": "2026-06-24T09:30:00+08:00",
		"updated_at": "2026-06-25T09:17:17+08:00",
		"finished_at": "",
		"labels": [
			{
				"id": 22791,
				"name": "triaged",
				"color": "#2865E0",
				"created_at": "2025-12-18T15:19:13+08:00",
				"updated_at": "2026-06-24T15:42:39+08:00"
			},
			{
				"id": 1503,
				"name": "bug",
				"color": "#f00f0f",
				"created_at": "2025-05-19T21:43:45+08:00",
				"updated_at": "2026-06-24T15:42:38+08:00"
			},
			{
				"id": 22794,
				"name": "medium-priority",
				"color": "#e09d29",
				"created_at": "2025-12-18T15:21:58+08:00",
				"updated_at": "2026-06-24T09:30:00+08:00"
			}
		],
		"issue_state": "TODO",
		"comments": 1,
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
	},
	{
		"id": 4108304,
		"html_url": "https://gitcode.com/Ascend/msmodelslim/issues/317",
		"number": "317",
		"state": "open",
		"title": "[Bug] deepseek v4-flash 执行w8a8量化之后，进行hf2mcore格式，报错",
		"body": "\n\n## 👉 遇到问题先看这里\n### 🌟 第一次使用工具遇到问题？\n按[🚀 快速入门](https://gitcode.com/Ascend/msmodelslim/docs/zh/quantization_quick_start.md)\n\n### ❓ 搜索历史issue，查看冷门的同类问题\n在[🔖 Issue](https://gitcode.com/Ascend/msmodelslim/issues)中搜索历史类似问题\n\n### 操作系统及版本\n            \nopenEuler 24.03 (LTS-SP2)\"\n### python版本\n            \n3.11\n### MsModelSlim 工具版本\n            \ncommit 0844e66715835ea9dfcfa8ffff88fa5e03a46291\n### 是否必现\n            \n是\n### MsModelSlim 执行命令\n            \n  msmodelslim quant  --model_path ./model_from_hf/deepseek4-hf  --save_path ./model_from_hf/deepseek4-hf-bf16_w8a8  --model_type DeepSeek-V4-Flash  --quant_type w8a8  --trust_remote_code True\n### 预期行为\n            \n![image.png](https://raw.gitcode.com/user-images/assets/8444818/3ecb338b-6644-46e2-858c-9268eedf77d2/image.png 'image.png')![image.png](https://raw.gitcode.com/user-images/assets/8444818/17e872fd-834d-43e7-b9f3-62ad4afe02f7/image.png 'image.png')\n### 实际行为\n            \n![image.png](https://raw.gitcode.com/user-images/assets/8444818/3ecb338b-6644-46e2-858c-9268eedf77d2/image.png 'image.png')\n\n\n欢迎加入社区，感谢您对社区的贡献 🎉!\n\n",
		"user": {
			"avatar_url": "https://cdn-img.gitcode.com/ec/dd/996e3c0477dde19db01b28068f1d5e1ed1793bab381bc3869d1156de0cc903d1.png",
			"html_url": "https://gitcode.com/2601_95119870",
			"id": "697ab869cdc37d7649b50341",
			"object_id": "697ab869cdc37d7649b50341",
			"login": "2601_95119870",
			"name": "KADC_gitcode"
		},
		"assignee": {
			"html_url": "https://gitcode.com/zhangz200102",
			"id": "68b9853f52d11012db79ae5b",
			"object_id": "68b9853f52d11012db79ae5b",
			"login": "zhangz200102",
			"name": "zhangz200102"
		},
		"assignees": [
			{
				"html_url": "https://gitcode.com/zhangz200102",
				"id": "68b9853f52d11012db79ae5b",
				"object_id": "68b9853f52d11012db79ae5b",
				"login": "zhangz200102",
				"name": "zhangz200102"
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
		"created_at": "2026-06-22T15:55:55+08:00",
		"updated_at": "2026-06-24T16:03:13+08:00",
		"finished_at": "",
		"labels": [
			{
				"id": 1503,
				"name": "bug",
				"color": "#f00f0f",
				"created_at": "2025-05-19T21:43:45+08:00",
				"updated_at": "2026-06-24T15:42:38+08:00"
			},
			{
				"id": 22791,
				"name": "triaged",
				"color": "#2865E0",
				"created_at": "2025-12-18T15:19:13+08:00",
				"updated_at": "2026-06-24T15:42:39+08:00"
			},
			{
				"id": 22802,
				"name": "pending",
				"color": "#c2e029",
				"created_at": "2025-12-18T15:29:30+08:00",
				"updated_at": "2026-06-22T16:59:28+08:00"
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
	},
	{
		"id": 4108049,
		"html_url": "https://gitcode.com/Ascend/msmodelslim/issues/316",
		"number": "316",
		"state": "open",
		"title": "[Bug] Qwen-Image-Edit-2509 W4A4F4量化精度不达标",
		"body": "## 问题概述\n\nQwen-Image-Edit-2509 W4A4F4量化精度不达标\nFA算子精度问题\n\n\n## MsModelSlim 工具版本\n\ncommit ec6ad52b9c91439291f26429691648b4175d1798\n\n## 是否必现\n\n是\n\n## MsModelSlim 执行命令\n\nmsmodelslim quant --model_path /datadisk2/models_weight/Qwen-Image-Edit-2509 --save_path /home/c00647285/Qwen-image-test --device npu --model_type Qwen-Image-Edit-2509 --config_path /home/c00647285/msmodelslim_image/lab_practice/qwen_image_edit/qwen-image-edit-w4a4f4-mxfp.yaml --trust_remote_code True\n\n## 预期行为\n\n生成量化权重后，用Mindie-SD进行推理，输出结构后使用GEdit进行评测，精度达标\n\n## 实际行为\n\n精度不达标，FA算子存在精度问题\n",
		"user": {
			"html_url": "https://gitcode.com/caishengcheng",
			"id": "6822f3cfe4b985165b4b1ffb",
			"object_id": "6822f3cfe4b985165b4b1ffb",
			"login": "caishengcheng",
			"name": "caishengcheng"
		},
		"assignee": {
			"html_url": "https://gitcode.com/caishengcheng",
			"id": "6822f3cfe4b985165b4b1ffb",
			"object_id": "6822f3cfe4b985165b4b1ffb",
			"login": "caishengcheng",
			"name": "caishengcheng"
		},
		"assignees": [
			{
				"html_url": "https://gitcode.com/caishengcheng",
				"id": "6822f3cfe4b985165b4b1ffb",
				"object_id": "6822f3cfe4b985165b4b1ffb",
				"login": "caishengcheng",
				"name": "caishengcheng"
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
		"created_at": "2026-06-22T14:34:26+08:00",
		"updated_at": "2026-06-24T16:08:38+08:00",
		"finished_at": "",
		"labels": [
			{
				"id": 1503,
				"name": "bug",
				"color": "#f00f0f",
				"created_at": "2025-05-19T21:43:45+08:00",
				"updated_at": "2026-06-24T15:42:38+08:00"
			},
			{
				"id": 41210,
				"name": "need-detail-desc",
				"color": "#e02978",
				"created_at": "2026-04-02T11:58:31+08:00",
				"updated_at": "2026-06-24T10:22:48+08:00"
			},
			{
				"id": 22791,
				"name": "triaged",
				"color": "#2865E0",
				"created_at": "2025-12-18T15:19:13+08:00",
				"updated_at": "2026-06-24T15:42:39+08:00"
			}
		],
		"issue_state": "TODO",
		"comments": 2,
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
	},
	{
		"id": 4106591,
		"html_url": "https://gitcode.com/Ascend/msmodelslim/issues/315",
		"number": "315",
		"state": "open",
		"title": "[Feature]: 当前是否支持GLM5.2-w4a8量化？",
		"body": "### Problem/Pain Point Description | 问题/痛点描述\n            \n当前是否支持GLM5.2-w4a8量化？以方便搭配vllm-ascend在800IA2上使用\n### Proposed Solution | 建议方案\n            \nNone\n### Alternative Solutions | 替代方案\n            \n\n### Expected Value | 预期价值\n            \nNone\n### Contribution Intent | 贡献意向\n            \n- [ ] I am willing to participate in the development or testing of this feature | 我愿意参与此功能的开发或测试\n\n\nWelcome to join the community and thank you for your contribution 🎉!\n\n欢迎加入社区，感谢您对社区的贡献 🎉!\n\n",
		"user": {
			"avatar_url": "https://cdn-img.gitcode.com/fc/fc/249fc28fc36b94fcdb4815b86197120c99c60b02fe61eafdf71f908f86768151.jpg",
			"html_url": "https://gitcode.com/DT2131",
			"id": "6745257681efe24face7bee7",
			"object_id": "6745257681efe24face7bee7",
			"login": "DT2131",
			"name": "DT2131"
		},
		"assignees": [],
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
		"created_at": "2026-06-21T08:36:14+08:00",
		"updated_at": "2026-06-24T16:10:24+08:00",
		"finished_at": "",
		"labels": [
			{
				"id": 22791,
				"name": "triaged",
				"color": "#2865E0",
				"created_at": "2025-12-18T15:19:13+08:00",
				"updated_at": "2026-06-24T15:42:39+08:00"
			},
			{
				"id": 4180,
				"name": "feature",
				"color": "#B5CC18",
				"created_at": "2025-06-13T14:55:04+08:00",
				"updated_at": "2026-06-21T08:36:15+08:00"
			}
		],
		"issue_state": "TODO",
		"comments": 1,
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
			"created_at": "2026-06-19T01:26:05+08:00",
			"description": "",
			"number": 557105,
			"repository_id": 8444818,
			"state": "active",
			"title": "MindStudio 26.2.0",
			"updated_at": "2026-06-19T01:26:05+08:00",
			"url": "https://gitcode.com/Ascend/msmodelslim/milestones/5"
		},
		"visibility_reason": "public"
	},
	{
		"id": 4104827,
		"html_url": "https://gitcode.com/Ascend/msmodelslim/issues/314",
		"number": "314",
		"state": "open",
		"title": "[Feature]: 摸高调优策略全回退场景应当测评而不是默认达标",
		"body": "### Problem/Pain Point Description | 问题/痛点描述\n            \n当前自动调优由用户输入期望精度和容忍阈值，在摸高调优策略中，默认全回退即浮点精度达到用户预期精度，会跳过对应的测评，但该假设不一定成立，浮点精度可能也达不到用户输入的期望精度，后续的量化和调优均为无效迭代。\n### Proposed Solution | 建议方案\n            \n1、摸高调优策略二分阶段需对全回退进行评测，当全回退也无法达成精度标准时，报错中止，并提示用户预期精度无法达成，建议用户调整精度预期。\n2、允许用户不输入预期精度，摸高策略自行测评全回退精度作为浮点精度。\n### Alternative Solutions | 替代方案\n            \n\n### Expected Value | 预期价值\n            \n减少无效迭代，避免浪费用户时间。\n### Contribution Intent | 贡献意向\n            \n- [x] I am willing to participate in the development or testing of this feature | 我愿意参与此功能的开发或测试\n\n\nWelcome to join the community and thank you for your contribution 🎉!\n\n欢迎加入社区，感谢您对社区的贡献 🎉!\n\n",
		"user": {
			"html_url": "https://gitcode.com/joejoezhou",
			"id": "682314cd6a68fa1fec6cf718",
			"object_id": "682314cd6a68fa1fec6cf718",
			"login": "joejoezhou",
			"name": "joejoezhou"
		},
		"assignee": {
			"html_url": "https://gitcode.com/joejoezhou",
			"id": "682314cd6a68fa1fec6cf718",
			"object_id": "682314cd6a68fa1fec6cf718",
			"login": "joejoezhou",
			"name": "joejoezhou"
		},
		"assignees": [
			{
				"html_url": "https://gitcode.com/joejoezhou",
				"id": "682314cd6a68fa1fec6cf718",
				"object_id": "682314cd6a68fa1fec6cf718",
				"login": "joejoezhou",
				"name": "joejoezhou"
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
		"created_at": "2026-06-18T18:24:14+08:00",
		"updated_at": "2026-06-24T16:10:42+08:00",
		"finished_at": "",
		"labels": [
			{
				"id": 4180,
				"name": "feature",
				"color": "#B5CC18",
				"created_at": "2025-06-13T14:55:04+08:00",
				"updated_at": "2026-06-21T08:36:15+08:00"
			},
			{
				"id": 22791,
				"name": "triaged",
				"color": "#2865E0",
				"created_at": "2025-12-18T15:19:13+08:00",
				"updated_at": "2026-06-24T15:42:39+08:00"
			}
		],
		"issue_state": "TODO",
		"comments": 1,
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
			"created_at": "2026-06-19T01:26:05+08:00",
			"description": "",
			"number": 557105,
			"repository_id": 8444818,
			"state": "active",
			"title": "MindStudio 26.2.0",
			"updated_at": "2026-06-19T01:26:05+08:00",
			"url": "https://gitcode.com/Ascend/msmodelslim/milestones/5"
		},
		"visibility_reason": "public"
	},
	{
		"id": 4104123,
		"html_url": "https://gitcode.com/Ascend/msmodelslim/issues/312",
		"number": "312",
		"state": "open",
		"title": "[Bug] 【自提】DeepSeek-V4部分数据集尚未验证",
		"body": "\n\n## 👉 遇到问题先看这里\n### 🌟 第一次使用工具遇到问题？\n按[🚀 快速入门](https://gitcode.com/Ascend/msmodelslim/docs/zh/quantization_quick_start.md)\n\n### ❓ 搜索历史issue，查看冷门的同类问题\n在[🔖 Issue](https://gitcode.com/Ascend/msmodelslim/issues)中搜索历史类似问题\n\n### 操作系统及版本\n            \nNA\n### python版本\n            \n3.11\n### MsModelSlim 工具版本\n            \nNA\n### 是否必现\n            \n是\n### MsModelSlim 执行命令\n            \nNA\n### 预期行为\n            \n\n### 实际行为\n            \n当前 DeepSeek-V4-Flash W8A8/DeepSeek-V4-Pro W4A8量化尚未验证Terminal Bench 2 数据集\n\n\n欢迎加入社区，感谢您对社区的贡献 🎉!\n\n",
		"user": {
			"html_url": "https://gitcode.com/zhangz200102",
			"id": "68b9853f52d11012db79ae5b",
			"object_id": "68b9853f52d11012db79ae5b",
			"login": "zhangz200102",
			"name": "zhangz200102"
		},
		"assignee": {
			"html_url": "https://gitcode.com/zhangz200102",
			"id": "68b9853f52d11012db79ae5b",
			"object_id": "68b9853f52d11012db79ae5b",
			"login": "zhangz200102",
			"name": "zhangz200102"
		},
		"assignees": [
			{
				"html_url": "https://gitcode.com/zhangz200102",
				"id": "68b9853f52d11012db79ae5b",
				"object_id": "68b9853f52d11012db79ae5b",
				"login": "zhangz200102",
				"name": "zhangz200102"
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
		"created_at": "2026-06-18T15:20:55+08:00",
		"updated_at": "2026-06-25T11:36:23+08:00",
		"finished_at": "",
		"labels": [
			{
				"id": 22789,
				"name": "resolved",
				"color": "#51e029",
				"created_at": "2025-12-18T15:16:02+08:00",
				"updated_at": "2026-06-25T11:36:24+08:00"
			},
			{
				"id": 1503,
				"name": "bug",
				"color": "#f00f0f",
				"created_at": "2025-05-19T21:43:45+08:00",
				"updated_at": "2026-06-24T15:42:38+08:00"
			},
			{
				"id": 22791,
				"name": "triaged",
				"color": "#2865E0",
				"created_at": "2025-12-18T15:19:13+08:00",
				"updated_at": "2026-06-24T15:42:39+08:00"
			},
			{
				"id": 41210,
				"name": "need-detail-desc",
				"color": "#e02978",
				"created_at": "2026-04-02T11:58:31+08:00",
				"updated_at": "2026-06-24T10:22:48+08:00"
			}
		],
		"issue_state": "TODO",
		"comments": 4,
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
	},
	{
		"id": 4103689,
		"html_url": "https://gitcode.com/Ascend/msmodelslim/issues/310",
		"number": "310",
		"state": "open",
		"title": "[Bug] 量化精度自动调优使用迅捷回退，当第一个精度测试不达标时，跳过剩余数据集的精度测试，当前无任何日志提示，易用性较差，需要补充日志信息",
		"body": "\n\n## 👉 遇到问题先看这里\n### 🌟 第一次使用工具遇到问题？\n按[🚀 快速入门](https://gitcode.com/Ascend/msmodelslim/docs/zh/quantization_quick_start.md)\n\n### ❓ 搜索历史issue，查看冷门的同类问题\n在[🔖 Issue](https://gitcode.com/Ascend/msmodelslim/issues)中搜索历史类似问题\n\n### 操作系统及版本\n            \nopenEuler 24.03 (LTS-SP3)\n### python版本\n            \n3.11\n### MsModelSlim 工具版本\n            \n08422c18f0603b438fcf10c3dc3c5a11ecb2e102\n### 是否必现\n            \n是\n### MsModelSlim 执行命令\n            \nmsmodelslim tune     --model_path /home/autotest/AutoTestProperty/modelslim/llm_ptq/model/Qwen3-32B/     --save_path /home/tune_binary_fallback_result     --config /home/yaml/tune_binary_fallback.yaml     --model_type Qwen3-32B     --device npu:0,1,2,3\n### 预期行为\n            \n1、量化精度自动调优执行成功，当第一个数据集精度测试不达标时，跳过剩余的数据集评测，需要有日志提示。\n### 实际行为\n            \n1、量化精度自动调优执行成功，当第一个数据集精度测试不达标时，跳过剩余的数据集评测，当前无任何日志提示，易用性较差。\n![image.png](https://raw.gitcode.com/user-images/assets/8444818/afd303c7-4e1f-4e8d-9f20-1639ab618b86/image.png 'image.png')\n\n\n欢迎加入社区，感谢您对社区的贡献 🎉!\n\n",
		"user": {
			"html_url": "https://gitcode.com/mominhua",
			"id": "681c79b1c644db757fcc1b97",
			"object_id": "681c79b1c644db757fcc1b97",
			"login": "mominhua",
			"name": "不甜"
		},
		"assignee": {
			"avatar_url": "https://cdn-img.gitcode.com/ae/bf/6ae718b547fb7947c59af28da62caf624a8e34acc52a8cd8574d0d0d5eb5dfec.png?time=1766480013909",
			"html_url": "https://gitcode.com/tanxiangyuu",
			"id": "6819af11fae9f95e8e53b032",
			"object_id": "6819af11fae9f95e8e53b032",
			"login": "tanxiangyuu",
			"name": "tanxiangyuu"
		},
		"assignees": [
			{
				"avatar_url": "https://cdn-img.gitcode.com/ae/bf/6ae718b547fb7947c59af28da62caf624a8e34acc52a8cd8574d0d0d5eb5dfec.png?time=1766480013909",
				"html_url": "https://gitcode.com/tanxiangyuu",
				"id": "6819af11fae9f95e8e53b032",
				"object_id": "6819af11fae9f95e8e53b032",
				"login": "tanxiangyuu",
				"name": "tanxiangyuu"
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
		"created_at": "2026-06-18T11:43:20+08:00",
		"updated_at": "2026-06-18T11:43:20+08:00",
		"finished_at": "",
		"labels": [
			{
				"id": 1503,
				"name": "bug",
				"color": "#f00f0f",
				"created_at": "2025-05-19T21:43:45+08:00",
				"updated_at": "2026-06-24T15:42:38+08:00"
			},
			{
				"id": 22794,
				"name": "medium-priority",
				"color": "#e09d29",
				"created_at": "2025-12-18T15:21:58+08:00",
				"updated_at": "2026-06-24T09:30:00+08:00"
			},
			{
				"id": 22791,
				"name": "triaged",
				"color": "#2865E0",
				"created_at": "2025-12-18T15:19:13+08:00",
				"updated_at": "2026-06-24T15:42:39+08:00"
			}
		],
		"issue_state": "TODO",
		"comments": 1,
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
	},
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
				"updated_at": "2026-06-24T15:42:39+08:00"
			},
			{
				"id": 1503,
				"name": "bug",
				"color": "#f00f0f",
				"created_at": "2025-05-19T21:43:45+08:00",
				"updated_at": "2026-06-24T15:42:38+08:00"
			},
			{
				"id": 22789,
				"name": "resolved",
				"color": "#51e029",
				"created_at": "2025-12-18T15:16:02+08:00",
				"updated_at": "2026-06-25T11:36:24+08:00"
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
]
```