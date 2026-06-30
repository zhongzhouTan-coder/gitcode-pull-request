
# Create a comment in a pull request API

## API Description

This API allows users to create an inline comment in a pull request.

## Endpoints

```
POST https://api.gitcode.com/api/v5/repos/:owner/:repo/pulls/:number/comments
```

## Path Variables

- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: Repository Path.
- `number`: Pull Request Number.

## Query Parameters

- `access_token`: (Required) The access token for authentication.

## Request Body

```json
{
	"body": "comment content",
	"path": "Relative path of the file",
	"position": 16, # Number of code lines
	"position_type": "\"binary\": File-level comment, \"text\": line-level comment. Default is \"text\", when \"binary\" is passed, position no longer takes effect."
}
```

## Example Request

```bash
curl --request POST \
  --url 'https://api.gitcode.com/api/v5/repos/tangxuanya/msmodelslim/pulls/2/comments?access_token=xxxxxxxxxxxxxxxxxxx'
```

## Example Request Body

```json
{
	"body": "test comment",
	"path": "README.md",
	"position": 16,
	"position_type": "text"
}
```

## Example Response

```json
{
	"id": "73b1babf3cff8703f99ac535510a4d11765d658f",
	"body": "test comment",
	"note_id": 177884521
}
```
