# Revised comments and inspection opinions, status resolved

## API Description

This API allows users to revise the status of comments and inspection opinions in a pull request, marking them as resolved or unresolved.

## Endpoints

```
PUT https://api.gitcode.com/api/v5/repos/:owner/:repo/pulls/:number/comments/:discussion_id
```

## Path Variables

- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: Repository Path.
- `number`: Pull Request Number.
- `discussion_id`: The discussion ID of the comment or inspection opinion to be revised.

## Query Parameters

- `access_token`: (Required) The access token for authentication.

## Request Body

```json
{
	"resolved": true # Has it been resolved?
}
```

## Example Request

```bash
curl --request PUT \
  --url 'https://api.gitcode.com/api/v5/repos/tangxuanya/msmodelslim/pulls/2/comments/73b1babf3cff8703f99ac535510a4d11765d658f?access_token=xxxxxxxxxxxxxxxxxxx'
```

## Example Request Body

```json
{
	"resolved": true
}
```

## Example Response

```json
{}
```