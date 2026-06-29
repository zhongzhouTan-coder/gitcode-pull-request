# create a pull request API

## API Description

This API allows users to create a pull request in a repository.

## Endpoints

```
POST https://api.gitcode.com/api/v5/repos/:owner/:repo/pulls
```

## Path Variables
- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: 	Repository Path(path).

## Query Parameters
- `access_token`: (Required) The access token for authentication.

## Request Body
The request body should be in JSON format and include the following fields:
- `title` string required Required. Pull Request title
- `head` string required Required. The source branch of the Pull Request submission. Format: branch. If cross-repository PR, pass: username:branch
- `base` string required Required. The name of the target branch for the Pull Request submission.
- `body` string Optional. Content of the Pull Request
- `milestone_number` integer Optional. Milestone sequence number (id)
- `labels` string A comma-separated list of labels, where the name must be between 2-20 characters long and cannot contain special characters. For example: bug,performance
- `issue` string Optional. The title and body of the Pull Request can be automatically filled based on the specified Issue ID.
- `assignees` string Optional. Reviewers' usernames, multiple can be specified, separated by half-width commas, e.g., (username1,username2). Note: This option is invalid when the repository code review settings have already set 【Assign Reviewers】.
- `testers` string Optional. Testers' username, multiple usernames can be provided, separated by half-width commas, e.g., (username1,username2). Note: This option is invalid when the repository code review settings have already set 【Assign Testers】.
- `prune_source_branch` boolean Optional. Whether to delete the source branch after merging the PR. Defaults to false (do not delete).
- `draft` boolean Optional. Whether to set as draft. Default false
- `squash` boolean Optional. When using flat (squash) merging while accepting a Pull Request, defaults to false.
- `squash_commit_message` string Optional. Squash commit messages.
- `fork_path` string Optional. Fork project path 【owner/repo】, required for cross-repository PRs.
- `close_related_issue` boolean Optional. Whether to close associated Issues after merging, default is set according to the repository configuration

## Example Request

```bash
curl --request POST \
  --url 'https://api.gitcode.com/api/v5/repos/tangxuanya/ai_test/pulls?access_token=xxxxxxxxxxxxxxxx'
```

## Example Request Body

```json
{
  "title": "TEST AI",
  "head": "new_branch_1",
  "base": "main",
	 "body": "test some ai function",
  "milestone_number": 0,
  "labels": "bug",
  "issue": "",
  "assignees": "tangxuanya",
  "testers": "tangxuanya",
  "prune_source_branch": true,
  "draft": true,
  "squash": true,
  "squash_commit_message": "message",
  "fork_path": "",
  "close_related_issue": true
}
```

## Example Response

