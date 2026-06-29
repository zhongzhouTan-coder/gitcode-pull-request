
# list members API

## API Description

This API allows users to list all members in a repository.

## Endpoints

```
GET https://api.gitcode.com/api/v5/repos/:owner/:repo/collaborators
```

## Path Variables

- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: 	Repository Path(path).

## Query Parameters

- `access_token`: (Required) The access token for authentication.
- `page`: (Optional) The page number to retrieve. Defaults to 1.
- `per_page`: (Optional) The number of members to retrieve per page. Defaults to 20. Maximum is 100.

## Example Request

```bash
curl --request GET \
  --url 'https://api.gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/collaborators?access_token=xxxxxxxxxxxxxxxxxxxxxxx&page=1&per_page=20'
```

## Example Response

```json
[
	{
		"id": "10089084",
		"name": "ascend-ds-bot",
		"username": "ascend-ds-bot",
		"nick_name": "ascend-robot",
		"state": "active",
		"email": "ascend-ds-bot@noreply.gitcode.com",
		"web_url": "https://gitcode.com/ascend-ds-bot",
		"access_level": 50,
		"type": "EnterpriseMember",
		"join_way": "inherit",
		"role_name": "Owner",
		"role_name_cn": "管理员",
		"permissions": {
			"admin": true
		},
		"object_id": "698c2d13738353511a62d364",
		"permission": "admin",
		"login": "ascend-ds-bot"
	},
	{
		"id": "5355243",
		"name": "ascend-robot",
		"username": "ascend-robot",
		"nick_name": "ascend-robot",
		"state": "active",
		"email": "zhongyuanke@huawei.com",
		"web_url": "https://gitcode.com/ascend-robot",
		"access_level": 50,
		"type": "EnterpriseMember",
		"join_way": "inherit",
		"role_name": "Owner",
		"role_name_cn": "管理员",
		"permissions": {
			"admin": true
		},
		"object_id": "680e157b4e445c0df960c4c4",
		"permission": "admin",
		"login": "ascend-robot"
	},
	{
		"id": "2596302",
		"name": "cann-robot",
		"username": "cann-robot",
		"nick_name": "CANN-robot",
		"state": "active",
		"email": "cann@cann.team",
		"web_url": "https://gitcode.com/cann-robot",
		"access_level": 50,
		"type": "EnterpriseMember",
		"join_way": "inherit",
		"role_name": "Owner",
		"role_name_cn": "管理员",
		"permissions": {
			"admin": true
		},
		"object_id": "673c1552584fe8295cfd4a13",
		"permission": "admin",
		"login": "cann-robot"
	},
	{
		"id": "5275533",
		"name": "openLiBingCI",
		"username": "openLiBingCI",
		"nick_name": "openLiBingCI",
		"state": "active",
		"email": "openlibing-robot@openlibing.com",
		"web_url": "https://gitcode.com/openLiBingCI",
		"access_level": 50,
		"type": "EnterpriseMember",
		"join_way": "inherit",
		"role_name": "Owner",
		"role_name_cn": "管理员",
		"permissions": {
			"admin": true
		},
		"object_id": "68089a59ece4e46547130586",
		"permission": "admin",
		"login": "openLiBingCI"
	},
	{
		"id": "4016582",
		"name": "yao-xiaobai",
		"username": "yao-xiaobai",
		"nick_name": "姚小白",
		"state": "active",
		"email": "17625331900@163.com",
		"web_url": "https://gitcode.com/yao-xiaobai",
		"access_level": 50,
		"type": "EnterpriseMember",
		"join_way": "inherit",
		"role_name": "Owner",
		"role_name_cn": "管理员",
		"permissions": {
			"admin": true
		},
		"object_id": "67a6cc631268060aa71e539b",
		"permission": "admin",
		"login": "yao-xiaobai"
	},
	{
		"id": "7854584",
		"name": "gcw_u8HHrTWX",
		"username": "gcw_u8HHrTWX",
		"nick_name": "gcw_u8HHrTWX",
		"state": "active",
		"email": "1326345633@qq.com",
		"web_url": "https://gitcode.com/gcw_u8HHrTWX",
		"access_level": 50,
		"type": "EnterpriseMember",
		"join_way": "inherit",
		"role_name": "Owner",
		"role_name_cn": "管理员",
		"permissions": {
			"admin": true
		},
		"object_id": "690dc4283e3a032dc7a4b200",
		"permission": "admin",
		"login": "gcw_u8HHrTWX"
	},
	{
		"id": "746087",
		"name": "AtlasAccount",
		"username": "AtlasAccount",
		"nick_name": "AtlasAccount",
		"state": "active",
		"email": "AtlasAccount@noreply.gitcode.com",
		"web_url": "https://gitcode.com/AtlasAccount",
		"access_level": 50,
		"type": "EnterpriseMember",
		"join_way": "inherit",
		"role_name": "Owner",
		"role_name_cn": "管理员",
		"permissions": {
			"admin": true
		},
		"object_id": "666d68b3324d160979397e89",
		"permission": "admin",
		"login": "AtlasAccount"
	},
	{
		"id": "7287530",
		"name": "zeshengzong",
		"username": "zeshengzong",
		"nick_name": "zeshengzong",
		"state": "active",
		"email": "zesheng.zong@outlook.com",
		"web_url": "https://gitcode.com/zeshengzong",
		"access_level": 50,
		"type": "EnterpriseMember",
		"join_way": "inherit",
		"role_name": "Owner",
		"role_name_cn": "管理员",
		"permissions": {
			"admin": true
		},
		"object_id": "68d9185dd72b9e193f874fec",
		"permission": "admin",
		"login": "zeshengzong"
	},
	{
		"id": "5243410",
		"name": "drizzlezyk",
		"username": "drizzlezyk",
		"nick_name": "drizzlezyk",
		"state": "active",
		"email": "drizzlezyk@163.com",
		"web_url": "https://gitcode.com/drizzlezyk",
		"access_level": 50,
		"type": "EnterpriseMember",
		"join_way": "inherit",
		"role_name": "Owner",
		"role_name_cn": "管理员",
		"permissions": {
			"admin": true
		},
		"object_id": "680645b4577c40328d98d4d6",
		"permission": "admin",
		"login": "drizzlezyk"
	},
	{
		"id": "3103109",
		"name": "zhongjun2",
		"username": "zhongjun2",
		"nick_name": "zhongjun2",
		"state": "active",
		"email": "jun.zhongjun@huawei.com",
		"web_url": "https://gitcode.com/zhongjun2",
		"access_level": 50,
		"type": "EnterpriseMember",
		"join_way": "inherit",
		"role_name": "Owner",
		"role_name_cn": "管理员",
		"permissions": {
			"admin": true
		},
		"object_id": "67586f53dc1d652f8020ab09",
		"permission": "admin",
		"login": "zhongjun2"
	},
	{
		"id": "5306252",
		"name": "y30044005",
		"username": "y30044005",
		"nick_name": "yanhe13",
		"state": "active",
		"email": "1037452625@qq.com",
		"web_url": "https://gitcode.com/y30044005",
		"access_level": 40,
		"type": "ProjectMember",
		"join_way": "normal",
		"source_name": "MindStudio-ModelSlim",
		"role_name": "Maintainer",
		"role_name_cn": "维护者",
		"permissions": {
			"admin": false
		},
		"object_id": "680a1a384e445c0df95f92a7",
		"permission": "admin",
		"login": "y30044005"
	},
	{
		"id": "5307450",
		"name": "panyj1993",
		"username": "panyj1993",
		"nick_name": "panyj1993",
		"state": "active",
		"email": "panyangjie@huawei.com",
		"web_url": "https://gitcode.com/panyj1993",
		"access_level": 40,
		"type": "ProjectMember",
		"join_way": "normal",
		"source_name": "MindStudio-ModelSlim",
		"role_name": "Maintainer",
		"role_name_cn": "维护者",
		"permissions": {
			"admin": false
		},
		"object_id": "680a1ff392685e00dfb29f4f",
		"permission": "admin",
		"login": "panyj1993"
	},
	{
		"id": "6096018",
		"name": "wowenjie",
		"username": "wowenjie",
		"nick_name": "wowenjie",
		"state": "active",
		"email": "wowenjie@huawei.com",
		"web_url": "https://gitcode.com/wowenjie",
		"access_level": 40,
		"type": "ProjectMember",
		"join_way": "normal",
		"source_name": "MindStudio-ModelSlim",
		"role_name": "Maintainer",
		"role_name_cn": "维护者",
		"permissions": {
			"admin": false
		},
		"object_id": "684fc2ebd9a4db28218e1e1b",
		"permission": "admin",
		"login": "wowenjie"
	},
	{
		"id": "5587405",
		"name": "joejoezhou",
		"username": "joejoezhou",
		"nick_name": "joejoezhou",
		"state": "active",
		"email": "zhourongchen1@huawei.com",
		"web_url": "https://gitcode.com/joejoezhou",
		"access_level": 40,
		"type": "ProjectMember",
		"join_way": "normal",
		"source_name": "MindStudio-ModelSlim",
		"role_name": "Maintainer",
		"role_name_cn": "维护者",
		"permissions": {
			"admin": false
		},
		"object_id": "682314cd6a68fa1fec6cf718",
		"permission": "admin",
		"login": "joejoezhou"
	},
	{
		"id": "5860007",
		"name": "anreywmh",
		"username": "anreywmh",
		"nick_name": "anreywmh",
		"state": "active",
		"email": "18845895998@163.com",
		"web_url": "https://gitcode.com/anreywmh",
		"access_level": 40,
		"type": "ProjectMember",
		"join_way": "normal",
		"source_name": "MindStudio-ModelSlim",
		"role_name": "Maintainer",
		"role_name_cn": "维护者",
		"permissions": {
			"admin": false
		},
		"object_id": "6839c471b5d4fc36d75fa0b2",
		"permission": "admin",
		"login": "anreywmh"
	},
	{
		"id": "6891194",
		"name": "keith_wa",
		"username": "keith_wa",
		"nick_name": "keith_wa",
		"state": "active",
		"email": "keith_wwa@163.com",
		"web_url": "https://gitcode.com/keith_wa",
		"access_level": 40,
		"type": "ProjectMember",
		"join_way": "normal",
		"source_name": "MindStudio-ModelSlim",
		"role_name": "Maintainer",
		"role_name_cn": "维护者",
		"permissions": {
			"admin": false
		},
		"object_id": "68afc34af4848b5858dfd33b",
		"permission": "admin",
		"login": "keith_wa"
	},
	{
		"id": "5035262",
		"name": "zhao-zepeng",
		"username": "zhao-zepeng",
		"nick_name": "zhaozepeng",
		"state": "active",
		"email": "zhaozepeng1@h-partners.com",
		"web_url": "https://gitcode.com/zhao-zepeng",
		"access_level": 20,
		"type": "ProjectMember",
		"join_way": "normal",
		"source_name": "MindStudio-ModelSlim",
		"role_name": "Reporter",
		"role_name_cn": "参与者",
		"permissions": {
			"admin": false
		},
		"object_id": "67f6113dac463534c89d768d",
		"permission": "write",
		"login": "zhao-zepeng"
	},
	{
		"id": "995674",
		"name": "xyxin_006",
		"username": "xyxin_006",
		"nick_name": "xyxin_006",
		"state": "active",
		"email": "xyxin_hit@163.com",
		"web_url": "https://gitcode.com/xyxin_006",
		"access_level": 15,
		"type": "ProjectMember",
		"join_way": "normal",
		"source_name": "MindStudio-ModelSlim",
		"role_name": "Ascend开发者",
		"role_name_cn": "Ascend开发者",
		"permissions": {
			"admin": false
		},
		"object_id": "66cda03f1188e14345d1f65e",
		"permission": "read",
		"login": "xyxin_006"
	},
	{
		"id": "2124982",
		"name": "luyq11",
		"username": "luyq11",
		"nick_name": "luyq11",
		"state": "active",
		"email": "luyiqian4@h-partners.com",
		"web_url": "https://gitcode.com/luyq11",
		"access_level": 15,
		"type": "ProjectMember",
		"join_way": "normal",
		"source_name": "MindStudio-ModelSlim",
		"role_name": "Ascend开发者",
		"role_name_cn": "Ascend开发者",
		"permissions": {
			"admin": false
		},
		"object_id": "67246cdd4580686cebafeb58",
		"permission": "read",
		"login": "luyq11"
	},
	{
		"id": "1183248",
		"name": "ylzzz",
		"username": "ylzzz",
		"nick_name": "ylzzz",
		"state": "active",
		"email": "yelinzhong@huawei.com",
		"web_url": "https://gitcode.com/ylzzz",
		"access_level": 15,
		"type": "ProjectMember",
		"join_way": "normal",
		"source_name": "MindStudio-ModelSlim",
		"role_name": "Ascend开发者",
		"role_name_cn": "Ascend开发者",
		"permissions": {
			"admin": false
		},
		"object_id": "66e6df7f22522e592950b434",
		"permission": "read",
		"login": "ylzzz"
	}
]
```
