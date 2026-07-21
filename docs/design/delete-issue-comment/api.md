# Delete Issue Comment API

## API Description

This API allows users to delete a comment from an issue.
## Endpoints

```
DELETE https://api.gitcode.com/api/v5/repos/:owner/:repo/issues/comments/:id
```

## Path Variables

- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: Repository Path.
- `id`: Comment ID.

## Query Parameters

- `access_token`: (Required) The access token for authentication.



## Example Request

```bash
curl --request DELETE \
  --url 'https://api.gitcode.com/api/v5/repos/tangxuanya/ai_test/issues/comments/180799302' \
  --header 'Authorization: Bearer xxxxxxxxxxxxxxxxxx' 
```

## Example Response

200 OK
