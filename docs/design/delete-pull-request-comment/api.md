# Delete Pull Request Comment API

## API Description

This API allows users to delete a comment from a pull request.
## Endpoints

```
DELETE https://api.gitcode.com/api/v5/repos/:owner/:repo/pulls/comments/:id
```

## Path Variables

- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: Repository Path.
- `id`: Comment ID.

## Query Parameters

- `access_token`: (Required) The access token for authentication.

## Request Body

```json
[
    # integer Which comment ID, the ordinal number of the Comment in this repository
]
```

## Example Request

```bash
curl --request DELETE \
  --url 'https://api.gitcode.com/api/v5/repos/tangxuanya/ai_test/pulls/comments/2?access_token=xxxxxxxxxxxxxxxxxx' 
```

## Example Response

200 OK