```json
{
	"id": 8793937,
	"iid": 2,
	"project_id": 10233341,
	"title": "[WIP]TEST AI",
	"description": "test some ai function",
	"state": "opened",
	"created_at": "2026-06-27T15:23:10+08:00",
	"updated_at": "2026-06-27T15:23:11+08:00",
	"target_branch": "main",
	"source_branch": "new_branch_1",
	"squash_commit_message": "message",
	"user_notes_count": 0,
	"upvotes": 0,
	"downvotes": 0,
	"author": {
		"id": 9573307,
		"name": "tangxuanya",
		"username": "tangxuanya",
		"iam_id": "OkHqxXUduQJpeUFmvagZMsIrlr99OSb6",
		"state": "active",
		"email": "cqyzdp1@163.com",
		"name_cn": "",
		"web_url": "https://gitcode.com/tangxuanya",
		"nick_name": "tangxuanya"
	},
	"source_project_id": 10233341,
	"target_project_id": 10233341,
	"labels": [
		{
			"id": 13244332,
			"color": "#ED4014",
			"name": "bug",
			"repository_id": 10233341,
			"created_at": "2026-06-27T15:22:10+08:00",
			"updated_at": "2026-06-27T15:23:11+08:00"
		}
	],
	"work_in_progress": true,
	"merge_when_pipeline_succeeds": false,
	"merge_status": "unchecked",
	"sha": "d594a6b1390028ff94d0dc324ed63dc0adeb4ebe",
	"should_remove_source_branch": false,
	"force_remove_source_branch": true,
	"web_url": "https://gitcode.com/tangxuanya/ai_test/merge_requests/2",
	"time_stats": {
		"total_time_spent": 0
	},
	"squash": true,
	"merge_request_type": "MergeRequest",
	"has_pre_merge_ref": false,
	"review_mode": "approval",
	"is_source_branch_exist": true,
	"approval_merge_request_reviewers": [],
	"approval_merge_request_approvers": [],
	"source_project": {
		"id": 10233341,
		"description": "",
		"name": "ai_test",
		"name_with_namespace": "tangxuanya / ai_test",
		"path": "ai_test",
		"path_with_namespace": "tangxuanya/ai_test",
		"develop_mode": "normal",
		"created_at": "2026-06-27T15:18:40.674+08:00",
		"updated_at": "2026-06-27T15:18:40.674+08:00",
		"archived": false,
		"is_kia": false,
		"ssh_url_to_repo": "git@gitcode.com:tangxuanya/ai_test.git",
		"http_url_to_repo": "https://gitcode.com/tangxuanya/ai_test.git",
		"web_url": "https://gitcode.com/tangxuanya/ai_test",
		"readme_url": "https://gitcode.com/tangxuanya/ai_test/blob/main/README.md",
		"license": {
			"key": "Apache_License_v2.0"
		},
		"star_count": 0,
		"forks_count": 0,
		"repo_type": "0",
		"last_repository_updated_at": "2026-06-27T15:18:40.674+08:00",
		"default_branch": "main",
		"tag_list": [],
		"open_issues_count": 0,
		"open_merge_requests_count": 2,
		"release_count": 0,
		"last_activity_at": "2026-06-27T15:18:41.840+08:00",
		"namespace": {
			"id": 11448161,
			"name": "tangxuanya",
			"path": "tangxuanya",
			"develop_mode": "normal",
			"kind": "user",
			"full_path": "tangxuanya",
			"full_name": "tangxuanya",
			"visibility_level": 20,
			"enable_file_control": false,
			"owner_id": 9573307
		},
		"empty_repo": false,
		"starred": false,
		"visibility": "public",
		"security": "internal",
		"has_updated_kia": false,
		"network_type": "green",
		"owner": {
			"id": 9573307,
			"name": "tangxuanya",
			"username": "tangxuanya",
			"iam_id": "OkHqxXUduQJpeUFmvagZMsIrlr99OSb6",
			"state": "active",
			"email": "cqyzdp1@163.com",
			"name_cn": "",
			"web_url": "https://gitcode.com/tangxuanya",
			"nick_name": "tangxuanya"
		},
		"creator": {
			"id": 9573307,
			"name": "tangxuanya",
			"username": "tangxuanya",
			"iam_id": "OkHqxXUduQJpeUFmvagZMsIrlr99OSb6",
			"state": "active",
			"email": "cqyzdp1@163.com",
			"name_cn": "",
			"web_url": "https://gitcode.com/tangxuanya",
			"nick_name": "tangxuanya"
		},
		"creator_id": 9573307,
		"item_type": "Project",
		"main_repository_language": [
			null,
			null
		]
	},
	"target_project": {
		"id": 10233341,
		"description": "",
		"name": "ai_test",
		"name_with_namespace": "tangxuanya / ai_test",
		"path": "ai_test",
		"path_with_namespace": "tangxuanya/ai_test",
		"develop_mode": "normal",
		"created_at": "2026-06-27T15:18:40.674+08:00",
		"updated_at": "2026-06-27T15:18:40.674+08:00",
		"archived": false,
		"is_kia": false,
		"ssh_url_to_repo": "git@gitcode.com:tangxuanya/ai_test.git",
		"http_url_to_repo": "https://gitcode.com/tangxuanya/ai_test.git",
		"web_url": "https://gitcode.com/tangxuanya/ai_test",
		"readme_url": "https://gitcode.com/tangxuanya/ai_test/blob/main/README.md",
		"license": {
			"key": "Apache_License_v2.0"
		},
		"star_count": 0,
		"forks_count": 0,
		"repo_type": "0",
		"last_repository_updated_at": "2026-06-27T15:18:40.674+08:00",
		"default_branch": "main",
		"tag_list": [],
		"open_issues_count": 0,
		"open_merge_requests_count": 2,
		"release_count": 0,
		"last_activity_at": "2026-06-27T15:18:41.840+08:00",
		"namespace": {
			"id": 11448161,
			"name": "tangxuanya",
			"path": "tangxuanya",
			"develop_mode": "normal",
			"kind": "user",
			"full_path": "tangxuanya",
			"full_name": "tangxuanya",
			"visibility_level": 20,
			"enable_file_control": false,
			"owner_id": 9573307
		},
		"empty_repo": false,
		"starred": false,
		"visibility": "public",
		"security": "internal",
		"has_updated_kia": false,
		"network_type": "green",
		"owner": {
			"id": 9573307,
			"name": "tangxuanya",
			"username": "tangxuanya",
			"iam_id": "OkHqxXUduQJpeUFmvagZMsIrlr99OSb6",
			"state": "active",
			"email": "cqyzdp1@163.com",
			"name_cn": "",
			"web_url": "https://gitcode.com/tangxuanya",
			"nick_name": "tangxuanya"
		},
		"creator": {
			"id": 9573307,
			"name": "tangxuanya",
			"username": "tangxuanya",
			"iam_id": "OkHqxXUduQJpeUFmvagZMsIrlr99OSb6",
			"state": "active",
			"email": "cqyzdp1@163.com",
			"name_cn": "",
			"web_url": "https://gitcode.com/tangxuanya",
			"nick_name": "tangxuanya"
		},
		"creator_id": 9573307,
		"item_type": "Project",
		"main_repository_language": [
			null,
			null
		]
	},
	"added_lines": 1,
	"removed_lines": 0,
	"subscribed": true,
	"changes_count": "1",
	"diff_refs": {
		"base_sha": "dd29456a0da460d26145acaa947bc2d729c58b01",
		"head_sha": "d594a6b1390028ff94d0dc324ed63dc0adeb4ebe",
		"start_sha": "dd29456a0da460d26145acaa947bc2d729c58b01"
	},
	"merge_request_assignee_list": [],
	"merge_request_reviewer_list": [],
	"user": {},
	"merge_request_review_count": 0,
	"merge_request_reviewers_count": 0,
	"notes": 0,
	"unresolved_discussions_count": 0,
	"e2e_issues": [],
	"gate_check": true,
	"pipeline_status": "",
	"codequality_status": "success",
	"pipeline_status_with_code_quality": "",
	"from_forked_project": false,
	"can_delete_source_branch": true,
	"required_reviewers": [],
	"omega_mode": false,
	"source_git_url": "git@gitcode.com:tangxuanya/ai_test.git",
	"approval_merge_request_testers": [],
	"number": 2
}
```