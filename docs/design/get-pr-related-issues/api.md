# Get a pr related issues API

## API Description

This API allows users to list all issues related to a pull request.

## Endpoints

```
GET https://api.gitcode.com/api/v5/repos/:owner/:repo/pulls/:number/issues
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
  --url 'https://api.gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/pulls/660/issues?access_token=xxxxxxxxxxxxxxxx'
```

## Example Response

```json
[
	{
		"number": "339",
		"title": "[Doc]: 【新需求资料测试】量化格式接入指南相关文档，存在正确性、易理解性、内容完整性等6个问题需要修改优化",
		"state": "open",
		"url": "https://api.gitcode.com/api/v5/repos/Ascend/msmodelslim/issues/339",
		"html_url": "https://gitcode.com/Ascend/msmodelslim/issues/339",
		"id": 4123195,
		"body": "### Documentation Location (Multiple document links can be specified) | 文档位置（可指定多个文档链接）\n            \nhttps://gitcode.com/Ascend/msmodelslim/blob/26.1.0/docs/zh/user_guide/quantization_formats/README.md https://gitcode.com/Ascend/msmodelslim/blob/26.1.0/docs/zh/user_guide/quantization_formats/ascendv1.md https://gitcode.com/Ascend/msmodelslim/blob/26.1.0/docs/zh/user_guide/quantization_formats/compressed_tensors.md\n### Current Content Description | 文档问题描述\n            \nhttps://gitcode.com/Ascend/msmodelslim/blob/26.1.0/docs/zh/user_guide/quantization_formats/README.md\n1、yaml缩进不正确，如果不支持缩进，建议直接删掉这一列\n![image.png](https://raw.gitcode.com/user-images/assets/8444818/2d253008-9a59-4718-b2cf-2ef29e9fbaf8/image.png 'image.png')\n\n\nhttps://gitcode.com/Ascend/msmodelslim/blob/26.1.0/docs/zh/user_guide/quantization_formats/ascendv1.md\n2、扩展参数是否需要特定的值？还是自定义，格式有什么要求？建议描述清晰\n![image.png](https://raw.gitcode.com/user-images/assets/8444818/0bf5630b-e2bb-4dee-b374-a69981d4b55e/image.png 'image.png')\n\n\nhttps://gitcode.com/Ascend/msmodelslim/blob/26.1.0/docs/zh/user_guide/quantization_formats/compressed_tensors.md\n3、语句描述不易理解\n![image.png](https://raw.gitcode.com/user-images/assets/8444818/41313b00-d8fe-422f-be88-e4cf07e50e60/image.png 'image.png')\n\n4、这里的N指代不完全正确，如果是10以上的数字就不对了\n![image.png](https://raw.gitcode.com/user-images/assets/8444818/ea741b29-5336-454e-bb5b-3f2b9c67c858/image.png 'image.png')\n\n5、顶层字段说明不完整，补充对应字段说明\n![image.png](https://raw.gitcode.com/user-images/assets/8444818/bc8dc247-105e-4d1b-9eb9-8bef159c2130/image.png 'image.png')\n\n6、参数说明表格里面有的写了类型和默认值，有的只有一个参数，怎么知道要表达的是类型还是默认值呢？呈现不清晰\n![image.png](https://raw.gitcode.com/user-images/assets/8444818/65e64ff6-2dc2-4955-9c6f-6c62b91155ad/image.png 'image.png')\n### Modification Suggestion | 修改建议\n            \n1、根据描述修改即可\n\n\nWelcome to join the community and thank you for your contribution 🎉!\n\n欢迎加入社区，感谢您对社区的贡献 🎉!\n\n",
		"user": {
			"id": "681c79b1c644db757fcc1b97",
			"login": "mominhua",
			"name": "不甜",
			"html_url": "https://gitcode.com/mominhua"
		},
		"labels": [
			{
				"id": 23612,
				"color": "#2988e0",
				"name": "document",
				"text_color": "#FFFFFF"
			},
			{
				"id": 22794,
				"color": "#e09d29",
				"name": "medium-priority",
				"text_color": "#FFFFFF"
			},
			{
				"id": 22791,
				"color": "#2865E0",
				"name": "triaged",
				"text_color": "#FFFFFF"
			}
		],
		"repository": {
			"full_name": "Ascend/msmodelslim",
			"created_at": "2025-11-21T16:47:14+08:00",
			"updated_at": "2025-12-30T19:10:29+08:00"
		},
		"issue_created_at": "2026-06-29T10:55:46+08:00",
		"issue_updated_at": "2026-06-29T10:59:40+08:00"
	}
]
```
