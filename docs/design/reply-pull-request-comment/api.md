# Reply Pull Request Comment

## Description

This API is used to reply to a comment on a pull request.
## API Endpoint

POST `https://api.gitcode.com/api/v5/repos/:owner/:repo/pulls/:number/discussions/:discussion_id/comments`

## Path variables
- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: Repository Name Path.
- `number`: Pull Request Number.
- `discussion_id`: Discussion ID.

## Query Parameters
- `access_token`: (Required) The access token for authentication.

## Request Body
```json
{
    "body": "Comment content"
}
```

## Example Request

```bash
curl --request POST \
  --url 'https://api.gitcode.com/api/v5/repos/tangxuanya/msmodelslim/pulls/2/discussions/73b1babf3cff8703f99ac535510a4d11765d658f/comments?access_token=xxxxxxxxxxxxxxx' \
  --header 'Content-Type: application/json' \
  --data '{
	"body": "test reply"
}'
```

## Response
200 OK

```json
{
	"id": "73b1babf3cff8703f99ac535510a4d11765d658f",
	"body": "test reply",
	"note_id": 178162257
}
```