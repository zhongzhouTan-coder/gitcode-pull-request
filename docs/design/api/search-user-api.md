
# search-user-api

## API Description

This API allows users to search for users in the system.

## Endpoints

```
GET https://api.gitcode.com/api/v5/search/users
```

## Query Parameters

- `access_token`: (Required) The access token for authentication.
- `q`: (Required) The search query.
- `page`: (Optional) The page number of the results to fetch. Defaults to 1.
- `per_page`: (Optional) The number of results per page. Defaults to 30.

## Example Request

```bash
curl --request GET \
  --url 'https://api.gitcode.com/api/v5/search/users?q=tangxuanya&access_token=xxxxxxxxxxxxxxxx'
```

## Example Response

```json
[
	{
		"created_at": "2025-12-30T10:22:01+08:00",
		"html_url": "https://gitcode.com/tangxuanya",
		"id": "9591287",
		"login": "tangxuanya",
		"name": "tangxuanya"
	}
]
```
