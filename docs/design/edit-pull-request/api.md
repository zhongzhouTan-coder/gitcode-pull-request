
# Edit Pull Request API

## API Description

This API allows users to edit an existing pull request in a repository. Users
can update the title, description, and supported pull request preferences.

## Endpoints

```
PATCH https://api.gitcode.com/api/v5/repos/:owner/:repo/pulls/:number
```

## Path Variables

- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: 	Repository Path(path).
- `number`: Pull Request number.

## Query Parameters

- `access_token`: (Required) The access token for authentication.

## Request Body

The request body should be in JSON format and include the following fields:

- `title` string required Required. Pull Request title
- `body` string Optional. Content of the Pull Request
- `state` string Optional. The state of the Pull Request, can be set to "open" or "closed".
- `milestone_number` integer Optional. Milestone sequence number (id)
- `labels` string A comma-separated list of labels, where the name must be between 2-20 characters long and cannot contain special characters. For example: bug,performance
- `draft` boolean Optional. Whether to set as draft. Default false
- `close_related_issue` boolean Optional. Whether to close associated Issues after merging, default is set according to the repository configuration
- `prune_branch` boolean Optional. Whether to merge and delete the source branch, default is set according to the repository configuration
- `squash_merge` boolean Optional. Whether to squash merge, default is set according to the repository configuration

## Example Request

```bash
curl --request PATCH \
  --url 'https://api.gitcode.com/api/v5/repos/tangxuanya/ai_test/pulls/2?access_token=xxxxxxxxxxxxxxxx'
```

## Example Request Body

```json
{
  "title": "TEST AI",
  "body": "test some ai function patch api",
  "state": "open",
  "milestone_number": 0,
  "labels": "bug,duplicate",
  "draft": false,
  "close_related_issue": true,
  "prune_branch": false,
  "squash_merge": false
}
```

## Example Response

```json
{
	"title": "TEST AI",
	"body": "test some ai function patch api",
	"state": "opened",
	"created_at": "2026-06-27T15:23:10+08:00",
	"updated_at": "2026-06-27T15:28:41+08:00"
}
```
