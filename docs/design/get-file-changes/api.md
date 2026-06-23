# Get file changes

## API Description

This API allows users to get file changes of a pull request.

## Endpoints

```
GET https://api.gitcode.com/api/v5/repos/:owner/:repo/pulls/:pull_number/files.json
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
  --url 'https://api.gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/pulls/597/files.json?access_token=xxxxxxxxxxxxxxxx'
```

## Example Response

```json
{
	"code": 0,
	"added_lines": 8,
	"remove_lines": 1,
	"count": 2,
	"diff_refs": {
		"base_sha": "0844e66715835ea9dfcfa8ffff88fa5e03a46291",
		"start_sha": "0844e66715835ea9dfcfa8ffff88fa5e03a46291",
		"head_sha": "169338a869599b5e7abf82f2fdf9399ee4c4bdab"
	},
	"diffs": [
		{
			"new_blob_id": "c7dfd412d17db4341c640cbd2d2218c121e8f0e5",
			"statistic": {
				"type": "text_type",
				"path": "config/config.ini",
				"old_path": "config/config.ini",
				"new_path": "config/config.ini",
				"view": false
			},
			"head": {
				"url": "https://raw.gitcode.com/Ascend/MindStudio-ModelSlim/raw/169338a869599b5e7abf82f2fdf9399ee4c4bdab/config/config.ini",
				"commit_id": "169338a869599b5e7abf82f2fdf9399ee4c4bdab"
			},
			"added_lines": 1,
			"remove_lines": 1,
			"content": {
				"text": [
					{
						"line_content": "@@ -73,7 +73,7 @@ qwen3_5_moe = msmodelslim.model.qwen3_5_moe.loader:Qwen3_5MoeAdapterLoader",
						"old_line": "...",
						"new_line": "...",
						"type": "match"
					},
					{
						"line_content": " qwen2_5_omni_thinker = msmodelslim.model.qwen2_5_omni_thinker.loader:Qwen2_5OmniThinkerAdapterLoader",
						"old_line": {
							"line_code": "80680bd277bcadaacce5cbc6697d87d491a734b6_73_73",
							"line_num": 73
						},
						"new_line": {
							"line_code": "80680bd277bcadaacce5cbc6697d87d491a734b6_73_73",
							"line_num": 73
						}
					},
					{
						"line_content": " glm4_6v = msmodelslim.model.glm4_6v.loader:Glm4_6VAdapterLoader",
						"old_line": {
							"line_code": "80680bd277bcadaacce5cbc6697d87d491a734b6_74_74",
							"line_num": 74
						},
						"new_line": {
							"line_code": "80680bd277bcadaacce5cbc6697d87d491a734b6_74_74",
							"line_num": 74
						}
					},
					{
						"line_content": " qwen_image_edit = msmodelslim.model.qwen_image_edit.loader:QwenImageEditAdapterLoader",
						"old_line": {
							"line_code": "80680bd277bcadaacce5cbc6697d87d491a734b6_75_75",
							"line_num": 75
						},
						"new_line": {
							"line_code": "80680bd277bcadaacce5cbc6697d87d491a734b6_75_75",
							"line_num": 75
						}
					},
					{
						"line_content": "step3_5_flash = msmodelslim.model.step3_5_flash.model_adapter:Step3_5FlashModelAdapter",
						"old_line": {
							"line_code": "80680bd277bcadaacce5cbc6697d87d491a734b6_76_76",
							"line_num": 76
						},
						"new_line": {
							"line_code": "80680bd277bcadaacce5cbc6697d87d491a734b6_76_76",
							"line_num": ""
						},
						"type": "old"
					},
					{
						"line_content": "step3_5_flash = msmodelslim.model.step3_5_flash.loader:Step3_5FlashAdapterLoader",
						"old_line": {
							"line_code": "80680bd277bcadaacce5cbc6697d87d491a734b6_77_76",
							"line_num": ""
						},
						"new_line": {
							"line_code": "80680bd277bcadaacce5cbc6697d87d491a734b6_77_76",
							"line_num": 76
						},
						"type": "new"
					},
					{
						"line_content": " internvl3_5_dense = msmodelslim.model.internvl3_5.loader:InternVL3_5AdapterLoader",
						"old_line": {
							"line_code": "80680bd277bcadaacce5cbc6697d87d491a734b6_77_77",
							"line_num": 77
						},
						"new_line": {
							"line_code": "80680bd277bcadaacce5cbc6697d87d491a734b6_77_77",
							"line_num": 77
						}
					},
					{
						"line_content": " internvl3_5_moe = msmodelslim.model.internvl3_5_moe.loader:InternVL3_5MoeAdapterLoader",
						"old_line": {
							"line_code": "80680bd277bcadaacce5cbc6697d87d491a734b6_78_78",
							"line_num": 78
						},
						"new_line": {
							"line_code": "80680bd277bcadaacce5cbc6697d87d491a734b6_78_78",
							"line_num": 78
						}
					},
					{
						"line_content": " minimax_m2 = msmodelslim.model.minimax_m2.loader:MiniMaxM2AdapterLoader",
						"old_line": {
							"line_code": "80680bd277bcadaacce5cbc6697d87d491a734b6_79_79",
							"line_num": 79
						},
						"new_line": {
							"line_code": "80680bd277bcadaacce5cbc6697d87d491a734b6_79_79",
							"line_num": 79
						}
					}
				]
			}
		},
		{
			"new_blob_id": "ec6fed5e58d0724cfecd3243b1eb45e4e7802026",
			"statistic": {
				"type": "text_type",
				"path": "msmodelslim/model/step3_5_flash/loader.py",
				"old_path": "msmodelslim/model/step3_5_flash/loader.py",
				"new_path": "msmodelslim/model/step3_5_flash/loader.py",
				"view": false
			},
			"head": {
				"url": "https://raw.gitcode.com/Ascend/MindStudio-ModelSlim/raw/169338a869599b5e7abf82f2fdf9399ee4c4bdab/msmodelslim/model/step3_5_flash/loader.py",
				"commit_id": "169338a869599b5e7abf82f2fdf9399ee4c4bdab"
			},
			"added_lines": 7,
			"remove_lines": 0,
			"content": {
				"text": [
					{
						"line_content": "@@ -0,0 +1,7 @@",
						"old_line": "...",
						"new_line": "...",
						"type": "match"
					},
					{
						"line_content": "# -*- coding: UTF-8 -*-",
						"old_line": {
							"line_code": "5e34edca50427a0a02992fe99d9865720c92382d_0_1",
							"line_num": ""
						},
						"new_line": {
							"line_code": "5e34edca50427a0a02992fe99d9865720c92382d_0_1",
							"line_num": 1
						},
						"type": "new"
					},
					{
						"line_content": "",
						"old_line": {
							"line_code": "5e34edca50427a0a02992fe99d9865720c92382d_0_2",
							"line_num": ""
						},
						"new_line": {
							"line_code": "5e34edca50427a0a02992fe99d9865720c92382d_0_2",
							"line_num": 2
						},
						"type": "new"
					},
					{
						"line_content": "from msmodelslim.model.plugin_factory.base_loader import BaseModelAdapterLoader",
						"old_line": {
							"line_code": "5e34edca50427a0a02992fe99d9865720c92382d_0_3",
							"line_num": ""
						},
						"new_line": {
							"line_code": "5e34edca50427a0a02992fe99d9865720c92382d_0_3",
							"line_num": 3
						},
						"type": "new"
					},
					{
						"line_content": "",
						"old_line": {
							"line_code": "5e34edca50427a0a02992fe99d9865720c92382d_0_4",
							"line_num": ""
						},
						"new_line": {
							"line_code": "5e34edca50427a0a02992fe99d9865720c92382d_0_4",
							"line_num": 4
						},
						"type": "new"
					},
					{
						"line_content": "",
						"old_line": {
							"line_code": "5e34edca50427a0a02992fe99d9865720c92382d_0_5",
							"line_num": ""
						},
						"new_line": {
							"line_code": "5e34edca50427a0a02992fe99d9865720c92382d_0_5",
							"line_num": 5
						},
						"type": "new"
					},
					{
						"line_content": "class Step3_5FlashAdapterLoader(BaseModelAdapterLoader):",
						"old_line": {
							"line_code": "5e34edca50427a0a02992fe99d9865720c92382d_0_6",
							"line_num": ""
						},
						"new_line": {
							"line_code": "5e34edca50427a0a02992fe99d9865720c92382d_0_6",
							"line_num": 6
						},
						"type": "new"
					},
					{
						"line_content": "    ADAPTER_CLASS_PATH = \"msmodelslim.model.step3_5_flash.model_adapter:Step3_5FlashModelAdapter\"",
						"old_line": {
							"line_code": "5e34edca50427a0a02992fe99d9865720c92382d_0_7",
							"line_num": ""
						},
						"new_line": {
							"line_code": "5e34edca50427a0a02992fe99d9865720c92382d_0_7",
							"line_num": 7
						},
						"type": "new"
					}
				]
			}
		}
	]
}
```