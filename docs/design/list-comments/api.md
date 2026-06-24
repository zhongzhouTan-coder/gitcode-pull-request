# List comments API

## API Description

This API allows users to list comments on a pull request.

## Endpoints

```
GET https://api.gitcode.com/api/v5/repos/:owner/:repo/pulls/:pull_number/comments
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
  --url 'https://api.gitcode.com/api/v5/repos/Ascend/MindStudio-ModelSlim/pulls/583/comments?access_token=xxxxxxxxxxxxxxxx'
```

## Example Response

```json
[
	{
		"id": 176109963,
		"discussion_id": "896efe78dcae8fedd4d4b01458ed6c4d68235f03",
		"body": "openLiBing可接管PR, PR详情链接:\nhttps://www.openlibing.com/apps/transitionPrDetail?owner=Ascend&repo=msmodelslim&number=583&platform=gitcode&codeHostingPlatformFlag=gitcode",
		"created_at": "2026-06-17T16:13:09+08:00",
		"updated_at": "2026-06-17T16:13:09+08:00",
		"user": {
			"id": "680e157b4e445c0df960c4c4",
			"login": "ascend-robot",
			"object_id": "680e157b4e445c0df960c4c4",
			"name": "ascend-robot",
			"avatar_url": "https://cdn-img.gitcode.com/ad/ec/4a22097de2cd8cd630c843b4fb17bd85bc7dd082a7e3a0e7089c373e836a3524.png?time=1753510752944",
			"html_url": "https://gitcode.com/ascend-robot"
		},
		"comment_type": "pr_comment"
	},
	{
		"id": 176109997,
		"discussion_id": "0b06dfc206df5cd7a35fff59b7ddff528657f1ab",
		"body": "Thanks for your pull-request.\nThe full list of commands accepted by me can be found at [**here**](https://gitcode.com/Ascend/infrastructure/blob/master/docs/robot/robot%E4%BD%BF%E7%94%A8%E6%8C%87%E5%8D%97.md#-%E5%A6%82%E9%9C%80%E4%BA%86%E8%A7%A3%E8%AF%A6%E7%BB%86%E7%9A%84%E5%91%BD%E4%BB%A4%E5%8F%AF%E5%8F%82%E8%80%83%E4%B8%8B%E6%96%B9%E8%AF%A6%E7%BB%86%E8%A1%A8%E6%A0%BC)。\nYou can get sig-info at [**here**](https://gitcode.com/Ascend/community/blob/master/MindStudio/sigs/sig-msmodelslim/sig-info.yaml)\n\n\n---\n\n## PR Approval Progress\n\n✅ **Congratulations! All modules have met the lgtm and approve requirements.**\n\n### Module Approval Details\n\n| module | lgtm status | approve status |\n|------|-----------|--------------|\n| repo-Ascend/msmodelslim | ✅ [*王建新*](https://gitcode.com/keith_wa), [*yejiajun*](https://gitcode.com/yejiajun) (2/2) | ✅ [*王建新*](https://gitcode.com/keith_wa) (1/1) |\n\n> 💡 Tip:\n> - **Committer** can comment `/approve` or `/lgtm`\n> - Commenting `/approve` implies both code review (lgtm) and intent to merge (approve)\n\n------\n\n## CLA Signature Pass  \n qq_46439621, thanks for your pull request. All authors of the commits have signed the CLA. :+1:",
		"created_at": "2026-06-17T16:13:16+08:00",
		"updated_at": "2026-06-17T20:00:05+08:00",
		"user": {
			"id": "680e157b4e445c0df960c4c4",
			"login": "ascend-robot",
			"object_id": "680e157b4e445c0df960c4c4",
			"name": "ascend-robot",
			"avatar_url": "https://cdn-img.gitcode.com/ad/ec/4a22097de2cd8cd630c843b4fb17bd85bc7dd082a7e3a0e7089c373e836a3524.png?time=1753510752944",
			"html_url": "https://gitcode.com/ascend-robot"
		},
		"comment_type": "pr_comment"
	},
	{
		"id": 176110142,
		"discussion_id": "415a7cf0785ed1e9fb1e6564cccdf3b5ecf29534",
		"body": "compile",
		"created_at": "2026-06-17T16:13:37+08:00",
		"updated_at": "2026-06-17T16:13:37+08:00",
		"user": {
			"id": "68add47a5a5e89101cc24be9",
			"login": "qq_46439621",
			"object_id": "68add47a5a5e89101cc24be9",
			"name": "wanlongze123",
			"avatar_url": "https://profile-avatar.csdnimg.cn/a04fdcff1a5a4d8dbb3777426204f918_qq_46439621.jpg!1",
			"html_url": "https://gitcode.com/qq_46439621"
		},
		"comment_type": "pr_comment"
	},
	{
		"id": 176110308,
		"discussion_id": "e5ecca7dc02b37692308bc755d77584798ad7144",
		"body": "Ascend docs pipeline is running...",
		"created_at": "2026-06-17T16:14:16+08:00",
		"updated_at": "2026-06-17T16:14:16+08:00",
		"user": {
			"id": "680e157b4e445c0df960c4c4",
			"login": "ascend-robot",
			"object_id": "680e157b4e445c0df960c4c4",
			"name": "ascend-robot",
			"avatar_url": "https://cdn-img.gitcode.com/ad/ec/4a22097de2cd8cd630c843b4fb17bd85bc7dd082a7e3a0e7089c373e836a3524.png?time=1753510752944",
			"html_url": "https://gitcode.com/ascend-robot"
		},
		"comment_type": "pr_comment"
	},
	{
		"id": 176110403,
		"discussion_id": "d557b1fca374ab0bb5685b33ba7ae7340db2e6b6",
		"body": "Ascend docs pipeline is running...",
		"created_at": "2026-06-17T16:14:38+08:00",
		"updated_at": "2026-06-17T16:14:38+08:00",
		"user": {
			"id": "680e157b4e445c0df960c4c4",
			"login": "ascend-robot",
			"object_id": "680e157b4e445c0df960c4c4",
			"name": "ascend-robot",
			"avatar_url": "https://cdn-img.gitcode.com/ad/ec/4a22097de2cd8cd630c843b4fb17bd85bc7dd082a7e3a0e7089c373e836a3524.png?time=1753510752944",
			"html_url": "https://gitcode.com/ascend-robot"
		},
		"comment_type": "pr_comment"
	},
	{
		"id": 176110602,
		"discussion_id": "7069748bd1852706f8c664cb46cf2335301e6e84",
		"body": "✅ 跳过 docs ci 检查，没有需要检查的文档文件",
		"created_at": "2026-06-17T16:15:10+08:00",
		"updated_at": "2026-06-17T16:15:10+08:00",
		"user": {
			"id": "680e157b4e445c0df960c4c4",
			"login": "ascend-robot",
			"object_id": "680e157b4e445c0df960c4c4",
			"name": "ascend-robot",
			"avatar_url": "https://cdn-img.gitcode.com/ad/ec/4a22097de2cd8cd630c843b4fb17bd85bc7dd082a7e3a0e7089c373e836a3524.png?time=1753510752944",
			"html_url": "https://gitcode.com/ascend-robot"
		},
		"comment_type": "pr_comment"
	},
	{
		"id": 176110687,
		"discussion_id": "c93ec76a867a8937dde4f2c208807c2de69bd52d",
		"body": "✅ 跳过 docs ci 检查，没有需要检查的文档文件",
		"created_at": "2026-06-17T16:15:27+08:00",
		"updated_at": "2026-06-17T16:15:27+08:00",
		"user": {
			"id": "680e157b4e445c0df960c4c4",
			"login": "ascend-robot",
			"object_id": "680e157b4e445c0df960c4c4",
			"name": "ascend-robot",
			"avatar_url": "https://cdn-img.gitcode.com/ad/ec/4a22097de2cd8cd630c843b4fb17bd85bc7dd082a7e3a0e7089c373e836a3524.png?time=1753510752944",
			"html_url": "https://gitcode.com/ascend-robot"
		},
		"comment_type": "pr_comment"
	},
	{
		"id": 176133360,
		"discussion_id": "744456305d5ee0a1567b847fa7553ea15234b59e",
		"body": "<div style=\"margin-bottom: 20px\">流水线 <a href=\"https://www.openlibing.com/apps/pipelineDetail?projectId=300037&pipelineId=94d11f71c079458fbe60875ec7d658e4&pipelineRunId=001fcc1679444985bccc54b8a283ca6a&codeHostingPlatformFlag=gitcode\">PR-pipeline_msmodelslim#1706</a>  [ commitID：121cc507 ] 已完成</div>\n<div style=\"margin-bottom: 20px; font-size: 12px;\"><a href=\"https://www.openlibing.com/apps/pipelineDetail?projectId=300037&pipelineId=94d11f71c079458fbe60875ec7d658e4&pipelineRunId=001fcc1679444985bccc54b8a283ca6a&codeHostingPlatformFlag=gitcode&openFlag=codeFix\">>>></a>代码风格自动修复执行成功（无修复内容）</div>\n<table class=\"access-control-table\" style=\"border-collapse: collapse; text-align: center; margin-bottom: 20px\">\n    <tr>\n        <th>阶段</th>\n        <th>任务名</th>\n        <th>状态</th>\n        <th>详情</th>\n    </tr>\n    <tr>\n        <td>编译构建</td>\n        <td>Build_msmodelslim</td>\n        <td>&#9989;</td>\n        <td><a href=\"https://www.openlibing.com/apps/pipelineDetail?projectId=300037&pipelineId=94d11f71c079458fbe60875ec7d658e4&pipelineRunId=001fcc1679444985bccc54b8a283ca6a&stepId=423ef20a5dcf43e1b2e78423dd4b6d78&jobRunId=775f37c9206b447b9bea8ed4a0a0421a&stepRunId=1fb08dc94fb8495eb0de5a6dcda0fa03&codeHostingPlatformFlag=gitcode\">>>></a></td>\n    </tr>\n    <tr>\n        <td>恶意代码检查</td>\n        <td>Antipoison_MindStudio-ModelSlim</td>\n        <td>&#9989;</td>\n        <td><a href=\"https://www.openlibing.com/apps/entryCheckNew/poisoningresult/59ec53bb-1b30-4cb0-a4ca-0cc231c5f4d0/MindStudio/msmodelslim?projectName=MindStudio&codeHostingPlatformFlag=gitcode\">>>></a></td>\n    </tr>\n    <tr>\n        <td>编码安全与规范检查</td>\n        <td>CodeCheck_MindStudio-ModelSlim</td>\n        <td>&#9989;</td>\n        <td><a href=\"https://www.openlibing.com/apps/pipelineDetail?projectId=300037&pipelineId=94d11f71c079458fbe60875ec7d658e4&pipelineRunId=001fcc1679444985bccc54b8a283ca6a&stepId=d4472d7eadd34990aec72c82563b4044&jobRunId=52b2018c900e4d71adca95d53a9eee0c&stepRunId=f2ef5320b1194df988daa2a819a75be3&codeHostingPlatformFlag=gitcode\">>>></a></td>\n    </tr>\n    <tr>\n        <td>开源片段检查</td>\n        <td>SCA_MindStudio-ModelSlim</td>\n        <td>&#9989;</td>\n        <td><a href=\"https://www.openlibing.com/apps/personalScandTaskInfor/person/a6377094-531d-4630-821c-281e01df2135?projectId=300037&codeHostingPlatformFlag=gitcode&projectName=null\">>>></a></td>\n    </tr>\n    <tr>\n        <td rowspan=\"2\">开发者测试</td>\n        <td>UT_msmodelslim</td>\n        <td>&#9989;</td>\n        <td><a href=\"https://www.openlibing.com/apps/pipelineDetail?projectId=300037&pipelineId=94d11f71c079458fbe60875ec7d658e4&pipelineRunId=001fcc1679444985bccc54b8a283ca6a&stepId=7e5ccd336f35469fbedc76ca0ab17a9c&jobRunId=3a658697ea704a129da0df8778f999de&stepRunId=a56fecfe634f471d89cb5628548af46a&codeHostingPlatformFlag=gitcode\">>>></a></td>\n    </tr>\n    <tr>\n        <td>PreSmoke_msmodelslim</td>\n        <td>&#9989;</td>\n        <td><a href=\"https://www.openlibing.com/apps/pipelineDetail?projectId=300037&pipelineId=94d11f71c079458fbe60875ec7d658e4&pipelineRunId=001fcc1679444985bccc54b8a283ca6a&stepId=7e5ccd336f35469fbedc76ca0ab17a9c&jobRunId=877e0a1374fa4382a7cacdb871fef52e&stepRunId=1398d877871f4afeae30df141082211e&codeHostingPlatformFlag=gitcode\">>>></a></td>\n    </tr>\n    <tr>\n        <td>流水线</td>\n        <td>PR-pipeline_msmodelslim</td>\n        <td>&#9989;</td>\n        <td><a href=\"https://www.openlibing.com/apps/pipelineDetail?projectId=300037&pipelineId=94d11f71c079458fbe60875ec7d658e4&pipelineRunId=001fcc1679444985bccc54b8a283ca6a&codeHostingPlatformFlag=gitcode\">>>></a></td>\n    </tr>\n</table><span style=\"font-size: 12px; font-style: oblique\">此流水线已支持下列评论快捷指令，仅PR创建者和白名单成员评论有效</span>\n<ul style=\"font-size: 14px; margin-top: 6px; padding-left: 20px;\">\n<li style=\"font-size: 14px;\">\n<span style=\"font-size: 12px; padding: 2px; background-color: #f8f8f8; border: solid 1px #e7eaed; border-radius: 4px; margin-right: 4px;\">compile</span> : <span style=\"font-size: 12px;\">运行流水线</span>\n</li>\n<li style=\"font-size: 14px;\">\n<span style=\"font-size: 12px; padding: 2px; background-color: #f8f8f8; border: solid 1px #e7eaed; border-radius: 4px; margin-right: 4px;\">retry</span> : <span style=\"font-size: 12px;\">重试流水线所有失败子任务</span>\n</li>\n<li style=\"font-size: 14px;\">\n<span style=\"font-size: 12px; padding: 2px; background-color: #f8f8f8; border: solid 1px #e7eaed; border-radius: 4px; margin-right: 4px;\">retry &lt;任务名&gt;</span> : <span style=\"font-size: 12px;\">仅重试指定失败子任务</span>\n</li>\n<li style=\"font-size: 14px;\">\n<span style=\"font-size: 12px; padding: 2px; background-color: #f8f8f8; border: solid 1px #e7eaed; border-radius: 4px; margin-right: 4px;\">stop</span> : <span style=\"font-size: 12px;\">停止流水线</span>\n</li>\n</ul>",
		"created_at": "2026-06-17T17:22:24+08:00",
		"updated_at": "2026-06-17T17:22:24+08:00",
		"user": {
			"id": "680e157b4e445c0df960c4c4",
			"login": "ascend-robot",
			"object_id": "680e157b4e445c0df960c4c4",
			"name": "ascend-robot",
			"avatar_url": "https://cdn-img.gitcode.com/ad/ec/4a22097de2cd8cd630c843b4fb17bd85bc7dd082a7e3a0e7089c373e836a3524.png?time=1753510752944",
			"html_url": "https://gitcode.com/ascend-robot"
		},
		"comment_type": "pr_comment"
	},
	{
		"id": 176153829,
		"discussion_id": "9035cc85d114b0e24b5b48104ecf51f94a901be2",
		"body": "建议改为True 匹配实际的kv cache C8量化行为",
		"created_at": "2026-06-17T19:12:01+08:00",
		"updated_at": "2026-06-17T19:58:41+08:00",
		"user": {
			"id": "6822c9b2398335026946a660",
			"login": "yejiajun",
			"object_id": "6822c9b2398335026946a660",
			"name": "yejj",
			"html_url": "https://gitcode.com/yejiajun"
		},
		"comment_type": "diff_comment",
		"resolved": true,
		"diff_position": {
			"start_new_line": 13,
			"end_new_line": 13,
			"position_type": "text"
		},
		"reply": [
			{
				"id": 176154249,
				"body": "changed this line on [50f2a196](https://gitcode.com/Ascend/msmodelslim/commits/detail/50f2a196ae3d3101186d7fa066214eb0ff7e7e04?ref=glm5_1_w4a4_mxfp4&prId=583) view [diff detail](https://gitcode.com/Ascend/msmodelslim/merge_requests/583/diffs?diffId=6498084&start_sha=121cc507d2669fdafb324f70d54d55dbcb9c2abe&filePath=lab_practice/glm_5/glm_5_1_w4a4c8_mxfp4.yaml#7792f72adb859a1c50bb81377738f510b90fa569_0_13)",
				"created_at": "2026-06-17T19:15:47+08:00",
				"updated_at": "2026-06-17T19:15:47+08:00",
				"user": {
					"id": "68add47a5a5e89101cc24be9",
					"login": "qq_46439621",
					"object_id": "68add47a5a5e89101cc24be9",
					"name": "wanlongze123",
					"avatar_url": "https://profile-avatar.csdnimg.cn/a04fdcff1a5a4d8dbb3777426204f918_qq_46439621.jpg!1",
					"html_url": "https://gitcode.com/qq_46439621"
				}
			}
		]
	},
	{
		"id": 176154300,
		"discussion_id": "65a5e77d725c2fadc5767b5cf87b1c0768e5ec95",
		"body": "compile",
		"created_at": "2026-06-17T19:16:16+08:00",
		"updated_at": "2026-06-17T19:16:16+08:00",
		"user": {
			"id": "68add47a5a5e89101cc24be9",
			"login": "qq_46439621",
			"object_id": "68add47a5a5e89101cc24be9",
			"name": "wanlongze123",
			"avatar_url": "https://profile-avatar.csdnimg.cn/a04fdcff1a5a4d8dbb3777426204f918_qq_46439621.jpg!1",
			"html_url": "https://gitcode.com/qq_46439621"
		},
		"comment_type": "pr_comment"
	},
	{
		"id": 176154384,
		"discussion_id": "221f5ed5b6a5a0356b01c27ab1993ebae95fd00e",
		"body": "Ascend docs pipeline is running...",
		"created_at": "2026-06-17T19:16:59+08:00",
		"updated_at": "2026-06-17T19:16:59+08:00",
		"user": {
			"id": "680e157b4e445c0df960c4c4",
			"login": "ascend-robot",
			"object_id": "680e157b4e445c0df960c4c4",
			"name": "ascend-robot",
			"avatar_url": "https://cdn-img.gitcode.com/ad/ec/4a22097de2cd8cd630c843b4fb17bd85bc7dd082a7e3a0e7089c373e836a3524.png?time=1753510752944",
			"html_url": "https://gitcode.com/ascend-robot"
		},
		"comment_type": "pr_comment"
	},
	{
		"id": 176154436,
		"discussion_id": "cecb497e92098108918623228fa268c9318da9d8",
		"body": "Ascend docs pipeline is running...",
		"created_at": "2026-06-17T19:17:41+08:00",
		"updated_at": "2026-06-17T19:17:41+08:00",
		"user": {
			"id": "680e157b4e445c0df960c4c4",
			"login": "ascend-robot",
			"object_id": "680e157b4e445c0df960c4c4",
			"name": "ascend-robot",
			"avatar_url": "https://cdn-img.gitcode.com/ad/ec/4a22097de2cd8cd630c843b4fb17bd85bc7dd082a7e3a0e7089c373e836a3524.png?time=1753510752944",
			"html_url": "https://gitcode.com/ascend-robot"
		},
		"comment_type": "pr_comment"
	},
	{
		"id": 176154446,
		"discussion_id": "34d83a4eaada1f984b9528608cb018401716a6f7",
		"body": "✅ 跳过 docs ci 检查，没有需要检查的文档文件",
		"created_at": "2026-06-17T19:17:51+08:00",
		"updated_at": "2026-06-17T19:17:51+08:00",
		"user": {
			"id": "680e157b4e445c0df960c4c4",
			"login": "ascend-robot",
			"object_id": "680e157b4e445c0df960c4c4",
			"name": "ascend-robot",
			"avatar_url": "https://cdn-img.gitcode.com/ad/ec/4a22097de2cd8cd630c843b4fb17bd85bc7dd082a7e3a0e7089c373e836a3524.png?time=1753510752944",
			"html_url": "https://gitcode.com/ascend-robot"
		},
		"comment_type": "pr_comment"
	},
	{
		"id": 176154487,
		"discussion_id": "b5fe935196440208e64a0711d3425d8e631f8e3d",
		"body": "✅ 跳过 docs ci 检查，没有需要检查的文档文件",
		"created_at": "2026-06-17T19:18:34+08:00",
		"updated_at": "2026-06-17T19:18:34+08:00",
		"user": {
			"id": "680e157b4e445c0df960c4c4",
			"login": "ascend-robot",
			"object_id": "680e157b4e445c0df960c4c4",
			"name": "ascend-robot",
			"avatar_url": "https://cdn-img.gitcode.com/ad/ec/4a22097de2cd8cd630c843b4fb17bd85bc7dd082a7e3a0e7089c373e836a3524.png?time=1753510752944",
			"html_url": "https://gitcode.com/ascend-robot"
		},
		"comment_type": "pr_comment"
	},
	{
		"id": 176156954,
		"discussion_id": "f292201c206f213cf9ea3a154a0d8a2792804087",
		"body": "<div style=\"margin-bottom: 20px\">流水线 <a href=\"https://www.openlibing.com/apps/pipelineDetail?projectId=300037&pipelineId=94d11f71c079458fbe60875ec7d658e4&pipelineRunId=5e795b4440274019b5779ab457471be1&codeHostingPlatformFlag=gitcode\">PR-pipeline_msmodelslim#1719</a>  [ commitID：50f2a196 ] 已完成</div>\n<div style=\"margin-bottom: 20px; font-size: 12px;\"><a href=\"https://www.openlibing.com/apps/pipelineDetail?projectId=300037&pipelineId=94d11f71c079458fbe60875ec7d658e4&pipelineRunId=5e795b4440274019b5779ab457471be1&codeHostingPlatformFlag=gitcode&openFlag=codeFix\">>>></a>代码风格自动修复执行成功（无修复内容）</div>\n<table class=\"access-control-table\" style=\"border-collapse: collapse; text-align: center; margin-bottom: 20px\">\n    <tr>\n        <th>阶段</th>\n        <th>任务名</th>\n        <th>状态</th>\n        <th>详情</th>\n    </tr>\n    <tr>\n        <td>编译构建</td>\n        <td>Build_msmodelslim</td>\n        <td>&#9989;</td>\n        <td><a href=\"https://www.openlibing.com/apps/pipelineDetail?projectId=300037&pipelineId=94d11f71c079458fbe60875ec7d658e4&pipelineRunId=5e795b4440274019b5779ab457471be1&stepId=7be950d7b38d4952b382cd45efce1045&jobRunId=bbfe45bc9df44b5db1650143b6dfa283&stepRunId=6238c752d41d42fd88e03db5827b682a&codeHostingPlatformFlag=gitcode\">>>></a></td>\n    </tr>\n    <tr>\n        <td>恶意代码检查</td>\n        <td>Antipoison_MindStudio-ModelSlim</td>\n        <td>&#9989;</td>\n        <td><a href=\"https://www.openlibing.com/apps/entryCheckNew/poisoningresult/6f1fe21f-ebe0-4e22-97f4-f8a78f0be8d6/MindStudio/msmodelslim?projectName=MindStudio&codeHostingPlatformFlag=gitcode\">>>></a></td>\n    </tr>\n    <tr>\n        <td>编码安全与规范检查</td>\n        <td>CodeCheck_MindStudio-ModelSlim</td>\n        <td>&#9989;</td>\n        <td><a href=\"https://www.openlibing.com/apps/pipelineDetail?projectId=300037&pipelineId=94d11f71c079458fbe60875ec7d658e4&pipelineRunId=5e795b4440274019b5779ab457471be1&stepId=68448131916044b5b5f0146dd9542320&jobRunId=0b5b8a94f1da4accb47928b2e6931e87&stepRunId=9a5ab9bbcd414fb09d6c925677e83ef0&codeHostingPlatformFlag=gitcode\">>>></a></td>\n    </tr>\n    <tr>\n        <td>开源片段检查</td>\n        <td>SCA_MindStudio-ModelSlim</td>\n        <td>&#9989;</td>\n        <td><a href=\"https://www.openlibing.com/apps/personalScandTaskInfor/person/45f09e4c-d897-4f4b-89ce-549678a2742a?projectId=300037&codeHostingPlatformFlag=gitcode&projectName=null\">>>></a></td>\n    </tr>\n    <tr>\n        <td rowspan=\"2\">开发者测试</td>\n        <td>UT_msmodelslim</td>\n        <td>&#9989;</td>\n        <td><a href=\"https://www.openlibing.com/apps/pipelineDetail?projectId=300037&pipelineId=94d11f71c079458fbe60875ec7d658e4&pipelineRunId=5e795b4440274019b5779ab457471be1&stepId=e3842b54b3d74fc38c593c3fef771ad1&jobRunId=c22e7fbbcdbc49cc8d30aec5ea70b4cc&stepRunId=4ba027db1f2d4b908f9750db05290a2c&codeHostingPlatformFlag=gitcode\">>>></a></td>\n    </tr>\n    <tr>\n        <td>PreSmoke_msmodelslim</td>\n        <td>&#9989;</td>\n        <td><a href=\"https://www.openlibing.com/apps/pipelineDetail?projectId=300037&pipelineId=94d11f71c079458fbe60875ec7d658e4&pipelineRunId=5e795b4440274019b5779ab457471be1&stepId=e3842b54b3d74fc38c593c3fef771ad1&jobRunId=fd4239200f1840d588cccc10d38f091b&stepRunId=9c42066ba9fd429ca2dd389de9080a44&codeHostingPlatformFlag=gitcode\">>>></a></td>\n    </tr>\n    <tr>\n        <td>流水线</td>\n        <td>PR-pipeline_msmodelslim</td>\n        <td>&#9989;</td>\n        <td><a href=\"https://www.openlibing.com/apps/pipelineDetail?projectId=300037&pipelineId=94d11f71c079458fbe60875ec7d658e4&pipelineRunId=5e795b4440274019b5779ab457471be1&codeHostingPlatformFlag=gitcode\">>>></a></td>\n    </tr>\n</table><span style=\"font-size: 12px; font-style: oblique\">此流水线已支持下列评论快捷指令，仅PR创建者和白名单成员评论有效</span>\n<ul style=\"font-size: 14px; margin-top: 6px; padding-left: 20px;\">\n<li style=\"font-size: 14px;\">\n<span style=\"font-size: 12px; padding: 2px; background-color: #f8f8f8; border: solid 1px #e7eaed; border-radius: 4px; margin-right: 4px;\">compile</span> : <span style=\"font-size: 12px;\">运行流水线</span>\n</li>\n<li style=\"font-size: 14px;\">\n<span style=\"font-size: 12px; padding: 2px; background-color: #f8f8f8; border: solid 1px #e7eaed; border-radius: 4px; margin-right: 4px;\">retry</span> : <span style=\"font-size: 12px;\">重试流水线所有失败子任务</span>\n</li>\n<li style=\"font-size: 14px;\">\n<span style=\"font-size: 12px; padding: 2px; background-color: #f8f8f8; border: solid 1px #e7eaed; border-radius: 4px; margin-right: 4px;\">retry &lt;任务名&gt;</span> : <span style=\"font-size: 12px;\">仅重试指定失败子任务</span>\n</li>\n<li style=\"font-size: 14px;\">\n<span style=\"font-size: 12px; padding: 2px; background-color: #f8f8f8; border: solid 1px #e7eaed; border-radius: 4px; margin-right: 4px;\">stop</span> : <span style=\"font-size: 12px;\">停止流水线</span>\n</li>\n</ul>",
		"created_at": "2026-06-17T19:41:20+08:00",
		"updated_at": "2026-06-17T19:41:20+08:00",
		"user": {
			"id": "680e157b4e445c0df960c4c4",
			"login": "ascend-robot",
			"object_id": "680e157b4e445c0df960c4c4",
			"name": "ascend-robot",
			"avatar_url": "https://cdn-img.gitcode.com/ad/ec/4a22097de2cd8cd630c843b4fb17bd85bc7dd082a7e3a0e7089c373e836a3524.png?time=1753510752944",
			"html_url": "https://gitcode.com/ascend-robot"
		},
		"comment_type": "pr_comment"
	},
	{
		"id": 176156955,
		"discussion_id": "3cc02ec179ee21c8617a5da7ed46ea126a7b3e7e",
		"body": "<div style=\"margin-bottom: 20px\">流水线 <a href=\"https://www.openlibing.com/apps/pipelineDetail?projectId=300037&pipelineId=94d11f71c079458fbe60875ec7d658e4&pipelineRunId=5e795b4440274019b5779ab457471be1&codeHostingPlatformFlag=gitcode\">PR-pipeline_msmodelslim#1719</a>  [ commitID：50f2a196 ] 已完成</div>\n<div style=\"margin-bottom: 20px; font-size: 12px;\"><a href=\"https://www.openlibing.com/apps/pipelineDetail?projectId=300037&pipelineId=94d11f71c079458fbe60875ec7d658e4&pipelineRunId=5e795b4440274019b5779ab457471be1&codeHostingPlatformFlag=gitcode&openFlag=codeFix\">>>></a>代码风格自动修复执行成功（无修复内容）</div>\n<table class=\"access-control-table\" style=\"border-collapse: collapse; text-align: center; margin-bottom: 20px\">\n    <tr>\n        <th>阶段</th>\n        <th>任务名</th>\n        <th>状态</th>\n        <th>详情</th>\n    </tr>\n    <tr>\n        <td>编译构建</td>\n        <td>Build_msmodelslim</td>\n        <td>&#9989;</td>\n        <td><a href=\"https://www.openlibing.com/apps/pipelineDetail?projectId=300037&pipelineId=94d11f71c079458fbe60875ec7d658e4&pipelineRunId=5e795b4440274019b5779ab457471be1&stepId=7be950d7b38d4952b382cd45efce1045&jobRunId=bbfe45bc9df44b5db1650143b6dfa283&stepRunId=6238c752d41d42fd88e03db5827b682a&codeHostingPlatformFlag=gitcode\">>>></a></td>\n    </tr>\n    <tr>\n        <td>恶意代码检查</td>\n        <td>Antipoison_MindStudio-ModelSlim</td>\n        <td>&#9989;</td>\n        <td><a href=\"https://www.openlibing.com/apps/entryCheckNew/poisoningresult/6f1fe21f-ebe0-4e22-97f4-f8a78f0be8d6/MindStudio/msmodelslim?projectName=MindStudio&codeHostingPlatformFlag=gitcode\">>>></a></td>\n    </tr>\n    <tr>\n        <td>编码安全与规范检查</td>\n        <td>CodeCheck_MindStudio-ModelSlim</td>\n        <td>&#9989;</td>\n        <td><a href=\"https://www.openlibing.com/apps/pipelineDetail?projectId=300037&pipelineId=94d11f71c079458fbe60875ec7d658e4&pipelineRunId=5e795b4440274019b5779ab457471be1&stepId=68448131916044b5b5f0146dd9542320&jobRunId=0b5b8a94f1da4accb47928b2e6931e87&stepRunId=9a5ab9bbcd414fb09d6c925677e83ef0&codeHostingPlatformFlag=gitcode\">>>></a></td>\n    </tr>\n    <tr>\n        <td>开源片段检查</td>\n        <td>SCA_MindStudio-ModelSlim</td>\n        <td>&#9989;</td>\n        <td><a href=\"https://www.openlibing.com/apps/personalScandTaskInfor/person/45f09e4c-d897-4f4b-89ce-549678a2742a?projectId=300037&codeHostingPlatformFlag=gitcode&projectName=null\">>>></a></td>\n    </tr>\n    <tr>\n        <td rowspan=\"2\">开发者测试</td>\n        <td>UT_msmodelslim</td>\n        <td>&#9989;</td>\n        <td><a href=\"https://www.openlibing.com/apps/pipelineDetail?projectId=300037&pipelineId=94d11f71c079458fbe60875ec7d658e4&pipelineRunId=5e795b4440274019b5779ab457471be1&stepId=e3842b54b3d74fc38c593c3fef771ad1&jobRunId=c22e7fbbcdbc49cc8d30aec5ea70b4cc&stepRunId=4ba027db1f2d4b908f9750db05290a2c&codeHostingPlatformFlag=gitcode\">>>></a></td>\n    </tr>\n    <tr>\n        <td>PreSmoke_msmodelslim</td>\n        <td>&#9989;</td>\n        <td><a href=\"https://www.openlibing.com/apps/pipelineDetail?projectId=300037&pipelineId=94d11f71c079458fbe60875ec7d658e4&pipelineRunId=5e795b4440274019b5779ab457471be1&stepId=e3842b54b3d74fc38c593c3fef771ad1&jobRunId=fd4239200f1840d588cccc10d38f091b&stepRunId=9c42066ba9fd429ca2dd389de9080a44&codeHostingPlatformFlag=gitcode\">>>></a></td>\n    </tr>\n    <tr>\n        <td>流水线</td>\n        <td>PR-pipeline_msmodelslim</td>\n        <td>&#9989;</td>\n        <td><a href=\"https://www.openlibing.com/apps/pipelineDetail?projectId=300037&pipelineId=94d11f71c079458fbe60875ec7d658e4&pipelineRunId=5e795b4440274019b5779ab457471be1&codeHostingPlatformFlag=gitcode\">>>></a></td>\n    </tr>\n</table><span style=\"font-size: 12px; font-style: oblique\">此流水线已支持下列评论快捷指令，仅PR创建者和白名单成员评论有效</span>\n<ul style=\"font-size: 14px; margin-top: 6px; padding-left: 20px;\">\n<li style=\"font-size: 14px;\">\n<span style=\"font-size: 12px; padding: 2px; background-color: #f8f8f8; border: solid 1px #e7eaed; border-radius: 4px; margin-right: 4px;\">compile</span> : <span style=\"font-size: 12px;\">运行流水线</span>\n</li>\n<li style=\"font-size: 14px;\">\n<span style=\"font-size: 12px; padding: 2px; background-color: #f8f8f8; border: solid 1px #e7eaed; border-radius: 4px; margin-right: 4px;\">retry</span> : <span style=\"font-size: 12px;\">重试流水线所有失败子任务</span>\n</li>\n<li style=\"font-size: 14px;\">\n<span style=\"font-size: 12px; padding: 2px; background-color: #f8f8f8; border: solid 1px #e7eaed; border-radius: 4px; margin-right: 4px;\">retry &lt;任务名&gt;</span> : <span style=\"font-size: 12px;\">仅重试指定失败子任务</span>\n</li>\n<li style=\"font-size: 14px;\">\n<span style=\"font-size: 12px; padding: 2px; background-color: #f8f8f8; border: solid 1px #e7eaed; border-radius: 4px; margin-right: 4px;\">stop</span> : <span style=\"font-size: 12px;\">停止流水线</span>\n</li>\n</ul>",
		"created_at": "2026-06-17T19:41:21+08:00",
		"updated_at": "2026-06-17T19:41:21+08:00",
		"user": {
			"id": "680e157b4e445c0df960c4c4",
			"login": "ascend-robot",
			"object_id": "680e157b4e445c0df960c4c4",
			"name": "ascend-robot",
			"avatar_url": "https://cdn-img.gitcode.com/ad/ec/4a22097de2cd8cd630c843b4fb17bd85bc7dd082a7e3a0e7089c373e836a3524.png?time=1753510752944",
			"html_url": "https://gitcode.com/ascend-robot"
		},
		"comment_type": "pr_comment"
	},
	{
		"id": 176157991,
		"discussion_id": "02564a3e864addd5a27f6a321a82944c0ddbe65b",
		"body": "解释一下这里的作用，和之前的都存在差异",
		"created_at": "2026-06-17T19:48:56+08:00",
		"updated_at": "2026-06-17T19:58:47+08:00",
		"user": {
			"id": "6822c9b2398335026946a660",
			"login": "yejiajun",
			"object_id": "6822c9b2398335026946a660",
			"name": "yejj",
			"html_url": "https://gitcode.com/yejiajun"
		},
		"comment_type": "diff_comment",
		"resolved": true,
		"diff_position": {
			"start_new_line": 35,
			"end_new_line": 35,
			"position_type": "text"
		}
	},
	{
		"id": 176159365,
		"discussion_id": "bde97e333575731937c56f11282d27f3b1103ba9",
		"body": "/lgtm",
		"created_at": "2026-06-17T19:58:51+08:00",
		"updated_at": "2026-06-17T19:58:51+08:00",
		"user": {
			"id": "6822c9b2398335026946a660",
			"login": "yejiajun",
			"object_id": "6822c9b2398335026946a660",
			"name": "yejj",
			"html_url": "https://gitcode.com/yejiajun"
		},
		"comment_type": "pr_comment"
	},
	{
		"id": 176159605,
		"discussion_id": "8881501bf80ac2582b34c84bb951f5f7db7d3613",
		"body": "/lgtm\n/approve",
		"created_at": "2026-06-17T19:59:59+08:00",
		"updated_at": "2026-06-17T19:59:59+08:00",
		"user": {
			"id": "68afc34af4848b5858dfd33b",
			"login": "keith_wa",
			"object_id": "68afc34af4848b5858dfd33b",
			"name": "keith_wa",
			"html_url": "https://gitcode.com/keith_wa"
		},
		"comment_type": "pr_comment"
	},
	{
		"id": 176159678,
		"discussion_id": "30d050841ae8cd8d46e4b7da86baf0872abaea71",
		"body": "Pull Request 已合并或已关闭。\n\nIf you want to solve this problem, [you can click here to do it in the **<font color=red>_FAQs_</font>**](https://gitcode.com/ascend/infrastructure/blob/master/docs/robot/robot%E4%BD%BF%E7%94%A8%E6%8C%87%E5%8D%97.md#-faq).",
		"created_at": "2026-06-17T20:00:20+08:00",
		"updated_at": "2026-06-17T20:00:20+08:00",
		"user": {
			"id": "680e157b4e445c0df960c4c4",
			"login": "ascend-robot",
			"object_id": "680e157b4e445c0df960c4c4",
			"name": "ascend-robot",
			"avatar_url": "https://cdn-img.gitcode.com/ad/ec/4a22097de2cd8cd630c843b4fb17bd85bc7dd082a7e3a0e7089c373e836a3524.png?time=1753510752944",
			"html_url": "https://gitcode.com/ascend-robot"
		},
		"comment_type": "pr_comment"
	}
]
```