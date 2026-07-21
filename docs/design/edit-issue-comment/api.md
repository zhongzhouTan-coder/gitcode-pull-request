
# Edit Issue Comment API

## API Description

This API allows users to edit an existing comment on an issue in a repository. Users can update the content of the comment.

## Endpoints

```
PATCH https://api.gitcode.com/api/v5/repos/:owner/:repo/issues/comments/:comment_id
```

## Path Variables

- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: 	Repository Path(path).
- `comment_id`: Comment ID.

## Query Parameters

- `access_token`: (Required) The access token for authentication.

## Request Body

```json
{
  "body": "Updated comment content"
}
```

## Example Request

```bash
curl --request PATCH \
  --url 'https://api.gitcode.com/api/v5/repos/tangxuanya/ai_test/issues/comments/180857638' \
  --header 'Authorization: Bearer xxxxxxxxxxxxxxxxxxxxx' \
  --header 'Content-Type: application/json' \
  --data '{
	"body": "new content"
}'
```

## Example Response

200 OK
