
# Edit Pull Request Comment API

## API Description

This API allows users to edit an existing comment on a pull request in a repository. Users can update the content of the comment.

## Endpoints

```
PATCH https://api.gitcode.com/api/v5/repos/:owner/:repo/pulls/comments/:comment_id
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
  --url 'https://api.gitcode.com/api/v5/repos/tangxuanya/ai_test/pulls/comments/177890221?access_token=xxxxxxxxxxxxxxxx' \
  --H 'Content-Type: application/json' \
  --data-raw '{
    "body": "new changed comment"
  }'
```

## Example Request Body

```json
{
  "body": "new changed comment"
}
```

## Example Response

200 OK
