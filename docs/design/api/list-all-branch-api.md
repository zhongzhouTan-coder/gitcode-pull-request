# list all branches

## API Description

This API allows users to list all branches in a repository.

## Endpoints

```
GET https://api.gitcode.com/api/v5/repos/:owner/:repo/branches
```

## Path Variables

- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: 	Repository Path(path).

## Query Parameters

- `access_token`: (Required) The access token for authentication.
- `page`: (Optional) The page number to retrieve. Defaults to 1.
- `per_page`: (Optional) The number of branches to retrieve per page. Defaults to 20. Maximum is 100.

## Example Request

```bash
curl --request GET \
  --url 'https://api.gitcode.com/api/v5/repos/tangxuanya/ai_test/branches?access_token=xxxxxxxxxxxxxxxx'
```

## Example Response

```json
[
	{
		"name": "master",
		"commit": {
			"commit": {
				"author": {
					"name": "LeeQT",
					"date": "2026-06-27T18:21:11+08:00",
					"email": "liqitong@huawei.com"
				},
				"committer": {
					"name": "ascend-robot",
					"date": "2026-06-27T18:21:11+08:00",
					"email": "zhongyuanke@huawei.com"
				},
				"message": "【Doc】修复一些链接失效"
			},
			"sha": "9d8f50a31de27811f120806f78d6c1166b5278b7",
			"url": "https://gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/commits/9d8f50a31de27811f120806f78d6c1166b5278b7"
		},
		"default_branch": true,
		"protected": true
	},
	{
		"name": "br_release_MindStudio_8.2.RC1_TR5_20260923",
		"commit": {
			"commit": {
				"author": {
					"name": "ascend-robot",
					"date": "2025-11-21T16:47:15+08:00",
					"email": "zhongyuanke@huawei.com"
				},
				"committer": {
					"name": "ascend-robot",
					"date": "2025-11-21T16:47:15+08:00",
					"email": "zhongyuanke@huawei.com"
				},
				"message": "Initial commit"
			},
			"sha": "4a7d61a5ae207fdd18c7ae65889aa87f7081906f",
			"url": "https://gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/commits/4a7d61a5ae207fdd18c7ae65889aa87f7081906f"
		},
		"default_branch": false,
		"protected": true
	},
	{
		"name": "br_release_MindStudio_8.3.0_20261231",
		"commit": {
			"commit": {
				"author": {
					"name": "ascend-robot",
					"date": "2025-11-21T16:47:15+08:00",
					"email": "zhongyuanke@huawei.com"
				},
				"committer": {
					"name": "ascend-robot",
					"date": "2025-11-21T16:47:15+08:00",
					"email": "zhongyuanke@huawei.com"
				},
				"message": "Initial commit"
			},
			"sha": "4a7d61a5ae207fdd18c7ae65889aa87f7081906f",
			"url": "https://gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/commits/4a7d61a5ae207fdd18c7ae65889aa87f7081906f"
		},
		"default_branch": false,
		"protected": true
	},
	{
		"name": "26.1.0",
		"commit": {
			"commit": {
				"author": {
					"name": "qq_46439621",
					"date": "2026-06-27T16:57:49+08:00",
					"email": "wanlongze1@huawei.com"
				},
				"committer": {
					"name": "ascend-robot",
					"date": "2026-06-27T16:57:49+08:00",
					"email": "zhongyuanke@huawei.com"
				},
				"message": "[Bugfix] [26.1.0]补充GLM5.1对应的资料以及GLM5.1 W8A8、W4A8量化的最佳实践"
			},
			"sha": "2df35ac00c93a0c58b593e2ff2f435d2253f4fa2",
			"url": "https://gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/commits/2df35ac00c93a0c58b593e2ff2f435d2253f4fa2"
		},
		"default_branch": false,
		"protected": false
	},
	{
		"name": "26.0.0",
		"commit": {
			"commit": {
				"author": {
					"name": "sunny_infra",
					"date": "2026-06-18T15:48:13+08:00",
					"email": "sunyu138@huawei.com"
				},
				"committer": {
					"name": "ascend-robot",
					"date": "2026-06-18T15:48:13+08:00",
					"email": "zhongyuanke@huawei.com"
				},
				"message": "【docs】修复26.0.0的安装文档"
			},
			"sha": "539058d69bdcd1d69ecd284934885338e50c683a",
			"url": "https://gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/commits/539058d69bdcd1d69ecd284934885338e50c683a"
		},
		"default_branch": false,
		"protected": false
	},
	{
		"name": "br_float_quant_26.0.0_20270525",
		"commit": {
			"commit": {
				"author": {
					"name": "wangsihao",
					"date": "2026-06-12T18:01:45+08:00",
					"email": "wangsihao5@h-partners.com"
				},
				"committer": {
					"name": "joejoezhou",
					"date": "2026-06-12T18:01:45+08:00",
					"email": "zhourongchen1@huawei.com"
				},
				"message": "[Feature] 新增Deepseek和Qwen3部分模型量化配置文件"
			},
			"sha": "0ead82d1e2017329a39b043cda51e6813d6bc5b9",
			"url": "https://gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/commits/0ead82d1e2017329a39b043cda51e6813d6bc5b9"
		},
		"default_branch": false,
		"protected": false
	},
	{
		"name": "br_release_MindStudio_26.0.0_O1_20270430",
		"commit": {
			"commit": {
				"author": {
					"name": "libarry",
					"date": "2026-04-25T10:01:48+08:00",
					"email": "870390541@qq.com"
				},
				"committer": {
					"name": "ascend-robot",
					"date": "2026-04-25T10:01:48+08:00",
					"email": "zhongyuanke@huawei.com"
				},
				"message": "【bugfix】【双合】修复glm-5不开启quarot量化保存后处理报错问题"
			},
			"sha": "eced39c3702174a847a14c92606d3923f6ed0e06",
			"url": "https://gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/commits/eced39c3702174a847a14c92606d3923f6ed0e06"
		},
		"default_branch": false,
		"protected": false
	},
	{
		"name": "br_26.0.0_beta1",
		"commit": {
			"commit": {
				"author": {
					"name": "code_mingming",
					"date": "2026-02-27T17:36:57+08:00",
					"email": "limingyu35@h-partners.com"
				},
				"committer": {
					"name": "ascend-robot",
					"date": "2026-02-27T17:36:57+08:00",
					"email": "zhongyuanke@huawei.com"
				},
				"message": "【bugfix】修复qwen3_vl_moe缺失导入VlmCalibSample问题"
			},
			"sha": "7c534bd656f58071a6a296d23b10e2c53a75a237",
			"url": "https://gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/commits/7c534bd656f58071a6a296d23b10e2c53a75a237"
		},
		"default_branch": false,
		"protected": false
	},
	{
		"name": "Feature/Qwen3_VL_32B_W8A8C8-20260930",
		"commit": {
			"commit": {
				"author": {
					"name": "libarry",
					"date": "2026-02-27T17:29:55+08:00",
					"email": "870390541@qq.com"
				},
				"committer": {
					"name": "ascend-robot",
					"date": "2026-02-27T17:29:55+08:00",
					"email": "zhongyuanke@huawei.com"
				},
				"message": "【poc】【bugfix】 修复只保存visual depth数目c8权重的问题"
			},
			"sha": "f59ad78c7e2c336608baad84a63017929a51ff4c",
			"url": "https://gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/commits/f59ad78c7e2c336608baad84a63017929a51ff4c"
		},
		"default_branch": false,
		"protected": false
	}
]
```
