# Cancel Assignee API

## API Description

This API allows users to cancel assignees for a specific pull request.

## Endpoints

```
DELETE https://api.gitcode.com/api/v5/repos/:owner/:repo/pulls/:number/assignees
```

## Path Variables

- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: 	Repository Path(path).
- `number`: Pull Request Number.

## Query Parameters

- `access_token`: (Required) The access token for authentication.'
- `assignees`: (Required) The assignees to be canceled. It can be a single assignee or multiple assignees separated by commas.

## Example Request

```bash
curl --request DELETE \
  --url 'https://api.gitcode.com/api/v5/repos/tangxuanya/ai_test/pulls/2/assignees?assignees=xuanxuantan' \
  --header 'Authorization: Bearer xxxxxxxxxxxxxxx'
```

## Example Response

204 No Content
