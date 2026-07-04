# List Reviewers API

## API Description

This API allows users to list reviewers for a specific repository.

## Endpoints

```
GET https://api.gitcode.com/api/v5/repos/:owner/:repo/pulls/:number/option_reviewers
```

## Path Variables

- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: 	Repository Path(path).
- `number`: Pull Request Number.

## Query Parameters

- `access_token`: (Required) The access token for authentication.

## Example Request

```bash
curl --request GET \
  --url 'https://api.gitcode.com/api/v5/repos/tangxuanya/ai_test/pulls/2/option_reviewers' \
  --header 'Authorization: Bearer xxxxxxxxxxxxxxxx' 
```

## Example Response

```json
[
	{
		"id": 11897222,
		"login": "xuanxuantan",
		"name": "xuanxuantan",
		"object_id": "6a4717e8b625670e4e839bb2"
	}
]
```
