# Delete Related Issue from Pull Request API

## API Description

This API allows users to delete a related issue from a pull request, removing the connection between the pull request and the issue.
## Endpoints

```
DELETE https://api.gitcode.com/api/v5/repos/:owner/:repo/pulls/:number/issues
```

## Path Variables

- `owner`: Repository Owner Path (Organization or User Path).
- `repo`: Repository Path.
- `number`: Pull Request Number.

## Query Parameters

- `access_token`: (Required) The access token for authentication.

## Request Body

```json
[
    # integer Which issue number, the ordinal number of the Issue in this repository
]
```

## Example Request

```bash
curl --request DELETE \
  --url 'https://api.gitcode.com/api/v5/repos/tangxuanya/ai_test/pulls/2/issues?access_token=xxxxxxxxxxxxxxxxxx' \
  --header 'Content-Type: application/json' \
  --data '[
	1
]'
```

## Example Response

200 OK

```json
[]
```