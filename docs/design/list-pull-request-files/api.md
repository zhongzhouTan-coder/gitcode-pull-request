# List Pull Request Files API

## API Description

This API allows users to list the files changed in a pull request.

## Endpoints

```
GET https://api.gitcode.com/api/v5/repos/:owner/:repo/pulls/:pull_number/files
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
  --url 'https://api.gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/pulls/597/files?access_token=xxxxxxxxxxxxxxxxxxxx' 
```

## Example Response

```json
[
	{
		"sha": "169338a869599b5e7abf82f2fdf9399ee4c4bdab",
		"filename": "config/config.ini",
		"additions": 1,
		"deletions": 1,
		"blob_id": "c7dfd412d17db4341c640cbd2d2218c121e8f0e5",
		"blob_url": "https://gitcode.com/Ascend/MindStudio-ModelSlim/blob/169338a869599b5e7abf82f2fdf9399ee4c4bdab/config/config.ini",
		"raw_url": "https://raw.gitcode.com/Ascend/MindStudio-ModelSlim/raw/169338a869599b5e7abf82f2fdf9399ee4c4bdab/config/config.ini",
		"patch": {
			"diff": "@@ -73,7 +73,7 @@ qwen3_5_moe = msmodelslim.model.qwen3_5_moe.loader:Qwen3_5MoeAdapterLoader\n qwen2_5_omni_thinker = msmodelslim.model.qwen2_5_omni_thinker.loader:Qwen2_5OmniThinkerAdapterLoader\n glm4_6v = msmodelslim.model.glm4_6v.loader:Glm4_6VAdapterLoader\n qwen_image_edit = msmodelslim.model.qwen_image_edit.loader:QwenImageEditAdapterLoader\n-step3_5_flash = msmodelslim.model.step3_5_flash.model_adapter:Step3_5FlashModelAdapter\n+step3_5_flash = msmodelslim.model.step3_5_flash.loader:Step3_5FlashAdapterLoader\n internvl3_5_dense = msmodelslim.model.internvl3_5.loader:InternVL3_5AdapterLoader\n internvl3_5_moe = msmodelslim.model.internvl3_5_moe.loader:InternVL3_5MoeAdapterLoader\n minimax_m2 = msmodelslim.model.minimax_m2.loader:MiniMaxM2AdapterLoader\n",
			"old_path": "config/config.ini",
			"new_path": "config/config.ini",
			"a_mode": "100644",
			"b_mode": "100644",
			"new_file": false,
			"renamed_file": false,
			"deleted_file": false,
			"too_large": false,
			"added_lines": 1,
			"removed_lines": 1
		},
		"target_branch": "master",
		"source_branch": "add_loader",
		"source_project": {
			"id": 9393630,
			"full_name": "yejiajun/msmodelslim",
			"human_name": "yejiajun / MindStudio-ModelSlim",
			"path": "msmodelslim"
		},
		"target_project": {
			"id": 8444818,
			"full_name": "Ascend/msmodelslim",
			"human_name": "Ascend / MindStudio-ModelSlim",
			"path": "msmodelslim"
		}
	},
	{
		"sha": "169338a869599b5e7abf82f2fdf9399ee4c4bdab",
		"filename": "msmodelslim/model/step3_5_flash/loader.py",
		"status": "added",
		"additions": 7,
		"deletions": 0,
		"blob_id": "ec6fed5e58d0724cfecd3243b1eb45e4e7802026",
		"blob_url": "https://gitcode.com/Ascend/MindStudio-ModelSlim/blob/169338a869599b5e7abf82f2fdf9399ee4c4bdab/msmodelslim/model/step3_5_flash/loader.py",
		"raw_url": "https://raw.gitcode.com/Ascend/MindStudio-ModelSlim/raw/169338a869599b5e7abf82f2fdf9399ee4c4bdab/msmodelslim/model/step3_5_flash/loader.py",
		"patch": {
			"diff": "@@ -0,0 +1,7 @@\n+# -*- coding: UTF-8 -*-\n+\n+from msmodelslim.model.plugin_factory.base_loader import BaseModelAdapterLoader\n+\n+\n+class Step3_5FlashAdapterLoader(BaseModelAdapterLoader):\n+    ADAPTER_CLASS_PATH = \"msmodelslim.model.step3_5_flash.model_adapter:Step3_5FlashModelAdapter\"\n",
			"old_path": "msmodelslim/model/step3_5_flash/loader.py",
			"new_path": "msmodelslim/model/step3_5_flash/loader.py",
			"a_mode": "0",
			"b_mode": "100644",
			"new_file": true,
			"renamed_file": false,
			"deleted_file": false,
			"too_large": false,
			"added_lines": 7,
			"removed_lines": 0
		},
		"target_branch": "master",
		"source_branch": "add_loader",
		"source_project": {
			"id": 9393630,
			"full_name": "yejiajun/msmodelslim",
			"human_name": "yejiajun / MindStudio-ModelSlim",
			"path": "msmodelslim"
		},
		"target_project": {
			"id": 8444818,
			"full_name": "Ascend/msmodelslim",
			"human_name": "Ascend / MindStudio-ModelSlim",
			"path": "msmodelslim"
		}
	}
]
```